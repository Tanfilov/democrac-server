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
  console.log('GROQ_API_KEY status:', process.env.GROQ_API_KEY ? 'Set' : 'Not set');
  if (process.env.GROQ_API_KEY) {
    // Log first 4 and last 4 characters of the API key (safe to log)
    const apiKey = process.env.GROQ_API_KEY;
    const maskedKey = apiKey.length > 8 
      ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`
      : '(invalid key)';
    console.log('GROQ_API_KEY first/last chars:', maskedKey);
  }
  
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'YOUR_GROQ_API_KEY') {
    groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
    console.log('Groq client initialized successfully');
  } else {
    console.warn('GROQ_API_KEY not set or using placeholder value. Summarization will be disabled.');
    console.log('Check environment variables: GROQ_API_KEY, AUTO_SUMMARIZE, ADMIN_API_KEY');
    console.log('AUTO_SUMMARIZE setting:', process.env.AUTO_SUMMARIZE);
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

// Rate limiting for Groq API
const groqRateLimit = {
  requestsPerMinute: 25, // Set slightly below limit (30/min) for safety
  tokensPerMinute: 5500, // Set slightly below limit (6k/min) for safety
  
  // Tracking variables
  requestsThisMinute: 0,
  tokensThisMinute: 0,
  lastResetTime: Date.now(),
  
  // Queue for pending summarization requests
  queue: [],
  processing: false,
  
  // Reset counters
  resetCounters() {
    this.requestsThisMinute = 0;
    this.tokensThisMinute = 0;
    this.lastResetTime = Date.now();
  },
  
  // Check if we can make another request
  canMakeRequest(estimatedTokens = 1000) {
    // Reset counters if a minute has passed
    if (Date.now() - this.lastResetTime > 60000) {
      this.resetCounters();
    }
    
    return (
      this.requestsThisMinute < this.requestsPerMinute &&
      this.tokensThisMinute + estimatedTokens < this.tokensPerMinute
    );
  },
  
  // Register a request
  registerRequest(tokens) {
    this.requestsThisMinute++;
    this.tokensThisMinute += tokens;
  },
  
  // Add to queue
  addToQueue(task) {
    this.queue.push(task);
    this.processQueue();
  },
  
  // Process queue
  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }
    
    this.processing = true;
    
    try {
      while (this.queue.length > 0) {
        // Check if we can make another request
        if (!this.canMakeRequest()) {
          // Wait until next minute
          const waitTime = 60000 - (Date.now() - this.lastResetTime) + 1000; // Add 1 second buffer
          console.log(`Rate limit reached, waiting ${waitTime}ms before next request`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          this.resetCounters();
        }
        
        const task = this.queue.shift();
        await task();
      }
    } catch (error) {
      console.error('Error processing queue:', error);
    } finally {
      this.processing = false;
    }
  }
};

// Summarize article using Groq API
const summarizeArticle = async (articleContent, title) => {
  try {
    if (!groq) {
      console.warn('Groq client not initialized. Skipping summarization.');
      return { summary: '', mentionedPoliticians: [] };
    }

    if (!articleContent || articleContent.trim().length === 0) {
      return { summary: '', mentionedPoliticians: [] };
    }
    
    // Detect content language
    const isHebrew = /[\u0590-\u05FF]/.test(articleContent) || /[\u0590-\u05FF]/.test(title);
    
    // Load politicians data for detection
    const politiciansPath = path.join(__dirname, '../../data/politicians/politicians.json');
    let politiciansList = [];
    
    if (fs.existsSync(politiciansPath)) {
      const politiciansData = JSON.parse(fs.readFileSync(politiciansPath, 'utf8'));
      politiciansList = politiciansData.map(p => p.Name);
    }
    
    // Extract more paragraphs (up to 8) for summarization to get more content
    const paragraphs = articleContent.split(/\n+/).filter(p => p.trim().length > 20);
    const contentToSummarize = paragraphs.slice(0, 8).join('\n\n');
    
    // Estimate tokens (rough estimate: 4 chars per token)
    const estimatedPromptTokens = Math.ceil((title.length + contentToSummarize.length) / 4) + 500; // Add 500 for the prompt text
    
    // Create a promise that will be resolved when the API call completes
    return new Promise((resolve) => {
      groqRateLimit.addToQueue(async () => {
        try {
          // For Hebrew content, use a simpler prompt that asks for plaintext first, then we'll format it as JSON
          const prompt = isHebrew
            ? `
            You are a professional newspaper editor specializing in creating comprehensive, informative summaries.
            
            Here is a news article in Hebrew:
            Title: ${title}
            Content: ${contentToSummarize}
            
            IMPORTANT INSTRUCTIONS:
            1. Write a comprehensive, detailed newspaper-style summary of this article in 6-10 sentences in Hebrew.
            2. Your summary MUST be at least twice as long as a typical short summary and contain more details.
            3. Your summary MUST be original - do NOT simply copy the first paragraph or description.
            4. Use factual, neutral, and unbiased language typical of professional news reporting.
            5. Include key details, statistics, quotes, and context from the article when available.
            6. Read and analyze the full content provided to create a thorough summary.
            7. In a SEPARATE section at the end, list any Israeli politicians mentioned in this article from this list: ${politiciansList.join(', ')}
            8. Format your response as:
            
            SUMMARY: 
            [your 6-10 sentence summary here]
            
            POLITICIANS MENTIONED: 
            [list of politicians, separated by commas]
            `
            : `
            You are a professional newspaper editor specializing in creating comprehensive, informative summaries.
            
            Here is a news article:
            Title: ${title}
            Content: ${contentToSummarize}
            
            IMPORTANT INSTRUCTIONS:
            1. Write a comprehensive, detailed newspaper-style summary of this article in 6-10 sentences.
            2. Your summary MUST be at least twice as long as a typical short summary and contain more details.
            3. Your summary MUST be original - do NOT simply copy the first paragraph or description.
            4. Use factual, neutral, and unbiased language typical of professional news reporting.
            5. Include key details, statistics, quotes, and context from the article when available.
            6. Read and analyze the full content provided to create a thorough summary.
            7. Identify any Israeli politicians mentioned in this article from this list: ${politiciansList.join(', ')}
            
            Format your response as JSON:
            {
              "summary": "Your original 6-10 sentence summary here...",
              "mentionedPoliticians": ["Politician Name 1", "Politician Name 2", ...]
            }
            `;
          
          const responseFormat = isHebrew ? { type: 'text' } : { type: 'json_object' };
          
          // Try primary model first, then fallback to alternative if that fails
          let completion;
          let model = 'llama3-8b-8192';
          
          try {
            completion = await groq.chat.completions.create({
              messages: [{ role: 'user', content: prompt }],
              model: model,
              temperature: 0.3,
              max_tokens: 1500, // Increased max tokens to allow for longer summaries
              response_format: responseFormat
            });
          } catch (modelError) {
            // If primary model fails, try the fallback model
            console.log(`Primary model ${model} failed, trying fallback model llama-3.1-8b-instant`);
            model = 'llama-3.1-8b-instant';
            completion = await groq.chat.completions.create({
              messages: [{ role: 'user', content: prompt }],
              model: model,
              temperature: 0.3,
              max_tokens: 1500, // Increased max tokens to allow for longer summaries
              response_format: responseFormat
            });
          }
          
          // Register the actual tokens used
          const tokensUsed = completion.usage.total_tokens;
          groqRateLimit.registerRequest(tokensUsed);
          
          let result;
          
          if (isHebrew) {
            // For Hebrew, parse the plain text response into our JSON format
            const response = completion.choices[0].message.content;
            
            // Extract summary (between SUMMARY: and POLITICIANS MENTIONED:)
            const summaryRegex = /SUMMARY:\s*([\s\S]*?)(?:POLITICIANS MENTIONED:|$)/i;
            const summaryMatch = response.match(summaryRegex);
            const summary = summaryMatch ? summaryMatch[1].trim() : response.split(/POLITICIANS MENTIONED:/i)[0].trim();
            
            // Extract politicians list
            const politiciansRegex = /POLITICIANS MENTIONED:\s*([\s\S]*)/i;
            const politiciansMatch = response.match(politiciansRegex);
            const politiciansText = politiciansMatch ? politiciansMatch[1].trim() : '';
            
            // Parse the politicians from the comma-separated list
            const mentionedPoliticians = politiciansText
              ? politiciansText.split(/,|\n/).map(p => p.trim()).filter(p => p.length > 0)
              : [];
            
            // If that didn't work, try to match politicians from the list
            const filteredPoliticians = mentionedPoliticians.length > 0 
              ? mentionedPoliticians 
              : politiciansList.filter(p => politiciansText.includes(p));
            
            // Ensure the summary is properly formatted
            const formattedSummary = summary.replace(/\n{3,}/g, '\n\n').trim();  
            
            // Deduplicate politician names
            const uniquePoliticians = [...new Set(filteredPoliticians)];
            
            result = {
              summary: formattedSummary,
              mentionedPoliticians: uniquePoliticians
            };
          } else {
            // For English, parse the JSON response
            const parsed = JSON.parse(completion.choices[0].message.content);
            
            // Ensure the summary is properly formatted
            if (parsed.summary) {
              parsed.summary = parsed.summary.replace(/\n{3,}/g, '\n\n').trim();
            }
            
            // Deduplicate politician names
            if (parsed.mentionedPoliticians && Array.isArray(parsed.mentionedPoliticians)) {
              parsed.mentionedPoliticians = [...new Set(parsed.mentionedPoliticians)];
            }
            
            result = parsed;
          }
          
          resolve(result);
        } catch (error) {
          console.error('Error summarizing article with Groq:', error);
          // If we get a JSON validation error, try to extract the summary from the failed generation
          if (error.code === 'json_validate_failed' && error.failed_generation) {
            try {
              // Try to salvage the summary from the failed JSON
              const failedText = error.failed_generation;
              
              // Extract summary using regex - look for text between "summary": and the next comma or closing brace
              // Use a more robust regex that can capture multi-line summaries with quotes
              const summaryMatch = failedText.match(/"summary":\s*"((?:\\"|[^"])+)"/);
              const rawSummary = summaryMatch ? summaryMatch[1] : '';
              
              // Clean up the summary - unescape quotes and ensure proper formatting
              const summary = rawSummary
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, '\\')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
              
              // Extract politicians using regex - look for array after "mentionedPoliticians":
              const politiciansMatch = failedText.match(/"mentionedPoliticians":\s*\[(.*?)\]/);
              const politiciansText = politiciansMatch ? politiciansMatch[1] : '';
              
              // Parse the politicians from the array text
              const mentionedPoliticians = politiciansText
                .split(',')
                .map(p => p.trim().replace(/"/g, ''))
                .filter(p => p.length > 0);
              
              // Deduplicate politician names
              const uniquePoliticians = [...new Set(mentionedPoliticians)];
              
              // Only resolve with summary if we actually extracted something
              if (summary) {
                resolve({
                  summary,
                  mentionedPoliticians: uniquePoliticians
                });
              } else {
                // If we couldn't extract a valid summary, return empty
                resolve({ summary: '', mentionedPoliticians: [] });
              }
            } catch (parseError) {
              console.error('Error parsing failed generation:', parseError);
              resolve({ summary: '', mentionedPoliticians: [] });
            }
          } else {
            // For any other errors, return empty values
            resolve({ summary: '', mentionedPoliticians: [] });
          }
        }
      });
    });
  } catch (error) {
    console.error('Error in summarizeArticle function:', error);
    return { summary: '', mentionedPoliticians: [] };
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

// Process a batch of articles for summarization
const processBatchForSummarization = async (articleIds, maxBatchSize = 5) => {
  if (!articleIds.length) return;
  
  console.log(`Processing batch of ${articleIds.length} articles for summarization`);
  
  // Process in smaller batches to avoid overwhelming the API
  for (let i = 0; i < articleIds.length; i += maxBatchSize) {
    const batch = articleIds.slice(i, i + maxBatchSize);
    
    // Process each article in the batch concurrently
    await Promise.all(
      batch.map(async (articleId) => {
        try {
          // Get article from database
          const article = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM articles WHERE id = ?', [articleId], (err, row) => {
              if (err) reject(err);
              else resolve(row);
            });
          });
          
          if (!article) {
            console.error(`Article with ID ${articleId} not found`);
            return;
          }
          
          console.log(`Auto-generating summary for article ID: ${articleId}`);
          
          // Scrape full content if needed
          let articleContent = article.content;
          if (!articleContent || articleContent.length < 200) {
            const scrapedContent = await scrapeArticleContent(article.link);
            if (scrapedContent) {
              articleContent = scrapedContent;
              
              // Update the article with scraped content
              await new Promise((resolve, reject) => {
                db.run('UPDATE articles SET content = ? WHERE id = ?', [scrapedContent, articleId], (err) => {
                  if (err) reject(err);
                  else resolve();
                });
              });
            }
          }
          
          // Generate summary
          const result = await summarizeArticle(articleContent, article.title);
          
          // Update the article with the summary
          if (result.summary) {
            await new Promise((resolve, reject) => {
              db.run('UPDATE articles SET summary = ? WHERE id = ?', [result.summary, articleId], (err) => {
                if (err) reject(err);
                else resolve();
              });
            });
            
            // Add any new politician mentions
            if (result.mentionedPoliticians && result.mentionedPoliticians.length > 0) {
              // Get existing mentions
              const existingMentions = await new Promise((resolve, reject) => {
                db.all('SELECT politicianName FROM politician_mentions WHERE articleId = ?', [articleId], (err, rows) => {
                  if (err) reject(err);
                  else resolve(rows ? rows.map(row => row.politicianName) : []);
                });
              });
              
              const newMentions = result.mentionedPoliticians.filter(p => !existingMentions.includes(p));
              
              if (newMentions.length > 0) {
                const mentionValues = newMentions.map(name => 
                  `(${articleId}, '${name.replace(/'/g, "''")}')`
                ).join(',');
                
                await new Promise((resolve, reject) => {
                  db.run(
                    `INSERT INTO politician_mentions (articleId, politicianName) VALUES ${mentionValues}`,
                    (err) => {
                      if (err) reject(err);
                      else resolve();
                    }
                  );
                });
              }
            }
          }
        } catch (error) {
          console.error(`Error processing article ${articleId} for summarization:`, error);
        }
      })
    );
    
    // Add a small delay between batches to avoid overwhelming the system
    if (i + maxBatchSize < articleIds.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
};

