/**
 * Real-World Articles Politician Detection Test
 * 
 * This tool tests politician detection on real-world articles
 * and outputs the results in a formatted HTML report, using actual
 * database IDs from the test environment.
 */

const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');
const { htmlToText } = require('html-to-text');
const { loadPoliticians, enhancedPoliticianDetection } = require('../../server/src/politician-detection/politicianDetectionService');
const { exec } = require('child_process');
const os = require('os');
const sqlite3 = require('sqlite3').verbose();
const config = require('../src/config'); // Load test environment config for DB path

// Maximum number of articles to process
const MAX_ARTICLES = 15;

// Maximum word count for content display
const MAX_CONTENT_WORDS = 100;

// Maximum number of articles with the same politician
const MAX_ARTICLES_PER_POLITICIAN = 5;

// Mock functions for enhancedPoliticianDetection dependencies
const mockScrapeArticleContent = async (url) => { 
  console.log(`Mock scrape called for: ${url}`); 
  return "Default mock article content. Netanyahu said something. Lapid responded."; 
};
const mockUpdateArticleContentInDb = async (articleId, content) => { 
  console.log(`Mock DB update called for article ID ${articleId} with content length ${content ? content.length : 0}`);
  return Promise.resolve();
};

// Load the politicians data
// Corrected path to be relative from test-environment/tools
const POLITICIANS_FILE_PATH = path.join(__dirname, '../../data/politicians/politicians.json'); 
const politicians = loadPoliticians(POLITICIANS_FILE_PATH);

// --- Database Helper Functions ---
let db;

function connectToDatabase() {
  return new Promise((resolve, reject) => {
    const dbPath = path.resolve(__dirname, '../src', config.db.path); // Resolve DB path relative to config location
    console.log(`Attempting to connect to database at: ${dbPath}`);
    db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        console.error(`Error connecting to database ${dbPath}:`, err.message);
        // Try to resolve relative to project root if src/data/news.db fails
        const fallbackDbPath = path.resolve(__dirname, '../../', config.db.path.replace('./data', 'server/data'));
        console.log(`Attempting fallback connection to database at: ${fallbackDbPath}`);
        db = new sqlite3.Database(fallbackDbPath, sqlite3.OPEN_READWRITE, (errFallback) => {
            if(errFallback) {
                console.error(`Error connecting to fallback database ${fallbackDbPath}:`, errFallback.message);
                return reject(errFallback);
            }
            console.log(`Successfully connected to fallback database: ${fallbackDbPath}`);
            resolve(db);
        });
      } else {
        console.log(`Successfully connected to database: ${dbPath}`);
        resolve(db);
      }
    });
  });
}

function closeDatabase() {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) {
          console.error('Error closing database:', err.message);
          return reject(err);
        }
        console.log('Database connection closed.');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

function insertArticleAndGetId(article) {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO articles (title, description, content, link, source, publishedAt, guid, createdAt, summary, imageUrl)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [
      article.title || '',
      article.description || '',
      article.fullContent || '', // Ensure we store full content if available
      article.link || null,
      article.source || 'Unknown',
      article.publishedAt ? new Date(article.publishedAt).toISOString() : new Date().toISOString(),
      article.guid || article.link, // Use link as fallback for guid
      new Date().toISOString(),
      article.summary || null,
      article.imageUrl || null
    ];

    db.run(sql, params, function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          // Article likely already exists, try to fetch its ID
          const selectSql = `SELECT id FROM articles WHERE guid = ? OR link = ?`;
          db.get(selectSql, [article.guid || article.link, article.link], (selectErr, row) => {
            if (selectErr) {
              console.error('Error fetching ID of existing article:', selectErr.message);
              return reject(selectErr);
            }
            if (row) {
              console.log(`Article already exists (link: ${article.link}). Found ID: ${row.id}`);
              resolve(row.id);
            } else {
              // This case should ideally not happen if UNIQUE constraint failed but we can't find it
              console.warn(`Article insertion failed due to UNIQUE constraint, but could not retrieve existing ID for link: ${article.link}`);
              resolve(null); // Resolve with null if ID can't be found
            }
          });
        } else {
          console.error('Error inserting article:', err.message);
          return reject(err);
        }
      } else {
        console.log(`Article inserted with ID: ${this.lastID} (link: ${article.link})`);
        resolve(this.lastID);
      }
    });
  });
}

