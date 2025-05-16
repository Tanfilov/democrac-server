const fs = require('fs');
const path = require('path');

// Path to the politicians.json file
const politiciansPath = path.join(__dirname, 'data/politicians/politicians.json');

try {
  // Read the current file
  console.log(`Reading file from: ${politiciansPath}`);
  const data = fs.readFileSync(politiciansPath, 'utf8');
  
  // Parse the JSON
  const politicians = JSON.parse(data);
  console.log(`Successfully parsed JSON with ${politicians.length} politicians`);
  
  // Find Netanyahu's entry
  const netanyahuIndex = politicians.findIndex(p => p.name === 'בנימין נתניהו');
  
  if (netanyahuIndex === -1) {
    console.error('Could not find Netanyahu in the politicians list');
    process.exit(1);
  }
  
  console.log(`Found Netanyahu at index ${netanyahuIndex}`);
  console.log('Current aliases:', JSON.stringify(politicians[netanyahuIndex].aliases));
  
  // Update Netanyahu's aliases
  politicians[netanyahuIndex].aliases = ['נתניהו', 'ביבי'];
  
  console.log('New aliases:', JSON.stringify(politicians[netanyahuIndex].aliases));
  
  // Write the updated data back to the file
  fs.writeFileSync(politiciansPath, JSON.stringify(politicians, null, 2), 'utf8');
  console.log('Successfully updated politicians.json with Netanyahu aliases');

  // Verification - read the file again to confirm changes
  const verifyData = fs.readFileSync(politiciansPath, 'utf8');
  const verifyPoliticians = JSON.parse(verifyData);
  const verifyNetanyahu = verifyPoliticians.find(p => p.name === 'בנימין נתניהו');
  
  if (verifyNetanyahu) {
    console.log('Verification - Netanyahu aliases:', JSON.stringify(verifyNetanyahu.aliases));
  }
} catch (err) {
  console.error('Error:', err.message);
} 