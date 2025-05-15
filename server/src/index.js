// Load environment variables
require('dotenv').config();

const express = require('express');
const Parser = require('rss-parser');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const { format } = require('date-fns');
const fs = require('fs');
const { htmlToText } = require('html-to-text');
const Groq = require('groq-sdk');
const axios = require('axios');
const cheerio = require('cheerio');

// Initialize Groq client (conditionally)
let groq = null;
try {
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'YOUR_GROQ_API_KEY') {
    groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
    console.log('Groq client initialized successfully');
  } else {
    console.warn('GROQ_API_KEY not set or using placeholder value. Summarization will be disabled.');
  }
} catch (error) {
  console.warn('Failed to initialize Groq client:', error.message);
}

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;
const UPDATE_INTERVAL = parseInt(process.env.UPDATE_INTERVAL || 300000); // Default: 5 minutes
const DB_PATH = process.env.DB_PATH || './data/news.db';
const AUTO_SUMMARIZE = process.env.AUTO_SUMMARIZE !== 'false'; // Default: true

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Enable CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*'
}));
app.use(express.json());

// Serve politician images as static files
app.use('/politicians/images', express.static(path.join(__dirname, '../../data/politicians/images')));

// Initialize RSS parser
const parser = new Parser({
  customFields: {
    item: ['media:content', 'description', 'pubDate', 'content']
  },
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  }
});

// Initialize SQLite database
const db = new sqlite3.Database(DB_PATH);

// Setup database tables
const initDatabase = () => {
  return new Promise((resolve, reject) => {
    // Create articles table
    db.run(`CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      content TEXT,
      link TEXT UNIQUE,
      imageUrl TEXT,
      source TEXT NOT NULL,
      publishedAt TEXT NOT NULL,
      guid TEXT UNIQUE,
      createdAt TEXT NOT NULL,
      summary TEXT
    )`, (err) => {
      if (err) return reject(err);
      
      // Create politician_mentions table
      db.run(`CREATE TABLE IF NOT EXISTS politician_mentions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        articleId INTEGER,
        politicianName TEXT NOT NULL,
        FOREIGN KEY (articleId) REFERENCES articles(id)
      )`, (err) => {
        if (err) return reject(err);
        
        // Create indexes
        db.run(`CREATE INDEX IF NOT EXISTS idx_articles_publishedAt ON articles(publishedAt)`, (err) => {
          if (err) return reject(err);
          db.run(`CREATE INDEX IF NOT EXISTS idx_articles_guid ON articles(guid)`, (err) => {
            if (err) return reject(err);
            resolve();
          });
        });
      });
    });
  });
};

// List of news sources
const NEWS_SOURCES = [
  { url: 'https://www.ynet.co.il/Integration/StoryRss2.xml', name: 'Ynet' },
  { url: 'https://rcs.mako.co.il/rss/news-military.xml?Partner=interlink', name: 'Mako Military' },
  { url: 'https://rcs.mako.co.il/rss/news-law.xml?Partner=interlink', name: 'Mako Law' }
];

// List of politicians to detect in content
const POLITICIANS = [
  { he: 'בנימין נתניהו', en: 'Benjamin Netanyahu' },
  { he: 'יאיר לפיד', en: 'Yair Lapid' },
  { he: 'בני גנץ', en: 'Benny Gantz' },
  { he: 'נפתלי בנט', en: 'Naftali Bennett' },
  { he: 'איילת שקד', en: 'Ayelet Shaked' },
  { he: 'יצחק הרצוג', en: 'Isaac Herzog' },
  { he: 'אביגדור ליברמן', en: 'Avigdor Lieberman' },
  { he: 'מרב מיכאלי', en: 'Merav Michaeli' }
];

// Extract image URL from RSS item
const extractImageUrl = (item) => {
  // First try to get from media:content (for feeds that use this format)
  if (item['media:content'] && item['media:content']['$'] && item['media:content']['$'].url) {
    return item['media:content']['$'].url;
  }
  
  // Next, try to find image URL in the content field (which is used by Ynet)
  if (item.content) {
    const contentMatch = item.content.match(/<img[^>]+src=["']([^"'>]+)["']/);
    if (contentMatch) return contentMatch[1];
  }
  
  // Lastly, try to find image URL in the description field
  if (item.description) {
    const descMatch = item.description.match(/<img[^>]+src=["']([^"'>]+)["']/);
    if (descMatch) return descMatch[1];
  }
  
  return null;
};

