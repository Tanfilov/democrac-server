/**
 * False Positives Detection Test
 * 
 * This tool focuses on identifying and analyzing false positives
 * in politician detection to help improve the algorithm.
 */

const fs = require('fs');
const path = require('path');
const politicianDetection = require('../src/politician-detection');
const improvedDetection = require('../src/politician-detection/detection-fix');
const { exec } = require('child_process');
const os = require('os');

// Load the politicians data
function loadPoliticians() {
  try {
    const politiciansPath = path.join(__dirname, '../data/politicians/politicians.json');
    if (fs.existsSync(politiciansPath)) {
      return politicianDetection.loadPoliticians(politiciansPath);
    }
    
    // Fall back to the real data
    const politiciansPath2 = path.join(__dirname, '../../data/politicians/politicians.json');
    if (fs.existsSync(politiciansPath2)) {
      return politicianDetection.loadPoliticians(politiciansPath2);
    }
    
    throw new Error('No politicians data found');
  } catch (error) {
    console.error('Error loading politicians:', error.message);
    return [];
  }
}

// Known false positive patterns for each politician
const falsePositiveScenarios = [
  // Format: { text: "some test text", expectedDetections: [] }
  
  // Foreign leader false positives
  { 
    text: "ראש הממשלה של בריטניה חתם על הסכם סחר", 
    expectedDetections: [] 
  },
  { 
    text: "נשיא ארצות הברית ביידן ונשיא רוסיה פוטין נפגשו בג'נבה", 
    expectedDetections: [] 
  },
  
  // Historical references
  { 
    text: "ראש הממשלה לשעבר בגין חתם על הסכם השלום", 
    expectedDetections: [] 
  },
  { 
    text: "ראש הממשלה הקודם בנט פעל לקידום השלום", 
    expectedDetections: [] 
  },
  
  // Conditional or hypothetical
  { 
    text: "אם נתניהו יסכים להצעה, החטופים יחזרו", 
    expectedDetections: ["נתניהו"] 
  },
  { 
    text: "לו היה בן גביר שר הביטחון, המדיניות הייתה שונה", 
    expectedDetections: ["בן גביר"] 
  },
  
  // Names similar to politicians
  { 
    text: "דני נתן יהודה מלכה הגיע לכנס", 
    expectedDetections: [] 
  },
  
  // Common first names without context
  { 
    text: "בני וגבי חברים טובים מגבעתיים", 
    expectedDetections: [] 
  },
  
  // Foreign location/nationalities with politician names
  { 
    text: "השר הטורקי איתמר ביקר בישראל", 
    expectedDetections: [] 
  },
  
  // Complex sentence structures
  { 
    text: "הממשלה, לפיד אמר אתמול, תבחן את ההצעה בקרוב", 
    expectedDetections: ["לפיד"] 
  },
  { 
    text: "בדיון שעסק בעניין וועדת הכנסת, בן גביר דרש לקיים הצבעה", 
    expectedDetections: ["בן גביר"] 
  },
  
  // Cultural references with politician names
  { 
    text: "יש הרבה איילות בטבע הישראלי", 
    expectedDetections: [] 
  },
  
  // References to positions without specific name
  { 
    text: "ראש הממשלה אמר בנאומו אתמול", 
    expectedDetections: ["נתניהו"] // Assuming Netanyahu is PM
  },
  { 
    text: "ראש הממשלה שיכהן אחרי הבחירות יצטרך להתמודד עם אתגרים רבים", 
    expectedDetections: [] 
  },
  
  // Combinations of scenarios
  { 
    text: "לשעבר התייחס ראש הממשלה הבריטי לדבריו של נתניהו בכנס בלונדון", 
    expectedDetections: ["נתניהו"] 
  },
  { 
    text: "עמיתו של בן גביר, השר הטורקי, הגיע לביקור בירושלים", 
    expectedDetections: ["בן גביר"] 
  }
];

