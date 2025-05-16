const fs = require('fs');
const path = require('path');

try {
  const POLITICIANS_DATA = fs.readFileSync(path.join(__dirname, 'data/politicians/politicians.json'), 'utf8');
  const POLITICIANS = JSON.parse(POLITICIANS_DATA);
  
  console.log('First politician:');
  console.log(JSON.stringify(POLITICIANS[0], null, 2));
  
  console.log('\nDoes it have position property?', POLITICIANS[0].hasOwnProperty('position'));
  
  // Check what positions are available
  const positions = new Set();
  POLITICIANS.forEach(p => {
    if (p.position) {
      positions.add(p.position);
    }
  });
  
  console.log('\nAvailable positions:');
  console.log(Array.from(positions));
  
  // How many politicians have positions?
  const withPosition = POLITICIANS.filter(p => p.position).length;
  console.log(`\n${withPosition} out of ${POLITICIANS.length} politicians have a position (${Math.round(withPosition/POLITICIANS.length*100)}%)`);
} catch (error) {
  console.error('Error:', error);
} 