// Extract clean description text from RSS item
const extractCleanDescription = (item, source) => {
  let content = item.content || item.description || '';
  
  // For Ynet feeds, extract only the text part after the image HTML
  if (source === 'Ynet' && content.includes('</div>')) {
    // Extract the text after the closing div that contains the image
    const matches = content.match(/<\/div>(.*?)$/s);
    if (matches && matches[1]) {
      content = matches[1].trim();
    }
  }
  
  // Convert any remaining HTML to plain text
  const plainContent = htmlToText(content, { wordwrap: false });
  return plainContent.length > 150 ? plainContent.substring(0, 147) + '...' : plainContent;
};

// Find politician mentions in text
const findPoliticianMentions = (text) => {
  return POLITICIANS.filter(politician => {
    return text.toLowerCase().includes(politician.he.toLowerCase()) || 
           text.toLowerCase().includes(politician.en.toLowerCase());
  }).map(p => p.he);
};

// Scrape article content from URL
const scrapeArticleContent = async (url) => {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    // Remove unnecessary elements
    $('script, style, nav, header, footer, aside, iframe, .advertisement, .ads, .comments').remove();
    
    // Extract the main content (this may need adjustment based on the specific news sites)
    let mainContent = '';
    
    // For Ynet articles
    if (url.includes('ynet.co.il')) {
      mainContent = $('.article-body').text() || $('article').text();
    } 
    // For Mako articles
    else if (url.includes('mako.co.il')) {
      mainContent = $('.article-body').text() || $('.article').text();
    }
    // Generic fallback
    else {
      mainContent = $('article').text() || $('main').text() || $('body').text();
    }
    
    // Clean up the text
    return mainContent.replace(/\s+/g, ' ').trim();
  } catch (error) {
    console.error(`Error scraping article content from ${url}:`, error);
    return '';
  }
};

// Summarize article using Groq API
const summarizeArticle = async (articleContent, title) => {
  try {
    if (!groq) {
      console.warn('Groq client not initialized. Skipping summarization.');
      return { summary: 'Summarization is disabled (API key not configured)', mentionedPoliticians: [] };
    }

    if (!articleContent || articleContent.trim().length === 0) {
      return { summary: '', mentionedPoliticians: [] };
    }
    
    // Load politicians data for detection
    const politiciansPath = path.join(__dirname, '../../data/politicians/politicians.json');
    let politiciansList = [];
    
    if (fs.existsSync(politiciansPath)) {
      const politiciansData = JSON.parse(fs.readFileSync(politiciansPath, 'utf8'));
      politiciansList = politiciansData.map(p => p.Name);
    }
    
    const prompt = `
    You are a professional newspaper editor specializing in creating concise, informative summaries.
    
    Here is a news article:
    Title: ${title}
    Content: ${articleContent}
    
    1. Write a newspaper-style summary of this article in 3-5 sentences. Be factual and objective.
    2. Identify any Israeli politicians mentioned in this article from this list: ${politiciansList.join(', ')}
    
    Format your response as JSON:
    {
      "summary": "Your summary here...",
      "mentionedPoliticians": ["Politician Name 1", "Politician Name 2", ...]
    }
    `;
    
    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama3-8b-8192',
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });
    
    const result = JSON.parse(completion.choices[0].message.content);
    return result;
  } catch (error) {
    console.error('Error summarizing article with Groq:', error);
    return { summary: 'Error during summarization', mentionedPoliticians: [] };
  }
};

// Insert an article with its politician mentions
const insertArticle = (article, mentions) => {
  return new Promise((resolve, reject) => {
    const { title, description, content, link, imageUrl, source, publishedAt, guid, summary } = article;
    
    db.run(
      `INSERT OR IGNORE INTO articles (title, description, content, link, imageUrl, source, publishedAt, guid, createdAt, summary)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, description, content, link, imageUrl, source, publishedAt, guid, new Date().toISOString(), summary],
      function(err) {
        if (err) return reject(err);
        
        const articleId = this.lastID;
        if (!articleId || mentions.length === 0) return resolve(articleId);
        
        // Insert all politician mentions
        const mentionValues = mentions.map(name => 
          `(${articleId}, '${name.replace(/'/g, "''")}')`
        ).join(',');
        
        db.run(
          `INSERT INTO politician_mentions (articleId, politicianName) VALUES ${mentionValues}`,
          function(err) {
            if (err) return reject(err);
            resolve(articleId);
          }
        );
      }
    );
  });
};

