const fs = require('fs');

// Test the detection of "former" qualifier (לשעבר) after position
const text = "נפתלי בנת, ראש הממשלה לשעבר";
const position = "ראש הממשלה";
const former = "לשעבר";

let results = [];

// Log a message to both console and our results array
function log(message) {
  console.log(message);
  results.push(message);
}

log("Testing position detection with 'former' qualifier");
log(`Text: ${text}`);
log(`Position: ${position}`);
log(`Former term: ${former}`);

// Find the position term in the text
const positionIndex = text.indexOf(position);
log(`Position index: ${positionIndex}`);

if (positionIndex >= 0) {
  // Get text after the position
  const afterText = text.substring(positionIndex + position.length);
  log(`Text after position: "${afterText}"`);
  
  // Check if it contains "לשעבר" (former)
  const containsFormer = afterText.includes(former);
  log(`Contains 'former': ${containsFormer}`);
  
  // Test our regex patterns
  const trimmedAfterText = afterText.trim();
  log(`Trimmed after text: "${trimmedAfterText}"`);
  
  const startsWithFormer = trimmedAfterText.startsWith(former);
  log(`After trimming, starts with 'former': ${startsWithFormer}`);
  
  // Check if there's punctuation followed by "former"
  const punctuationThenFormer = /^[ \t,.;:]+לשעבר/.test(afterText);
  log(`Has punctuation then 'former': ${punctuationThenFormer}`);
  
  // Our full check
  const isFormerPosition = trimmedAfterText.startsWith(former) || punctuationThenFormer;
  log(`\nFINAL RESULT - Is former position: ${isFormerPosition}`);
  
  if (isFormerPosition) {
    log("SUCCESS: Our solution will correctly skip detecting Netanyahu");
  } else {
    log("FAILURE: Our solution would incorrectly detect Netanyahu");
  }
} else {
  log("FAILURE: Position not found in text");
}

// Print a report about the issue and solution
log("\n----------------------------------------");
log("ISSUE ANALYSIS");
log("----------------------------------------");
log("Problem: When text mentions 'former prime minister' (ראש הממשלה לשעבר),");
log("the system incorrectly associates it with Netanyahu (current prime minister).");
log("\nSolution implemented:");
log("1. Check for 'לשעבר' (former) after any position term");
log("2. When 'לשעבר' is found, skip the current position detection");
log("3. This prevents Netanyahu being detected when Bennett is mentioned as former PM");
log("----------------------------------------");

// Write results to a file
fs.writeFileSync('test-results.txt', results.join('\n'), 'utf8');
log("Results written to test-results.txt"); 