/**
 * Test script for politician detection using sample politicians
 */

const fs = require('fs');
const path = require('path');

// Load the sample politicians with correct encoding
const samplePoliticiansPath = path.join(__dirname, 'sample-politicians.json');
let POLITICIANS_LIST = [];

try {
  const data = fs.readFileSync(samplePoliticiansPath, 'utf8');
  POLITICIANS_LIST = JSON.parse(data);
  console.log(`Loaded ${POLITICIANS_LIST.length} sample politicians with correct encoding`);
} catch (error) {
  console.error('Error loading sample politicians:', error.message);
  process.exit(1);
}

// Print the politicians for verification
console.log("\nVerify politicians display correctly:");
POLITICIANS_LIST.forEach((p, index) => {
  console.log(`${index+1}. ${p.name} (${p.aliases ? p.aliases.join(', ') : 'no aliases'})`);
});

// Format for detection
const POLITICIANS = POLITICIANS_LIST.map(p => {
  return { 
    he: p.name, 
    en: p.name, 
    aliases: p.aliases || [] 
  };
});

// Helper function to escape regular expression special characters
const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Find politician mentions in text
const findPoliticianMentions = (text) => {
  if (!text) return [];
  
  console.log(`\nSearching in text: "${text}"`);
  
  return POLITICIANS.filter(politician => {
    // Check main name with word boundary
    const namePattern = new RegExp(`\\b${escapeRegExp(politician.he)}\\b`, 'u');
    
    // For partial name matching (e.g., just "נתניהו" instead of "בנימין נתניהו")
    const nameParts = politician.he.split(' ');
    const lastNamePattern = nameParts.length > 1 ? 
      new RegExp(`\\b${escapeRegExp(nameParts[nameParts.length - 1])}\\b`, 'u') : null;
    
    const nameMatch = namePattern.test(text);
    const lastNameMatch = lastNamePattern ? lastNamePattern.test(text) : false;
    
    if (nameMatch) {
      console.log(`FULL NAME MATCH: "${politician.he}" found in text`);
      return true;
    }
    
    if (lastNameMatch) {
      console.log(`LAST NAME MATCH: "${nameParts[nameParts.length - 1]}" from "${politician.he}" found in text`);
      return true;
    }
    
    // Check aliases
    if (politician.aliases && politician.aliases.length > 0) {
      for (const alias of politician.aliases) {
        const aliasPattern = new RegExp(`\\b${escapeRegExp(alias)}\\b`, 'u');
        if (aliasPattern.test(text)) {
          console.log(`ALIAS MATCH: "${alias}" (alias of "${politician.he}") found in text`);
          return true;
        }
      }
    }
    
    return false;
  }).map(p => p.he);
};

// Test articles
const testArticles = [
  {
    title: "ראש הממשלה בנימין נתניהו הודיע היום על תוכנית חדשה",
    description: "במסיבת עיתונאים שנערכה היום בירושלים הודיע ראש הממשלה נתניהו על תוכנית כלכלית חדשה",
  },
  {
    title: "יאיר לפיד תוקף את מדיניות הממשלה",
    description: "במסגרת נאום באופוזיציה, מנהיג יש עתיד יאיר לפיד תקף את מדיניות הממשלה בנושא הכלכלי",
  },
  {
    title: "שר הביטחון יואב גלנט מבקר בגבול הצפון",
    description: "השר גלנט הגיע לביקור פיקוד צפון, שם נפגש עם מפקדים בכירים ודן במצב הביטחוני",
  },
  {
    title: "סמוטריץ' מציג תקציב חדש",
    description: "שר האוצר בצלאל סמוטריץ' הציג היום את התקציב החדש לשנה הקרובה",
  },
  {
    title: "ישראל כץ מדבר על היחסים עם ארה\"ב",
    description: "שר החוץ ישראל כץ דיבר היום על היחסים המדיניים עם ארצות הברית",
  }
];

// Test each article
console.log("\n==== TESTING POLITICIAN DETECTION ====\n");

testArticles.forEach((article, index) => {
  console.log(`\n=== Article ${index + 1} ===`);
  console.log(`Title: ${article.title}`);
  console.log(`Description: ${article.description}`);
  
  // Test detection in title
  const titlePoliticians = findPoliticianMentions(article.title);
  console.log(`Politicians in title: ${titlePoliticians.length > 0 ? titlePoliticians.join(", ") : "None"}`);
  
  // Test detection in description
  const descriptionPoliticians = findPoliticianMentions(article.description);
  console.log(`Politicians in description: ${descriptionPoliticians.length > 0 ? descriptionPoliticians.join(", ") : "None"}`);
  
  // Combined unique results
  const allPoliticians = [...new Set([...titlePoliticians, ...descriptionPoliticians])];
  console.log(`All detected politicians: ${allPoliticians.length > 0 ? allPoliticians.join(", ") : "None"}`);
}); 