// Truncate content to a specified number of words
function truncateWords(text, maxWords) {
  if (!text) return '';
  
  const words = text.split(/\\s+/);
  if (words.length <= maxWords) return text;
  
  return words.slice(0, maxWords).join(' ') + '...';
}

// Highlight politicians in text - SIMPLIFIED VERSION
function highlightPoliticians(text, politiciansToHighlight) {
  if (!text || !politiciansToHighlight || politiciansToHighlight.length === 0) return text;
  
  let result = text;
  const highlightStyle = 'background-color: #ffcc00; color: #000000; font-weight: bold; padding: 2px 4px; border-radius: 3px; display: inline-block; border: 1px solid #e6b800;';
  
  const sortedPoliticians = [...politiciansToHighlight].sort((a, b) => {
    const nameA = typeof a === 'string' ? a : a.name;
    const nameB = typeof b === 'string' ? b : b.name;
    if (!nameA && !nameB) return 0;
    if (!nameA) return 1;
    if (!nameB) return -1;
    return nameB.length - nameA.length;
  });
  
  for (const p of sortedPoliticians) {
    const politicianName = typeof p === 'string' ? p : p.name;
    if (!politicianName) continue;
    const replacement = `<span style="${highlightStyle}">${politicianName}</span>`;
    const commonPrepositions = ['של', 'עם', 'על', 'את', 'מול', 'בין', 'לפי', 'כמו'];
    const standaloneRegex = new RegExp(`(^|\\s|["'\`.,;:!?()[\\]{}])${escapeRegExp(politicianName)}(?=$|\\s|["'\`.,;:!?()[\\]{}])`, 'g');
    result = result.replace(standaloneRegex, (match, prefix) => {
      return prefix + replacement;
    });
    for (const preposition of commonPrepositions) {
      const prepositionRegex = new RegExp(`(\\s|^)(${preposition}\\s+)${escapeRegExp(politicianName)}(?=$|\\s|["'\`.,;:!?()[\\]{}])`, 'g');
      result = result.replace(prepositionRegex, (match, prefix, prepositionText) => {
        return `${prefix}${prepositionText}${replacement}`;
      });
    }
  }
  // Handle special compound cases if necessary (this part might need review based on actual politician names)
  const compounds = ['לפיד ונתניהו', 'נתניהו ולפיד', 'לפיד לנתניהו'];
  for (const compound of compounds) {
    if (result.includes(compound)) {
      const plainText = compound;
      const highlighted = `<span style="${highlightStyle}">${compound}</span>`;
      result = result.replace(new RegExp(escapeRegExp(plainText), 'g'), highlighted);
    }
  }
  return result;
}

// Escape special regex characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&'); // Corrected escape for backslash
}

