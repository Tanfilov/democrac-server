/**
 * Test Specific Cases with HTML Report
 * 
 * This tool tests specific test cases with the original and improved 
 * detection algorithms and generates an HTML report.
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const open = require('open');
const { exec } = require('child_process');
const os = require('os');
const { loadPoliticians, findPoliticianMentions } = require('../../src/politician-detection/politicianDetectionService');

const POLITICIANS_FILE = path.join(__dirname, '../../../data/politicians/politicians.json');
const politicians = loadPoliticians(POLITICIANS_FILE);

// Process a test file and generate an HTML report
async function processTestFile(filePath) {
  // Load politicians
  console.log(`Loaded ${politicians.length} politicians for testing`);
  
  // Read test file
  console.log(`Reading test file: ${filePath}`);
  const content = fs.readFileSync(filePath, 'utf8');
  const testCases = content.split('\n')
    .filter(line => line.trim().length > 0)
    .map(line => {
      // Extract the line number and text from the form "1. text here"
      const match = line.match(/^(\d+)\.\s+(.+)$/);
      if (match) {
        return {
          number: match[1],
          text: match[2]
        };
      }
      return { number: 0, text: line };
    });
  
  console.log(`Found ${testCases.length} test cases`);
  
  // Process each test case
  const results = [];
  
  for (const testCase of testCases) {
    // Get detections from both algorithms
    // Original detection (if still needed for comparison, otherwise remove)
    // const originalResults = originalDetection.findPoliticianMentions(testCase.text, politicians);
    // console.log(`Original detection: ${originalResults.join(', ')}`);

    // Improved detection
    const improvedResults = findPoliticianMentions(testCase.text, politicians);
    console.log(`Improved detection: ${improvedResults.join(', ')}`);
    
    // Add result
    results.push({
      number: testCase.number,
      text: testCase.text,
      originalDetections: [],
      improvedDetections: improvedResults,
      hasDifference: !areDetectionsEqual(results[results.length - 1].originalDetections, improvedResults)
    });
  }
  
  // Generate HTML report
  console.log("Generating HTML report...");
  const html = generateHtmlReport(results, path.basename(filePath));
  
  // Save HTML report
  const outputPath = path.join(__dirname, '../data/test-specific-report.html');
  fs.writeFileSync(outputPath, html, 'utf8');
  console.log(`HTML report saved to: ${outputPath}`);
  
  // Open in browser - platform specific
  try {
    openFileInBrowser(outputPath);
  } catch (err) {
    console.log('Could not open report automatically. Please open it manually.');
  }
  
  return outputPath;
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

// Check if two detection arrays are equal
function areDetectionsEqual(a, b) {
  if (a.length !== b.length) return false;
  
  // Check if all items in a are in b
  for (const item of a) {
    if (!b.includes(item)) return false;
  }
  
  return true;
}

// Generate HTML report
function generateHtmlReport(results, testFileName) {
  const passCount = results.filter(r => !r.hasDifference).length;
  const failCount = results.filter(r => r.hasDifference).length;
  
  let html = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>דוח בדיקת זיהוי פוליטיקאים</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      margin: 20px;
      background-color: #f5f5f5;
    }
    h1, h2 {
      color: #003366;
    }
    h1 {
      text-align: center;
      margin-bottom: 30px;
    }
    .summary {
      margin-bottom: 20px;
      padding: 15px;
      background-color: #e6f7ff;
      border-radius: 5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
      background-color: #fff;
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
    .difference {
      background-color: #ffe6e6;
    }
    .no-difference {
      background-color: #e6ffe6;
    }
    .detection {
      margin-right: 5px;
      padding: 3px 6px;
      border-radius: 3px;
      background-color: #e6f7ff;
      display: inline-block;
      margin-bottom: 5px;
      font-size: 0.9em;
    }
    .text-context {
      padding: 10px;
      border-radius: 5px;
      background-color: #f5f5f5;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <h1>דוח בדיקת זיהוי פוליטיקאים</h1>
  
  <div class="summary">
    <h2>סיכום</h2>
    <p>קובץ בדיקה: <strong>${testFileName}</strong></p>
    <p>סך הכל מקרי בדיקה: <strong>${results.length}</strong></p>
    <p>זהים: <strong>${passCount}</strong> (${Math.round((passCount / results.length) * 100)}%)</p>
    <p>שונים: <strong>${failCount}</strong> (${Math.round((failCount / results.length) * 100)}%)</p>
  </div>
  
  <table>
    <tr>
      <th>מס'</th>
      <th>משפט לבדיקה</th>
      <th>זיהוי מקורי</th>
      <th>זיהוי משופר</th>
      <th>הבדל</th>
    </tr>`;
  
  // Add rows
  for (const result of results) {
    html += `
    <tr class="${result.hasDifference ? 'difference' : 'no-difference'}">
      <td>${result.number}</td>
      <td class="text-context">${highlightDetections(result.text, result.improvedDetections)}</td>
      <td>${formatDetections(result.originalDetections)}</td>
      <td>${formatDetections(result.improvedDetections)}</td>
      <td>${result.hasDifference ? 'כן' : 'לא'}</td>
    </tr>`;
  }
  
  html += `
  </table>
</body>
</html>`;
  
  return html;
}

// Format detections as badges
function formatDetections(detections) {
  if (!detections || detections.length === 0) return '<span style="color: #888;">אין פוליטיקאים</span>';
  
  return detections.map(d => `<span class="detection">${d}</span>`).join(' ');
}

// Highlight detections in the text
function highlightDetections(text, detections) {
  if (!detections || detections.length === 0) return text;
  
  let highlightedText = text;
  
  // Sort detections by length (descending) to ensure longer names are highlighted first
  const sortedDetections = [...detections].sort((a, b) => b.length - a.length);
  
  // Highlight each detection
  for (const detection of sortedDetections) {
    const regex = new RegExp(`\\b${escapeRegExp(detection)}\\b`, 'g');
    highlightedText = highlightedText.replace(regex, `<span class="highlight">${detection}</span>`);
  }
  
  return highlightedText;
}

// Helper to escape regex special characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Run the test if this script is run directly
if (require.main === module) {
  // Get test file path from command line argument, or use default
  const args = process.argv.slice(2);
  const testFilePath = args[0] || path.join(__dirname, '../data/test-cases/foreign-positions-test.txt');
  
  processTestFile(testFilePath).catch(err => {
    console.error('Error processing test file:', err);
    process.exit(1);
  });
}

module.exports = {
  processTestFile
}; 