// Process the test cases
async function testFalsePositives() {
  // Load politicians
  const politicians = loadPoliticians();
  console.log(`Loaded ${politicians.length} politicians for testing`);
  
  // Process each test case with both detection methods
  const results = [];
  
  for (const scenario of falsePositiveScenarios) {
    const originalDetections = politicianDetection.findPoliticianMentions(scenario.text, politicians);
    const improvedDetections = improvedDetection.findPoliticianMentions(scenario.text, politicians);
    
    const originalCorrect = areDetectionsEqual(originalDetections, scenario.expectedDetections);
    const improvedCorrect = areDetectionsEqual(improvedDetections, scenario.expectedDetections);
    
    results.push({
      text: scenario.text,
      expected: scenario.expectedDetections,
      original: {
        detections: originalDetections,
        correct: originalCorrect
      },
      improved: {
        detections: improvedDetections,
        correct: improvedCorrect
      },
      improvement: !originalCorrect && improvedCorrect
    });
  }
  
  // Add some statistics
  const originalCorrectCount = results.filter(r => r.original.correct).length;
  const improvedCorrectCount = results.filter(r => r.improved.correct).length;
  const improvementCount = results.filter(r => r.improvement).length;
  
  // Generate and save HTML report
  const html = generateHtmlReport(results, {
    totalScenarios: results.length,
    originalCorrect: originalCorrectCount,
    improvedCorrect: improvedCorrectCount,
    improvements: improvementCount
  });
  
  const outputPath = path.join(__dirname, '../data/false-positives-report.html');
  fs.writeFileSync(outputPath, html, 'utf8');
  
  console.log(`HTML report generated at: ${outputPath}`);
  console.log(`Original algorithm correct: ${originalCorrectCount}/${results.length} (${Math.round(originalCorrectCount/results.length*100)}%)`);
  console.log(`Improved algorithm correct: ${improvedCorrectCount}/${results.length} (${Math.round(improvedCorrectCount/results.length*100)}%)`);
  console.log(`Improvements: ${improvementCount} scenarios`);
  
  // Open the report in the default browser
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

// Check if two detection arrays are equal regardless of order
function areDetectionsEqual(actual, expected) {
  if (actual.length !== expected.length) return false;
  
  const sortedActual = [...actual].sort();
  const sortedExpected = [...expected].sort();
  
  for (let i = 0; i < sortedActual.length; i++) {
    if (sortedActual[i] !== sortedExpected[i]) return false;
  }
  
  return true;
}

// Generate HTML report
function generateHtmlReport(results, stats) {
  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>דוח בדיקת זיהויים שגויים</title>
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
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .progress-container {
      width: 100%;
      background-color: #ddd;
      border-radius: 4px;
      margin: 10px 0;
    }
    .progress-bar {
      height: 20px;
      border-radius: 4px;
      text-align: center;
      color: white;
      font-weight: bold;
    }
    .progress-original {
      background-color: #4CAF50;
    }
    .progress-improved {
      background-color: #2196F3;
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
      background-color: #ffe066;
      font-weight: bold;
      padding: 2px 4px;
      border-radius: 3px;
    }
    .success {
      background-color: #dff0d8;
    }
    .failure {
      background-color: #f2dede;
    }
    .improvement {
      background-color: #d9edf7;
    }
    .detection-tag {
      display: inline-block;
      margin: 2px;
      padding: 3px 8px;
      background-color: #e6f7ff;
      border: 1px solid #1890ff;
      border-radius: 4px;
      font-size: 0.9em;
    }
    .expected-tag {
      background-color: #f0f7ff;
      border-color: #69c0ff;
    }
    .actual-tag-correct {
      background-color: #f6ffed;
      border-color: #95de64;
    }
    .actual-tag-wrong {
      background-color: #fff1f0;
      border-color: #ff7875;
    }
  </style>
</head>
<body>
  <h1>דוח בדיקת זיהויים שגויים של פוליטיקאים</h1>
  
  <div class="summary">
    <h2>סיכום</h2>
    <p>סך הכל תרחישי בדיקה: <strong>${stats.totalScenarios}</strong></p>
    
    <h3>ביצועי האלגוריתם המקורי:</h3>
    <div class="progress-container">
      <div class="progress-bar progress-original" style="width: ${Math.round(stats.originalCorrect/stats.totalScenarios*100)}%">
        ${Math.round(stats.originalCorrect/stats.totalScenarios*100)}%
      </div>
    </div>
    <p>${stats.originalCorrect} מתוך ${stats.totalScenarios} תרחישים זוהו נכון</p>
    
    <h3>ביצועי האלגוריתם המשופר:</h3>
    <div class="progress-container">
      <div class="progress-bar progress-improved" style="width: ${Math.round(stats.improvedCorrect/stats.totalScenarios*100)}%">
        ${Math.round(stats.improvedCorrect/stats.totalScenarios*100)}%
      </div>
    </div>
    <p>${stats.improvedCorrect} מתוך ${stats.totalScenarios} תרחישים זוהו נכון</p>
    
    <h3>שיפור:</h3>
    <p>${stats.improvements} תרחישים שהאלגוריתם המשופר זיהה נכון והמקורי שגה</p>
  </div>

  <table>
    <tr>
      <th style="width: 40%;">טקסט המבחן</th>
      <th style="width: 20%;">פוליטיקאים צפויים</th>
      <th style="width: 20%;">זיהוי אלגוריתם מקורי</th>
      <th style="width: 20%;">זיהוי אלגוריתם משופר</th>
    </tr>
    ${results.map(result => {
      let rowClass = '';
      if (result.improvement) rowClass = 'improvement';
      else if (result.original.correct && result.improved.correct) rowClass = 'success';
      else if (!result.original.correct && !result.improved.correct) rowClass = 'failure';
      
      return `
      <tr class="${rowClass}">
        <td>${result.text}</td>
        <td>${formatDetections(result.expected, 'expected-tag')}</td>
        <td>${formatDetections(result.original.detections, result.original.correct ? 'actual-tag-correct' : 'actual-tag-wrong')}</td>
        <td>${formatDetections(result.improved.detections, result.improved.correct ? 'actual-tag-correct' : 'actual-tag-wrong')}</td>
      </tr>
      `;
    }).join('')}
  </table>
</body>
</html>`;

  return html;
}

// Format detection arrays as HTML tags
function formatDetections(detections, className) {
  if (!detections || detections.length === 0) {
    return '<span class="detection-tag ' + className + '">אין</span>';
  }
  
  return detections
    .map(name => `<span class="detection-tag ${className}">${name}</span>`)
    .join(' ');
}

// Run the main function if this script is executed directly
if (require.main === module) {
  testFalsePositives().catch(err => {
    console.error('Error testing false positives:', err);
    process.exit(1);
  });
}

module.exports = {
  testFalsePositives
}; 