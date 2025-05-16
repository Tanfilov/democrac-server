/**
 * Politician Detection HTML Report Generator
 * 
 * This tool creates an HTML report showing detected politicians in articles
 * with context highlighting for clear visualization of detection accuracy.
 */

const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');
const { htmlToText } = require('html-to-text');
const politicianDetection = require('../src/politician-detection');
const improvedDetection = require('../src/politician-detection/detection-fix');
const config = require('../src/config');
const open = require('open');
const { exec } = require('child_process');
const os = require('os');

// Character window around a detection to show
const CONTEXT_WINDOW = 100;

// Get the JSON politicians data
const loadPoliticians = () => {
  try {
    // First check if we have sample data in our test environment
    const samplePath = path.join(__dirname, '../data/politicians/politicians.json');
    if (fs.existsSync(samplePath)) {
      return politicianDetection.loadPoliticians(samplePath);
    }
    
    // Fall back to the real data
    const politiciansPath = path.join(__dirname, '../../data/politicians/politicians.json');
    if (fs.existsSync(politiciansPath)) {
      return politicianDetection.loadPoliticians(politiciansPath);
    }
    
    throw new Error('No politicians data found');
  } catch (error) {
    console.error('Error loading politicians:', error.message);
    return [];
  }
};

// Enhanced detection that provides detailed information with context
function enhancedDetectionWithContext(text, politicians) {
  if (!text) return [];

  const results = [];
  
  // Test each politician
  for (const politician of politicians) {
    const politicianName = politician.name || politician.he;
    
    // Check name
    testNameWithContext(politicianName, text, politician, results);
    
    // Check aliases
    if (politician.aliases && politician.aliases.length > 0) {
      for (const alias of politician.aliases) {
        if (alias.length < 3) continue; // Skip very short aliases
        testNameWithContext(alias, text, politician, results);
      }
    }
    
    // Check position
    if (politician.position) {
      const positionMap = {
        'ראש הממשלה': 'ראש הממשלה',
        'רה"מ': 'ראש הממשלה',
        'ראש האופוזיציה': 'ראש האופוזיציה',
        'שר הביטחון': 'שר הביטחון',
        'שר האוצר': 'שר האוצר',
        'שר החוץ': 'שר החוץ',
        'שר הפנים': 'שר הפנים',
        'השר לביטחון לאומי': 'השר לביטחון לאומי',
        'יושב ראש הכנסת': 'יושב ראש הכנסת',
        'נשיא המדינה': 'נשיא המדינה',
        'הנשיא': 'נשיא המדינה'
      };
      
      // If this politician has a known position title, check for that too
      Object.entries(positionMap).forEach(([positionTitle, standardPosition]) => {
        if (politician.position === standardPosition) {
          testPositionWithContext(positionTitle, text, politician, results);
        }
      });
    }
  }
  
  return results;
}

// Test a name/alias with context
function testNameWithContext(name, text, politician, results) {
  if (!text.includes(name)) return;
  
  // Word boundaries
  const wordBoundaries = [' ', '.', ',', ':', ';', '?', '!', '"', "'", '(', ')', '[', ']', '{', '}', '\n', '\t', '"', '"'];
  
  // Find all occurrences
  const indexes = findAllOccurrences(text, name);
  
  for (const index of indexes) {
    const beforeChar = index === 0 ? ' ' : text[index - 1];
    const afterChar = index + name.length >= text.length ? ' ' : text[index + name.length];
    
    // Standard boundary check
    const isMatch = (wordBoundaries.includes(beforeChar) || index === 0) && 
                   (wordBoundaries.includes(afterChar) || index + name.length === text.length);
    
    if (isMatch) {
      // If this politician requires context, check for it around this specific match
      if (politician.requiresContext) {
        if (!hasRequiredContext(text, politician, index, name.length)) {
          continue; // Skip this match as it doesn't have the required context
        }
      }
      
      // Check if this is a legitimate detection or a false positive
      const isFalsePositive = isForeignLeaderReference(text, index, name);
      if (isFalsePositive) {
        continue; // Skip false positives
      }
      
      // Extract the context window
      const contextStart = Math.max(0, index - CONTEXT_WINDOW);
      const contextEnd = Math.min(text.length, index + name.length + CONTEXT_WINDOW);
      
      const beforeContext = text.substring(contextStart, index);
      const nameText = text.substring(index, index + name.length);
      const afterContext = text.substring(index + name.length, contextEnd);
      
      results.push({
        politicianName: politician.name || politician.he,
        detectedText: nameText,
        detectedAs: 'name',
        detectedTerm: name,
        position: index,
        context: {
          before: beforeContext,
          term: nameText,
          after: afterContext,
          full: `${beforeContext}[${nameText}]${afterContext}`
        }
      });
    }
  }
}

