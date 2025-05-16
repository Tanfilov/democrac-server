/**
 * Specific Politician Detection Test Tool
 * 
 * This tool tests specific cases of politician detection to identify
 * false positives and investigate detection issues.
 */

const fs = require('fs');
const path = require('path');
const politicianDetection = require('../src/politician-detection');

// Load the politicians data
function loadPoliticians() {
  try {
    const politiciansPath = path.join(__dirname, '../data/politicians/politicians.json');
    if (fs.existsSync(politiciansPath)) {
      return politicianDetection.loadPoliticians(politiciansPath);
    }
    
    throw new Error('No politicians data found');
  } catch (error) {
    console.error('Error loading politicians:', error.message);
    return [];
  }
}

// Test case structure for targeted detection testing
const testCases = [
  {
    name: "Simple name mention",
    text: "ראש הממשלה בנימין נתניהו נפגש עם שר החוץ",
    expectedDetections: ["בנימין נתניהו"]
  },
  {
    name: "Position only mention without name",
    text: "ראש הממשלה נפגש עם ראש האופוזיציה ושר הביטחון",
    expectedDetections: ["בנימין נתניהו", "יאיר לפיד", "יואב גלנט"]
  },
  {
    name: "Two politicians in same sentence",
    text: "יאיר לפיד ביקר את התנהלות רה״מ נתניהו ואת שר האוצר סמוטריץ׳",
    expectedDetections: ["יאיר לפיד", "בנימין נתניהו", "בצלאל סמוטריץ'"]
  },
  {
    name: "Politician alias only",
    text: "ביבי אמר בישיבת הממשלה אתמול",
    expectedDetections: ["בנימין נתניהו"]
  },
  {
    name: "Former position reference (false positive test)",
    text: "ראש הממשלה לשעבר נפתלי בנט",
    expectedDetections: [] // Should not detect Netanyahu
  },
  {
    name: "Requires context - with context",
    text: "שר הדתות מתן כהנא הודיע על רפורמה חדשה",
    expectedDetections: ["כהנא"]
  },
  {
    name: "Requires context - without context (false positive test)",
    text: "כהנא הוא שם משפחה נפוץ בישראל",
    expectedDetections: [] // Should not detect without context
  },
  {
    name: "News article excerpt with positions",
    text: "בעקבות שיחות בין ראש הממשלה לשר הביטחון, הוחלט להגביר את פעילות צה״ל ברצועת עזה. הנשיא ברך על ההחלטה.",
    expectedDetections: ["בנימין נתניהו", "יואב גלנט", "יצחק הרצוג"]
  },
  {
    name: "Position with different forms (false positive test)",
    text: "ראש עיריית תל אביב הודיע על תכנית חדשה. ראש הממשלה הבא יצטרך להתמודד עם אתגרים רבים.",
    expectedDetections: [] // Should not detect any current politicians
  },
  {
    name: "Non-existant politician (false positive test)",
    text: "משה הלך לקניות עם בני, בזמן שגלעד ישב במשרד",
    expectedDetections: [] // Should not detect anything here
  }
];

