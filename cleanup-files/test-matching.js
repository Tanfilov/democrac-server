/**
 * Simple politician name matching test
 */

const fs = require('fs');
const path = require('path');

// Load politicians from JSON file
const POLITICIANS_DATA = fs.readFileSync(path.join(__dirname, 'data/politicians/politicians.json'), 'utf8');
const POLITICIANS_LIST = JSON.parse(POLITICIANS_DATA);

console.log(`Loaded ${POLITICIANS_LIST.length} politicians for testing`);

// Print a few samples
console.log("\nSample politicians:");
POLITICIANS_LIST.slice(0, 5).forEach(p => {
  console.log(`- ${p.name} (${p.aliases ? p.aliases.join(', ') : 'no aliases'})`);
});

// Test article texts with exact politician names
const testTexts = [
  "ראש הממשלה בנימין נתניהו הודיע היום על תוכנית חדשה",
  "יאיר לפיד תוקף את מדיניות הממשלה",
  "שר הביטחון יואב גלנט מבקר בגבול הצפון",
  "סמוטריץ' מציג תקציב חדש",
  "ישראל כץ דיבר היום על היחסים המדיניים עם ארצות הברית"
];

// Simple matching algorithm - check if politician name appears in text
function findSimplePoliticianMentions(text) {
  return POLITICIANS_LIST.filter(politician => {
    // Check main name (direct substring match)
    if (text.includes(politician.name)) {
      console.log(`MATCH FOUND: "${politician.name}" in text "${text}"`);
      return true;
    }
    
    // Check aliases if available
    if (politician.aliases && Array.isArray(politician.aliases)) {
      for (const alias of politician.aliases) {
        if (text.includes(alias)) {
          console.log(`ALIAS MATCH FOUND: "${alias}" for politician "${politician.name}" in text "${text}"`);
          return true;
        }
      }
    }
    
    return false;
  }).map(p => p.name);
}

// Test each text
console.log("\n==== TESTING SIMPLE POLITICIAN DETECTION ====\n");
testTexts.forEach((text, index) => {
  console.log(`\nTest ${index + 1}: "${text}"`);
  
  const detectedPoliticians = findSimplePoliticianMentions(text);
  console.log(`Detected politicians: ${detectedPoliticians.length > 0 ? detectedPoliticians.join(", ") : "None"}`);
});

// Test direct matching with the first few politicians
console.log("\n==== TESTING DIRECT POLITICIAN NAME INSERTION ====\n");

POLITICIANS_LIST.slice(0, 5).forEach((politician, index) => {
  const text = `היום התקיימה פגישה עם ${politician.name} בכנסת`;
  console.log(`\nTest ${index + 1}: "${text}"`);
  
  const detectedPoliticians = findSimplePoliticianMentions(text);
  console.log(`Detected politicians: ${detectedPoliticians.length > 0 ? detectedPoliticians.join(", ") : "None"}`);
}); 