// Test a position title with context
function testPositionWithContext(position, text, politician, results) {
  if (!text.includes(position)) return;
  
  // Word boundaries
  const wordBoundaries = [' ', '.', ',', ':', ';', '?', '!', '"', "'", '(', ')', '[', ']', '{', '}', '\n', '\t', '"', '"'];
  
  // Find all occurrences
  const indexes = findAllOccurrences(text, position);
  
  for (const index of indexes) {
    const beforeChar = index === 0 ? ' ' : text[index - 1];
    const afterChar = index + position.length >= text.length ? ' ' : text[index + position.length];
    
    // Standard boundary check
    const isMatch = (wordBoundaries.includes(beforeChar) || index === 0) && 
                   (wordBoundaries.includes(afterChar) || index + position.length === text.length);
    
    if (isMatch) {
      // Check if this is a modified position (former, future, etc)
      if (improvedDetection.isModifiedPosition(text, position)) {
        continue; // Skip modified positions
      }
      
      // Extract the context window
      const contextStart = Math.max(0, index - CONTEXT_WINDOW);
      const contextEnd = Math.min(text.length, index + position.length + CONTEXT_WINDOW);
      
      const beforeContext = text.substring(contextStart, index);
      const positionText = text.substring(index, index + position.length);
      const afterContext = text.substring(index + position.length, contextEnd);
      
      results.push({
        politicianName: politician.name || politician.he,
        detectedText: positionText,
        detectedAs: 'position',
        detectedTerm: position,
        position: index,
        context: {
          before: beforeContext,
          term: positionText,
          after: afterContext,
          full: `${beforeContext}[${positionText}]${afterContext}`
        }
      });
    }
  }
}

// Helper function to check if a position refers to a foreign leader
function isForeignLeaderReference(text, position, name) {
  // Get window of text around position
  const windowStart = Math.max(0, position - 30);
  const windowEnd = Math.min(text.length, position + name.length + 30);
  const textWindow = text.substring(windowStart, windowEnd);
  
  // List of foreign country indicators in Hebrew
  const foreignIndicators = [
    'אמריקאי', 'אמריקאית', 'אמריקה', 'ארצות הברית', 'ארה"ב',
    'בריטי', 'בריטית', 'בריטניה', 'אנגלי', 'אנגליה',
    'צרפתי', 'צרפתית', 'צרפת', 
    'רוסי', 'רוסית', 'רוסיה',
    'גרמני', 'גרמנית', 'גרמניה'
  ];
  
  // Check if any foreign indicator appears near the name
  return foreignIndicators.some(indicator => textWindow.includes(indicator));
}

// These helper functions are adapted from the politician detection module
function findAllOccurrences(text, subtext) {
  const indexes = [];
  let index = text.indexOf(subtext);
  
  while (index !== -1) {
    indexes.push(index);
    index = text.indexOf(subtext, index + 1);
  }
  
  return indexes;
}

function hasRequiredContext(text, politician, nameMatchIndex, nameLength) {
  if (!politician.requiresContext || !politician.contextIdentifiers || politician.contextIdentifiers.length === 0) {
    return true; // No context required
  }
  
  // Define the window size (in characters) to look for context before and after the name
  const windowSize = 200; // Look for context within 200 characters before and after the name
  
  // Get the window of text around the name
  const startWindow = Math.max(0, nameMatchIndex - windowSize);
  const endWindow = Math.min(text.length, nameMatchIndex + nameLength + windowSize);
  
  const textWindow = text.substring(startWindow, endWindow);
  
  // Check if any context identifiers appear in the window
  return politician.contextIdentifiers.some(context => textWindow.includes(context));
}