// Process articles from captured RSS feeds
async function processRealArticles() {
  try {
    await connectToDatabase(); // Connect to DB

  console.log(`Loaded ${politicians.length} politicians for testing`);
    const capturedFeedsDir = path.join(__dirname, '../data/captured-feeds'); // Adjusted path relative to tools
  if (!fs.existsSync(capturedFeedsDir)) {
    console.error('No captured feeds directory found. Run the capture-feeds.js script first.');
    return;
  }
  const files = fs.readdirSync(capturedFeedsDir);
  const feedFiles = files.filter(file => file.endsWith('.xml'));
  if (feedFiles.length === 0) {
    console.error('No feed files found. Run the capture-feeds.js script first.');
    return;
  }
  console.log(`Found ${feedFiles.length} captured feed files`);
  const parser = new Parser({
      customFields: { item: ['media:content', 'description', 'pubDate', 'content', 'guid'] }
  });
  const candidateArticles = [];
  for (const file of feedFiles) {
    const feedPath = path.join(capturedFeedsDir, file);
    console.log(`Processing feed: ${file}`);
    try {
      const feedContent = fs.readFileSync(feedPath, 'utf8');
      const feed = await parser.parseString(feedContent);
      console.log(`Feed: ${feed.title || file} with ${feed.items.length} articles`);
      
      for (const item of feed.items) {
        let title = item.title || ''; // Make mutable for cleaning
        let description = item.description ? htmlToText(item.description, { wordwrap: false }) : ''; // Make mutable
        let fullContent = item.content ? htmlToText(item.content, { wordwrap: false }) : (item.contentSnippet ? item.contentSnippet : ''); // Make mutable

        // --- Clean title, description, and fullContent for report consistency ---
        // Clean title
        title = title.replace(/<[^>]+>/g, ' '); // Strip HTML tags (though htmlToText might do much of this)
        title = title.replace(/\[https?:\/\/[^\\\]]*?\]/g, ' '); // Remove [URL] placeholders
        title = title.replace(/https?:\/\/[^\s)]+/g, ' '); // Remove general URLs
        title = title.replace(/__IMAGE_URL__/g, ' '); // Remove image placeholders
        title = title.replace(/\s+/g, ' ').trim(); // Normalize whitespace

        // Clean description
        description = description.replace(/<[^>]+>/g, ' '); // Strip HTML tags
        description = description.replace(/\[https?:\/\/[^\\\]]*?\]/g, ' '); 
        description = description.replace(/https?:\/\/[^\s)]+/g, ' ');
        description = description.replace(/__IMAGE_URL__/g, ' ');
        description = description.replace(/\s+/g, ' ').trim();

        // Clean fullContent
        fullContent = fullContent.replace(/<[^>]+>/g, ' '); // Strip HTML tags
        fullContent = fullContent.replace(/\[https?:\/\/[^\\\]]*?\]/g, ' ');
        fullContent = fullContent.replace(/https?:\/\/[^\s)]+/g, ' ');
        fullContent = fullContent.replace(/__IMAGE_URL__/g, ' ');
        fullContent = fullContent.replace(/\s+/g, ' ').trim();
        // --- End of cleaning block ---
        
          if (title.length < 5 || (fullContent.length < 20 && description.length < 20)) {
          continue;
        }
        
          // Create an article object for DB insertion
          const dbArticle = {
            title: title,
            description: description,
            fullContent: fullContent, // Store the full text
            link: item.link || null,
            source: feed.title || file.split('_')[0] || 'Unknown',
            publishedAt: item.pubDate || new Date().toISOString(),
            guid: item.guid || item.link, // Use link as fallback for guid
            imageUrl: item['media:content']?.$?.url || null
          };

          const dbId = await insertArticleAndGetId(dbArticle);
          if (dbId === null) {
            console.warn(`Skipping article due to DB ID issue: ${title}`);
            continue; // Skip if we couldn't get a DB ID
          }

          const articleForDetection = {
              id: dbId, // Use the REAL Database ID
              title: title, // Use cleaned title
              description: description, // Use cleaned description
              content: fullContent, // Pass cleaned full content to detection
              link: item.link || ''
          };
          
          // Run enhanced detection (which includes relevance scoring)
          const detectedPoliticians = await enhancedPoliticianDetection(
              articleForDetection, 
              politicians, 
              async (articleToScrape) => articleToScrape.content, // Simplified mock scrape, service expects full content
              mockUpdateArticleContentInDb 
          );
          
        if (detectedPoliticians.length === 0) {
            // console.log(`No politicians detected for article ID ${dbId}: "${title}"`);
          continue;
        }
        
        candidateArticles.push({
            articleId: dbId, // Use REAL DB ID here for the report
          title, // Already cleaned
            description, // Already cleaned
            content: truncateWords(fullContent, MAX_CONTENT_WORDS), // Use cleaned and then truncated fullContent
          detectedPoliticians,
            relevantPoliticians: detectedPoliticians, // Service handles relevance
            source: feed.title || file.split('_')[0] || 'Unknown',
          date: item.pubDate ? new Date(item.pubDate).toLocaleDateString('he-IL') : 'לא ידוע'
        });
      }
    } catch (error) {
      console.error(`Error processing feed ${file}:`, error);
    }
  }
  console.log(`Found ${candidateArticles.length} candidate articles with politicians`);
  if (candidateArticles.length === 0) {
      console.error('No articles with politicians found to report.');
    return;
  }
  const selectedArticles = selectDiverseArticles(candidateArticles, MAX_ARTICLES, MAX_ARTICLES_PER_POLITICIAN);
  console.log(`Selected ${selectedArticles.length} diverse articles for the report`);
    const reportPath = await generateHtmlReport(selectedArticles, politicians);
    openFileInBrowser(reportPath);

  } catch (err) {
    console.error("Error in processRealArticles:", err);
  } finally {
    await closeDatabase(); // Ensure DB connection is closed
  }
}

