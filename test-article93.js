// Test script for article #93
const fs = require('fs');
const path = require('path');

// Import the new politician detection service
const { loadPoliticians, findPoliticianMentions, enhancedPoliticianDetection } = require('./server/src/politician-detection/politicianDetectionService');

// Article #93 content from production
const article = {
  id: 93,
  title: '"החלטת קבינט אחת": פגישת לפיד ונתניהו חושפת את הקלפים במשא ומתן לשחרור החטופים',
  description: 'לאחר חודשיים ללא הידברות, יאיר לפיד ובנימין נתניהו נפגשו לעדכון בטחוני על רקע המשא ומתן להשבת החטופים, שנותר ללא פריצת דרך. בתום הפגישה, לפיד פרסם ...',
  content: '\r\n\t\t\t\t<img height=\'80\' width=\'100\' align=\'right\' src=\'https://images.maariv.co.il/image/upload/f_auto,fl_lossy/c_fill,g_faces:center,h_460,w_690/479504\' /><br/>לאחר חודשיים ללא הידברות, יאיר לפיד ובנימין נתניהו נפגשו לעדכון בטחוני על רקע המשא ומתן להשבת החטופים, שנותר ללא פריצת דרך. בתום הפגישה, לפיד פרסם סרטון מכיכר החטופים בו הוא מצהיר: "אפשר לעשות עסקה"<br/>\r\n\t\t\t'
};

// Load politicians
const politiciansPath = path.join(__dirname, 'data/politicians/politicians.json');
const POLITICIANS = loadPoliticians(politiciansPath);

console.log('-------- TESTING DETECTION FOR ARTICLE #93 --------');
console.log(`Article title: ${article.title}`);
console.log(`Article contains 'נתניהו': ${article.title.includes('נתניהו') ? 'YES' : 'NO'}`);
console.log(`Article description contains 'נתניהו': ${article.description.includes('נתניהו') ? 'YES' : 'NO'}`);
console.log(`Article description contains 'בנימין': ${article.description.includes('בנימין') ? 'YES' : 'NO'}`);

// Test politician-detection module
console.log('\n--- Testing findPoliticianMentions ---');
const titlePoliticians = findPoliticianMentions(article.title, POLITICIANS);
console.log('Politicians detected in title:', titlePoliticians);

const descriptionPoliticians = findPoliticianMentions(article.description, POLITICIANS);
console.log('Politicians detected in description:', descriptionPoliticians);

// Mock functions for enhancedPoliticianDetection
const mockScrapeArticleContent = async (url) => {
  console.log(`Mock scrape called for: ${url} - returning existing content for test.`);
  // In a real scenario, you might fetch or use the article's existing full content if available.
  // For this test, we assume the provided article.content is what would be scraped or already exists.
  return article.content || article.description || article.title; 
};
const mockUpdateArticleContentInDb = async (articleId, dbContent) => {
  console.log(`Mock DB update called for article ID ${articleId}. Content length: ${dbContent ? dbContent.length : 0}`);
  // In a real scenario, this would update the database.
  return Promise.resolve();
};

// Test the enhanced detection
console.log('\n--- Testing enhancedPoliticianDetection ---');
(async () => {
  try {
    const detectedPoliticians = await enhancedPoliticianDetection(article, POLITICIANS, mockScrapeArticleContent, mockUpdateArticleContentInDb);
    console.log('Enhanced detection result:', detectedPoliticians);
  } catch (error) {
    console.error('Error in enhanced detection:', error);
  }
})();

// Look for Netanyahu specifically
const netanyahuEntry = POLITICIANS.find(p => p.name && p.name.includes('נתניהו'));
console.log('\n--- Netanyahu Entry in politicians.json ---');
console.log(netanyahuEntry);

// Check detection with direct string search
console.log('\n--- Manual Detection Checks ---');
if (netanyahuEntry) {
  console.log(`Direct match for Netanyahu name in title: ${article.title.includes(netanyahuEntry.name) ? 'YES' : 'NO'}`);
  console.log(`Direct match for Netanyahu name in description: ${article.description.includes(netanyahuEntry.name) ? 'YES' : 'NO'}`);
  
  if (netanyahuEntry.aliases) {
    for (const alias of netanyahuEntry.aliases) {
      console.log(`Checking alias "${alias}" in title: ${article.title.includes(alias) ? 'YES' : 'NO'}`);
      console.log(`Checking alias "${alias}" in description: ${article.description.includes(alias) ? 'YES' : 'NO'}`);
    }
  }
}

// Detailed character-by-character testing
console.log('\n--- Character by Character Analysis ---');
const searchFor = 'נתניהו';
console.log(`Searching for each character in "${searchFor}":`);
for (let i = 0; i < searchFor.length; i++) {
  console.log(`Character ${i+1}: "${searchFor[i]}" - Title contains: ${article.title.includes(searchFor[i]) ? 'YES' : 'NO'}`);
}

// Detailed boundary testing for Netanyahu
console.log('\n--- Boundary Testing for Netanyahu ---');
// Check if Netanyahu is at word boundaries
if (article.title.includes('נתניהו')) {
  const index = article.title.indexOf('נתניהו');
  const before = index > 0 ? article.title[index-1] : 'START';
  const after = index + 'נתניהו'.length < article.title.length ? article.title[index + 'נתניהו'.length] : 'END';
  console.log(`Before "נתניהו": "${before}", After: "${after}"`);
} 