// Generate HTML with context highlighting for detections
function generateHtmlReport(articles) {
  let html = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Politician Detection Report</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      margin: 20px;
      background-color: #f5f5f5;
    }
    h1 {
      color: #003366;
      text-align: center;
      margin-bottom: 30px;
    }
    h2 {
      color: #003366;
      margin-top: 30px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }
    th, td {
      padding: 12px 15px;
      border: 1px solid #ddd;
      text-align: right;
    }
    th {
      background-color: #003366;
      color: white;
      position: sticky;
      top: 0;
    }
    tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    tr:hover {
      background-color: #f1f1f1;
    }
    .highlight {
      background-color: #ffffa0;
      font-weight: bold;
      padding: 2px;
      border-radius: 2px;
    }
    .position-highlight {
      background-color: #a0ffa0;
      font-weight: bold;
      padding: 2px;
      border-radius: 2px;
    }
    .context {
      max-width: 500px;
      overflow-wrap: break-word;
    }
    .detected {
      background-color: #e6f7ff;
      border-left: 4px solid #1890ff;
      padding-left: 10px;
    }
    .article-container {
      background-color: white;
      padding: 20px;
      border-radius: 5px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .politician-name {
      font-weight: bold;
      color: #003366;
    }
    .detection-type {
      color: #666;
      font-size: 0.9em;
    }
    .summary {
      margin-bottom: 20px;
      padding: 15px;
      background-color: #e6f7ff;
      border-radius: 5px;
    }
  </style>
</head>
<body>
  <h1>דוח זיהוי פוליטיקאים במאמרים</h1>
  <div class="summary">
    <h2>סיכום</h2>
    <p>סך הכל נבדקו: <strong>${articles.length}</strong> מאמרים</p>
    <p>סך הכל זוהו: <strong>${countTotalDetections(articles)}</strong> אזכורים של פוליטיקאים</p>
  </div>
`;

  // Process each article
  articles.forEach((article, index) => {
    html += `
  <div class="article-container">
    <h2>מאמר ${index + 1}: ${article.title}</h2>
    <p><strong>מקור:</strong> ${article.source || 'לא ידוע'}</p>
    <p><strong>תאריך:</strong> ${article.date || 'לא ידוע'}</p>
    
    <table>
      <tr>
        <th>פוליטיקאי</th>
        <th>כותרת</th>
        <th>תקציר</th>
        <th>תוכן</th>
      </tr>`;
    
    // Get unique politicians detected in this article
    const uniquePoliticians = getUniquePoliticians(article);
    
    // For each politician, show all contexts where they were detected
    uniquePoliticians.forEach(politician => {
      html += `
      <tr>
        <td class="politician-name">${politician}</td>
        <td class="context">${formatDetectionContext(article.titleDetections, politician)}</td>
        <td class="context">${formatDetectionContext(article.descriptionDetections, politician)}</td>
        <td class="context">${formatDetectionContext(article.contentDetections, politician)}</td>
      </tr>`;
    });
    
    html += `
    </table>
  </div>`;
  });

  html += `
</body>
</html>`;

  return html;
}

// Helper to format detection context for a specific politician
function formatDetectionContext(detections, politicianName) {
  if (!detections || detections.length === 0) return 'לא זוהה';
  
  // Filter detections for this politician
  const relevantDetections = detections.filter(d => d.politicianName === politicianName);
  if (relevantDetections.length === 0) return 'לא זוהה';
  
  let contextsHtml = '';
  
  relevantDetections.forEach(detection => {
    const before = escapeHtml(detection.context.before);
    const term = escapeHtml(detection.context.term);
    const after = escapeHtml(detection.context.after);
    
    const highlightClass = detection.detectedAs === 'position' ? 'position-highlight' : 'highlight';
    
    contextsHtml += `
      <div class="detected">
        <span class="detection-type">(זוהה כ-${detection.detectedAs === 'position' ? 'תפקיד' : 'שם'})</span>
        <div>${before}<span class="${highlightClass}">${term}</span>${after}</div>
      </div>`;
  });
  
  return contextsHtml;
}

// Escape HTML special characters
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Get unique politician names from all detections in an article
function getUniquePoliticians(article) {
  const allDetections = [
    ...article.titleDetections || [],
    ...article.descriptionDetections || [],
    ...article.contentDetections || []
  ];
  
  const uniqueNames = new Set();
  allDetections.forEach(detection => {
    uniqueNames.add(detection.politicianName);
  });
  
  return Array.from(uniqueNames);
}

// Count total detections across all articles
function countTotalDetections(articles) {
  return articles.reduce((count, article) => {
    return count + 
      (article.titleDetections?.length || 0) + 
      (article.descriptionDetections?.length || 0) + 
      (article.contentDetections?.length || 0);
  }, 0);
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
    // Use 'open' package for other platforms
    open(filePath).then(() => {
      console.log('Opened report in default browser');
    }).catch((err) => {
      console.error(`Error opening file: ${err.message}`);
    });
  }
}

// Parse RSS feeds and generate an HTML report
async function generateDetectionReport() {
  // Load politicians
  const politicians = loadPoliticians();
  console.log(`Loaded ${politicians.length} politicians for testing`);
  
  // Check captured feeds directory
  const capturedFeedsDir = path.join(__dirname, '../data/captured-feeds');
  if (!fs.existsSync(capturedFeedsDir)) {
    console.error('No captured feeds directory found. Run the capture-feeds.js script first.');
    return;
  }
  
  // Get all feed files
  const files = fs.readdirSync(capturedFeedsDir);
  const feedFiles = files.filter(file => file.endsWith('.xml'));
  
  if (feedFiles.length === 0) {
    console.error('No feed files found. Run the capture-feeds.js script first.');
    return;
  }
  
  console.log(`Found ${feedFiles.length} captured feed files`);
  
  // Initialize RSS parser
  const parser = new Parser({
    customFields: {
      item: ['media:content', 'description', 'pubDate', 'content']
    }
  });
  
  const allArticles = [];
  
  // Process each feed file
  for (const file of feedFiles) {
    const feedPath = path.join(capturedFeedsDir, file);
    console.log(`Processing feed: ${file}`);
    
    try {
      // Parse the feed
      const feedContent = fs.readFileSync(feedPath, 'utf8');
      const feed = await parser.parseString(feedContent);
      console.log(`Feed: ${feed.title || file} with ${feed.items.length} articles`);
      
      // Process each item
      for (let i = 0; i < Math.min(feed.items.length, 5); i++) {
        const item = feed.items[i];
        
        // Extract clean text
        const title = item.title || '';
        const description = item.description ? htmlToText(item.description, { wordwrap: false }) : '';
        const content = item.content ? htmlToText(item.content, { wordwrap: false }) : '';
        
        // Process detections for each part
        const titleDetections = enhancedDetectionWithContext(title, politicians);
        const descriptionDetections = enhancedDetectionWithContext(description, politicians);
        const contentDetections = enhancedDetectionWithContext(content, politicians);
        
        // Add to articles collection
        allArticles.push({
          title,
          source: feed.title || file,
          date: item.pubDate ? new Date(item.pubDate).toLocaleDateString('he-IL') : 'לא ידוע',
          titleDetections,
          descriptionDetections,
          contentDetections
        });
      }
    } catch (error) {
      console.error(`Error processing feed ${file}:`, error);
    }
  }
  
  // Generate and save HTML report
  const html = generateHtmlReport(allArticles);
  const outputPath = path.join(__dirname, '../data/politician-detection-report.html');
  fs.writeFileSync(outputPath, html, 'utf8');
  
  console.log(`HTML report generated at: ${outputPath}`);
  
  // Try to open the report in the default browser
  try {
    openFileInBrowser(outputPath);
  } catch (err) {
    console.log('Could not open report automatically. Please open it manually.');
  }
  
  return outputPath;
}

// Run the main function if this script is executed directly
if (require.main === module) {
  generateDetectionReport().catch(err => {
    console.error('Error generating detection report:', err);
    process.exit(1);
  });
}

module.exports = {
  generateDetectionReport
}; 