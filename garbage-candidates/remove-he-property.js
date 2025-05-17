// Script to remove the 'he' property from politicians.json
const fs = require('fs');
const path = require('path');

// Load the politicians data
console.log('Loading politicians data...');
const politiciansFilePath = path.resolve(__dirname, '../data/politicians/politicians.json');
const politiciansData = fs.readFileSync(politiciansFilePath, 'utf8');
const politicians = JSON.parse(politiciansData);
console.log(`Loaded ${politicians.length} politicians`);

// Remove the 'he' property from each politician
console.log('Removing the "he" property from each politician...');
let removedCount = 0;
politicians.forEach(politician => {
  if (politician.he) {
    // Ensure the name property exists before removing he
    if (!politician.name) {
      politician.name = politician.he;
      console.log(`Added name property using he value for politician with aliases: ${politician.aliases ? politician.aliases.join(', ') : 'none'}`);
    }
    
    delete politician.he;
    removedCount++;
  }
});
console.log(`Removed "he" property from ${removedCount} politician records`);

// Save the updated data back to the file
fs.writeFileSync(
  politiciansFilePath,
  JSON.stringify(politicians, null, 2),
  'utf8'
);

console.log(`Updated politicians data saved to ${politiciansFilePath}`);
console.log('Completed. The "he" property has been removed from all politician records.'); 