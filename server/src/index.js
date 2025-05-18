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

// Enable foreign key constraints
db.run('PRAGMA foreign_keys = ON', err => {
  if (err) {
    console.error('Error enabling foreign key constraints:', err);
  } else {
    console.log('Foreign key constraints enabled');
  }
});

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

// Import politician detection module
const { loadPoliticians, findPoliticianMentions, enhancedPoliticianDetection } = require('./politician-detection/politicianDetectionService');

// Load politicians from JSON file
const politiciansPath = path.join(__dirname, '../../data/politicians/politicians.json');
const POLITICIANS = loadPoliticians(politiciansPath);

// Log the number of politicians loaded for debugging
console.log(`Loaded ${POLITICIANS.length} politicians for detection`);

// Callback function to update article content in the DB, to be passed to enhancedPoliticianDetection
const updateArticleContentInDbCallback = async (articleId, content) => {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE articles SET content = ? WHERE id = ?',
      [content, articleId],
      (err) => {
        if (err) {
          console.error(`Error updating article content for ID ${articleId}:`, err);
          return reject(err);
        }
        console.log(`DB: Updated content for article ${articleId} (${content ? content.length : 0} characters)`);
        resolve();
      }
    );
  });
};

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

// Update politician mentions for an article
const updatePoliticianMentions = async (articleId, detectedPoliticiansArray) => {
  // Renamed 'politicians' to 'detectedPoliticiansArray' for clarity
  if (!articleId) {
    console.warn('updatePoliticianMentions called with no articleId');
    return 0;
  }

  if (!detectedPoliticiansArray) {
    console.warn(`updatePoliticianMentions for article ${articleId} called with null/undefined detectedPoliticiansArray.`);
    // Treat as an empty array for deletion purposes if article exists
    detectedPoliticiansArray = []; 
  }
  
  console.log(`Attempting to update politician mentions for article ${articleId}. Received ${detectedPoliticiansArray.length} politicians.`);

  try {
    const articleExists = await new Promise((resolve, reject) => {
      db.get('SELECT 1 FROM articles WHERE id = ?', [articleId], (err, row) => {
        if (err) {
          console.error(`DB Error checking if article ${articleId} exists:`, err.message);
          return reject(err); // Propagate error
        }
        resolve(!!row);
      });
    });
    
    if (!articleExists) {
      console.error(`Cannot update politician mentions: Article with ID ${articleId} does not exist.`);
      return 0;
    }

    // Use a transaction to ensure atomicity for delete and inserts
    return await new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            console.error(`DB Error starting transaction for article ${articleId}:`, err.message);
            return reject(err); // Propagate error
          }
          
          // 1. Delete all existing mentions for this article
          db.run('DELETE FROM politician_mentions WHERE articleId = ?', [articleId], function(err) {
            if (err) {
              console.error(`DB Error deleting existing mentions for article ${articleId}:`, err.message);
              db.run('ROLLBACK'); 
              return reject(err); // Propagate error
            }
            console.log(`Deleted ${this.changes} existing mentions for article ${articleId}.`);

            // 2. Insert all new (current) mentions
            if (detectedPoliticiansArray.length > 0) {
              const stmt = db.prepare('INSERT INTO politician_mentions (articleId, politicianName) VALUES (?, ?)');
              let insertedCount = 0;
              let errorDuringInsert = null;

              for (const politicianName of detectedPoliticiansArray) {
                stmt.run(articleId, politicianName, function(errRun) {
                  if (errRun) {
                    console.error(`DB Error inserting mention '${politicianName}' for article ${articleId}:`, errRun.message);
                    errorDuringInsert = errRun; // Capture the first error
                  }
                  if (!errorDuringInsert) {
                    insertedCount++;
                  }
                });
                if (errorDuringInsert) break; // Stop if an error occurred
              }
              
              stmt.finalize((finalizeErr) => {
                if (finalizeErr) {
                   console.error(`DB Error finalizing statement for article ${articleId}:`, finalizeErr.message);
                   // If finalize fails, and we haven't already flagged an insert error, this is the error.
                   if (!errorDuringInsert) errorDuringInsert = finalizeErr;
                }

                if (errorDuringInsert) {
                  db.run('ROLLBACK', rbErr => {
                    if (rbErr) console.error(`DB Error rolling back transaction for article ${articleId} after insert error:`, rbErr.message);
                    return reject(errorDuringInsert); // Propagate the captured insert/finalize error
                  });
                } else {
                  db.run('COMMIT', (commitErr) => {
                    if (commitErr) {
                      console.error(`DB Error committing transaction for article ${articleId}:`, commitErr.message);
                      db.run('ROLLBACK'); // Attempt rollback on commit error
                      return reject(commitErr); // Propagate commit error
                    }
                    console.log(`Successfully committed ${insertedCount} mentions for article ${articleId}.`);
                    resolve(insertedCount);
                  });
                }
              });
            } else {
              // No new politicians to insert, just commit the deletion of old ones
              db.run('COMMIT', (commitErr) => {
                if (commitErr) {
                  console.error(`DB Error committing transaction for article ${articleId} (no new mentions):`, commitErr.message);
                  db.run('ROLLBACK');
                  return reject(commitErr); // Propagate commit error
                }
                console.log(`No new mentions to add for article ${articleId}, committed deletion of old ones.`);
                resolve(0); // 0 mentions inserted
              });
            }
          });
        });
      });
    });

  } catch (error) {
    // Catch errors from article existence check or transaction promise rejections
    console.error(`Critical error in updatePoliticianMentions for article ${articleId}:`, error.message);
    // Ensure a response that indicates failure to the caller if possible, or rethrow
    return 0; // Or throw error; depending on how callers handle it.
  }
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
      politiciansList = politiciansData.map(p => p.name);
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
          
          // Models to try in order
          const models = [
            'llama3-8b-8192',
            'meta-llama/llama-4-scout-17b-16e-instruct', // Added new model as the second option
            'llama-3.1-8b-instant'
          ];
          
          let completion;
          let model;
          let succeeded = false;
          
          // Try each model in sequence until one succeeds
          for (const modelName of models) {
            if (succeeded) break;
            
            model = modelName;
            try {
              console.log(`Attempting to summarize article using model: ${model}`);
              completion = await groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: model,
                temperature: 0.3,
                max_tokens: 1500, // Increased max tokens to allow for longer summaries
                response_format: responseFormat
              });
              succeeded = true;
              console.log(`Successfully summarized with model: ${model}`);
            } catch (modelError) {
              console.log(`Failed with model ${model}: ${modelError.message}`);
            }
          }
          
          // If all models failed, throw an error
          if (!succeeded) {
            throw new Error('All summarization models failed');
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
    
    // Use a transaction to ensure atomicity
    db.serialize(() => {
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) {
          console.error('Error starting transaction:', err);
          return reject(err);
        }
        
        // First insert the article
    db.run(
      `INSERT OR IGNORE INTO articles (title, description, content, link, imageUrl, source, publishedAt, guid, createdAt, summary)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, description, content, link, imageUrl, source, publishedAt, guid, new Date().toISOString(), summary],
      function(err) {
            if (err) {
              console.error('Error inserting article:', err);
              db.run('ROLLBACK', () => reject(err));
              return;
            }
        
        const articleId = this.lastID;
            
            // If no article ID or no mentions, just commit and return
            if (!articleId || mentions.length === 0) {
              db.run('COMMIT', (commitErr) => {
                if (commitErr) {
                  console.error('Error committing transaction:', commitErr);
                  db.run('ROLLBACK', () => reject(commitErr));
                } else {
            resolve(articleId);
          }
              });
              return;
            }
            
            // Verify the article was actually inserted or already exists
            db.get('SELECT id FROM articles WHERE guid = ?', [guid], (err, row) => {
              if (err) {
                console.error('Error finding inserted article:', err);
                db.run('ROLLBACK', () => reject(err));
                return;
              }
              
              // If article exists (either newly inserted or pre-existing), use its ID
              const resolvedArticleId = row ? row.id : articleId;
              if (!resolvedArticleId) {
                console.error('Failed to determine article ID');
                db.run('ROLLBACK', () => reject(new Error('Failed to determine article ID')));
            return;
          }
          
              // Create a prepared statement for politician mentions
              const stmt = db.prepare('INSERT OR IGNORE INTO politician_mentions (articleId, politicianName) VALUES (?, ?)');
              
              let insertedCount = 0;
              let errors = 0;
            
              // Insert each politician mention separately with error handling
              for (const politician of mentions) {
                stmt.run(resolvedArticleId, politician, (err) => {
                  if (err) {
                    console.error(`Error inserting politician mention for article ${resolvedArticleId}:`, err);
                    errors++;
                  } else {
                    insertedCount++;
                  }
                });
              }
              
              // Finalize the prepared statement
              stmt.finalize();
            
              // Commit or rollback based on results
              if (errors > 0) {
                console.error(`Encountered ${errors} errors while inserting politician mentions`);
                db.run('ROLLBACK', () => {
                  reject(new Error('Failed to insert politician mentions'));
                });
              } else {
                db.run('COMMIT', (commitErr) => {
                  if (commitErr) {
                    console.error('Error committing transaction:', commitErr);
                    db.run('ROLLBACK', () => reject(commitErr));
                  } else {
                    console.log(`Successfully inserted article ID ${resolvedArticleId} with ${insertedCount} politician mentions`);
                    resolve(resolvedArticleId);
            }
                });
              }
            });
          }
        );
      });
    });
  });
};

// Process a batch of articles for politician detection
const processBatchForPoliticianDetection = async (articleIds, maxBatchSize = 5) => {
  if (!articleIds.length) return;
  
  console.log(`Processing batch of ${articleIds.length} articles for politician detection`);
  
  let successCount = 0;
  let failureCount = 0;
  
  // Process each article in the batch sequentially to avoid race conditions
  for (const articleId of articleIds) {
    try {
      // Check if article exists before processing
      const articleExists = await new Promise((resolve, reject) => {
        db.get('SELECT id, title FROM articles WHERE id = ?', [articleId], (err, row) => {
          if (err) {
            console.error(`Error checking if article ${articleId} exists:`, err);
            reject(err);
          } else {
            resolve(row);
          }
                });
              });
      
      if (!articleExists) {
        console.error(`Article with ID ${articleId} not found, skipping detection`);
        failureCount++;
        continue;
      }
      
      console.log(`Processing enhanced politician detection for article ID: ${articleId} - "${articleExists.title?.substring(0, 30)}..."`);
          
      // First clear existing mentions to avoid duplicates
            await new Promise((resolve, reject) => {
        db.run('DELETE FROM politician_mentions WHERE articleId = ?', [articleId], (err) => {
          if (err) {
            console.error(`Error clearing existing politician mentions for article ${articleId}:`, err);
            reject(err);
          } else {
            resolve();
          }
              });
            });
            
      // Enhanced politician detection
      const detectedPoliticians = await enhancedPoliticianDetection(articleExists, POLITICIANS, scrapeArticleContent, updateArticleContentInDbCallback);
      console.log(`Article ID ${articleId} - Detected politicians: ${detectedPoliticians.join(', ') || 'None'}`);
      
      // Update mentions in database
      const updatedCount = await updatePoliticianMentions(articleId, detectedPoliticians);
              
      if (updatedCount > 0 || detectedPoliticians.length === 0) {
        successCount++;
      } else if (detectedPoliticians.length > 0 && updatedCount === 0) {
        console.warn(`Warning: Detected ${detectedPoliticians.length} politicians for article ${articleId} but none were saved`);
        failureCount++;
                    }
        } catch (error) {
      console.error(`Error processing article ${articleId}:`, error);
      failureCount++;
      // Continue with next article despite errors
        }
  }
  
  // After processing all articles in the batch, get the count of articles with politicians
  let articlesWithPoliticiansCount = 0;
  try {
    articlesWithPoliticiansCount = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(DISTINCT articleId) as count FROM politician_mentions', [], (err, row) => {
        if (err) {
          console.error('Error fetching count of articles with politicians:', err.message);
          // Don't reject, just resolve with 0 so the main log can still proceed
          resolve(0); 
        } else {
          resolve(row ? row.count : 0);
        }
      });
    });
  } catch (dbError) {
    // Should be caught by the promise's error handler, but as a safeguard
    console.error('Unexpected error querying politician_mentions count:', dbError.message);
    articlesWithPoliticiansCount = 0; // Default to 0 if query fails
  }

  console.log(`Batch processing complete: ${successCount} successful, ${failureCount} failed out of ${articleIds.length} total. Articles with politicians in DB: ${articlesWithPoliticiansCount}`);
  return { successCount, failureCount, totalCount: articleIds.length, articlesWithPoliticiansInDb: articlesWithPoliticiansCount };
};

// Fetch RSS feed with fallback support and rate limiting
const fetchFeed = async (source) => {
  // Check if we need to respect rate limits
  const now = Date.now();
  const lastRequestTime = lastSuccessfulRequests[source.name] || 0;
  const timeSinceLastRequest = now - lastRequestTime;
  const minInterval = source.minRequestInterval || 10 * 60 * 1000; // Default 10 minutes
  
  if (timeSinceLastRequest < minInterval) {
    const timeToWait = minInterval - timeSinceLastRequest;
    console.log(`Rate limiting for ${source.name}: last request was ${Math.round(timeSinceLastRequest/1000/60)} minutes ago, waiting ${Math.round(timeToWait/1000/60)} more minutes`);
    
    // Skip this source for now to respect rate limits
    return { 
      items: [],
      title: source.name,
      description: 'Skipped due to rate limiting',
      link: source.url,
      skipped: true
    };
  }
  
  // Try with the primary URL first
  try {
    console.log(`Attempting to fetch feed from ${source.name} (${source.url})...`);
    const feed = await parser.parseURL(source.url);
    console.log(`Successfully fetched feed from ${source.name} with ${feed.items.length} items`);
    
    // Update last request time on success
    lastSuccessfulRequests[source.name] = Date.now();
    return feed;
  } catch (primaryError) {
    console.log(`Primary URL failed for ${source.name}: ${primaryError.message}`);
    
    // If there's an alternative URL, try that next
    if (source.alternativeUrl) {
      try {
        // Add a small delay before trying alternative URL
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log(`Trying alternative URL for ${source.name}: ${source.alternativeUrl}`);
        const feed = await parser.parseURL(source.alternativeUrl);
        console.log(`Successfully fetched feed from alternative URL for ${source.name} with ${feed.items.length} items`);
        
        // Update last request time on success
        lastSuccessfulRequests[source.name] = Date.now();
        return feed;
      } catch (alternativeError) {
        console.log(`Alternative URL also failed for ${source.name}: ${alternativeError.message}`);
      }
    }
    
    // If both URLs failed or there was no alternative, try the axios fallback
    console.log(`Trying axios fallback method for ${source.name}...`);
    try {
      // Add another small delay before trying axios
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // First try the primary URL with axios
      const url = source.url;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
          'Accept-Language': 'en-US,en;q=0.9,he;q=0.8',
          'Referer': 'https://www.mako.co.il/',
          'Origin': 'https://www.mako.co.il'
        },
        timeout: 15000,
        maxRedirects: 5
      });
      
      // Create a simulated feed object
      const xmlData = response.data;
      const cheerio = require('cheerio');
      const $ = cheerio.load(xmlData, { xmlMode: true });
      
      const items = [];
      
      $('item').each((i, item) => {
        const $item = $(item);
        
        const extractText = (selector) => {
          const element = $item.find(selector);
          return element.length ? element.text() : '';
        };
        
        items.push({
          title: extractText('title'),
          link: extractText('link'),
          description: extractText('description'),
          content: extractText('description'),
          pubDate: extractText('pubDate'),
          guid: extractText('guid') || extractText('link')
        });
      });
      
      const feed = {
        items,
        title: $('channel > title').text(),
        description: $('channel > description').text(),
        link: $('channel > link').text()
      };
      
      console.log(`Successfully parsed feed with axios for ${source.name} with ${items.length} items`);
      
      // Update last request time on success
      lastSuccessfulRequests[source.name] = Date.now();
      return feed;
      
    } catch (axiosError) {
      console.error(`All methods failed for ${source.name}:`, axiosError.message);
      
      // Return an empty feed object instead of throwing
      // This way other sources can still be processed
      console.log(`Returning empty feed for ${source.name} to avoid halting the process`);
      return { 
        items: [],
        title: source.name,
        description: '',
        link: source.url
      };
    }
  }
};

// Fetch and process RSS feeds
const updateFeeds = async () => {
  console.log('Fetching RSS feeds...');
  
  try {
    // Track articles for politician detection
    const articlesToProcess = [];
    let totalArticlesProcessed = 0;
    let sourcesSkipped = 0;
    
    // Process each source sequentially to avoid overwhelming the system
    for (const source of NEWS_SOURCES) {
      try {
        // Fetch feed with our enhanced method
        const feed = await fetchFeed(source);
        
        // If feed was skipped due to rate limiting, count it and continue
        if (feed.skipped) {
          sourcesSkipped++;
          continue;
        }
        
        if (!feed || !feed.items || feed.items.length === 0) {
          console.log(`No items found in feed for ${source.name}, skipping`);
          continue;
        }
        
        let articlesProcessed = 0;
        
        // Process each item in the feed
        for (const item of feed.items) {
          try {
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
            
            // Initial simple politician detection
            const detectedPoliticians = findPoliticianMentions(article.title + ' ' + article.description + ' ' + article.content, POLITICIANS);
            
            // Apply relevance scoring to filter only relevant politicians
            let relevantPoliticians = [];
            if (detectedPoliticians.length > 0) {
              // Create article object for relevance scoring
              const articleForScoring = {
                title: article.title || '',
                description: article.description || '',
                content: article.content || ''
              };
              
              // Get relevance scores for all detected politicians
              const scoredPoliticians = politicianDetection.scorePoliticianRelevance(
                articleForScoring,
                detectedPoliticians
              );
              
              // Get politicians to add to the database using relevance scoring logic
              // This will include either:
              // 1. All politicians that are deemed relevant (score > 0 and meets criteria), OR
              // 2. If no politicians are deemed relevant, up to 2 politicians with the highest scores (as long as > 0)
              const relevantPoliticiansData = politicianDetection.getRelevantPoliticians(scoredPoliticians, {
                minScore: 1, // Minimum score required to be included in the database
                maxCount: 10 // Allow more politicians if they're relevant
              });
              
              // Extract just the politician names
              relevantPoliticians = relevantPoliticiansData.map(p => p.name);
              
              // See if we're using the backup mechanism
              const primaryRelevantCount = scoredPoliticians.filter(p => p.isRelevant).length;
              if (primaryRelevantCount === 0 && relevantPoliticians.length > 0) {
                console.log(`Article "${article.title.substring(0, 40)}...": Using backup relevance mechanism - no primary relevant politicians found, using top ${relevantPoliticians.length} scored politicians`);
              }
              
              if (relevantPoliticians.length < detectedPoliticians.length) {
                console.log(`Initial relevance filtering: ${detectedPoliticians.length} detected → ${relevantPoliticians.length} relevant for article "${article.title.substring(0, 40)}..."`);
              }
            }
            
            // Only insert politicians that passed the relevance filter
            const articleId = await insertArticle(article, relevantPoliticians);
            
            // If a new article was inserted, add it to the processing queue for enhanced detection
            if (articleId) {
              articlesToProcess.push(articleId);
              articlesProcessed++;
            }
          } catch (itemError) {
            console.error(`Error processing item from ${source.name}:`, itemError.message);
            continue; // Skip this item but continue with others
          }
        }
        
        totalArticlesProcessed += articlesProcessed;
        console.log(`Processed ${articlesProcessed} items from ${source.name}`);
      } catch (sourceError) {
        console.error(`Failed to process source ${source.name}:`, sourceError.message);
        continue; // Skip this source but continue with others
      }
    }
    
    console.log(`RSS feed update completed. Total articles processed: ${totalArticlesProcessed}, Sources skipped due to rate limiting: ${sourcesSkipped}`);
    
    // Process articles for enhanced politician detection
    if (articlesToProcess.length > 0) {
      console.log(`Scheduling enhanced detection for ${articlesToProcess.length} new articles`);
      processBatchForPoliticianDetection(articlesToProcess);
    } else {
      console.log('No new articles to process for enhanced detection');
    }
  } catch (error) {
    console.error('Unexpected error updating feeds:', error);
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
      
      // TEMPORARILY MODIFIED: Run enhanced politician detection instead of summarization
      console.log(`Running enhanced politician detection for article ID: ${articleId}`);
      
      // Run enhanced politician detection
      const detectedPoliticians = await enhancedPoliticianDetection(article, POLITICIANS, scrapeArticleContent, updateArticleContentInDbCallback);
      
      // Update the article's politician mentions
      const addedCount = await updatePoliticianMentions(articleId, detectedPoliticians);
      
      // Get full list of politicians for this article
      const allDetectedPoliticians = await new Promise((resolve, reject) => {
        db.all('SELECT politicianName FROM politician_mentions WHERE articleId = ?', [articleId], (err, rows) => {
          if (err) reject(err);
          else resolve(rows ? rows.map(row => row.politicianName) : []);
        });
      });
      
      // Return the detected politicians
      res.json({
        success: true,
        article: {
          id: article.id,
          title: article.title,
          description: article.description,
          link: article.link,
          source: article.source,
          publishedAt: article.publishedAt
        },
        politicians: {
          detected: detectedPoliticians,
          newlyAdded: addedCount > 0 ? detectedPoliticians.filter(p => allDetectedPoliticians.includes(p)).slice(-addedCount) : [],
          all: allDetectedPoliticians
        },
        message: 'Enhanced politician detection completed'
      });
      
      /* TEMPORARILY DISABLED: Summarization
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
      */
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
      '/api/news?onlyWithPoliticians=true - Get only articles with politician mentions',
      '/api/news?sort=publishedAt&order=desc - Sort articles by publication date',
      '/api/news/:id - Get a specific news article',
      '/api/news-stats/all - Get statistics about articles',
      '/api/summarize/:id - Generate or retrieve a summary for an article',
      '/api/refresh - Trigger a manual feed update (admin)',
      '/api/clear - Clear all news articles from the database (admin)',
      '/api/reset-politicians - Clear all politician mentions and reprocess (admin)',
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

// API endpoint to clear all politician mentions (requires admin API key)
app.post('/api/reset-politicians', async (req, res) => {
  // Check if API key is provided (simple auth)
  const apiKey = req.headers['x-admin-api-key'] || req.query.apiKey;
  if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized - Admin API key required' });
  }
  
  console.log('Starting politician mentions reset process...');
  
  try {
    // Step 1: Delete all politician mentions
    await new Promise((resolve, reject) => {
      console.log('Clearing all politician mentions...');
  db.run('DELETE FROM politician_mentions', (err) => {
    if (err) {
      console.error('Error clearing politician mentions:', err);
          reject(err);
        } else {
          console.log('All politician mentions cleared successfully');
          resolve();
    }
      });
    });
    
    // Send immediate response that deletion was successful
    res.json({ message: 'All politician mentions cleared successfully' });
    
    // Step 2: Get all article IDs
    console.log('Re-processing all articles for politician detection...');
    const articleIds = await new Promise((resolve, reject) => {
      db.all('SELECT id FROM articles ORDER BY id', [], (err, rows) => {
      if (err) {
        console.error('Error fetching articles for reprocessing:', err);
          reject(err);
        } else {
          resolve(rows.map(row => row.id));
      }
      });
    });
      
      if (articleIds.length > 0) {
      console.log(`Found ${articleIds.length} articles to process`);
      
      // Step 3: Process articles in smaller batches to avoid overwhelming the system
      const batchSize = 10; // Process 10 articles at a time
      let processed = 0;
      
      for (let i = 0; i < articleIds.length; i += batchSize) {
        const batch = articleIds.slice(i, Math.min(i + batchSize, articleIds.length));
        try {
          await processPoliticianDetectionBatch(batch);
          processed += batch.length;
          console.log(`Processed ${processed}/${articleIds.length} articles`);
        } catch (error) {
          console.error(`Error processing batch starting at article ${batch[0]}:`, error);
          // Continue with next batch despite errors
        }
      }
      
      console.log(`Politician detection reset completed: ${processed}/${articleIds.length} articles processed`);
    } else {
      console.log('No articles found for reprocessing');
    }
  } catch (error) {
    console.error('Error in reset-politicians process:', error);
    // Response already sent, so we can't send an error response here
  }
});

// Process a batch of articles for politician detection with proper error handling
const processPoliticianDetectionBatch = async (articleIds) => {
  if (!articleIds || articleIds.length === 0) return;
  
  console.log(`Processing batch of ${articleIds.length} articles for politician detection`);
  
  let successCount = 0;
  let failureCount = 0;
  
  // Process each article in the batch sequentially to avoid race conditions
  for (const articleId of articleIds) {
    try {
      // Check if article exists before processing
      const articleExists = await new Promise((resolve, reject) => {
        db.get('SELECT id, title, description, content, link FROM articles WHERE id = ?', [articleId], (err, row) => {
          if (err) {
            console.error(`Error checking if article ${articleId} exists:`, err);
            reject(err);
          } else {
            resolve(row);
          }
  });
});
      
      if (!articleExists) {
        console.error(`Article with ID ${articleId} not found, skipping detection`);
        failureCount++;
        continue;
      }
      
      console.log(`Processing enhanced politician detection for article ID: ${articleId} - "${articleExists.title?.substring(0, 30)}..."`);
      
      // First clear existing mentions to avoid duplicates
      await new Promise((resolve, reject) => {
        db.run('DELETE FROM politician_mentions WHERE articleId = ?', [articleId], (err) => {
          if (err) {
            console.error(`Error clearing existing politician mentions for article ${articleId}:`, err);
            reject(err);
          } else {
            resolve();
          }
        });
      });
      
      // Enhanced politician detection
      const detectedPoliticians = await enhancedPoliticianDetection(articleExists, POLITICIANS, scrapeArticleContent, updateArticleContentInDbCallback);
      console.log(`Article ID ${articleId} - Detected politicians: ${detectedPoliticians.join(', ') || 'None'}`);
      
      // Update mentions in database
      const updatedCount = await updatePoliticianMentions(articleId, detectedPoliticians);
      
      if (updatedCount > 0 || detectedPoliticians.length === 0) {
        successCount++;
      } else if (detectedPoliticians.length > 0 && updatedCount === 0) {
        console.warn(`Warning: Detected ${detectedPoliticians.length} politicians for article ${articleId} but none were saved`);
        failureCount++;
      }
    } catch (error) {
      console.error(`Error processing article ${articleId}:`, error);
      failureCount++;
      // Continue with next article despite errors
    }
  }
  
  // After processing all articles in the batch, get the count of articles with politicians
  let articlesWithPoliticiansCount = 0;
  try {
    articlesWithPoliticiansCount = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(DISTINCT articleId) as count FROM politician_mentions', [], (err, row) => {
        if (err) {
          console.error('Error fetching count of articles with politicians:', err.message);
          // Don't reject, just resolve with 0 so the main log can still proceed
          resolve(0); 
        } else {
          resolve(row ? row.count : 0);
        }
      });
    });
  } catch (dbError) {
    // Should be caught by the promise's error handler, but as a safeguard
    console.error('Unexpected error querying politician_mentions count:', dbError.message);
    articlesWithPoliticiansCount = 0; // Default to 0 if query fails
  }

  console.log(`Batch processing complete: ${successCount} successful, ${failureCount} failed out of ${articleIds.length} total. Articles with politicians in DB: ${articlesWithPoliticiansCount}`);
  return { successCount, failureCount, totalCount: articleIds.length, articlesWithPoliticiansInDb: articlesWithPoliticiansCount };
};

// Get all articles with pagination
app.get('/api/news', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const onlySummarized = req.query.onlySummarized === 'true';
    const onlyWithPoliticians = req.query.onlyWithPoliticians === 'true';
    const sort = req.query.sort || 'publishedAt';
    const order = req.query.order === 'asc' ? 'ASC' : 'DESC';
    
    // Build the query based on filters
    let baseQuery = `
      SELECT 
        a.*,
        GROUP_CONCAT(DISTINCT pm.politicianName) as mentionedPoliticians
      FROM articles a
      LEFT JOIN politician_mentions pm ON a.id = pm.articleId
      WHERE a.description IS NOT NULL AND a.description != '' 
      AND (LENGTH(a.description) - LENGTH(REPLACE(a.description, ' ', '')) + 1) >= 10
    `;
    
    // Add filter for summarized articles if requested
    if (onlySummarized) {
      baseQuery += ` AND a.summary IS NOT NULL AND a.summary != '' `;
    }
    
    // Add filter for articles with politician mentions if requested
    if (onlyWithPoliticians) {
      baseQuery += ` AND EXISTS (
        SELECT 1 FROM politician_mentions pm2 
        WHERE pm2.articleId = a.id
        LIMIT 1
      ) `;
    }
    
    // Add group by, sort and pagination
    baseQuery += `
      GROUP BY a.id
      ORDER BY ${sort} ${order}
      LIMIT ? OFFSET ?
    `;
    
    console.log(`Executing query with filters: onlySummarized=${onlySummarized}, onlyWithPoliticians=${onlyWithPoliticians}`);
    console.log('SQL query:', baseQuery);
    
    // Execute the query
    db.all(baseQuery, [limit, offset], (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        console.error('Failed query:', baseQuery);
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Count total for pagination with the same filters
      let countQuery = `
        SELECT COUNT(*) as count 
        FROM articles a
        WHERE description IS NOT NULL AND description != '' 
        AND (LENGTH(description) - LENGTH(REPLACE(description, ' ', '')) + 1) >= 10
      `;
      
      // Add the same filters to count query
      if (onlySummarized) {
        countQuery += ` AND summary IS NOT NULL AND summary != '' `;
      }
      
      if (onlyWithPoliticians) {
        countQuery += ` AND EXISTS (
          SELECT 1 FROM politician_mentions pm 
          WHERE pm.articleId = a.id
          LIMIT 1
        ) `;
      }
      
      console.log('Count query:', countQuery);
      
      db.get(countQuery, [], (err, countRow) => { // Removed params from countQuery as it's not parameterized in this version
        if (err) {
          console.error('Count error:', err);
          console.error('Failed query:', countQuery);
          return res.status(500).json({ error: 'Database error' });
        }
        
        const total = countRow.count || 0;
        const totalPages = Math.ceil(total / limit);
        
        console.log(`Found ${rows.length} articles matching criteria, ${total} total`);
        
        // Format the response
        const formattedArticles = rows.map(row => {
          const article = { ...row };
          let mentionedPoliticiansArray = [];
          
          if (row.mentionedPoliticians) {
            if (Array.isArray(row.mentionedPoliticians)) {
              mentionedPoliticiansArray = [...new Set(row.mentionedPoliticians.filter(p => p && p.trim() !== ''))];
            } else if (typeof row.mentionedPoliticians === 'string') {
              mentionedPoliticiansArray = [...new Set(row.mentionedPoliticians.split(',').filter(p => p && p.trim() !== ''))];
            }
          }
          
          article.uuid = article.id ? `article-${article.id}` : `article-${uuidv4()}`; // uuidv4 needs to be defined or imported
          
          const politicianMentionContext = mentionedPoliticiansArray.map(politicianName => {
            const titleContext = extractContext(article.title, politicianName);
            const descriptionContext = extractContext(article.description, politicianName);
            const contentContext = extractContext(article.content, politicianName);
            return {
              politicianName,
              titleContext,
              descriptionContext,
              contentContext
            };
          });

          if (row.id && mentionedPoliticiansArray.length > 0) {
            console.log(`Article ${row.id} has politicians: ${JSON.stringify(mentionedPoliticiansArray)}`);
          }
            
          return {
            ...article,
            mentionedPoliticians: mentionedPoliticiansArray,
            politicianMentionContext // New field
          };
        });
        
        res.json({
          news: formattedArticles,
          pagination: {
            page,
            pages: totalPages,
            total
          },
          filters: {
            onlySummarized,
            onlyWithPoliticians,
            sort,
            order
          }
        });
      });
    });
  } catch (error) {
    console.error('Unexpected error in /api/news:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Add an endpoint for stats including politician data
app.get('/api/news-stats/all', (req, res) => {
  db.get(
    `SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN summary IS NOT NULL AND summary != '' THEN 1 ELSE 0 END) as withSummary,
      SUM(CASE WHEN summary IS NULL OR summary = '' THEN 1 ELSE 0 END) as withoutSummary,
      (SELECT COUNT(DISTINCT articleId) FROM politician_mentions) as withPoliticians
    FROM articles`,
    [],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json({
        stats: {
          total: row.total || 0,
          withSummary: row.withSummary || 0,
          withoutSummary: row.withoutSummary || 0,
          withPoliticians: row.withPoliticians || 0,
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
      GROUP_CONCAT(DISTINCT pm.politicianName) as mentionedPoliticians
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
        uuid: `article-${row.id}`,
        mentionedPoliticians: row.mentionedPoliticians 
          ? [...new Set(row.mentionedPoliticians.split(',').filter(p => p && p.trim() !== ''))]
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

// Debug endpoint to test politician detection
app.get('/api/debug/test-politician-detection', (req, res) => {
  try {
    // Test texts containing references to various politicians
    const testTexts = [
      "ראש הממשלה בנימין נתניהו הודיע היום על תוכנית חדשה",
      "יאיר לפיד, ראש האופוזיציה, מתנגד לתוכנית החדשה",
      "שר האוצר בצלאל סמוטריץ' אמר כי התוכנית הכלכלית תיושם בקרוב",
      "אבי מעוז, השר לביטחון פנים, מגיב לאירועי הביטחון האחרונים"
    ];
    
    // Test results
    const results = testTexts.map(text => {
      return {
        text: text,
        detectedPoliticians: findPoliticianMentions(text, POLITICIANS)
      };
    });
    
    // Count all available politicians
    const totalPoliticians = POLITICIANS.length;
    
    // Sample 5 random politicians from our list
    const randomPoliticians = [];
    for (let i = 0; i < 5 && i < POLITICIANS.length; i++) {
      const randomIndex = Math.floor(Math.random() * POLITICIANS.length);
      randomPoliticians.push({
        name: POLITICIANS[randomIndex].name,
        aliases: POLITICIANS[randomIndex].aliases
      });
    }
    
    return res.json({
      success: true,
      totalPoliticians,
      randomPoliticians,
      testResults: results
    });
  } catch (error) {
    console.error('Error testing politician detection:', error);
    return res.status(500).json({ error: 'Error testing politician detection' });
  }
});

// API endpoint to fix politician detection for a specific article (requires admin API key)
app.post('/api/fix-politician-detection/:id', async (req, res) => {
  // Check if API key is provided (simple auth)
  const apiKey = req.headers['x-admin-api-key'] || req.query.apiKey;
  if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized - Admin API key required' });
  }
  
  const articleId = parseInt(req.params.id);
  if (isNaN(articleId)) {
    return res.status(400).json({ error: 'Invalid article ID' });
  }
  
  try {
    // Get article from database
    const article = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM articles WHERE id = ?', [articleId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!article) {
      return res.status(404).json({ error: `Article with ID ${articleId} not found` });
    }
    
    console.log(`Fixing politician detection for article ID: ${articleId}`);
    console.log(`Title: ${article.title}`);
    
    // Clear existing politician mentions for this article
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM politician_mentions WHERE articleId = ?', [articleId], (err) => {
        if (err) {
          console.error(`Error clearing politician mentions for article ${articleId}:`, err);
          reject(err);
        } else {
          console.log(`Cleared existing politician mentions for article ${articleId}`);
          resolve();
        }
      });
    });
    
    // Run enhanced politician detection
    const detailedDetectionResult = await enhancedPoliticianDetection(article, POLITICIANS, scrapeArticleContent, updateArticleContentInDbCallback);
    console.log(`Article ID ${articleId} - Detailed detection result:`, JSON.stringify(detailedDetectionResult, null, 2)); // Log the detailed result for debugging
    
    // Extract names for updating the database, ensuring uniqueness
    const detectedPoliticianNames = [...new Set(detailedDetectionResult.map(p => p.name))];
    console.log(`Article ID ${articleId} - Extracted unique names for DB: ${detectedPoliticianNames.join(', ') || 'None'}`);

    // Update mentions in database
    await updatePoliticianMentions(articleId, detectedPoliticianNames);
    
    // Verify the update by fetching the names again
    const updatedMentions = await new Promise((resolve, reject) => {
      db.all('SELECT politicianName FROM politician_mentions WHERE articleId = ?', [articleId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows ? rows.map(row => row.politicianName) : []);
        }
      });
    });
    
    return res.json({
      message: `Politician detection fixed for article ${articleId}`,
      before: article.mentionedPoliticians || [], 
      after: updatedMentions, 
      detectionResult: detailedDetectionResult // Send the full detailed result
    });
  } catch (error) {
    console.error(`Error fixing politician detection for article ${articleId}:`, error);
    return res.status(500).json({ error: `Failed to fix politician detection: ${error.message}` });
  }
});

// Start the server
initDatabase()
  .then(() => {
    app.listen(config.port, () => {
      console.log(`Server running on ${config.isProduction ? config.apiBaseUrl : 'http://localhost:' + config.port}`);
      console.log(`API ready for connections - RSS feeds will be updated with ${Math.round(UPDATE_INTERVAL/1000/60)} minute intervals`);
      
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
              
              // Delay the initial feed update to avoid immediate requests
              const initialDelay = 10000; // 10 seconds
              console.log(`Initial feed update will start in ${initialDelay/1000} seconds...`);
              
              setTimeout(() => {
                // Initial feed update 
                updateFeeds();
                
                // Schedule regular updates with the defined interval
                setInterval(updateFeeds, UPDATE_INTERVAL);
              }, initialDelay);
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