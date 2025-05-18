/**
 * False Positives Detection Test
 * 
 * This tool focuses on identifying and analyzing false positives
 * in politician detection to help improve the algorithm.
 */

const fs = require('fs');
const path = require('path');
const { loadPoliticians, findPoliticianMentions } = require('../../../src/politician-detection/politicianDetectionService');
const { exec } = require('child_process');
const os = require('os');

const POLITICIANS_FILE = path.join(__dirname, '../../../../data/politicians/politicians.json');
const ALL_POLITICIANS = loadPoliticians(POLITICIANS_FILE);

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
  },
  {
    text: "גדי אייזנקוט הוא אלוף במילואים, לא שר הביטחון הנוכחי.",
    expectedDetections: ["גדי אייזנקוט"] // Expecting Gadi, but the context might be tricky for older versions
  },
  {
    text: "השר לשעבר גלעד ארדן נאם באו\"ם.",
    expectedDetections: ["גלעד ארדן"]
  },
  {
    text: "יוסי כהן, ראש המוסד לשעבר, נפגש עם בכירים.",
    expectedDetections: ["יוסי כהן"]
  },
  {
    text: "This text mentions Paris, not a politician.",
    expectedDetections: []
  },
  {
    text: "בני גנץ הוא יו\"ר המחנה הממלכתי.",
    expectedDetections: ["בני גנץ"]
  },
  {
    text: "שר האוצר לשעבר אמר כי הוא תומך במהלך",
    expectedDetections: []
  },
  {
    text: "ראש הממשלה היוצא לפיד נאם בכנס",
    expectedDetections: ["יאיר לפיד"]
  },
  {
    text: "הפרשן יעקב ברדוגו טען בשידור",
    expectedDetections: []
  },
  {
    text: "חבר הכנסת לשעבר משה פייגלין",
    expectedDetections: ["משה פייגלין"]
  },
  {
    text: "דובר צהל הודיע על תרגיל גדול",
    expectedDetections: []
  },
  {
    text: "בעקבות נאום גנץ, נתניהו ימסור הצהרה",
    expectedDetections: ["בני גנץ", "בנימין נתניהו"]
  },
  {
    text: "הנשיא הרצוג נפגש עם משפחות החטופים",
    expectedDetections: ["יצחק הרצוג"]
  },
  {
    text: "עיתונאי בשם אריאל כהנא דיווח על האירוע",
    expectedDetections: []
  },
  {
    text: "שר הביטחון גלנט קיים הערכת מצב",
    expectedDetections: ["יואב גלנט"]
  },
  {
    text: "אביגדור ליברמן, יו\"ר ישראל ביתנו, צייץ בחשבון הטוויטר שלו",
    expectedDetections: ["אביגדור ליברמן"]
  },
  {
    text: "זהו טקסט כללי על ממשלת ישראל, ללא שמות ספציפיים של שרים.",
    expectedDetections: []
  },
  {
    text: "עמית סגל ודפנה ליאל מדווחים מהכנסת",
    expectedDetections: []
  },
  {
    text: "ברק רביד חשף את הסיפור",
    expectedDetections: []
  },
  {
    text: "עמיתו של בן גביר, השר הטורקי, הגיע לביקור בירושלים",
    expectedDetections: ["איתמר בן גביר"]
  },
  {
    text: "גדי אייזנקוט הוא אלוף במילואים, לא שר הביטחון הנוכחי.",
    expectedDetections: ["גדי אייזנקוט"]
  },
  {
    text: "השר לשעבר גלעד ארדן נאם באו\"ם.",
    expectedDetections: ["גלעד ארדן"]
  },
  {
    text: "יוסי כהן, ראש המוסד לשעבר, נפגש עם בכירים.",
    expectedDetections: ["יוסי כהן"]
  },
  {
    text: "This text mentions Paris, not a politician.",
    expectedDetections: []
  },
  {
    text: "בני גנץ הוא יו\"ר המחנה הממלכתי.",
    expectedDetections: ["בני גנץ"]
  }
];

// Function to compare two arrays of detections
function areDetectionsEqual(arr1, arr2) {
  if (!arr1 || !arr2) return false;
  if (arr1.length !== arr2.length) return false;
  const sortedArr1 = [...arr1].sort();
  const sortedArr2 = [...arr2].sort();
  return sortedArr1.every((value, index) => value === sortedArr2[index]);
}

