# How to Obtain RSS News & Save to Database

This document details the exact process for fetching news from RSS feeds and saving articles to the SQLite database as implemented in the democracy-server project.

## 1. System Overview

The RSS feed fetching and database storage process is primarily handled by the `server/src/index.js` file. The core components are:

- **RSS Feed Sources**: Defined in the `NEWS_SOURCES` array
- **Rate Limiting**: Each source has configurable rate limits
- **Data Processing**: Articles are parsed, cleaned, and processed before storage
- **Database Storage**: Articles are saved to SQLite with politician mentions detection
- **Scheduled Updates**: Feeds are refreshed at regular intervals

## 2. Database Structure

The system uses SQLite with two primary tables:

- **`articles`**: Stores article metadata and content
  ```sql
  CREATE TABLE articles (
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
  )
  ```

- **`politician_mentions`**: Tracks politicians mentioned in each article
  ```sql
  CREATE TABLE politician_mentions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    articleId INTEGER,
    politicianName TEXT NOT NULL,
    FOREIGN KEY (articleId) REFERENCES articles(id)
  )
  ```

## 3. Detailed Implementation

### 3.1 RSS Feed Configuration

All news sources are defined in the `NEWS_SOURCES` array:

```javascript
const NEWS_SOURCES = [
  { 
    url: 'https://www.ynet.co.il/Integration/StoryRss2.xml', 
    name: 'Ynet',
    minRequestInterval: 15 * 60 * 1000 // 15 minutes between requests
  },
  { 
    url: 'https://rcs.mako.co.il/rss/news-military.xml?Partner=interlink', 
    name: 'Mako Military',
    alternativeUrl: 'https://www.mako.co.il/news-military?partner=rss',
    minRequestInterval: 30 * 60 * 1000 // 30 minutes between requests
  },
  // Additional sources...
]
```

Each source object contains:
- `url`: Primary RSS feed URL
- `name`: Source identifier
- `minRequestInterval`: Rate limiting in milliseconds
- `alternativeUrl` (optional): Backup URL if primary fails

### 3.2 RSS Fetching Process

The entire process is managed by the `updateFeeds` function, which:

1. Iterates through each defined RSS source
2. Fetches and parses the XML feed
3. Processes each article in the feed
4. Saves new/updated articles to the database

```javascript
// The main function that orchestrates the feed update process
const updateFeeds = async () => {
  console.log(`Starting feed updates at ${new Date().toISOString()}`);
  
  for (const source of NEWS_SOURCES) {
    try {
      const feed = await fetchFeed(source);
      
      if (feed && feed.items && feed.items.length > 0) {
        console.log(`Fetched ${feed.items.length} items from ${source.name}`);
        
        // Process each article in the feed
        for (const item of feed.items) {
          try {
            // Extract article details from the RSS item
            const article = {
              title: item.title,
              description: extractCleanDescription(item, source.name),
              link: item.link,
              imageUrl: extractImageUrl(item),
              source: source.name,
              publishedAt: new Date(item.pubDate || item.isoDate).toISOString(),
              guid: item.guid || item.link,
              createdAt: new Date().toISOString(),
              content: item.content || item.contentSnippet || ''
            };
            
            // Save the article to the database
            insertArticle(article, []);
          } catch (error) {
            console.error(`Error processing item from ${source.name}:`, error);
          }
        }
      } else {
        console.warn(`No items found in feed ${source.name} or failed to fetch`);
      }
    } catch (error) {
      console.error(`Error updating feed from ${source.name}:`, error);
    }
  }
  
  console.log(`Completed feed updates at ${new Date().toISOString()}`);
};
```

### 3.3 Fetching Individual Feeds

The `fetchFeed` function handles the actual HTTP request to each RSS feed URL:

```javascript
const fetchFeed = async (source) => {
  try {
    console.log(`Fetching feed from ${source.name}: ${source.url}`);
    const feed = await parser.parseURL(source.url);
    return feed;
  } catch (error) {
    console.error(`Error fetching feed from ${source.name}:`, error);
    
    // Try alternate URL if available
    if (source.alternativeUrl) {
      try {
        console.log(`Trying alternative URL for ${source.name}: ${source.alternativeUrl}`);
        const feed = await parser.parseURL(source.alternativeUrl);
        return feed;
      } catch (altError) {
        console.error(`Error fetching from alternative URL for ${source.name}:`, altError);
      }
    }
    
    return null;
  }
};
```

### 3.4 Processing & Saving Articles

The `insertArticle` function handles database insertion with duplicate detection:

