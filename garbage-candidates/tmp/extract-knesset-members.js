const fs = require('fs');
const path = require('path');

// Function to extract politicians from the HTML data
function extractPoliticians() {
  // All parties with their politicians from the Knesset website
  const partiesAndPoliticians = [
    {
      party: "הליכוד",
      politicians: [
        "אבי דיכטר",
        "אביחי אברהם בוארון",
        "אופיר כץ",
        "אושר שקלים",
        "אלי דלל",
        "אליהו רביבו",
        "אמיר אוחנה",
        "אריאל קלנר",
        "בועז ביסמוט",
        "בנימין נתניהו",
        "גילה גמליאל",
        "גלית דיסטל אטבריאן",
        "דוד ביטן",
        "דן אליהו יעקב אילוז",
        "חוה אתי עטיה",
        "חנוך דב מלביצקי",
        "טלי גוטליב",
        "יולי (יואל) אדלשטיין",
        "יריב לוין",
        "ישראל כ\"ץ",
        "מאי גולן",
        "משה סעדה",
        "משה פסל",
        "ניסים ואטורי",
        "ניר ברקת",
        "עמית הלוי",
        "עפיף עבד",
        "צגה צגנש מלקו",
        "קטי קטרין שטרית",
        "שלום דנינו",
        "שלמה קרעי",
        "ששון ששי גואטה"
      ]
    },
    {
      party: "יש עתיד",
      politicians: [
        "אלעזר שטרן",
        "בועז טופורובסקי",
        "דבורה דבי ביטון",
        "ולדימיר בליאק",
        "טטיאנה מזרסקי",
        "יאיר לפיד",
        "יואב סגלוביץ'",
        "יוראי להב הרצנו",
        "יסמין סאקס פרידמן",
        "ירון לוי",
        "מאיר כהן",
        "מטי צרפתי הרכבי",
        "מיקי לוי",
        "מירב בן-ארי",
        "מירב כהן",
        "משה טור פז",
        "נאור שירי",
        "סימון דוידסון",
        "קארין אלהרר",
        "רון כץ",
        "רם בן ברק",
        "שיר מיכל סגמן",
        "שלי טל מירון"
      ]
    },
    {
      party: "הציונות הדתית",
      politicians: [
        "אוהד טל",
        "אופיר סופר",
        "אורית סטרוק",
        "איילת שקד",
        "דניאלה דניאל וייס",
        "זיו מאור",
        "חיה גולדברג",
        "יצחק וסרלאוף",
        "מיכל וולדיגר",
        "משה סולומון",
        "סימחה רוטמן",
        "עמיחי אליהו",
        "צבי סוכות",
        "רויטל פולקמן"
      ]
    },
    {
      party: "המחנה הממלכתי",
      politicians: [
        "אלון שוסטר",
        "בנימין (בני) גנץ",
        "גדי אייזנקוט",
        "חילי טרופר",
        "מיכאל בירן",
        "פנינה תמנו",
        "רם בן ברק",
        "שרן השכל",
        "יאיר גולן",
        "אורן לוטם",
        "ירון יוס"
      ]
    },
    {
      party: "הימין הממלכתי",
      politicians: [
        "אייל רביב",
        "אריה דרמר",
        "בנט נפתלי",
        "גדעון סער",
        "זאב אלקין",
        "עידית סילמן",
        "רון קובי"
      ]
    },
    {
      party: "ש\"ס",
      politicians: [
        "אוריאל בוסו",
        "ארז מלול",
        "אריה מכלוף דרעי",
        "יונתן מישריקי",
        "יוסף טייב",
        "ינון אזולאי",
        "מיכאל מלכיאלי",
        "משה אבוטבול",
        "משה ארבל",
        "סימון מושיאשוילי"
      ]
    },
    {
      party: "יהדות התורה",
      politicians: [
        "אליהו ברוכי",
        "יעקב אשר",
        "יעקב טסלר",
        "יצחק פינדרוס",
        "ישראל אייכלר",
        "משה גפני",
        "משה רוט"
      ]
    },
    {
      party: "ישראל ביתנו",
      politicians: [
        "אביגדור ליברמן",
        "חמד עמאר",
        "יבגני סובה",
        "יוליה מלינובסקי",
        "עודד פורר",
        "שרון ניר"
      ]
    },
    {
      party: "חד\"ש - תע\"ל",
      politicians: [
        "אחמד טיבי",
        "איימן עודה",
        "יוסף עטאונה",
        "עאידה תומא סלימאן",
        "עופר כסיף"
      ]
    },
    {
      party: "רע\"מ",
      politicians: [
        "אימאן ח'טיב יאסין",
        "ואליד אלהואשלה",
        "ווליד טאהא",
        "יאסר חג'יראת",
        "מנסור עבאס"
      ]
    },
    {
      party: "העבודה",
      politicians: [
        "אפרת רייטן מרום",
        "גלעד קריב",
        "מרב מיכאלי",
        "נעמה לזימי"
      ]
    },
    {
      party: "עוצמה יהודית",
      politicians: [
        "איתמר בן גביר",
        "אלמוג כהן",
        "יצחק קרויזר",
        "יצחק שמעון וסרלאוף",
        "לימור סון הר מלך",
        "עמיחי אליהו",
        "צביקה פוגל"
      ]
    },
    {
      party: "נעם",
      politicians: [
        "אבי מעוז"
      ]
    },
    {
      party: "שרים שאינם חברי כנסת",
      politicians: [
        "אלי אליהו כהן",
        "בצלאל סמוטריץ'",
        "דוד אמסלם",
        "חיים ביטון",
        "חיים כץ",
        "יואב בן צור",
        "יואב קיש",
        "יעקב מרגי",
        "יצחק גולדקנופ",
        "מאיר פרוש",
        "מירי מרים רגב",
        "מכלוף מיקי זוהר",
        "עידית סילמן",
        "עמיחי שיקלי",
        "רון דרמר"
      ]
    },
    {
      party: "ח\"כ יחיד",
      politicians: [
        "עידן רול"
      ]
    }
  ];

  // Read the existing politicians.json file
  const politiciansJsonPath = path.join(__dirname, '..', 'data', 'politicians', 'politicians.json');
  let existingPoliticians = [];
  try {
    existingPoliticians = JSON.parse(fs.readFileSync(politiciansJsonPath, 'utf8'));
  } catch (error) {
    console.error('Error reading existing politicians file:', error);
    process.exit(1);
  }

  // Extract all current Knesset members into a flat array
  const currentKnessetMembers = partiesAndPoliticians.reduce((acc, party) => {
    return acc.concat(party.politicians);
  }, []);

  console.log(`Total current Knesset members: ${currentKnessetMembers.length}`);

  // Find politicians to add (in Knesset but not in our file)
  const politiciansToAdd = [];
  for (const partyData of partiesAndPoliticians) {
    for (const politicianName of partyData.politicians) {
      const normalizedName = normalizeHebName(politicianName);
      // Check if the politician already exists in our file
      const exists = existingPoliticians.some(p => normalizeHebName(p.name) === normalizedName);
      
      if (!exists) {
        politiciansToAdd.push({
          name: politicianName,
          party: partyData.party,
          position: "",
          aliases: [],
          image: "",
          image_url: ""
        });
      }
    }
  }

  // Find politicians to remove (in our file but not in Knesset)
  const politiciansToRemove = existingPoliticians.filter(politician => {
    // Remove title entities like "נשיא המדינה" (President)
    if (politician.name === "נשיא המדינה") return true;
    
    // Check if the politician is in the current Knesset
    return !currentKnessetMembers.some(name => normalizeHebName(name) === normalizeHebName(politician.name));
  });

  console.log(`Politicians to add: ${politiciansToAdd.length}`);
  console.log(`Politicians to remove: ${politiciansToRemove.length}`);

  // Update party for existing politicians
  for (const existingPolitician of existingPoliticians) {
    // Skip non-person entities like titles
    if (existingPolitician.name === "נשיא המדינה") continue;
    
    // Find the party this politician belongs to
    for (const partyData of partiesAndPoliticians) {
      const matchingPolitician = partyData.politicians.find(name => 
        normalizeHebName(name) === normalizeHebName(existingPolitician.name)
      );
      
      if (matchingPolitician) {
        // Update the party if it's different
        if (existingPolitician.party !== partyData.party) {
          console.log(`Updating party for ${existingPolitician.name} from ${existingPolitician.party} to ${partyData.party}`);
          existingPolitician.party = partyData.party;
        }
        break;
      }
    }
  }

  // Generate the updated politicians list
  const updatedPoliticians = [
    ...existingPoliticians.filter(p => !politiciansToRemove.includes(p)),
    ...politiciansToAdd
  ];

  // Write debug files
  fs.writeFileSync(path.join(__dirname, 'politicians-to-add.json'), JSON.stringify(politiciansToAdd, null, 2));
  fs.writeFileSync(path.join(__dirname, 'politicians-to-remove.json'), JSON.stringify(politiciansToRemove, null, 2));
  
  // Write the updated politicians.json file
  fs.writeFileSync(
    path.join(__dirname, 'updated-politicians.json'),
    JSON.stringify(updatedPoliticians, null, 2)
  );

  console.log('Done! Check the tmp directory for output files.');
  console.log('To update the actual politicians.json file, run:');
  console.log('cp tmp/updated-politicians.json data/politicians/politicians.json');
}

// Helper function to normalize Hebrew names for comparison
function normalizeHebName(name) {
  return name
    .replace(/['"]/g, '') // Remove quotes
    .replace(/\(.*?\)/g, '') // Remove parentheses and their contents
    .trim()
    .replace(/\s+/g, ' '); // Normalize spaces
}

// Run the extraction
extractPoliticians(); 