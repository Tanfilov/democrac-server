// Simple test for "לשעבר" detection
const testText = "נפתלי בנת, ראש הממשלה לשעבר";
console.log(`Test text: "${testText}"`);

const position = "ראש הממשלה";
const positionIndex = testText.indexOf(position);

if (positionIndex >= 0) {
  console.log(`Position found at index ${positionIndex}`);
  const afterText = testText.substring(positionIndex + position.length);
  console.log(`Text after position: "${afterText}"`);
  
  // Check for "לשעבר" after the position
  const containsFormer = afterText.includes('לשעבר');
  console.log(`Contains 'לשעבר'? ${containsFormer ? 'Yes' : 'No'}`);
  
  // More detailed regex checks
  const startsWithFormer = afterText.trim().startsWith('לשעבר');
  console.log(`Starts with 'לשעבר' after trimming? ${startsWithFormer ? 'Yes' : 'No'}`);
  
  const hasPunctuationThenFormer = afterText.match(/^[ \t,.;:]+לשעבר/);
  console.log(`Has punctuation then 'לשעבר'? ${hasPunctuationThenFormer ? 'Yes' : 'No'}`);
  
  // Full check
  const isFormerPosition = startsWithFormer || hasPunctuationThenFormer;
  console.log(`\nFinal result - Is former position? ${isFormerPosition ? 'Yes' : 'No'}`);
  
  if (isFormerPosition) {
    console.log('Our solution will correctly skip detecting Netanyahu');
  } else {
    console.log('Our solution would incorrectly detect Netanyahu');
  }
} else {
  console.log(`Position "${position}" not found in text`);
} 