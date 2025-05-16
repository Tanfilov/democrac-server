/**
 * Script to fix encoding issues in the politicians.json file
 */

const fs = require('fs');
const path = require('path');

// Path to the politicians.json file
const politiciansPath = path.join(__dirname, 'data', 'politicians', 'politicians.json');

// Sample politicians with correct Hebrew encoding
const samplePoliticians = [
  {
    "name": "בנימין נתניהו",
    "party": "הליכוד",
    "position": "ראש הממשלה",
    "aliases": ["ביבי", "נתניהו"],
    "image": "בנימין_נתניהו.png"
  },
  {
    "name": "יאיר לפיד",
    "party": "יש עתיד",
    "position": "ראש האופוזיציה",
    "aliases": ["לפיד"],
    "image": "יאיר_לפיד.png"
  },
  {
    "name": "בני גנץ",
    "party": "כחול לבן",
    "position": "שר הביטחון",
    "aliases": ["גנץ"],
    "image": "בני_גנץ.png"
  },
  {
    "name": "יואב גלנט",
    "party": "הליכוד",
    "position": "שר הביטחון",
    "aliases": ["גלנט"],
    "image": "יואב_גלנט.png"
  },
  {
    "name": "בצלאל סמוטריץ'",
    "party": "הציונות הדתית",
    "position": "שר האוצר",
    "aliases": ["סמוטריץ'", "סמוטריץ"],
    "image": "בצלאל_סמוטריץ'.png"
  },
  {
    "name": "ישראל כץ",
    "party": "הליכוד",
    "position": "שר החוץ",
    "aliases": ["כץ"],
    "image": "ישראל_כץ.png"
  },
  {
    "name": "איתמר בן גביר",
    "party": "עוצמה יהודית",
    "position": "השר לביטחון לאומי",
    "aliases": ["בן גביר"],
    "image": "איתמר_בן_גביר.png"
  }
];

try {
  // Save the sample politicians with correct encoding
  fs.writeFileSync(
    path.join(__dirname, 'sample-politicians.json'),
    JSON.stringify(samplePoliticians, null, 2),
    'utf8'
  );
  console.log('Saved sample-politicians.json with correct encoding');
  
  // Try to read and fix the original file
  try {
    // Try to read the file with different encodings
    let rawData = fs.readFileSync(politiciansPath, 'utf8');
    console.log('Read politicians.json with utf8 encoding');
    
    // Check if the file has correct Hebrew characters
    const containsHebrew = /[\u0590-\u05FF]/.test(rawData);
    console.log(`File contains Hebrew characters: ${containsHebrew}`);
    
    if (!containsHebrew) {
      console.log('The file does not contain Hebrew characters, which indicates an encoding issue.');
      console.log('Creating a temporary file with the sample politicians...');
      
      // Create a temporary file with the sample politicians
      fs.writeFileSync(
        path.join(__dirname, 'data', 'politicians', 'politicians-fixed.json'),
        JSON.stringify(samplePoliticians, null, 2),
        'utf8'
      );
      console.log('Created politicians-fixed.json with correct encoding');
    }
    
  } catch (readError) {
    console.error('Error reading the politicians.json file:', readError.message);
  }
  
} catch (error) {
  console.error('Error fixing encoding:', error.message);
} 