// Fetch and process RSS feeds
const updateFeeds = async () => {
  console.log('Fetching RSS feeds...');
  
  try {
    for (const source of NEWS_SOURCES) {
      try {
        const feed = await parser.parseURL(source.url);
        
        for (const item of feed.items) {
          const content = item.content || item.description || '';
          // Get a clean description
          const description = extractCleanDescription(item, source.name);
          
          const article = {
            title: item.title || '',
            description: description,
            content: content,
            link: item.link || '',
            imageUrl: extractImageUrl(item),
            source: source.name,
            publishedAt: item.pubDate ? format(new Date(item.pubDate), 'yyyy-MM-dd HH:mm:ss') : format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
            guid: item.guid || item.link || Math.random().toString(36).substring(2),
            summary: '' // Initialize with empty summary
          };
          
          const mentions = findPoliticianMentions(article.title + ' ' + article.content);
          const articleId = await insertArticle(article, mentions);
          
          // Auto-generate summary for new articles
          if (articleId && AUTO_SUMMARIZE && groq) {
            try {
              console.log(`Auto-generating summary for new article ID: ${articleId}`);
              // Scrape full content if needed
              let articleContent = article.content;
              if (!articleContent || articleContent.length < 200) {
                const scrapedContent = await scrapeArticleContent(article.link);
                if (scrapedContent && scrapedContent.content) {
                  articleContent = scrapedContent.content;
                }
              }
              
              // Generate summary
              const { summary, mentionedPoliticians } = await summarizeArticle(articleContent, article.title);
              
              // Update the article with the summary
              if (summary) {
                db.run('UPDATE articles SET summary = ? WHERE id = ?', [summary, articleId]);
                
                // Add any new politician mentions
                if (mentionedPoliticians && mentionedPoliticians.length > 0) {
                  const existingMentions = mentions;
                  const newMentions = mentionedPoliticians.filter(p => !existingMentions.includes(p));
                  
                  if (newMentions.length > 0) {
                    const mentionValues = newMentions.map(name => 
                      `(${articleId}, '${name.replace(/'/g, "''")}')`
                    ).join(',');
                    
                    db.run(
                      `INSERT INTO politician_mentions (articleId, politicianName) VALUES ${mentionValues}`
                    );
                  }
                }
              }
            } catch (summaryError) {
              console.error(`Error auto-generating summary for article ${articleId}:`, summaryError);
            }
          }
        }
        
        console.log(`Processed ${feed.items.length} items from ${source.name}`);
      } catch (error) {
        console.error(`Error processing feed from ${source.name}:`, error);
      }
    }
    
    console.log('RSS feed update completed');
  } catch (error) {
    console.error('Error updating feeds:', error);
  }
};

