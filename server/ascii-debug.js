// Test the detection of "former" qualifier (לשעבר) after position
const text = "נפתלי בנת, ראש הממשלה לשעבר";
const position = "ראש הממשלה";

console.log("Starting test with Hebrew text (shown as hex codes):");
console.log("Text:", Buffer.from(text).toString('hex'));
console.log("Position:", Buffer.from(position).toString('hex'));

// Find the position term in the text
const positionIndex = text.indexOf(position);
console.log("Position index:", positionIndex);

if (positionIndex >= 0) {
  // Get text after the position
  const afterText = text.substring(positionIndex + position.length);
  console.log("Text after position:", Buffer.from(afterText).toString('hex'));
  
  // Check if it contains "לשעבר" (former)
  const former = "לשעבר";
  console.log("Former term:", Buffer.from(former).toString('hex'));
  
  const containsFormer = afterText.includes(former);
  console.log("Contains 'former':", containsFormer);
  
  // Test our regex patterns
  const trimmedAfterText = afterText.trim();
  console.log("Trimmed after text:", Buffer.from(trimmedAfterText).toString('hex'));
  
  const startsWithFormer = trimmedAfterText.startsWith(former);
  console.log("After trimming, starts with 'former':", startsWithFormer);
  
  // Check if there's punctuation followed by "former"
  const punctuationThenFormer = /^[ \t,.;:]+לשעבר/.test(afterText);
  console.log("Has punctuation then 'former':", punctuationThenFormer);
  
  // Our full check
  const isFormerPosition = trimmedAfterText.startsWith(former) || punctuationThenFormer;
  console.log("\nFINAL RESULT - Is former position:", isFormerPosition);
  
  if (isFormerPosition) {
    console.log("SUCCESS: Our solution will correctly skip detecting Netanyahu");
  } else {
    console.log("FAILURE: Our solution would incorrectly detect Netanyahu");
  }
} else {
  console.log("FAILURE: Position not found in text");
}

// Print a report about the issue and solution
console.log("\n----------------------------------------");
console.log("ISSUE ANALYSIS");
console.log("----------------------------------------");
console.log("Problem: When text mentions 'former prime minister' (ראש הממשלה לשעבר),");
console.log("the system incorrectly associates it with Netanyahu (current prime minister).");
console.log("\nSolution implemented:");
console.log("1. Check for 'לשעבר' (former) after any position term");
console.log("2. When 'לשעבר' is found, skip the current position detection");
console.log("3. This prevents Netanyahu being detected when Bennett is mentioned as former PM");
console.log("----------------------------------------"); 