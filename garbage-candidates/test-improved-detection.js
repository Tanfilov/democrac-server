// Test script for improved politician detection

// Import the politician detection module
const detection = require('../server/src/politicians/detection');
const fs = require('fs');
const path = require('path');

// Sample article that previously had detection issues
const article = {
  "id": "test-article",
  "title": "\"החלטת קבינט אחת\": פגישת לפיד ונתניהו חושפת את הקלפים במשא ומתן לשחרור החטופים",
  "description": "לאחר חודשיים ללא הידברות, יאיר לפיד ובנימין נתניהו נפגשו לעדכון בטחוני על רקע המשא ומתן להשבת החטופים, שנותר ללא פריצת דרך. בתום הפגישה, לפיד פרסם ...",
  "content": "\r\n        <img height='80' width='100' align='right' src='https://images.maariv.co.il/image/upload/f_auto,fl_lossy/c_fill,g_faces:center,h_460,w_690/479504' /><br/>לאחר חודשיים ללא הידברות, יאיר לפיד ובנימין נתניהו נפגשו לעדכון בטחוני על רקע המשא ומתן להשבת החטופים, שנותר ללא פריצת דרך. בתום הפגישה, לפיד פרסם סרטון מכיכר החטופים בו הוא מצהיר: \"אפשר לעשות עסקה\"<br/>\r\n    ",
};

// Additional test case for position-based detection
const positionArticle = {
  "id": "position-test",
  "title": "ראש הממשלה ביבי מגיב להתפתחויות האחרונות בגבול הצפון",
  "description": "ראש הממשלה התייחס להתפתחויות בצפון ואמר כי ישראל מוכנה להגיב בעוצמה",
  "content": "בהצהרה מיוחדת לתקשורת, אמר היום ראש הממשלה כי \"ישראל לא תשתוק אל מול הפרות הריבונות\". בתגובה להתקפות האחרונות, נתניהו הבהיר כי צה\"ל פועל בנחישות. \"לא נהסס להפעיל את כל עוצמתנו אם יהיה צורך\", אמר."
};

// Load the politicians data
try {
  console.log('Loading politicians data...');
  const politiciansFilePath = path.resolve(__dirname, '../data/politicians/politicians.json');
  console.log(`Reading from: ${politiciansFilePath}`);
  const politiciansData = fs.readFileSync(politiciansFilePath, 'utf8');
  const POLITICIANS = JSON.parse(politiciansData);
  console.log(`Loaded ${POLITICIANS.length} politicians`);

  // Test cases
  console.log('\n==== Test Case 1: Direct Name Detection ====');
  console.log('Testing article with both Netanyahu and Lapid in title and content...');
  const titleDetection = detection.findPoliticianMentions(article.title, POLITICIANS);
  const descriptionDetection = detection.findPoliticianMentions(article.description, POLITICIANS);
  const contentDetection = detection.findPoliticianMentions(article.content, POLITICIANS);

  console.log(`Title detection: ${titleDetection.join(', ')}`);
  console.log(`Description detection: ${descriptionDetection.join(', ')}`);
  console.log(`Content detection: ${contentDetection.join(', ')}`);

  console.log('\n==== Test Case 2: Position-Based Detection ====');
  console.log('Testing article with PM position and nickname reference...');
  const positionTitleDetection = detection.findPoliticianMentions(positionArticle.title, POLITICIANS);
  const positionDescriptionDetection = detection.findPoliticianMentions(positionArticle.description, POLITICIANS);
  const positionContentDetection = detection.findPoliticianMentions(positionArticle.content, POLITICIANS);

  console.log(`Title detection: ${positionTitleDetection.join(', ')}`);
  console.log(`Description detection: ${positionDescriptionDetection.join(', ')}`);
  console.log(`Content detection: ${positionContentDetection.join(', ')}`);

  console.log('\n==== Test Case 3: Full Enhanced Detection with Scoring ====');
  console.log('Testing enhanced detection with relevance scoring...');

  async function testEnhancedDetection() {
    const enhancedDetection1 = await detection.enhancedPoliticianDetection(article, POLITICIANS);
    console.log(`Enhanced detection for article 1: ${enhancedDetection1.join(', ')}`);

    const enhancedDetection2 = await detection.enhancedPoliticianDetection(positionArticle, POLITICIANS);
    console.log(`Enhanced detection for article 2: ${enhancedDetection2.join(', ')}`);
  }

  testEnhancedDetection();

} catch (error) {
  console.error('Error running tests:', error);
} 