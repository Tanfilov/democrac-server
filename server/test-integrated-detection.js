/**
 * Test script for the integrated politician detection and relevance scoring
 * 
 * This script validates that the improved detection system works correctly
 * with the production environment without affecting it.
 */

const path = require('path');
const fs = require('fs');
const { loadPoliticians, findPoliticianMentions, enhancedPoliticianDetection } = require('./src/politician-detection/politicianDetectionService');

// Sample text for testing
const testTexts = [
  {
    title: "ראש הממשלה בנימין נתניהו נפגש עם שר החוץ",
    description: "בפגישה דנו בנושאים מדיניים",
    content: "יאיר לפיד ביקר את התנהלות רה״מ נתניהו ואת שר האוצר סמוטריץ׳"
  },
  {
    title: "ביבי אמר בישיבת הממשלה אתמול",
    description: "ראש הממשלה התייחס למצב הבטחוני",
    content: "בעקבות שיחות בין ראש הממשלה לשר הביטחון, הוחלט להגביר את פעילות צה״ל ברצועת עזה. הנשיא ברך על ההחלטה."
  }
];

// Load politicians
const politiciansPath = path.join(__dirname, 'data/politicians/politicians.json');
console.log(`Loading politicians from: ${politiciansPath}`);

if (!fs.existsSync(politiciansPath)) {
  console.error('Error: Politicians file not found!');
  console.log('Please ensure the politicians.json file exists in the data/politicians directory.');
  process.exit(1);
}

const politicians = loadPoliticians(politiciansPath);
console.log(`Loaded ${politicians.length} politicians for testing\n`);

// Test basic detection (using findPoliticianMentions for simplicity here)
console.log('===== Testing Basic Detection (findPoliticianMentions) =====');
for (let i = 0; i < testTexts.length; i++) {
  const { title, description, content } = testTexts[i];
  const fullText = `${title} ${description} ${content}`;
  
  console.log(`\nTest Case ${i + 1}:`);
  console.log(`Title: "${title}"`);
  console.log(`Description: "${description}"`);
  console.log(`Content: "${content}"`);
  
  const detectedPoliticians = findPoliticianMentions(fullText, politicians);
  console.log(`\nDetected Politicians: ${detectedPoliticians.length > 0 ? detectedPoliticians.join(', ') : 'None'}`);
}

// Mock functions for enhancedPoliticianDetection
const mockScrapeArticleContent = async (article) => {
  console.log(`Mock scrape called for article: ${article.title} - returning existing content for test.`);
  // For this test, we assume the provided article.content is what would be scraped or already exists.
  return article.content || article.description || article.title; 
};
const mockUpdateArticleContentInDb = async (articleId, dbContent) => {
  console.log(`Mock DB update called for article ID ${articleId}. Content length: ${dbContent ? dbContent.length : 0}`);
  return Promise.resolve();
};

// Test enhanced detection (which includes relevance scoring internally)
console.log('\n\n===== Testing Enhanced Detection (enhancedPoliticianDetection) =====');
(async () => {
  for (let i = 0; i < testTexts.length; i++) {
    const testArticle = {
        id: `test_${i+1}`,
        ...testTexts[i]
    };
    
    console.log(`\nTest Case ${i + 1}: "${testArticle.title}"`);
    
    const relevantPoliticians = await enhancedPoliticianDetection(
      testArticle, 
      politicians,
      mockScrapeArticleContent, // Pass the mock scrape function
      mockUpdateArticleContentInDb // Pass the mock DB update function
    );
    
    console.log('Relevant Politicians (from enhancedPoliticianDetection):');
    if (relevantPoliticians && relevantPoliticians.length > 0) {
      relevantPoliticians.forEach(pName => console.log(`- ${pName}`));
    } else {
      console.log('None');
    }
  }
  
  console.log('\n===== Integration Test Complete =====');
  console.log('If you see politician detections, the integration is working correctly!');
})(); 