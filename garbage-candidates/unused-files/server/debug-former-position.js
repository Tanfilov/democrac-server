const fs = require('fs');
const path = require('path');

// Load politicians data
try {
  const politiciansPath = path.join(__dirname, '../data/politicians/politicians.json');
  console.log(`Loading politicians from: ${politiciansPath}`);
  const data = fs.readFileSync(politiciansPath, 'utf8');
  const politiciansList = JSON.parse(data);
  console.log(`Loaded ${politiciansList.length} politicians`);
  
  // Find Netanyahu and check his position
  const netanyahu = politiciansList.find(p => p.name === 'בנימין נתניהו');
  if (netanyahu) {
    console.log(`Netanyahu found with position: "${netanyahu.position}"`);
  } else {
    console.log('Netanyahu not found in the politicians list');
  }
  
  // Format for detection
  const politicians = politiciansList.map(p => {
    return { 
      he: p.name, 
      en: p.name, 
      position: p.position,
      aliases: p.aliases || [] 
    };
  });
  
  // Test the specific case
  const testText = "נפתלי בנת, ראש הממשלה לשעבר";
  console.log(`\nTest text: "${testText}"`);
  
  // Detect if "לשעבר" is used after "ראש הממשלה"
  const position = "ראש הממשלה";
  const positionIndex = testText.indexOf(position);
  
  if (positionIndex >= 0) {
    const afterText = testText.substring(positionIndex + position.length);
    console.log(`Text after position: "${afterText}"`);
    
    // Check for "לשעבר" after the position
    const formerMatch = afterText.trim().startsWith('לשעבר') || 
                      afterText.match(/^[ \t,.;:]+לשעבר/) ||
                      afterText.match(/^[ \t,.;:]+ה?לשעבר/);
    
    console.log(`Contains 'לשעבר'? ${formerMatch ? 'Yes' : 'No'}`);
    
    if (formerMatch) {
      console.log('This is a former position - should NOT detect Netanyahu');
    } else {
      console.log('This is a current position - would detect Netanyahu');
    }
  } else {
    console.log(`Position "${position}" not found in text`);
  }
  
  // Implement a simplified version of the detection logic
  function simplifiedDetection(text) {
    const normalizedText = text;
    const detectedPoliticians = [];
    
    // 1. Position-based detection only for this test
    const positionMap = {
      'ראש הממשלה': 'ראש הממשלה',
    };
    
    // Check if the position is in the text
    Object.entries(positionMap).forEach(([positionTerm, standardPosition]) => {
      if (text.includes(positionTerm)) {
        console.log(`Found position: ${positionTerm}`);
        
        // Check for former position context
        const positionIndex = text.indexOf(positionTerm);
        const afterText = text.substring(positionIndex + positionTerm.length);
        
        const isFormerPosition = afterText.trim().startsWith('לשעבר') || 
                              afterText.match(/^[ \t,.;:]+לשעבר/) ||
                              afterText.match(/^[ \t,.;:]+ה?לשעבר/);
        
        console.log(`Is former position? ${isFormerPosition ? 'Yes' : 'No'}`);
        
        if (isFormerPosition) {
          console.log('Skipping current position detection since it is a former position');
        } else {
          // Find politicians with this position
          const politiciansWithPosition = politicians.filter(p => p.position === standardPosition);
          
          if (politiciansWithPosition.length > 0) {
            const politician = politiciansWithPosition[0]; // Take the first one
            console.log(`Would detect: ${politician.he} via position "${standardPosition}"`);
            detectedPoliticians.push(politician.he);
          }
        }
      }
    });
    
    return detectedPoliticians;
  }
  
  // Test with the simplified detection
  console.log('\nRunning simplified detection:');
  const detected = simplifiedDetection(testText);
  console.log(`Detected politicians: ${detected.length > 0 ? detected.join(', ') : 'None'}`);
  
  if (detected.length === 0) {
    console.log('SUCCESS: The fix prevents detecting Netanyahu when "לשעבר" is used');
  } else if (detected.includes('בנימין נתניהו')) {
    console.log('FAILURE: Still detecting Netanyahu even with "לשעבר"');
  }
  
} catch (error) {
  console.error('Error in the script:', error);
} 