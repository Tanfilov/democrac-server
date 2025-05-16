/**
 * Test Server - Entry Point
 * 
 * This is a simplified version of the main server
 * designed for testing purposes.
 */

// Load environment variables
require('dotenv').config();

const express = require('express');
const Parser = require('rss-parser');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const { format } = require('date-fns');
const fs = require('fs');
const config = require('./config');

// Import politician detection module
const politicianDetection = require('./politician-detection');

console.log('Starting server in TEST MODE');
console.log(`Config: port=${config.port}, db=${config.db.path}, inMemory=${config.db.inMemory}`);

// Initialize Express app
const app = express();
const PORT = config.port;

// Enable CORS
app.use(cors({
  origin: config.cors.origin
}));
app.use(express.json());

// Initialize SQLite database
const db = config.db.inMemory 
  ? new sqlite3.Database(':memory:') 
  : new sqlite3.Database(config.db.path);

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

// Load politicians from JSON file
let POLITICIANS = [];
try {
  const politiciansPath = config.politicians.path;
  if (fs.existsSync(politiciansPath)) {
    POLITICIANS = politicianDetection.loadPoliticians(politiciansPath);
    console.log(`Loaded ${POLITICIANS.length} politicians for detection`);
  } else {
    console.warn(`Politicians file not found at ${politiciansPath}`);
  }
} catch (error) {
  console.error('Error loading politicians:', error);
}

// Basic test routes

// Default route
app.get('/', (req, res) => {
  res.json({
    message: 'Democracy Server - TEST ENVIRONMENT',
    environment: process.env.NODE_ENV || 'development',
    config: {
      port: config.port,
      isProduction: config.isProduction,
      features: config.features
    },
    endpoints: [
      '/api/politicians - Get all politicians',
      '/api/test/detect - Test politician detection',
      '/api/test/feed - View captured feeds'
    ]
  });
});

// Get politicians
app.get('/api/politicians', (req, res) => {
  res.json(POLITICIANS);
});

// Test politician detection
app.post('/api/test/detect', (req, res) => {
  const { text } = req.body;
  
  if (!text) {
    return res.status(400).json({ error: 'No text provided' });
  }
  
  const detectedPoliticians = politicianDetection.findPoliticianMentions(text, POLITICIANS);
  
  res.json({
    text,
    detectedPoliticians,
    count: detectedPoliticians.length
  });
});

// View captured feeds
app.get('/api/test/feed', (req, res) => {
  const capturedFeedsDir = config.feeds.capturedFeedsDir;
  
  try {
    if (!fs.existsSync(capturedFeedsDir)) {
      return res.status(404).json({ error: 'No captured feeds found' });
    }
    
    const files = fs.readdirSync(capturedFeedsDir);
    const feedFiles = files.filter(file => file.endsWith('.xml'));
    
    // Get requested feed
    const { name } = req.query;
    
    if (name) {
      const matchingFile = feedFiles.find(file => file.includes(name));
      
      if (!matchingFile) {
        return res.status(404).json({ error: `No feed found matching "${name}"` });
      }
      
      const feedPath = path.join(capturedFeedsDir, matchingFile);
      const content = fs.readFileSync(feedPath, 'utf8');
      
      return res.type('application/xml').send(content);
    }
    
    // List all feeds
    res.json({
      capturedFeeds: feedFiles.map(file => ({
        name: file,
        path: `/api/test/feed?name=${encodeURIComponent(file.split('_')[0])}`,
        date: file.split('_')[1]?.replace('.xml', '') || 'unknown'
      }))
    });
  } catch (error) {
    console.error('Error accessing captured feeds:', error);
    res.status(500).json({ error: 'Error accessing captured feeds' });
  }
});

// Start the server
initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Test server running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });

module.exports = app; 