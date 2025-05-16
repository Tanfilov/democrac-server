/**
 * Test script for the integrated politician detection and relevance scoring
 * 
 * This script validates that the improved detection system works correctly
 * with the production environment without affecting it.
 */

const path = require('path');
const fs = require('fs');
const politicianDetection = require('./src/politician-detection');

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

const politicians = politicianDetection.loadPoliticians(politiciansPath);
console.log(`Loaded ${politicians.length} politicians for testing\n`);

// Test basic detection
console.log('===== Testing Basic Detection =====');
for (let i = 0; i < testTexts.length; i++) {
  const { title, description, content } = testTexts[i];
  const fullText = `${title} ${description} ${content}`;
  
  console.log(`\nTest Case ${i + 1}:`);
  console.log(`Title: "${title}"`);
  console.log(`Description: "${description}"`);
  console.log(`Content: "${content}"`);
  
  const detectedPoliticians = politicianDetection.findPoliticianMentions(fullText, politicians);
  console.log(`\nDetected Politicians: ${detectedPoliticians.length > 0 ? detectedPoliticians.join(', ') : 'None'}`);
}

// Test relevance scoring
console.log('\n\n===== Testing Relevance Scoring =====');
for (let i = 0; i < testTexts.length; i++) {
  const testArticle = testTexts[i];
  const fullText = `${testArticle.title} ${testArticle.description} ${testArticle.content}`;
  
  console.log(`\nTest Case ${i + 1}:`);
  
  // Detect politicians first
  const detectedPoliticians = politicianDetection.findPoliticianMentions(fullText, politicians);
  if (detectedPoliticians.length === 0) {
    console.log('No politicians detected, skipping relevance scoring.');
    continue;
  }
  
  // Score the detected politicians
  const scoredPoliticians = politicianDetection.scorePoliticianRelevance(
    testArticle, 
    detectedPoliticians
  );
  
  // Get the most relevant politicians
  const relevantPoliticians = politicianDetection.getRelevantPoliticians(scoredPoliticians, {
    maxCount: 3
  });
  
  console.log('Detected Politicians:');
  detectedPoliticians.forEach(p => console.log(`- ${p}`));
  
  console.log('\nRelevant Politicians:');
  relevantPoliticians.forEach(p => {
    console.log(`- ${p.name} (score: ${p.score}, relevant: ${p.isRelevant})`);
    console.log(`  Reasons: ${p.reasons.join(', ')}`);
  });
}

console.log('\n===== Integration Test Complete =====');
console.log('If you see politician detections and relevance scores, the integration is working correctly!'); 