// Select a diverse set of articles to ensure multiple politicians are covered
function selectDiverseArticles(candidateArticles, maxArticles, maxPerPolitician) {
  // Count appearances of each politician
  const politicianCounts = {};
  
  // Track selected articles
  const selectedArticles = [];
  
  // First, prioritize articles with multiple politicians
  const multiPoliticianArticles = candidateArticles
    .filter(article => article.detectedPoliticians.length > 1)
    .sort((a, b) => b.detectedPoliticians.length - a.detectedPoliticians.length);
  
  // Add multi-politician articles first
  for (const article of multiPoliticianArticles) {
    if (selectedArticles.length >= maxArticles) break;
    
    // Check if we already have too many articles with these politicians
    let shouldAdd = true;
    for (const politician of article.detectedPoliticians) {
      if ((politicianCounts[politician] || 0) >= maxPerPolitician) {
        shouldAdd = false;
        break;
      }
    }
    
    if (shouldAdd) {
      selectedArticles.push(article);
      // Update counts
      for (const politician of article.detectedPoliticians) {
        politicianCounts[politician] = (politicianCounts[politician] || 0) + 1;
      }
      console.log(`Added article with ${article.detectedPoliticians.length} politicians: "${article.title.substring(0, 40)}..."`);
    }
  }
  
  // Sort remaining candidate articles by prioritizing those with rare politicians
  const remainingArticles = candidateArticles
    .filter(article => !selectedArticles.includes(article))
    .sort((a, b) => {
      const aRarity = a.detectedPoliticians.reduce((sum, pol) => sum + (politicianCounts[pol] || 0), 0);
      const bRarity = b.detectedPoliticians.reduce((sum, pol) => sum + (politicianCounts[pol] || 0), 0);
      return aRarity - bRarity; // Lower counts (rarer politicians) first
    });
  
  // Fill the remaining slots
  for (const article of remainingArticles) {
    if (selectedArticles.length >= maxArticles) break;
    
    // Check if we already have too many articles with these politicians
    let shouldAdd = true;
    for (const politician of article.detectedPoliticians) {
      if ((politicianCounts[politician] || 0) >= maxPerPolitician) {
        shouldAdd = false;
        break;
      }
    }
    
    if (shouldAdd) {
      selectedArticles.push(article);
      // Update counts
      for (const politician of article.detectedPoliticians) {
        politicianCounts[politician] = (politicianCounts[politician] || 0) + 1;
      }
      console.log(`Added article: "${article.title.substring(0, 40)}..." with ${article.detectedPoliticians.length} politicians`);
    }
  }
  
  // If we still don't have enough articles, just add remaining ones
  if (selectedArticles.length < maxArticles) {
    for (const article of remainingArticles) {
      if (selectedArticles.length >= maxArticles) break;
      
      if (!selectedArticles.includes(article)) {
        selectedArticles.push(article);
        console.log(`Added article (to fill quota): "${article.title.substring(0, 40)}..."`);
      }
    }
  }
  
  return selectedArticles;
}