// Fetch and process RSS feeds
const updateFeeds = async () => {
  console.log('Fetching RSS feeds...');
  
  try {
    // Track articles that need summarization
    const articlesToSummarize = [];
    
    for (const source of NEWS_SOURCES) {
      try {
        const feed = await parser.parseURL(source.url);
        
        for (const item of feed.items) {
          const content = item.content || item.description || '';
          // Get a clean description
          const description = extractCleanDescription(item, source.name);
          
          // Skip items with empty descriptions or descriptions with fewer than 10 words
          if (!description || description.trim() === '' || description.trim().split(/\s+/).length < 10) {
            console.log(`Skipping item with insufficient description: "${item.title}"`);
            continue;
          }
          
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
          
          // If a new article was inserted, add it to the summarization queue
          if (articleId && AUTO_SUMMARIZE && groq) {
            articlesToSummarize.push(articleId);
          }
        }
        
        console.log(`Processed ${feed.items.length} items from ${source.name}`);
      } catch (error) {
        console.error(`Error processing feed from ${source.name}:`, error);
      }
    }
    
    console.log('RSS feed update completed');
    
    // Process articles for summarization
    if (articlesToSummarize.length > 0 && AUTO_SUMMARIZE && groq) {
      processBatchForSummarization(articlesToSummarize);
    }
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
    status: {
      groqApiEnabled: !!groq,
      autoSummarize: AUTO_SUMMARIZE,
      adminKeyConfigured: !!process.env.ADMIN_API_KEY
    },
    endpoints: [
      '/api/news - Get all news articles with pagination',
      '/api/news?onlySummarized=true - Get only articles with summaries',
      '/api/news/:id - Get a specific news article',
      '/api/news-stats/all - Get statistics about articles with and without summaries',
      '/api/summarize/:id - Generate or retrieve a summary for an article',
      '/api/refresh - Trigger a manual feed update (admin)',
      '/api/clear - Clear all news articles from the database (admin)',
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
  const onlySummarized = req.query.onlySummarized === 'true';
  
  // SQL query
  let query = `
    SELECT 
      a.*,
      GROUP_CONCAT(pm.politicianName) as mentionedPoliticians
    FROM articles a
    LEFT JOIN politician_mentions pm ON a.id = pm.articleId
  `;
  
  // Add filters
  let whereClause = [];
  
  // Filter for summarized articles if requested
  if (onlySummarized) {
    whereClause.push(`a.summary IS NOT NULL AND a.summary != ''`);
  }
  
  // Filter out articles with empty descriptions or fewer than 10 words
  whereClause.push(`a.description IS NOT NULL AND a.description != '' AND (LENGTH(a.description) - LENGTH(REPLACE(a.description, ' ', '')) + 1) >= 10`);
  
  // Apply where clause if we have conditions
  if (whereClause.length > 0) {
    query += ` WHERE ${whereClause.join(' AND ')}`;
  }
  
  // Complete the query
  query += `
    GROUP BY a.id
    ORDER BY publishedAt DESC
    LIMIT ? OFFSET ?
  `;
  
  db.all(
    query,
    [limit, offset],
    (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Get total count for pagination
      let countQuery = 'SELECT COUNT(*) as count FROM articles';
      
      // Add the same filters to the count query
      if (whereClause.length > 0) {
        countQuery += ` WHERE ${whereClause.join(' AND ')}`;
      }
      
      db.get(countQuery, (err, countRow) => {
        if (err) {
          console.error('Count error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        const total = countRow.count;
        const totalPages = Math.ceil(total / limit);
        
        // Format the response
        const articles = rows.map(row => {
          // Deduplicate politician names
          const mentionedPoliticians = row.mentionedPoliticians 
            ? [...new Set(row.mentionedPoliticians.split(','))]
            : [];
            
          return {
            ...row,
            mentionedPoliticians
          };
        });
        
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

// Get total articles count (with and without summaries) - with more specific path
app.get('/api/news-stats/all', (req, res) => {
  db.get(
    `SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN summary IS NOT NULL AND summary != '' THEN 1 ELSE 0 END) as withSummary,
      SUM(CASE WHEN summary IS NULL OR summary = '' THEN 1 ELSE 0 END) as withoutSummary
    FROM articles`,
    [],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json({
        stats: {
          total: row.total,
          withSummary: row.withSummary,
          withoutSummary: row.withoutSummary,
          percentComplete: row.total > 0 ? Math.round((row.withSummary / row.total) * 100) : 0
        }
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
      
      // Format the response with deduplicated politician names
      const article = {
        ...row,
        mentionedPoliticians: row.mentionedPoliticians 
          ? [...new Set(row.mentionedPoliticians.split(','))]
          : []
      };
      
      // Check if the article has an insufficient description
      if (!article.description || article.description.trim() === '' || 
          article.description.trim().split(/\s+/).length < 10) {
        article.warning = "This article has an insufficient description and wouldn't normally be shown in the feed.";
      }
      
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

// Debug endpoint to test Groq API
app.post('/api/debug/test-groq', async (req, res) => {
  // Check if API key is provided (simple auth)
  const apiKey = req.headers['x-admin-api-key'] || req.query.apiKey;
  if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized - Admin API key required' });
  }
  
  try {
    if (!groq) {
      return res.status(500).json({ 
        error: 'Groq client not initialized',
        groqStatus: process.env.GROQ_API_KEY ? 'API Key provided but client initialization failed' : 'No API Key found',
        envVars: {
          autoSummarize: AUTO_SUMMARIZE,
          adminKeyConfigured: !!process.env.ADMIN_API_KEY,
          groqKeyFirstChars: process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.substring(0, 4) : 'none'
        }
      });
    }
    
    // Test the Groq API with a simple request
    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: 'Say hello world as JSON' }],
      model: 'llama3-8b-8192',
      temperature: 0.3,
      max_tokens: 100,
      response_format: { type: 'json_object' }
    });
    
    return res.json({
      success: true,
      message: 'Groq API test successful',
      response: completion.choices[0].message.content
    });
  } catch (error) {
    console.error('Error testing Groq API:', error);
    return res.status(500).json({ 
      error: 'Error testing Groq API', 
      message: error.message,
      stack: error.stack
    });
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