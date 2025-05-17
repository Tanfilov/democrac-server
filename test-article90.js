// Test script for article #90
const fs = require('fs');
const path = require('path');

// Import the new politician detection service
const { loadPoliticians, findPoliticianMentions } = require('./server/src/politician-detection/politicianDetectionService');

// Article #90 content from production
const article = {
  id: 90,
  title: '"החלטת קבינט אחת": פגישת לפיד ונתניהו חושפת את הקלפים במשא ומתן לשחרור החטופים',
  description: 'לאחר חודשיים ללא הידברות, יאיר לפיד ובנימין נתניהו נפגשו לעדכון בטחוני על רקע המשא ומתן להשבת החטופים, שנותר ללא פריצת דרך. בתום הפגישה, לפיד פרסם ...',
  content: '\r\n        \u003cimg height=\u002780\u0027 width=\u0027100\u0027 align=\u0027right\u0027 src=\u0027https://images.maariv.co.il/image/upload/f_auto,fl_lossy/c_fill,g_faces:center,h_460,w_690/479504\u0027 /\u003e\u003cbr/\u003eלאחר חודשיים ללא הידברות, יאיר לפיד ובנימין נתניהו נפגשו לעדכון בטחוני על רקע המשא ומתן להשבת החטופים, שנותר ללא פריצת דרך. בתום הפגישה, לפיד פרסם סרטון מכיכר החטופים בו הוא מצהיר: \\"אפשר לעשות עסקה\\"\u003cbr/\u003e\r\n    '
};

// Load politicians
const politiciansPath = path.join(__dirname, 'data/politicians/politicians.json');
const POLITICIANS = loadPoliticians(politiciansPath);

console.log('-------- TESTING DETECTION FOR ARTICLE #90 --------');
console.log(`Article title: ${article.title}`);
console.log(`Article contains 'נתניהו': ${article.title.includes('נתניהו')}`);
console.log(`Article contains 'בנימין': ${article.content.includes('בנימין')}`);

// Test the detection module
console.log('\n--- Testing findPoliticianMentions ---');
const detectedPoliticians = findPoliticianMentions(article.title, POLITICIANS);
console.log('Politicians detected in title:', detectedPoliticians);

// Look for Netanyahu specifically
const netanyahuEntry = POLITICIANS.find(p => p.name && p.name.includes('נתניהו'));
console.log('\n--- Netanyahu Entry in politicians.json ---');
console.log(netanyahuEntry);

// Check detection with direct string search
console.log('\n--- Manual Detection Checks ---');
if (netanyahuEntry) {
  console.log(`Direct match for Netanyahu name: ${article.title.includes(netanyahuEntry.name)}`);
  if (netanyahuEntry.aliases) {
    for (const alias of netanyahuEntry.aliases) {
      console.log(`Checking alias "${alias}": ${article.title.includes(alias)}`);
    }
  }
} 