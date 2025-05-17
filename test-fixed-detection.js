// Test script to verify the fixed detection algorithm

// Import the politician detection module
const detection = require('./server/src/politicians/detection');
const fs = require('fs');

// The article data
const article = {
  "id": 90,
  "title": "\"החלטת קבינט אחת\": פגישת לפיד ונתניהו חושפת את הקלפים במשא ומתן לשחרור החטופים",
  "description": "לאחר חודשיים ללא הידברות, יאיר לפיד ובנימין נתניהו נפגשו לעדכון בטחוני על רקע המשא ומתן להשבת החטופים, שנותר ללא פריצת דרך. בתום הפגישה, לפיד פרסם ...",
  "content": "\r\n        <img height='80' width='100' align='right' src='https://images.maariv.co.il/image/upload/f_auto,fl_lossy/c_fill,g_faces:center,h_460,w_690/479504' /><br/>לאחר חודשיים ללא הידברות, יאיר לפיד ובנימין נתניהו נפגשו לעדכון בטחוני על רקע המשא ומתן להשבת החטופים, שנותר ללא פריצת דרך. בתום הפגישה, לפיד פרסם סרטון מכיכר החטופים בו הוא מצהיר: \"אפשר לעשות עסקה\"<br/>\r\n    ",
};

// Load the politicians data
const politiciansData = fs.readFileSync('./data/politicians/politicians.json', 'utf8');
const POLITICIANS = JSON.parse(politiciansData);

// Make sure we don't have any 'he' property in the data (to test the fix)
POLITICIANS.forEach(p => {
  delete p.he;
});

console.log('=== Testing Fixed Politician Detection Algorithm ===');
console.log('(Using data without "he" property, only using "name" property)\n');

// Test the detection mechanism on article parts
console.log('Detection results by article part:');
const titleDetection = detection.findPoliticianMentions(article.title, POLITICIANS);
const descriptionDetection = detection.findPoliticianMentions(article.description, POLITICIANS);
const contentDetection = detection.findPoliticianMentions(article.content, POLITICIANS);

console.log(`Title detection: ${titleDetection.join(', ')}`);
console.log(`Description detection: ${descriptionDetection.join(', ')}`);
console.log(`Content detection: ${contentDetection.join(', ')}`);

// Enhanced detection simulation
console.log('\nSimulating enhanced detection:');
async function simulateEnhancedDetection() {
  const detectedPoliticians = await detection.enhancedPoliticianDetection(article, POLITICIANS);
  console.log('Enhanced detection results:', detectedPoliticians);
}

simulateEnhancedDetection(); 