// Platform-specific method to open file in browser
function openFileInBrowser(filePath) {
  const isWindows = os.platform() === 'win32';
  
  if (isWindows) {
    // Use 'start' command on Windows
    exec(`start "" "${filePath}"`, (error) => {
      if (error) {
        console.error(`Error opening file: ${error.message}`);
      } else {
        console.log('Opened report in default browser');
      }
    });
  } else {
    // Use the file:// protocol for other platforms
    exec(`open "file://${filePath}"`, (error) => {
      if (error) {
        console.error(`Error opening file: ${error.message}`);
      } else {
        console.log('Opened report in default browser');
      }
    });
  }
}

// Generate HTML report
async function generateHtmlReport(articles, allPoliticians) {
  let politicianStats = generatePoliticianStats(articles);
  let uniquePoliticiansCount = countUniquePoliticians(articles);

  let htmlContent = '';
  htmlContent += '<!DOCTYPE html>';
  htmlContent += '<html lang="he">';
  htmlContent += '<head>';
  htmlContent += '    <meta charset="UTF-8">';
  htmlContent += '    <meta name="viewport" content="width=device-width, initial-scale=1.0">';
  htmlContent += '    <title>דוח זיהוי פוליטיקאים במאמרים אמיתיים (עם ID מסד נתונים)</title>';
  htmlContent += '    <style>';
  htmlContent += '        body { font-family: Arial, sans-serif; direction: rtl; margin: 20px; background-color: #f4f4f4; color: #333; }';
  htmlContent += '        h1, h2 { color: #333; border-bottom: 2px solid #ddd; padding-bottom: 10px; }';
  htmlContent += '        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; background-color: #fff; box-shadow: 0 0 10px rgba(0,0,0,0.1); }';
  htmlContent += '        th, td { border: 1px solid #ddd; padding: 12px; text-align: right; vertical-align: top; }';
  htmlContent += '        th { background-color: #e9e9e9; font-weight: bold; }';
  htmlContent += '        .article-id-cell { font-size: 0.9em; color: #555; width: 10%; }';
  htmlContent += '        .politician-cell { width: 20%; }';
  htmlContent += '        .title-cell { width: 25%; font-weight: bold; }';
  htmlContent += '        .content-cell { width: 45%; font-size: 0.95em; line-height: 1.6; }';
  htmlContent += '        .politician-tag { display: inline-block; background-color: #007bff; color: white; padding: 5px 10px; margin: 3px; border-radius: 15px; font-size: 0.9em; }';
  htmlContent += '        .politician-tag.relevant { background-color: #28a745; }';
  htmlContent += '        .politician-tag.not-relevant { background-color: #dc3545; }';
  htmlContent += '        .stats-section { padding: 15px; background-color: #fff; border: 1px solid #ddd; margin-bottom: 20px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }';
  htmlContent += '        .stats-section h2 { margin-top: 0; }';
  htmlContent += '        .stats-section p { margin: 5px 0; }';
  htmlContent += '        .no-detection { color: #777; font-style: italic; }';
  htmlContent += '        .source-info { font-size: 0.8em; color: #666; margin-top: 5px; }';
  htmlContent += '        .highlight { background-color: yellow; font-weight: bold; }';
  htmlContent += '    </style>';
  htmlContent += '</head>';
  htmlContent += '<body>';
  htmlContent += '    <h1>דוח זיהוי פוליטיקאים במאמרים אמיתיים (עם ID מסד נתונים)</h1>';
  htmlContent += '    <div class="stats-section">';
  htmlContent += '        <h2>סיכום כללי</h2>';
  htmlContent += '        <p>סה"כ מאמרים שנדגמו ועובדו מול מסד הנתונים: ' + articles.length + '</p>';
  htmlContent += '        <p>סה"כ פוליטיקאים ייחודיים שזוהו: ' + uniquePoliticiansCount + '</p>';
  htmlContent += '        ' + politicianStats;
  htmlContent += '    </div>';
  htmlContent += '    <h2>פירוט מאמרים</h2>';
  htmlContent += '    <table>';
  htmlContent += '        <thead>';
  htmlContent += '            <tr>';
  htmlContent += '                <th>ID (מזהה מסד נתונים)</th>';
  htmlContent += '                <th>כותרת</th>';
  htmlContent += '                <th>תיאור/תוכן</th>';
  htmlContent += '                <th>פוליטיקאים שזוהו</th>';
  htmlContent += '            </tr>';
  htmlContent += '        </thead>';
  htmlContent += '        <tbody>';

  for (const article of articles) {
      htmlContent += '            <tr>';
      htmlContent += '                <td class="article-id-cell">' + article.articleId + '</td>';
      htmlContent += '                <td class="title-cell">' + highlightPoliticians(article.title, article.detectedPoliticians) + '</td>';
      htmlContent += '                <td class="content-cell">' + highlightPoliticians(article.content, article.detectedPoliticians) + '</td>';
      htmlContent += '                <td class="politician-cell">';
      htmlContent += '                    ' + formatPoliticiansList(article.detectedPoliticians) + ' '; // Added space for clarity
      htmlContent += '                    <div class="source-info">מקור: ' + article.source + '</div>';
      htmlContent += '                    <div class="source-info">תאריך: ' + article.date + '</div>';
      htmlContent += '                </td>';
      htmlContent += '            </tr>';
  }

  htmlContent += '        </tbody>';
  htmlContent += '    </table>';
  htmlContent += '</body>';
  htmlContent += '</html>';

  const outputPath = path.join(__dirname, '../data/real-articles-report.html');
  fs.writeFileSync(outputPath, htmlContent, 'utf8');
  console.log('HTML report generated at: ' + outputPath);
  return outputPath;
}

