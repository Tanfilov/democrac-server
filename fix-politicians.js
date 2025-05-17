// Script to fix the politicians.json file
// This adds the 'he' property to each politician record which is required by the detection algorithm

const fs = require('fs');

// Load the politicians data
const politiciansFilePath = './data/politicians/politicians.json';
const politiciansData = fs.readFileSync(politiciansFilePath, 'utf8');
const POLITICIANS = JSON.parse(politiciansData);

console.log(`Loaded ${POLITICIANS.length} politicians from ${politiciansFilePath}`);

// Add 'he' property to each politician
POLITICIANS.forEach(p => {
  if (!p.he && p.name) {
    p.he = p.name;
  }
});

// Save the updated data
fs.writeFileSync(
  politiciansFilePath,
  JSON.stringify(POLITICIANS, null, 2),
  'utf8'
);

console.log(`Updated politicians data saved to ${politiciansFilePath}`);
console.log('Each politician record now has the "he" property set to match their "name" property'); 