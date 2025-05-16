/**
 * Super simple string matching test
 */

// Benjamin Netanyahu in Hebrew should match
const politicianName = "בנימין נתניהו";
const text = "ראש הממשלה בנימין נתניהו הודיע היום על תוכנית חדשה";

console.log("Politician name:", politicianName);
console.log("Text:", text);
console.log("Does text include politician name?", text.includes(politicianName));

// Try with last name only
const lastName = "נתניהו";
console.log("Last name:", lastName);
console.log("Does text include last name?", text.includes(lastName));

// Test with specific character code ranges (Hebrew Unicode range)
const hebrewTest = (str) => {
  return Array.from(str).some(char => {
    const code = char.charCodeAt(0);
    const isHebrew = code >= 0x0590 && code <= 0x05FF;
    if (isHebrew) {
      console.log(`Character "${char}" is Hebrew (Unicode: ${code.toString(16)})`);
    }
    return isHebrew;
  });
};

console.log("\nHebrew character tests:");
console.log("Does politician name contain Hebrew?", hebrewTest(politicianName));
console.log("Does text contain Hebrew?", hebrewTest(text));

// Try multiple politician names to see if any match
const politicians = [
  { name: "בנימין נתניהו", aliases: ["ביבי", "נתניהו"] },
  { name: "יאיר לפיד", aliases: ["לפיד"] },
  { name: "יואב גלנט", aliases: ["גלנט"] },
  { name: "בצלאל סמוטריץ'", aliases: ["סמוטריץ'", "סמוטריץ"] },
  { name: "ישראל כץ", aliases: ["כץ"] }
];

console.log("\nTesting each politician name:");
politicians.forEach(politician => {
  console.log(`- ${politician.name}: ${text.includes(politician.name) ? "MATCH" : "NO MATCH"}`);
  
  console.log("  Aliases:");
  politician.aliases.forEach(alias => {
    console.log(`  - ${alias}: ${text.includes(alias) ? "MATCH" : "NO MATCH"}`);
  });
}); 