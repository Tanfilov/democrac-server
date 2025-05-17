const fs = require('fs');
const path = require('path');

// Path to politicians.json file
const politiciansPath = path.join(__dirname, 'data', 'politicians', 'politicians.json');

// New position data
const positionUpdates = [
  { name: "בנימין נתניהו", position: "ראש הממשלה" },
  { name: "יריב לוין", position: "סגן ראש הממשלה, שר המשפטים" },
  { name: "בצלאל סמוטריץ'", position: "שר האוצר, שר נוסף במשרד הביטחון" },
  { name: "זאב אלקין", position: "שר נוסף במשרד האוצר" },
  { name: "אלי כהן", position: "שר האנרגיה והתשתיות" },
  { name: "ישראל כץ", position: "שר הביטחון" },
  { name: "יצחק גולדקנופף", position: "שר הבינוי והשיכון" },
  { name: "אוריאל בוסו", position: "שר הבריאות" },
  { name: "אורית סטרוק", position: "שרת ההתיישבות והמשימות הלאומיות" },
  { name: "גילה גמליאל", position: "שרת החדשנות, המדע והטכנולוגיה" },
  { name: "גדעון סער", position: "שר החוץ" },
  { name: "חיים ביטון", position: "שר בלי תיק במשרד החינוך" },
  { name: "יואב קיש", position: "שר החינוך" },
  { name: "אבי דיכטר", position: "שר החקלאות וביטחון המזון" },
  { name: "ניר ברקת", position: "שר הכלכלה והתעשייה" },
  { name: "עמיחי אליהו", position: "שר המורשת" },
  { name: "יריב לוין", position: "שר המשפטים" }, // Already included above
  { name: "דוד אמסלם", position: "שר נוסף במשרד המשפטים, שר הקשר בין הממשלה לכנסת, השר לשיתוף פעולה אזורי" },
  { name: "יצחק שמעון וסרלאוף", position: "שר הנגב, הגליל והחוסן הלאומי" },
  { name: "יואב בן צור", position: "שר העבודה" },
  { name: "אופיר סופר", position: "שר העלייה והקליטה" },
  { name: "משה ארבל", position: "שר הפנים" },
  { name: "יעקב מרגי", position: "שר הרווחה והביטחון החברתי" },
  { name: "מירי רגב", position: "שרת התחבורה והבטיחות בדרכים" },
  { name: "חיים כץ", position: "שר התיירות" },
  { name: "עמיחי שיקלי", position: "שר התפוצות והמאבק באנטישמיות" },
  { name: "שלמה קרעי", position: "שר התקשורת" },
  { name: "מיקי זוהר", position: "שר התרבות והספורט" },
  { name: "מאיר פרוש", position: "שר ירושלים ומסורת ישראל" },
  { name: "איתמר בן גביר", position: "השר לביטחון לאומי" },
  { name: "עידית סילמן", position: "השרה להגנת הסביבה" },
  { name: "רון דרמר", position: "השר לעניינים אסטרטגיים" },
  { name: "מאי גולן", position: "השרה לשוויון חברתי וקידום מעמד האישה" },
  { name: "מיכאל מלכיאלי", position: "השר לשירותי דת" },
  // Deputy Ministers
  { name: "שרן השכל", position: "סגנית שר החוץ" },
  { name: "משה אבוטבול", position: "סגן שר החקלאות וביטחון המזון" },
  { name: "אורי מקלב", position: "סגן שר התחבורה והבטיחות בדרכים, סגן שר ראש הממשלה" },
  { name: "יעקב טסלר", position: "סגן שר התרבות והספורט" },
  { name: "אלמוג כהן", position: "סגן שר במשרד ראש הממשלה" }
];

// Read the politicians.json file
console.log("Reading politicians.json...");
const politiciansData = fs.readFileSync(politiciansPath, 'utf8');
const politicians = JSON.parse(politiciansData);

// Track changes
let changesCount = 0;

// Update positions
console.log("Updating positions...");
politicians.forEach(politician => {
  const updateInfo = positionUpdates.find(update => 
    update.name === politician.name || 
    (politician.aliases && politician.aliases.includes(update.name))
  );
  
  if (updateInfo) {
    const oldPosition = politician.position;
    politician.position = updateInfo.position;
    console.log(`Updated: ${politician.name} - Position changed from "${oldPosition}" to "${updateInfo.position}"`);
    changesCount++;
  }
});

// Write the updated data back to the file
console.log("Writing changes to politicians.json...");
fs.writeFileSync(politiciansPath, JSON.stringify(politicians, null, 2), 'utf8');

console.log(`Done! Updated ${changesCount} politician positions.`); 