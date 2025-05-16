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
const config = require('./config');
const { v4: uuidv4 } = require('uuid');

// Import politician detection module
const politicianDetection = require('./politicians');

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
// Increase the interval to reduce frequency of requests to RSS feeds
// Default: 60 minutes (from previous 5 minutes)
const UPDATE_INTERVAL = parseInt(process.env.UPDATE_INTERVAL || 3600000);
const DB_PATH = process.env.DB_PATH || './data/news.db';
const AUTO_SUMMARIZE = false; // Temporarily disabled

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
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
    'Accept-Language': 'en-US,en;q=0.9,he;q=0.8',
    'Referer': 'https://www.google.com/',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  },
  timeout: 15000, // Increase timeout to 15 seconds
  defaultRSS: 2.0,
  maxRedirects: 5,
  requestOptions: {
    rejectUnauthorized: false // Sometimes needed for SSL certificates
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
      
      // Add summary column if it doesn't exist
      db.run("PRAGMA table_info(articles)", (err, rows) => {
        if (err) return reject(err);
        
        // Check if the summary column exists
        db.get("SELECT COUNT(*) as count FROM pragma_table_info('articles') WHERE name = 'summary'", (err, row) => {
          if (err) return reject(err);
          
          if (row.count === 0) {
            // Add the summary column if it doesn't exist
            db.run("ALTER TABLE articles ADD COLUMN summary TEXT", (err) => {
              if (err) return reject(err);
              console.log("Added summary column to articles table");
              
              // Continue with the rest of the initialization
              createPoliticianMentionsTable();
            });
          } else {
            // Continue with the rest of the initialization
            createPoliticianMentionsTable();
          }
        });
      });
      
      function createPoliticianMentionsTable() {
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
      }
    });
  });
};

// List of news sources with rate limits
const NEWS_SOURCES = [
  { 
    url: 'https://www.ynet.co.il/Integration/StoryRss2.xml', 
    name: 'Ynet',
    // Default rate limit is gentle
    minRequestInterval: 15 * 60 * 1000 // 15 minutes between requests
  },
  { 
    url: 'https://rcs.mako.co.il/rss/news-military.xml?Partner=interlink', 
    name: 'Mako Military',
    alternativeUrl: 'https://www.mako.co.il/news-military?partner=rss',
    minRequestInterval: 30 * 60 * 1000 // 30 minutes between requests
  },
  { 
    url: 'https://rcs.mako.co.il/rss/news-law.xml?Partner=interlink', 
    name: 'Mako Law',
    alternativeUrl: 'https://www.mako.co.il/news-law?partner=rss',
    minRequestInterval: 30 * 60 * 1000 // 30 minutes between requests
  },
  { 
    url: 'https://rss.walla.co.il/feed/2686', 
    name: 'Walla Politics',
    minRequestInterval: 20 * 60 * 1000 // 20 minutes between requests
  },
  { 
    url: 'https://rss.walla.co.il/feed/2689', 
    name: 'Walla Knesset',
    minRequestInterval: 20 * 60 * 1000 // 20 minutes between requests
  },
  { 
    url: 'https://www.maariv.co.il/Rss/RssFeedsPolitiMedini', 
    name: 'Maariv Politics',
    minRequestInterval: 15 * 60 * 1000 // 15 minutes between requests
  }
];

// Track last successful request time for each source
const lastSuccessfulRequests = {};

// Load politicians from JSON file
const politiciansPath = path.join(__dirname, '../../data/politicians/politicians.json');
const POLITICIANS = politicianDetection.loadPoliticians(politiciansPath);