// Process the test cases
async function testFalsePositives() {
  console.log(`Loaded ${ALL_POLITICIANS.length} politicians for testing false positives.`);
  
  const results = [];
  let passedCount = 0;
  let failedCount = 0;
  
  for (const scenario of falsePositiveScenarios) {
    const detectedPoliticians = findPoliticianMentions(scenario.text, ALL_POLITICIANS);
    const passed = areDetectionsEqual(detectedPoliticians, scenario.expectedDetections);

    if (passed) {
      passedCount++;
    } else {
      failedCount++;
    }
    
    results.push({
      text: scenario.text,
      expected: scenario.expectedDetections,
      actual: detectedPoliticians,
      passed: passed
    });
  }
  
  // Generate and save HTML report
  const reportPath = await generateHtmlReport(results, passedCount, failedCount);
  console.log(`False positives test report generated at: ${reportPath}`);
  console.log(`Summary: ${passedCount} passed, ${failedCount} failed out of ${results.length} scenarios.`);
  
  if (failedCount > 0) {
    console.error(`${failedCount} false positive scenarios failed. Check the report.`);
  }
  openFileInBrowser(reportPath);
}

// Generate HTML report for false positive tests
async function generateHtmlReport(results, passedCount, failedCount) {
  let html = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>דוח בדיקת זיהויים שגויים (False Positives)</title>
  <style>
    body { font-family: Arial, sans-serif; direction: rtl; margin: 20px; background-color: #f4f4f4; color: #333; }
    h1, h2 { color: #333; border-bottom: 2px solid #ddd; padding-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; background-color: #fff; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
    th, td { border: 1px solid #ddd; padding: 10px; text-align: right; vertical-align: top; }
    th { background-color: #e9e9e9; font-weight: bold; }
    .summary-section { padding: 15px; background-color: #fff; border: 1px solid #ddd; margin-bottom: 20px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
    .summary-section h2 { margin-top: 0; }
    .pass { background-color: #d4edda; color: #155724; }
    .fail { background-color: #f8d7da; color: #721c24; }
    .politician-tag { display: inline-block; margin: 2px; padding: 3px 8px; background-color: #e0e0e0; border-radius: 4px; font-size: 0.9em; }
    em { color: #777; }
  </style>
</head>
<body>
  <h1>דוח בדיקת זיהויים שגויים (False Positives)</h1>
  
  <div class="summary-section">
    <h2>סיכום תוצאות</h2>
    <p>סה"כ תרחישים שנבדקו: <strong>${results.length}</strong></p>
    <p style="color: #155724;">עברו בהצלחה: <strong>${passedCount}</strong></p>
    <p style="color: #721c24;">נכשלו: <strong>${failedCount}</strong></p>
  </div>

  <h2>פירוט תוצאות</h2>
  <table>
    <thead>
    <tr>
        <th style="width: 50%;">טקסט לבדיקה</th>
        <th style="width: 20%;">זיהויים מצופים</th>
        <th style="width: 20%;">זיהויים בפועל</th>
        <th style="width: 10%;">תוצאה</th>
    </tr>
    </thead>
    <tbody>
      ${results.map(res => {
      let rowClass = '';
        if (res.passed) rowClass = 'pass';
        else rowClass = 'fail';
      
      return `
      <tr class="${rowClass}">
          <td>${res.text}</td>
          <td>${res.expected.map(p => `<span class="politician-tag">${escapeHtml(p)}</span>`).join('') || '<em>אין</em>'}</td>
          <td>${res.actual.map(p => `<span class="politician-tag">${escapeHtml(p)}</span>`).join('') || '<em>אין</em>'}</td>
          <td>${res.passed ? 'עבר' : 'נכשל'}</td>
      </tr>
      `;
    }).join('')}
    </tbody>
  </table>
</body>
</html>`;

  const outputPath = path.join(__dirname, '../data/false-positives-report.html');
  fs.writeFileSync(outputPath, html, 'utf8');
  return outputPath;
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
  
// Helper to open file in browser
function openFileInBrowser(filePath) {
  const openCommand = os.platform() === 'win32' ? 'start' : (os.platform() === 'darwin' ? 'open' : 'xdg-open');
  exec(`${openCommand} "${filePath}"`, (error) => {
    if (error) {
      console.error(`Failed to open report: ${error.message}`);
      console.log(`Please open it manually: ${filePath}`);
    }
  });
}

// Run the tests
if (require.main === module) {
  testFalsePositives().catch(console.error);
}

module.exports = {
  testFalsePositives
}; 