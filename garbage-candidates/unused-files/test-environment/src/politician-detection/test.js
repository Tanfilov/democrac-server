// Simple test for politician detection module
const fs = require('fs');
const path = require('path');
const politicians = require('./index');

async function runTests() {
  try {
    console.log('Running politician detection tests...');
    
    // Load politicians data
    const politiciansPath = path.join(__dirname, '../../../data/politicians/politicians.json');
    
    // Check if the file exists
    if (!fs.existsSync(politiciansPath)) {
      console.error(`Error: Politicians file not found at ${politiciansPath}`);
      return;
    }
    
    console.log(`Loading politicians from: ${politiciansPath}`);
    const POLITICIANS = politicians.loadPoliticians(politiciansPath);
    
    console.log(`Loaded ${POLITICIANS.length} politicians for testing`);
    
    if (POLITICIANS.length === 0) {
      console.error('Error: No politicians loaded. Check the file format.');
      return;
    }
    
    // Test texts containing references to various politicians
    const testTexts = [
      "ראש הממשלה בנימין נתניהו הודיע היום על תוכנית חדשה",
      "יאיר לפיד, ראש האופוזיציה, מתנגד לתוכנית החדשה",
      "שר האוצר בצלאל סמוטריץ' אמר כי התוכנית הכלכלית תיושם בקרוב",
      "השר לביטחון לאומי מגיב לאירועי הביטחון האחרונים"
    ];
    
    // Basic detection test
    console.log('\n=== Basic Detection Tests ===');
    testTexts.forEach((text, index) => {
      console.log(`\nTest ${index + 1}: "${text}"`);
      try {
        const detectedPoliticians = politicians.findPoliticianMentions(text, POLITICIANS);
        console.log('Detected:', detectedPoliticians);
      } catch (error) {
        console.error(`Error in test ${index + 1}:`, error);
      }
    });
    
    // Enhanced detection test with mock article
    console.log('\n=== Enhanced Detection Test ===');
    const mockArticle = {
      id: 'test-1',
      title: 'ראש הממשלה נתניהו מתכנן פגישה עם ג\'ו ביידן',
      description: 'במסיבת עיתונאים הודיע ראש הממשלה על פגישה מתוכננת עם נשיא ארה"ב ביידן',
      content: 'ראש הממשלה בנימין נתניהו מתכנן לצאת בשבוע הבא לוושינגטון לפגישה עם הנשיא ג\'ו ביידן. יאיר לפיד, ראש האופוזיציה, מתח ביקורת על המהלך.',
      link: 'https://example.com/article1'
    };
    
    // Mock functions for content scraping and update
    const mockScrapeContent = async () => {
      return 'תוכן נוסף שמזכיר את שר הביטחון יואב גלנט וגם את שר האוצר בצלאל סמוטריץ\'.';
    };
    
    const mockUpdateContent = async (id, content) => {
      console.log(`Mock update content for article ${id}: ${content.substring(0, 30)}...`);
      return true;
    };
    
    try {
      const enhancedDetection = await politicians.enhancedPoliticianDetection(
        mockArticle, 
        POLITICIANS,
        mockScrapeContent,
        mockUpdateContent
      );
      
      console.log('\nEnhanced detection results:', enhancedDetection);
    } catch (error) {
      console.error('Error in enhanced detection test:', error);
    }
    
    console.log('\nAll tests completed successfully!');
  } catch (error) {
    console.error('Unexpected error in tests:', error);
  }
}

// Run the tests
runTests(); 