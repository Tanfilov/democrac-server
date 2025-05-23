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

// Database Initialization
const initDatabase = () => {
  console.log('Starting database initialization...');
  return new Promise((resolve, reject) => {
    // Create tables if they don't exist
    db.serialize(() => {
      console.log('Creating/checking articles table...');
      // Create articles table
      db.run(`CREATE TABLE IF NOT EXISTS articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        link TEXT UNIQUE NOT NULL,
        description TEXT,
        publishedAt TEXT,
        source TEXT,
        imageUrl TEXT,
        content TEXT,
        summary TEXT,
        uuid TEXT UNIQUE
      )`, err => {
        if (err) {
          console.error('Error creating articles table:', err);
          return reject(err);
        }
        console.log('Articles table ready');
      });

      console.log('Creating/checking politician_mentions table...');
      // Create politician_mentions table with foreign key constraint
      db.run(`CREATE TABLE IF NOT EXISTS politician_mentions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        article_id INTEGER NOT NULL,
        politician_id TEXT NOT NULL,
        politician_name TEXT NOT NULL,
        party TEXT,
        FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
      )`, err => {
        if (err) {
          console.error('Error creating politician_mentions table:', err);
          return reject(err);
        }
        console.log('Politician_mentions table ready');
        
        // Successfully created/verified both tables
        console.log('Database initialization complete');
        resolve();
      });
    });
  });
};

// API Routes
// Root endpoint with documentation
app.get('/', (req, res) => {
  res.json({
    status: 'Democracy Server API is running',
    endpoints: [
      '/api/news',
      '/api/news/:id',
      '/api/politicians',
      '/api/news-stats/all'
    ],
    docs: 'For more details, see api-endpoints.md'
  });
});

// Get all news articles with flexible filtering
app.get('/api/news', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  
  // Build query conditions
  let conditions = [];
  let params = [];
  
  if (req.query.onlySummarized === 'true') {
    conditions.push('summary IS NOT NULL');
  }
  
  // Sorting
  const sortField = req.query.sort || 'publishedAt';
  const sortOrder = req.query.order === 'asc' ? 'ASC' : 'DESC';
  
  // Get total count query
  const countQuery = `
    SELECT COUNT(*) as total FROM articles
    ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
  `;
  
  // Only with politicians filter needs to be handled separately
  if (req.query.onlyWithPoliticians === 'true') {
    const query = `
      SELECT a.*, GROUP_CONCAT(DISTINCT pm.politician_name) as mentionedPoliticians 
      FROM articles a
      JOIN politician_mentions pm ON a.id = pm.article_id
      ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
      GROUP BY a.id
      ORDER BY a.${sortField} ${sortOrder}
      LIMIT ? OFFSET ?
    `;
    
    db.all(query, [...params, limit, offset], (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Process the results to format mentionedPoliticians
      const processedRows = rows.map(row => {
        return {
          ...row,
          mentionedPoliticians: row.mentionedPoliticians ? row.mentionedPoliticians.split(',') : []
        };
      });
      
      // Get the total count for pagination
      db.get(countQuery, params, (err, countResult) => {
        if (err) {
          console.error('Count query error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        res.json({
          data: processedRows,
          pagination: {
            total: countResult.total,
            page,
            limit,
            totalPages: Math.ceil(countResult.total / limit)
          }
        });
      });
    });
  } else {
    // Standard query for all articles
    const query = `
      SELECT a.*, GROUP_CONCAT(DISTINCT pm.politician_name) as mentionedPoliticians 
      FROM articles a
      LEFT JOIN politician_mentions pm ON a.id = pm.article_id
      ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
      GROUP BY a.id
      ORDER BY a.${sortField} ${sortOrder}
      LIMIT ? OFFSET ?
    `;
    
    db.all(query, [...params, limit, offset], (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Process the results to format mentionedPoliticians
      const processedRows = rows.map(row => {
        return {
          ...row,
          mentionedPoliticians: row.mentionedPoliticians ? row.mentionedPoliticians.split(',') : []
        };
      });
      
      // Get the total count for pagination
      db.get(countQuery, params, (err, countResult) => {
        if (err) {
          console.error('Count query error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        res.json({
          data: processedRows,
          pagination: {
            total: countResult.total,
            page,
            limit,
            totalPages: Math.ceil(countResult.total / limit)
          }
        });
      });
    });
  }
});

