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

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;
const UPDATE_INTERVAL = parseInt(process.env.UPDATE_INTERVAL || 300000); // Default: 5 minutes
const DB_PATH = process.env.DB_PATH || './data/news.db';

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
      createdAt TEXT NOT NULL
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
  if (item['media:content'] && item['media:content']['$'] && item['media:content']['$'].url) {
    return item['media:content']['$'].url;
  }
  
  if (item.description) {
    const match = item.description.match(/<img[^>]+src="([^">]+)"/);
    if (match) return match[1];
  }
  
  return null;
};

// Find politician mentions in text
const findPoliticianMentions = (text) => {
  return POLITICIANS.filter(politician => {
    return text.toLowerCase().includes(politician.he.toLowerCase()) || 
           text.toLowerCase().includes(politician.en.toLowerCase());
  }).map(p => p.he);
};

// Insert an article with its politician mentions
const insertArticle = (article, mentions) => {
  return new Promise((resolve, reject) => {
    const { title, description, content, link, imageUrl, source, publishedAt, guid } = article;
    
    db.run(
      `INSERT OR IGNORE INTO articles (title, description, content, link, imageUrl, source, publishedAt, guid, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, description, content, link, imageUrl, source, publishedAt, guid, new Date().toISOString()],
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
          // Convert HTML content to plain text
          const plainContent = htmlToText(content, { wordwrap: false });
          const description = plainContent.length > 150 ? plainContent.substring(0, 147) + '...' : plainContent;
          
          const article = {
            title: item.title || '',
            description: description,
            content: content,
            link: item.link || '',
            imageUrl: extractImageUrl(item),
            source: source.name,
            publishedAt: item.pubDate ? format(new Date(item.pubDate), 'yyyy-MM-dd HH:mm:ss') : format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
            guid: item.guid || item.link || Math.random().toString(36).substring(2)
          };
          
          const mentions = findPoliticianMentions(article.title + ' ' + article.content);
          await insertArticle(article, mentions);
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

// API routes

// Default route
app.get('/', (req, res) => {
  res.json({
    message: 'Democra.c RSS Feed API',
    endpoints: [
      '/api/news - Get all news articles with pagination',
      '/api/news/:id - Get a specific news article',
      '/api/refresh - Trigger a manual feed update',
      '/api/clear - Clear all news articles from the database'
    ]
  });
});

// Special temporary route to clear database (delete this after use)
app.get('/clear-all-now', (req, res) => {
  console.log('Emergency clearing all news articles...');
  
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
      
      updateFeeds().catch(err => console.error('Error refreshing feeds:', err));
      
      res.json({ message: 'All news articles cleared successfully and refresh triggered' });
    });
  });
});

// Manual trigger to update feeds
app.post('/api/refresh', async (req, res) => {
  try {
    console.log('Manual refresh triggered');
    
    // Start the update process asynchronously 
    updateFeeds().catch(err => console.error('Error in background feed update:', err));
    
    // Respond immediately
    res.json({ message: 'Feed update triggered' });
  } catch (error) {
    console.error('Error triggering feed update:', error);
    res.status(500).json({ error: 'Failed to trigger feed update' });
  }
});

// Clear all news articles
app.post('/api/clear', async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Error clearing database:', error);
    res.status(500).json({ error: 'Failed to clear database' });
  }
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