// API route to summarize an article
app.post('/api/summarize/:id', async (req, res) => {
  try {
    const articleId = req.params.id;
    
    // Get the article from the database
    db.get('SELECT * FROM articles WHERE id = ?', [articleId], async (err, article) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!article) {
        return res.status(404).json({ error: 'Article not found' });
      }
      
      // If article already has a summary, return it
      if (article.summary) {
        return res.json({ 
          success: true, 
          summary: article.summary,
          message: 'Summary retrieved from database'
        });
      }
      
      // Scrape the article content if needed
      let articleContent = article.content;
      if (!articleContent || articleContent.length < 200) {
        articleContent = await scrapeArticleContent(article.link);
      }
      
      // Summarize the article
      const { summary, mentionedPoliticians } = await summarizeArticle(articleContent, article.title);
      
      if (!summary) {
        return res.status(500).json({ error: 'Failed to generate summary' });
      }
      
      // Update the article in the database with the summary
      db.run('UPDATE articles SET summary = ? WHERE id = ?', [summary, articleId], function(err) {
        if (err) {
          console.error('Error updating article with summary:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        // Insert any new politician mentions
        if (mentionedPoliticians && mentionedPoliticians.length > 0) {
          // Get existing mentions
          db.all('SELECT politicianName FROM politician_mentions WHERE articleId = ?', [articleId], (err, rows) => {
            if (err) {
              console.error('Error fetching existing mentions:', err);
              // Continue anyway, not a critical error
            }
            
            const existingMentions = rows ? rows.map(row => row.politicianName) : [];
            const newMentions = mentionedPoliticians.filter(p => !existingMentions.includes(p));
            
            if (newMentions.length > 0) {
              const mentionValues = newMentions.map(name => 
                `(${articleId}, '${name.replace(/'/g, "''")}')`
              ).join(',');
              
              db.run(
                `INSERT INTO politician_mentions (articleId, politicianName) VALUES ${mentionValues}`,
                function(err) {
                  if (err) {
                    console.error('Error inserting new politician mentions:', err);
                  }
                }
              );
            }
          });
        }
        
        res.json({ 
          success: true, 
          summary,
          mentionedPoliticians,
          message: 'Summary generated and saved'
        });
      });
    });
  } catch (error) {
    console.error('Error in summarize endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API routes

// Default route
app.get('/', (req, res) => {
  res.json({
    message: 'Democra.c RSS Feed API',
    endpoints: [
      '/api/news - Get all news articles with pagination',
      '/api/news/:id - Get a specific news article',
      '/api/summarize/:id - Generate or retrieve a summary for an article',
      '/api/summarize-url - Generate a summary for an article by URL',
      '/api/refresh - Trigger a manual feed update',
      '/api/clear - Clear all news articles from the database',
      '/api/politicians - Get list of politicians'
    ]
  });
});

// Manual trigger to update feeds
app.post('/api/refresh', (req, res) => {
  // Check if API key is provided (simple auth)
  const apiKey = req.headers['x-admin-api-key'] || req.query.apiKey;
  if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized - Admin API key required' });
  }
  
  console.log('Manual refresh triggered');
  updateFeeds().catch(err => console.error('Error refreshing feeds:', err));
  res.json({ message: 'Feed refresh triggered' });
});

// API endpoint to clear all articles (requires admin API key)
app.post('/api/clear', (req, res) => {
  // Check if API key is provided (simple auth)
  const apiKey = req.headers['x-admin-api-key'] || req.query.apiKey;
  if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized - Admin API key required' });
  }
  
  console.log('Clearing all news articles...');
  
  // Delete from politician_mentions first (foreign key constraint)
  db.run('DELETE FROM politician_mentions', (err) => {
    if (err) {
      console.error('Error clearing politician mentions:', err);
      return res.status(500).json({ error: 'Failed to clear database' });
    }
    
    // Then delete from articles
    db.run('DELETE FROM articles', (err) => {
      if (err) {
        console.error('Error clearing articles:', err);
        return res.status(500).json({ error: 'Failed to clear database' });
      }
      
      res.json({ message: 'All news articles cleared successfully' });
    });
  });
});

// Get all articles with pagination
app.get('/api/news', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  
  db.all(
    `SELECT 
      a.*,
      GROUP_CONCAT(pm.politicianName) as mentionedPoliticians
    FROM articles a
    LEFT JOIN politician_mentions pm ON a.id = pm.articleId
    GROUP BY a.id
    ORDER BY publishedAt DESC
    LIMIT ? OFFSET ?`,
    [limit, offset],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Get total count for pagination
      db.get('SELECT COUNT(*) as count FROM articles', (err, countRow) => {
        if (err) {
          console.error('Count error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        const total = countRow.count;
        const totalPages = Math.ceil(total / limit);
        
        // Format the response
        const articles = rows.map(row => ({
          ...row,
          mentionedPoliticians: row.mentionedPoliticians ? row.mentionedPoliticians.split(',') : []
        }));
        
        res.json({
          news: articles,
          pagination: {
            page,
            pages: totalPages,
            total
          }
        });
      });
    }
  );
});

// Get a single article by ID
app.get('/api/news/:id', (req, res) => {
  const id = req.params.id;
  
  db.get(
    `SELECT 
      a.*,
      GROUP_CONCAT(pm.politicianName) as mentionedPoliticians
    FROM articles a
    LEFT JOIN politician_mentions pm ON a.id = pm.articleId
    WHERE a.id = ?
    GROUP BY a.id`,
    [id],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!row) {
        return res.status(404).json({ error: 'Article not found' });
      }
      
      // Format the response
      const article = {
        ...row,
        mentionedPoliticians: row.mentionedPoliticians ? row.mentionedPoliticians.split(',') : []
      };
      
      res.json(article);
    }
  );
});

// Get all politicians
app.get('/api/politicians', (req, res) => {
  try {
    const politiciansPath = path.join(__dirname, '../../data/politicians/politicians.json');
    if (!fs.existsSync(politiciansPath)) {
      return res.status(404).json({ error: 'Politicians data not found' });
    }
    
    const politiciansData = JSON.parse(fs.readFileSync(politiciansPath, 'utf8'));
    
    // Add image URLs for the frontend to use
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const politiciansWithImageUrls = politiciansData.map(politician => {
      if (politician.image) {
        politician.image_url = `${baseUrl}/politicians/images/${encodeURIComponent(politician.image)}`;
      }
      return politician;
    });
    
    res.json(politiciansWithImageUrls);
  } catch (error) {
    console.error('Error fetching politicians data:', error);
    res.status(500).json({ error: 'Failed to fetch politicians data' });
  }
});

// Start the server
initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`API ready for connections - RSS feeds will be cleared and refreshed`);
      
      // Clear all existing articles on startup
      console.log('Clearing all existing articles...');
      db.run('DELETE FROM politician_mentions', (err) => {
        if (err) {
          console.error('Error clearing politician mentions:', err);
        } else {
          db.run('DELETE FROM articles', (err) => {
            if (err) {
              console.error('Error clearing articles:', err);
            } else {
              console.log('All articles cleared successfully.');
              
              // Initial feed update after clearing
              updateFeeds();
              
              // Schedule regular updates
              setInterval(updateFeeds, UPDATE_INTERVAL);
            }
          });
        }
      });
    });
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });

module.exports = app; 