// Log the number of politicians loaded for debugging
console.log(`Loaded ${POLITICIANS.length} politicians for detection`);

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
  
  // For Walla feeds with CDATA sections
  if (item.content && item.content.includes('CDATA')) {
    const cdataMatch = item.content.match(/\<!\[CDATA\[.*?<img[^>]+src=["']([^"'>]+)["'].*?\]\]>/s);
    if (cdataMatch) return cdataMatch[1];
  }
  
  // For Maariv feeds using the specific img format
  if (item.content && item.content.includes('align=\'right\'')) {
    const maarivMatch = item.content.match(/src='([^']+)'/);
    if (maarivMatch) return maarivMatch[1];
  }
  
  // Lastly, try to find image URL in the description field
  if (item.description) {
    const descMatch = item.description.match(/<img[^>]+src=["']([^"'>]+)["']/);
    if (descMatch) return descMatch[1];
    
    // For Walla feeds with CDATA in description
    if (item.description.includes('CDATA')) {
      const cdataDescMatch = item.description.match(/\<!\[CDATA\[.*?<img[^>]+src=["']([^"'>]+)["'].*?\]\]>/s);
      if (cdataDescMatch) return cdataDescMatch[1];
    }
    
    // For Maariv feeds using the specific img format in description
    if (item.description.includes('align=\'right\'')) {
      const maarivDescMatch = item.description.match(/src='([^']+)'/);
      if (maarivDescMatch) return maarivDescMatch[1];
    }
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
  // For Walla feeds, clean up CDATA content and extract relevant parts
  else if ((source === 'Walla Politics' || source === 'Walla Knesset') && content.includes('CDATA')) {
    // Extract content from CDATA sections
    const cdataMatches = content.match(/\<!\[CDATA\[(.*?)\]\]>/s);
    if (cdataMatches && cdataMatches[1]) {
      content = cdataMatches[1].trim();
    }
  }
  // For Maariv feeds, extract text after the image tag and more thoroughly clean HTML
  else if (source === 'Maariv Politics') {
    // First handle the case with image align='right'
    if (content.includes('align=\'right\'')) {
      const matches = content.match(/<\/a>\s*<br\/>(.*?)(<br\/>\s*|$)/);
      if (matches && matches[1]) {
        content = matches[1].trim();
      }
    }
    
    // Remove all HTML tags that might remain
    content = content.replace(/<[^>]+>/g, ' ');
    // Convert HTML entities
    content = content.replace(/&nbsp;/g, ' ');
    content = content.replace(/&amp;/g, '&');
    content = content.replace(/&lt;/g, '<');
    content = content.replace(/&gt;/g, '>');
    content = content.replace(/&quot;/g, '"');
    // Remove multiple spaces
    content = content.replace(/\s+/g, ' ').trim();
  }
  
  // Convert any remaining HTML to plain text
  const plainContent = htmlToText(content, { wordwrap: false });
  return plainContent.length > 150 ? plainContent.substring(0, 147) + '...' : plainContent;
};

// Use findPoliticianMentions from the politicians module
const findPoliticianMentions = (text) => {
  return politicianDetection.findPoliticianMentions(text, POLITICIANS);
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
    // For Walla articles
    else if (url.includes('walla.co.il')) {
      mainContent = $('.article-content').text() || $('.article__content').text() || $('.article').text();
      
      // If main content is still empty, try other common selectors
      if (!mainContent || mainContent.trim() === '') {
        mainContent = $('.item-text').text() || $('.article-body').text();
      }
    }
    // For Maariv articles
    else if (url.includes('maariv.co.il')) {
      mainContent = $('.article-body-text').text() || $('.article-body').text() || $('.article-content').text();
      
      // Try to get more specific content if possible
      if (!mainContent || mainContent.trim() === '') {
        mainContent = $('.entry-content').text() || $('.entry-body').text() || $('article').text();
      }
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

// Update article content in the database
const updateArticleContent = async (articleId, content) => {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE articles SET content = ? WHERE id = ?',
      [content, articleId],
      (err) => {
        if (err) {
          console.error(`Error updating article content:`, err);
          reject(err);
        } else {
          console.log(`Updated content for article ${articleId} (${content.length} characters)`);
          resolve(true);
        }
      }
    );
  });
};

// Enhanced politician detection using our module
const enhancedPoliticianDetection = async (article) => {
  return politicianDetection.enhancedPoliticianDetection(
    article, 
    POLITICIANS, 
    scrapeArticleContent,
    updateArticleContent
  );
};

// Update politician mentions for an article
const updatePoliticianMentions = async (articleId, politicians) => {
  if (!articleId || !politicians || politicians.length === 0) return;
  
  try {
    // Get existing mentions for this article
    const existingMentions = await new Promise((resolve, reject) => {
      db.all('SELECT politicianName FROM politician_mentions WHERE articleId = ?', [articleId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows ? rows.map(row => row.politicianName) : []);
        }
      });
    });
    
    // Find new mentions to add
    const newMentions = politicians.filter(p => !existingMentions.includes(p));
    
    if (newMentions.length > 0) {
      // Create values string for SQL INSERT
      const mentionValues = newMentions.map(name => 
        `(${articleId}, '${name.replace(/'/g, "''")}')`
      ).join(',');
      
      // Insert new mentions
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO politician_mentions (articleId, politicianName) VALUES ${mentionValues}`,
          (err) => {
            if (err) {
              console.error('Error inserting politician mentions:', err);
              reject(err);
            } else {
              console.log(`Added ${newMentions.length} new politician mentions for article ${articleId}`);
              resolve();
            }
          }
        );
      });
    }
    
    return newMentions.length;
  } catch (error) {
    console.error(`Error updating politician mentions: ${error.message}`);
    return 0;
  }
}; 