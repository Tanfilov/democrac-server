/**
 * Real-World Articles Politician Detection Test
 * 
 * This tool tests politician detection on real-world articles
 * and outputs the results in a formatted HTML report.
 */

const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');
const { htmlToText } = require('html-to-text');
const { loadPoliticians, enhancedPoliticianDetection } = require('../../src/politician-detection/politicianDetectionService');
const { exec } = require('child_process');
const os = require('os');

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
const POLITICIANS_FILE_PATH = path.join(__dirname, '../../../data/politicians/politicians.json');
const politicians = loadPoliticians(POLITICIANS_FILE_PATH);

// Truncate content to a specified number of words
function truncateWords(text, maxWords) {
  if (!text) return '';
  
  const words = text.split(/\s+/);
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
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Process articles from captured RSS feeds
async function processRealArticles() {
  console.log(`Loaded ${politicians.length} politicians for testing`);
  const capturedFeedsDir = path.join(__dirname, '../data/captured-feeds');
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
    customFields: { item: ['media:content', 'description', 'pubDate', 'content'] }
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
        const title = item.title || '';
        const description = item.description ? htmlToText(item.description, { wordwrap: false }) : '';
        const content = item.content ? htmlToText(item.content, { wordwrap: false }) : (item.contentSnippet ? item.contentSnippet : '');
        if (title.length < 5 || (content.length < 20 && description.length < 20)) {
          continue;
        }
        const articleForDetection = {
            id: generateStableArticleId(title, description),
            title: title,
            description: description,
            content: content, 
            link: item.link || ''
        };
        const detectedPoliticians = await enhancedPoliticianDetection(
            articleForDetection, 
            politicians, 
            mockScrapeArticleContent, 
            mockUpdateArticleContentInDb
        );
        if (detectedPoliticians.length === 0) {
          continue;
        }
        candidateArticles.push({
          articleId: articleForDetection.id,
          title,
          description,
          content: truncateWords(content, MAX_CONTENT_WORDS),
          detectedPoliticians, 
          relevantPoliticians: detectedPoliticians, // Service handles relevance
          source: feed.title || file,
          date: item.pubDate ? new Date(item.pubDate).toLocaleDateString('he-IL') : 'לא ידוע'
        });
      }
    } catch (error) {
      console.error(`Error processing feed ${file}:`, error);
    }
  }
  console.log(`Found ${candidateArticles.length} candidate articles with politicians`);
  if (candidateArticles.length === 0) {
    console.error('No articles with politicians found.');
    return;
  }
  const selectedArticles = selectDiverseArticles(candidateArticles, MAX_ARTICLES, MAX_ARTICLES_PER_POLITICIAN);
  console.log(`Selected ${selectedArticles.length} diverse articles for the report`);
  const reportPath = await generateHtmlReport(selectedArticles, politicians);
  openFileInBrowser(reportPath);
}

// Generate a stable article ID based on content hash
function generateStableArticleId(title, description) {
  // Simple hashing function to generate a stable ID
  const text = (title + description).slice(0, 100); // Use first 100 chars to create a stable ID
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16); // Convert to hex string
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

  let htmlContent = `
  <!DOCTYPE html>
  <html lang="he">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>דוח זיהוי פוליטיקאים במאמרים אמיתיים</title>
      <style>
          body { font-family: Arial, sans-serif; direction: rtl; margin: 20px; background-color: #f4f4f4; color: #333; }
          h1, h2 { color: #333; border-bottom: 2px solid #ddd; padding-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; background-color: #fff; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: right; vertical-align: top; }
          th { background-color: #e9e9e9; font-weight: bold; }
          .article-id-cell { font-size: 0.9em; color: #555; width: 5%; }
          .politician-cell { width: 20%; }
          .title-cell { width: 25%; font-weight: bold; }
          .content-cell { width: 50%; font-size: 0.95em; line-height: 1.6; }
          .politician-tag { display: inline-block; background-color: #007bff; color: white; padding: 5px 10px; margin: 3px; border-radius: 15px; font-size: 0.9em; }
          .politician-tag.relevant { background-color: #28a745; }
          .politician-tag.not-relevant { background-color: #dc3545; }
          .stats-section { padding: 15px; background-color: #fff; border: 1px solid #ddd; margin-bottom: 20px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
          .stats-section h2 { margin-top: 0; }
          .stats-section p { margin: 5px 0; }
          .no-detection { color: #777; font-style: italic; }
          .source-info { font-size: 0.8em; color: #666; margin-top: 5px; }
          .highlight { background-color: yellow; font-weight: bold; }
      </style>
  </head>
  <body>
      <h1>דוח זיהוי פוליטיקאים במאמרים אמיתיים</h1>
      <div class="stats-section">
          <h2>סיכום כללי</h2>
          <p>סה"כ מאמרים שנדגמו: ${articles.length}</p>
          <p>סה"כ פוליטיקאים ייחודיים שזוהו: ${uniquePoliticiansCount}</p>
          ${politicianStats}
      </div>
      <h2>פירוט מאמרים</h2>
      <table>
          <thead>
              <tr>
                  <th>ID</th>
                  <th>כותרת</th>
                  <th>תיאור/תוכן</th>
                  <th>פוליטיקאים שזוהו</th>
              </tr>
          </thead>
          <tbody>
  `;

  for (const article of articles) {
      htmlContent += `
              <tr>
                  <td class="article-id-cell">${article.articleId}</td>
                  <td class="title-cell">${highlightPoliticians(article.title, article.detectedPoliticians)}</td>
                  <td class="content-cell">${highlightPoliticians(article.content, article.detectedPoliticians)}</td>
                  <td class="politician-cell">
                      ${formatPoliticiansList(article.detectedPoliticians)} 
                      <div class="source-info">מקור: ${article.source}</div>
                      <div class="source-info">תאריך: ${article.date}</div>
                  </td>
              </tr>
      `;
  }

  htmlContent += `
          </tbody>
      </table>
  </body>
  </html>`;

  const outputPath = path.join(__dirname, '../data/real-articles-report.html');
  fs.writeFileSync(outputPath, htmlContent, 'utf8');
  console.log(`HTML report generated at: ${outputPath}`);
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
  return sortedPoliticians
    .map(([politician, count]) => 
      `<div class="politician-stat-item">${politician}: ${count} אזכורים</div>`
    )
    .join('');
}

// Format list of politicians as tags.
// Since enhancedPoliticianDetection now returns only relevant politicians (strings),
// this function is simplified.
function formatPoliticiansList(detectedPoliticiansArray) {
    if (!detectedPoliticiansArray || detectedPoliticiansArray.length === 0) return '<span class="no-detection">לא זוהו</span>';
    
    return detectedPoliticiansArray.map(politicianName => {
        // All politicians from the service are considered relevant now for this test's display
        return `<span class="politician-tag relevant">${escapeHtml(politicianName)}</span>`;
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