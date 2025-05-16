/**
 * RSS Feed Capture Tool
 * 
 * This script captures real RSS feeds and stores them for testing.
 * It allows us to have consistent test data while still using real-world examples.
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { format } = require('date-fns');

// Define feeds to capture
const FEEDS = [
  { 
    url: 'https://www.ynet.co.il/Integration/StoryRss2.xml', 
    name: 'ynet'
  },
  { 
    url: 'https://rcs.mako.co.il/rss/news-military.xml?Partner=interlink', 
    name: 'mako-military'
  },
  { 
    url: 'https://rcs.mako.co.il/rss/news-law.xml?Partner=interlink', 
    name: 'mako-law'
  },
  { 
    url: 'https://rss.walla.co.il/feed/2686', 
    name: 'walla-politics'
  },
  { 
    url: 'https://rss.walla.co.il/feed/2689', 
    name: 'walla-knesset'
  },
  { 
    url: 'https://www.maariv.co.il/Rss/RssFeedsPolitiMedini', 
    name: 'maariv-politics'
  }
];

// Capture directory
const CAPTURE_DIR = path.join(__dirname, '../data/captured-feeds');

/**
 * Capture a single feed and save to file
 */
async function captureFeed(feed) {
  try {
    console.log(`Capturing feed: ${feed.name} from ${feed.url}`);
    
    // Add request headers to simulate a browser
    const response = await axios.get(feed.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
        'Accept-Language': 'en-US,en;q=0.9,he;q=0.8',
        'Referer': 'https://www.google.com/',
        'Cache-Control': 'no-cache'
      },
      timeout: 15000
    });
    
    // Generate filename with date
    const dateStr = format(new Date(), 'yyyy-MM-dd');
    const filename = `${feed.name}_${dateStr}.xml`;
    const filePath = path.join(CAPTURE_DIR, filename);
    
    // Save feed content
    fs.writeFileSync(filePath, response.data);
    console.log(`✅ Feed saved to ${filename}`);
    
    return {
      feedName: feed.name,
      filePath,
      success: true
    };
  } catch (error) {
    console.error(`❌ Error capturing feed ${feed.name}:`, error.message);
    return {
      feedName: feed.name,
      success: false,
      error: error.message
    };
  }
}

/**
 * Capture all feeds
 */
async function captureAllFeeds() {
  console.log('Starting RSS feed capture...');
  
  // Ensure capture directory exists
  if (!fs.existsSync(CAPTURE_DIR)) {
    fs.mkdirSync(CAPTURE_DIR, { recursive: true });
  }
  
  const results = [];
  
  // Capture feeds sequentially to avoid rate limits
  for (const feed of FEEDS) {
    const result = await captureFeed(feed);
    results.push(result);
    
    // Add a small delay between requests
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  // Generate a summary
  const successCount = results.filter(r => r.success).length;
  console.log(`\nCapture complete: ${successCount}/${FEEDS.length} feeds captured successfully`);
  
  results.forEach(result => {
    if (result.success) {
      console.log(`✅ ${result.feedName}`);
    } else {
      console.log(`❌ ${result.feedName}: ${result.error}`);
    }
  });
}

// If script is run directly, execute the capture
if (require.main === module) {
  captureAllFeeds().catch(err => {
    console.error('Unhandled error during capture:', err);
    process.exit(1);
  });
}

module.exports = {
  captureAllFeeds,
  captureFeed,
  FEEDS
}; 