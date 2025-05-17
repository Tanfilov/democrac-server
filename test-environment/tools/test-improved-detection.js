/**
 * Improved Politician Detection Test Tool
 * 
 * This tool tests the improved detection algorithm against
 * specific test cases that previously showed false positives.
 */

const fs = require('fs');
const path = require('path');
// const politicianDetection = require('../../src/politician-detection'); // original (old index.js)
// const improvedDetection = require('../../src/politician-detection/detection-fix'); // old fix file
const { loadPoliticians, findPoliticianMentions } = require('../../../src/politician-detection/politicianDetectionService');

const POLITICIANS_FILE = path.join(__dirname, '../../../../data/politicians/politicians.json');
const ALL_POLITICIANS = loadPoliticians(POLITICIANS_FILE);

// Helper to simulate the "original" simple detection if needed for comparison
// This would be a very basic name/alias check, similar to what the initial findPoliticianMentions might have done.
// For a true comparison to the *exact* old logic, that logic would need to be preserved/imported separately.
function simpleLegacyFindMentions(text, politicians) {
    const found = [];
    politicians.forEach(p => {
        const namesToSearch = [p.name, ...(p.aliases || [])];
        namesToSearch.forEach(name => {
            if (name && text.includes(name)) {
                if (!found.includes(p.name)) {
                    found.push(p.name);
                }
            }
        });
    });
    return found;
}

// Test cases for comparison
const testCases = [
  {
    name: "Test case 1: Simple name mention",
    text: "ראש הממשלה בנימין נתניהו נפגש עם שר החוץ",
    expectDetection: true,
    expectedNames: ["בנימין נתניהו"]
  },
  {
    name: "Test case 2: Position only",
    text: "ראש הממשלה הודיע היום על צעדים חדשים",
    expectDetection: true,
    expectedNames: ["בנימין נתניהו"]
  },
  {
    name: "Test case 3: Former position (FALSE POSITIVE in original)",
    text: "ראש הממשלה לשעבר נפתלי בנט",
    expectDetection: false,
    expectedNames: []
  },
  {
    name: "Test case 4: Future position (FALSE POSITIVE in original)",
    text: "ראש הממשלה הבא יצטרך להתמודד עם אתגרים רבים",
    expectDetection: false,
    expectedNames: []
  },
  {
    name: "Test case 5: Position with context (FALSE POSITIVE in original)",
    text: "מי שיהיה ראש הממשלה בעוד כמה שנים יצטרך להתמודד",
    expectDetection: false,
    expectedNames: []
  },
  {
    name: "Test case 6: Multiple positions",
    text: "בפגישה השתתפו ראש הממשלה, שר הביטחון ונשיא המדינה",
    expectDetection: true,
    expectedNames: ["בנימין נתניהו", "יואב גלנט", "יצחק הרצוג"]
  },
  {
    name: "Test case 7: Historical reference (FALSE POSITIVE in original)",
    text: "ראש הממשלה של ממשלת האחדות ב-1984 היה שמעון פרס",
    expectDetection: false,
    expectedNames: []
  },
  {
    name: "Test case 8: News headline",
    text: "רה\"מ וראש האופוזיציה נפגשו היום לדיון על חוק הגיוס",
    expectDetection: true,
    expectedNames: ["בנימין נתניהו", "יאיר לפיד"]
  },
  {
    name: "Test case 9: Context required - with context",
    text: "שר הדתות מתן כהנא הודיע על רפורמה חדשה",
    expectDetection: true,
    expectedNames: ["כהנא"]
  },
  {
    name: "Test case 10: Context required - without context",
    text: "כהנא הוא שם משפחה נפוץ בישראל",
    expectDetection: false,
    expectedNames: []
  },
  // New challenging test cases
  {
    name: "Test case 11: Position + noun (FALSE POSITIVE risk)",
    text: "ראש הממשלה האמריקאי נשא נאום",
    expectDetection: false,
    expectedNames: []
  },
  {
    name: "Test case 12: News article mentioning 'המשרד של ראש הממשלה'",
    text: "דובר המשרד של ראש הממשלה הודיע אתמול כי התכנית החדשה תיבחן",
    expectDetection: true, 
    expectedNames: ["בנימין נתניהו"]
  },
  {
    name: "Test case 13: Ambiguous minister mention",
    text: "לדברי השר, יש לבחון מחדש את חוק המיסוי",
    expectDetection: false, // Should not detect any specific minister
    expectedNames: []
  },
  {
    name: "Test case 14: Minister mentioned in plural",
    text: "שרי הממשלה התכנסו לישיבה מיוחדת בהובלת ראש הממשלה",
    expectDetection: true,
    expectedNames: ["בנימין נתניהו"]
  },
  {
    name: "Test case 15: Position holder from another country",
    text: "נשיא ארצות הברית נחת בישראל לפגישה עם ראש הממשלה",
    expectDetection: true,
    expectedNames: ["בנימין נתניהו"]
  },
  {
    name: "Test case 16: Hypothetical statement",
    text: "אם ראש הממשלה יחליט ללכת לבחירות, תהיה לכך השפעה על המשק",
    expectDetection: true, // This is still referring to the current PM
    expectedNames: ["בנימין נתניהו"]
  },
  {
    name: "Test case 17: Complex sentence with multiple positions",
    text: "בישיבה בה נכחו ראש הממשלה לשעבר וראש הממשלה הנוכחי, הסכימו כולם כי שר הביטחון צדק בהערכותיו",
    expectDetection: true,
    expectedNames: ["בנימין נתניהו", "יואב גלנט"]
  },
  {
    name: "Test case 18: ראש הממשלה + adjective",
    text: "ראש הממשלה המכהן הגיע לאחרונה למסקנה כי יש לשנות את המדיניות",
    expectDetection: true,
    expectedNames: ["בנימין נתניהו"]
  },
  {
    name: "Test case 19: Complex context for context-required name",
    text: "כהנא פעלו בעבר, אך מתן כהנא הוא האיש הנכון לתפקיד",
    expectDetection: true,
    expectedNames: ["כהנא"]
  },
  {
    name: "Test case 20: Similar name but not a politician",
    text: "יש הטוענים כי משה נתניהו, שאינו קרוב משפחה של ראש הממשלה, הוא איש עסקים מוכשר",
    expectDetection: true, // Should only detect PM from "ראש הממשלה"
    expectedNames: ["בנימין נתניהו"]
  }
];