// Get specific news article by ID
app.get('/api/news/:id', (req, res) => {
  const id = req.params.id;

  const query = `
    SELECT a.*, GROUP_CONCAT(DISTINCT pm.politician_name) as mentionedPoliticians 
    FROM articles a
    LEFT JOIN politician_mentions pm ON a.id = pm.article_id
    WHERE a.id = ?
    GROUP BY a.id
  `;
  
  db.get(query, [id], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!row) {
      return res.status(404).json({ error: 'Article not found' });
    }
    
    // Format mentionedPoliticians
    row.mentionedPoliticians = row.mentionedPoliticians ? row.mentionedPoliticians.split(',') : [];
    
    res.json(row);
  });
});

// Get list of all tracked politicians
app.get('/api/politicians', (req, res) => {
  try {
    const politiciansFile = path.join(__dirname, '../../data/politicians/politicians.json');
    const politicians = JSON.parse(fs.readFileSync(politiciansFile, 'utf8'));
    res.json(politicians);
  } catch (error) {
    console.error('Error reading politicians file:', error);
    res.status(500).json({ error: 'Failed to load politicians data' });
  }
});

// Get statistics about articles
app.get('/api/news-stats/all', (req, res) => {
  const queries = {
    totalArticles: `SELECT COUNT(*) as count FROM articles`,
    articlesWithPoliticians: `
      SELECT COUNT(DISTINCT article_id) as count 
      FROM politician_mentions
    `,
    politicianMentions: `
      SELECT politician_name, COUNT(*) as count 
      FROM politician_mentions 
      GROUP BY politician_name 
      ORDER BY count DESC
    `,
    articlesBySource: `
      SELECT source, COUNT(*) as count 
      FROM articles 
      GROUP BY source 
      ORDER BY count DESC
    `,
    articlesByDay: `
      SELECT substr(publishedAt, 1, 10) as day, COUNT(*) as count 
      FROM articles 
      GROUP BY day 
      ORDER BY day DESC
    `
  };
  
  const stats = {};
  
  // Execute all queries in parallel
  const promises = Object.entries(queries).map(([key, query]) => {
    return new Promise((resolve, reject) => {
      if (key === 'totalArticles' || key === 'articlesWithPoliticians') {
        db.get(query, (err, row) => {
          if (err) return reject(err);
          stats[key] = row.count;
          resolve();
        });
      } else {
        db.all(query, (err, rows) => {
          if (err) return reject(err);
          stats[key] = rows;
          resolve();
        });
      }
    });
  });
  
  Promise.all(promises)
    .then(() => {
      res.json(stats);
    })
    .catch(err => {
      console.error('Error getting stats:', err);
      res.status(500).json({ error: 'Failed to get statistics' });
    });
});

// Placeholder for feed update functionality
const updateFeeds = () => {
  console.log('Feed update scheduled at:', new Date().toISOString());
  // Feed update logic would go here
};

// Improved server startup for Render deployment
console.log('Initializing server...');
initDatabase()
  .then(() => {
    console.log('Database initialized, now starting HTTP server...');
    try {
      // Listen on all interfaces (0.0.0.0) for Render compatibility
      const server = app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Listening on all interfaces (0.0.0.0:${PORT})`);
        
        // Schedule regular updates
        console.log(`Setting update interval to ${UPDATE_INTERVAL}ms`);
        setInterval(updateFeeds, UPDATE_INTERVAL);
      });
      
      // Error handling for the server
      server.on('error', (error) => {
        console.error('Server error:', error);
        if (error.code === 'EADDRINUSE') {
          console.error(`Port ${PORT} is already in use`);
          process.exit(1);
        }
      });
    } catch (error) {
      console.error('Error starting server:', error);
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  }); 