```javascript
const insertArticle = (article, mentions) => {
  const { title, description, link, imageUrl, source, publishedAt, guid, createdAt, content } = article;
  
  // Start a transaction to ensure data integrity
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    // Check if article already exists (by guid or link)
    db.get('SELECT id FROM articles WHERE guid = ? OR link = ?', [guid, link], (err, row) => {
      if (err) {
        console.error('Error checking for existing article:', err);
        db.run('ROLLBACK');
        return;
      }
      
      if (row) {
        // Article exists, update it
        const articleId = row.id;
        
        db.run(
          'UPDATE articles SET title = ?, description = ?, content = ?, imageUrl = ?, updatedAt = ? WHERE id = ?',
          [title, description, content, imageUrl, new Date().toISOString(), articleId],
          (err) => {
            if (err) {
              console.error('Error updating article:', err);
              db.run('ROLLBACK');
              return;
            }
            
            // Update politician mentions
            updatePoliticianMentions(articleId, mentions)
              .then(() => {
                db.run('COMMIT');
              })
              .catch(err => {
                console.error('Error updating politician mentions:', err);
                db.run('ROLLBACK');
              });
          }
        );
      } else {
        // New article, insert it
        db.run(
          'INSERT INTO articles (title, description, content, link, imageUrl, source, publishedAt, guid, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [title, description, content, link, imageUrl, source, publishedAt, guid, createdAt],
          function(err) {
            if (err) {
              console.error('Error inserting article:', err);
              db.run('ROLLBACK');
              return;
            }
            
            const articleId = this.lastID;
            
            // Detect and save politician mentions
            if (articleId) {
              // Check for politician mentions in newly inserted article
              processPoliticianDetectionForArticle(articleId)
                .then(() => {
                  db.run('COMMIT');
                })
                .catch(err => {
                  console.error('Error processing politician detection:', err);
                  db.run('ROLLBACK');
                });
            } else {
              db.run('COMMIT');
            }
          }
        );
      }
    });
  });
};
```

### 3.5 Politician Detection

The system automatically detects politicians mentioned in articles:

```javascript
const processPoliticianDetectionForArticle = async (articleId) => {
  if (!articleId) return;
  
  // Get the article content
  const article = await new Promise((resolve, reject) => {
    db.get(
      'SELECT id, title, description, content, link FROM articles WHERE id = ?',
      [articleId],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
  
  if (!article) return;
  
  try {
    // Load the list of politicians
    const politiciansData = fs.readFileSync(path.join(__dirname, '../../data/politicians/politicians.json'), 'utf8');
    const POLITICIANS = JSON.parse(politiciansData);
    
    // Detect politicians in the article
    const { politicianDetectionService } = require('./politician-detection/politicianDetectionService');
    const detectedPoliticians = await politicianDetectionService.enhancedPoliticianDetection(
      article,
      POLITICIANS,
      scrapeArticleContent,
      updateArticleContentInDbCallback
    );
    
    // Update the database with detected politicians
    if (detectedPoliticians.length > 0) {
      await updatePoliticianMentions(articleId, detectedPoliticians);
    }
  } catch (error) {
    console.error(`Error processing politician detection for article ${articleId}:`, error);
  }
};
```

### 3.6 Scheduled Updates

The system runs updates on a configurable interval:

```javascript
// Interval in milliseconds (default: 60 minutes)
const UPDATE_INTERVAL = parseInt(process.env.UPDATE_INTERVAL || 3600000);

// Initial fetch on startup
initDatabase()
  .then(() => {
    console.log('Database initialized successfully.');
    return updateFeeds();
  })
  .then(() => {
    console.log('Initial feed update completed.');
  })
  .catch(err => {
    console.error('Error during startup:', err);
  });

// Schedule regular updates
setInterval(updateFeeds, UPDATE_INTERVAL);
```

## 4. How to Set Up & Run

### 4.1 Prerequisites

- Node.js (v14 or higher recommended)
- NPM or Yarn
- The following NPM packages:
  - `express`
  - `rss-parser`
  - `sqlite3`
  - `cors`
  - `date-fns`
  - `html-to-text`
  - `axios`
  - `cheerio`

### 4.2 Configuration

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env` file in the root directory with these configuration options:
   ```
   PORT=3000
   UPDATE_INTERVAL=3600000
   DB_PATH=./data/news.db
   CORS_ORIGIN=*
   ```

### 4.3 Database Initialization

The database is automatically initialized when the server starts. The system:

1. Creates the database file at the path specified by `DB_PATH` (default: `./data/news.db`)
2. Creates the required tables if they don't exist
3. Sets up necessary indexes for optimal performance

### 4.4 Running the Server

Start the server with:

```bash
node server/src/index.js
```

Or if using npm scripts:

```bash
npm run dev
```

## 5. Common Issues & Solutions

### 5.1 Rate Limiting

The system implements rate limiting to avoid overwhelming news sources:

- Each source has a `minRequestInterval` in milliseconds
- The default configuration spaces requests to the same source by 15-30 minutes
- If you're getting blocked by sources, increase these intervals

### 5.2 Feed Parsing Issues

When RSS feeds change their structure:

1. Check the console for detailed error logs
2. Update the `extractImageUrl` and `extractCleanDescription` functions as needed
3. Consider implementing fallback mechanisms like the `alternativeUrl` option

### 5.3 Database Locking

SQLite can sometimes encounter locking issues with concurrent operations:

1. All critical operations use transactions (`BEGIN TRANSACTION`, `COMMIT`, `ROLLBACK`)
2. Consider enabling the Write-Ahead Log for better concurrency: `db.run('PRAGMA journal_mode = WAL')`

## 6. Extensions

To add a new RSS feed source:

1. Add a new entry to the `NEWS_SOURCES` array:
   ```javascript
   {
     url: 'https://example.com/rss.xml',
     name: 'Example News',
     minRequestInterval: 20 * 60 * 1000 // 20 minutes
   }
   ```

2. If the feed has a unique structure requiring special handling, update the helper functions:
   - `extractImageUrl` 
   - `extractCleanDescription`
   - Add source-specific logic as needed 