// Compare the detection results
function compareDetection() {
  console.log("COMPARING ORIGINAL VS IMPROVED DETECTION");
  console.log("========================================\n");
  
  const politicians = loadPoliticians();
  console.log(`Loaded ${politicians.length} politicians for testing\n`);
  
  let originalPassed = 0;
  let improvedPassed = 0;
  
  for (const testCase of testCases) {
    console.log(`${testCase.name}`);
    console.log(`Text: "${testCase.text}"`);
    
    // Run the original detection
    const originalResults = simpleLegacyFindMentions(testCase.text, ALL_POLITICIANS);
    const originalPassed_case = testCase.expectDetection 
      ? originalResults.length > 0 && testCase.expectedNames.every(name => originalResults.includes(name))
      : originalResults.length === 0;
      
    // Run the improved detection
    const improvedResults = findPoliticianMentions(testCase.text, ALL_POLITICIANS);
    const improvedPassed_case = testCase.expectDetection 
      ? improvedResults.length > 0 && testCase.expectedNames.every(name => improvedResults.includes(name))
      : improvedResults.length === 0;
    
    // Count passed tests
    if (originalPassed_case) originalPassed++;
    if (improvedPassed_case) improvedPassed++;
    
    // Print results
    console.log(`Expected: ${testCase.expectDetection ? testCase.expectedNames.join(', ') : 'None'}`);
    console.log(`Original: ${originalResults.length > 0 ? originalResults.join(', ') : 'None'} - ${originalPassed_case ? 'PASS' : 'FAIL'}`);
    console.log(`Improved: ${improvedResults.length > 0 ? improvedResults.join(', ') : 'None'} - ${improvedPassed_case ? 'PASS' : 'FAIL'}`);
    
    if (originalResults.length !== improvedResults.length || 
        !originalResults.every(name => improvedResults.includes(name))) {
      console.log("DIFFERENCE DETECTED! This demonstrates the improvement.");
    }
    
    console.log('-'.repeat(60));
  }
  
  // Print summary
  console.log("\nTEST RESULTS SUMMARY:");
  console.log(`Original detection passed: ${originalPassed}/${testCases.length} (${Math.round((originalPassed / testCases.length) * 100)}%)`);
  console.log(`Improved detection passed: ${improvedPassed}/${testCases.length} (${Math.round((improvedPassed / testCases.length) * 100)}%)`);
  
  if (improvedPassed > originalPassed) {
    console.log(`\nIMPROVEMENT: The new detection fixed ${improvedPassed - originalPassed} test cases!`);
  } else if (improvedPassed === originalPassed) {
    console.log("\nNO CHANGE: The detection results are the same. Need more improvements.");
  } else {
    console.log("\nREGRESSION: The improved detection performed worse than the original.");
  }
}

// Run the comparison when script is executed directly
if (require.main === module) {
  compareDetection();
}

module.exports = {
  compareDetection
}; 