// Generate politician statistics HTML
function generatePoliticianStats(articles) {
  const politicianCounts = {};
  
  // Count occurrences of each politician
  articles.forEach(article => {
    article.detectedPoliticians.forEach(politician => {
      politicianCounts[politician] = (politicianCounts[politician] || 0) + 1;
    });
  });
  
  // Sort politicians by occurrence count (descending)
  const sortedPoliticians = Object.entries(politicianCounts)
    .sort((a, b) => b[1] - a[1]);
  
  // Generate HTML for each politician stat
  let politicianStats = '';
  sortedPoliticians.forEach(([politician, count]) => {
    politicianStats += '<div class="politician-stat-item">' + politician + ': ' + count + ' אזכורים</div>';
  });

  return politicianStats;
}

// Format list of politicians as tags.
function formatPoliticiansList(detectedPoliticiansArray) {
    if (!detectedPoliticiansArray || detectedPoliticiansArray.length === 0) return '<span class="no-detection">לא זוהו</span>';
    
    return detectedPoliticiansArray.map(politicianName => {
        return '<span class="politician-tag relevant">' + escapeHtml(politicianName) + '</span>';
  }).join('');
}

function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

// Count unique politicians across all articles
function countUniquePoliticians(articles) {
  const uniquePoliticians = new Set();
  
  articles.forEach(article => {
    article.detectedPoliticians.forEach(politician => {
      uniquePoliticians.add(politician);
    });
  });
  
  return uniquePoliticians.size;
}

// Run the main function if this script is executed directly
if (require.main === module) {
  processRealArticles().catch(console.error);
}

module.exports = {
  processRealArticles
}; 