// Run all test cases
function runTests() {
  console.log("POLITICIAN DETECTION TEST RESULTS");
  console.log("=================================\n");
  
  const politicians = loadPoliticians();
  console.log(`Loaded ${politicians.length} politicians for testing\n`);
  
  // Inspect the politicians data
  console.log("POLITICIAN DATA SAMPLE:");
  politicians.slice(0, 3).forEach(politician => {
    console.log(JSON.stringify(politician, null, 2));
  });
  console.log("...\n");
  
  let passedTests = 0;
  let failedTests = 0;
  
  for (const testCase of testCases) {
    console.log(`TEST CASE: ${testCase.name}`);
    console.log(`Text: "${testCase.text}"`);
    console.log(`Expected: ${testCase.expectedDetections.length > 0 ? testCase.expectedDetections.join(", ") : "None"}`);
    
    // Run the detection
    const detectedPoliticians = politicianDetection.findPoliticianMentions(testCase.text, politicians);
    console.log(`Detected: ${detectedPoliticians.length > 0 ? detectedPoliticians.join(", ") : "None"}`);
    
    // Check for false positives (detected but not expected)
    const falsePositives = detectedPoliticians.filter(detected => 
      !testCase.expectedDetections.includes(detected)
    );
    
    // Check for false negatives (expected but not detected)
    const falseNegatives = testCase.expectedDetections.filter(expected => 
      !detectedPoliticians.includes(expected)
    );
    
    if (falsePositives.length > 0) {
      console.log(`FALSE POSITIVES: ${falsePositives.join(", ")}`);
    }
    
    if (falseNegatives.length > 0) {
      console.log(`FALSE NEGATIVES: ${falseNegatives.join(", ")}`);
    }
    
    // Show result
    const passed = falsePositives.length === 0 && falseNegatives.length === 0;
    console.log(`RESULT: ${passed ? "PASSED" : "FAILED"}`);
    
    if (passed) {
      passedTests++;
    } else {
      failedTests++;
    }
    
    console.log("-".repeat(50));
  }
  
  // Print summary
  console.log(`\nTEST SUMMARY:`);
  console.log(`Passed: ${passedTests}/${testCases.length}`);
  console.log(`Failed: ${failedTests}/${testCases.length}`);
  console.log(`Success rate: ${Math.round((passedTests / testCases.length) * 100)}%`);
  
  return { passed: passedTests, failed: failedTests };
}

// Debug the structure and detection of a specific politician
function debugPoliticianDetection(politicianName) {
  const politicians = loadPoliticians();
  
  // Find the politician in the data
  const politician = politicians.find(p => 
    p.name === politicianName || 
    (p.aliases && p.aliases.includes(politicianName))
  );
  
  if (!politician) {
    console.log(`Politician "${politicianName}" not found in the data.`);
    return;
  }
  
  console.log("POLITICIAN DATA:");
  console.log(JSON.stringify(politician, null, 2));
  
  // Create test text that should detect this politician
  const testTextName = `${politician.name} נפגש עם אזרחים.`;
  const testTextPosition = politician.position ? `${politician.position} נפגש עם אזרחים.` : null;
  const testTextAlias = politician.aliases && politician.aliases.length > 0 
    ? `${politician.aliases[0]} נפגש עם אזרחים.` 
    : null;
  
  console.log("\nDETECTION TESTS:");
  
  // Test name detection
  console.log(`\nTesting name: "${testTextName}"`);
  const nameDetections = politicianDetection.findPoliticianMentions(testTextName, politicians);
  console.log(`Result: ${nameDetections.join(", ") || "No detection"}`);
  
  // Test position detection
  if (testTextPosition) {
    console.log(`\nTesting position: "${testTextPosition}"`);
    const positionDetections = politicianDetection.findPoliticianMentions(testTextPosition, politicians);
    console.log(`Result: ${positionDetections.join(", ") || "No detection"}`);
  }
  
  // Test alias detection
  if (testTextAlias) {
    console.log(`\nTesting alias: "${testTextAlias}"`);
    const aliasDetections = politicianDetection.findPoliticianMentions(testTextAlias, politicians);
    console.log(`Result: ${aliasDetections.join(", ") || "No detection"}`);
  }
}

// Run specific commands based on arguments
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length > 0 && args[0] === 'debug') {
    // Debug a specific politician
    if (args.length > 1) {
      debugPoliticianDetection(args[1]);
    } else {
      console.log("Please specify a politician name to debug.");
      console.log("Usage: node test-specific-detection.js debug 'בנימין נתניהו'");
    }
  } else {
    // Run all tests
    runTests();
  }
}

module.exports = {
  runTests,
  debugPoliticianDetection
}; 