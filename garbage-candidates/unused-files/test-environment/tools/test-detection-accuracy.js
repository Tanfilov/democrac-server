/**
 * Politician Detection Accuracy Test Tool
 * 
 * This tool analyzes the detection of politicians in articles,
 * showing the exact context where the detection occurred to
 * help identify false positives.
 */

const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');
const { htmlToText } = require('html-to-text');
const politicianDetection = require('../src/politician-detection');
const config = require('../src/config');

// Character window around a detection to show
const CONTEXT_WINDOW = 100;

// Get the JSON politicians data
const loadPoliticians = () => {
  try {
    // First check if we have sample data in our test environment
    const samplePath = path.join(__dirname, '../data/politicians/politicians.json');
    if (fs.existsSync(samplePath)) {
      return politicianDetection.loadPoliticians(samplePath);
    }
    
    // Fall back to the real data
    const politiciansPath = path.join(__dirname, '../../data/politicians/politicians.json');
    if (fs.existsSync(politiciansPath)) {
      return politicianDetection.loadPoliticians(politiciansPath);
    }
    
    throw new Error('No politicians data found');
  } catch (error) {
    console.error('Error loading politicians:', error.message);
    return [];
  }
};

// Enhanced detection that provides detailed information
function enhancedDetectionWithContext(text, politicians) {
  if (!text) return [];

  const results = [];
  
  // Test each politician
  for (const politician of politicians) {
    // Check name
    testNameWithContext(politician.name, text, politician, results);
    
    // Check aliases
    if (politician.aliases && politician.aliases.length > 0) {
      for (const alias of politician.aliases) {
        if (alias.length < 3) continue; // Skip very short aliases
        testNameWithContext(alias, text, politician, results);
      }
    }
    
    // Check position
    if (politician.position) {
      const positionMap = {
        'ראש הממשלה': 'ראש הממשלה',
        'רה"מ': 'ראש הממשלה',
        'ראש האופוזיציה': 'ראש האופוזיציה',
        'שר הביטחון': 'שר הביטחון',
        'שר האוצר': 'שר האוצר',
        'שר החוץ': 'שר החוץ',
        'שר הפנים': 'שר הפנים',
        'השר לביטחון לאומי': 'השר לביטחון לאומי',
        'יושב ראש הכנסת': 'יושב ראש הכנסת',
        'נשיא המדינה': 'נשיא המדינה',
        'הנשיא': 'נשיא המדינה'
      };
      
      // If this politician has a known position title, check for that too
      Object.entries(positionMap).forEach(([positionTitle, standardPosition]) => {
        if (politician.position === standardPosition) {
          testPositionWithContext(positionTitle, text, politician, results);
        }
      });
    }
  }
  
  return results;
}

// Test a name/alias with context
function testNameWithContext(name, text, politician, results) {
  if (!text.includes(name)) return;
  
  // Word boundaries
  const wordBoundaries = [' ', '.', ',', ':', ';', '?', '!', '"', "'", '(', ')', '[', ']', '{', '}', '\n', '\t', '"', '"'];
  
  // Find all occurrences
  const indexes = findAllOccurrences(text, name);
  
  for (const index of indexes) {
    const beforeChar = index === 0 ? ' ' : text[index - 1];
    const afterChar = index + name.length >= text.length ? ' ' : text[index + name.length];
    
    // Standard boundary check
    const isMatch = (wordBoundaries.includes(beforeChar) || index === 0) && 
                   (wordBoundaries.includes(afterChar) || index + name.length === text.length);
    
    if (isMatch) {
      // If this politician requires context, check for it around this specific match
      if (politician.requiresContext) {
        if (!hasRequiredContext(text, politician, index, name.length)) {
          continue; // Skip this match as it doesn't have the required context
        }
      }
      
      // Extract the context window
      const contextStart = Math.max(0, index - CONTEXT_WINDOW);
      const contextEnd = Math.min(text.length, index + name.length + CONTEXT_WINDOW);
      
      const beforeContext = text.substring(contextStart, index);
      const nameText = text.substring(index, index + name.length);
      const afterContext = text.substring(index + name.length, contextEnd);
      
      results.push({
        politicianName: politician.name,
        detectedText: nameText,
        detectedAs: 'name',
        detectedTerm: name,
        position: index,
        context: {
          before: beforeContext,
          term: nameText,
          after: afterContext,
          full: `${beforeContext}[${nameText}]${afterContext}`
        }
      });
    }
  }
}

// Test a position title with context
function testPositionWithContext(position, text, politician, results) {
  if (!text.includes(position)) return;
  
  // Word boundaries
  const wordBoundaries = [' ', '.', ',', ':', ';', '?', '!', '"', "'", '(', ')', '[', ']', '{', '}', '\n', '\t', '"', '"'];
  
  // Find all occurrences
  const indexes = findAllOccurrences(text, position);
  
  for (const index of indexes) {
    const beforeChar = index === 0 ? ' ' : text[index - 1];
    const afterChar = index + position.length >= text.length ? ' ' : text[index + position.length];
    
    // Standard boundary check
    const isMatch = (wordBoundaries.includes(beforeChar) || index === 0) && 
                   (wordBoundaries.includes(afterChar) || index + position.length === text.length);
    
    if (isMatch) {
      // Check if this is a former position (contains "לשעבר")
      if (politicianDetection.isPositionFormer(text, position)) {
        continue; // Skip former positions
      }
      
      // Extract the context window
      const contextStart = Math.max(0, index - CONTEXT_WINDOW);
      const contextEnd = Math.min(text.length, index + position.length + CONTEXT_WINDOW);
      
      const beforeContext = text.substring(contextStart, index);
      const positionText = text.substring(index, index + position.length);
      const afterContext = text.substring(index + position.length, contextEnd);
      
      results.push({
        politicianName: politician.name,
        detectedText: positionText,
        detectedAs: 'position',
        detectedTerm: position,
        position: index,
        context: {
          before: beforeContext,
          term: positionText,
          after: afterContext,
          full: `${beforeContext}[${positionText}]${afterContext}`
        }
      });
    }
  }
}

// Helper function to check if a position is former
function isPositionFormer(text, position) {
  const formerIdentifiers = ['לשעבר', 'הקודם', 'היוצא', 'לקודם'];
  const positionIndex = text.indexOf(position);
  
  if (positionIndex === -1) return false;
  
  // Check if any former identifier appears right after the position
  const textAfterPosition = text.substring(positionIndex + position.length).trim();
  
  for (const identifier of formerIdentifiers) {
    if (textAfterPosition.startsWith(identifier)) {
      return true;
    }
  }
  
  return false;
}

// These helper functions are adapted from the politician detection module
function findAllOccurrences(text, subtext) {
  const indexes = [];
  let index = text.indexOf(subtext);
  
  while (index !== -1) {
    indexes.push(index);
    index = text.indexOf(subtext, index + 1);
  }
  
  return indexes;
}

function hasRequiredContext(text, politician, nameMatchIndex, nameLength) {
  if (!politician.requiresContext || !politician.contextIdentifiers || politician.contextIdentifiers.length === 0) {
    return true; // No context required
  }
  
  // Define the window size (in characters) to look for context before and after the name
  const windowSize = 200; // Look for context within 200 characters before and after the name
  
  // Get the window of text around the name
  const startWindow = Math.max(0, nameMatchIndex - windowSize);
  const endWindow = Math.min(text.length, nameMatchIndex + nameLength + windowSize);
  
  const textWindow = text.substring(startWindow, endWindow);
  
  // Check if any context identifiers appear in the window
  return politician.contextIdentifiers.some(context => textWindow.includes(context));
}

// Parse RSS feeds and test politician detection
async function parseAndTestFeeds() {
  // Load politicians
  const politicians = loadPoliticians();
  console.log(`Loaded ${politicians.length} politicians for testing`);
  
  // Check captured feeds directory
  const capturedFeedsDir = path.join(__dirname, '../data/captured-feeds');
  if (!fs.existsSync(capturedFeedsDir)) {
    console.error('No captured feeds directory found. Run the capture-feeds.js script first.');
    return;
  }
  
  // Get all feed files
  const files = fs.readdirSync(capturedFeedsDir);
  const feedFiles = files.filter(file => file.endsWith('.xml'));
  
  if (feedFiles.length === 0) {
    console.error('No feed files found. Run the capture-feeds.js script first.');
    return;
  }
  
  console.log(`Found ${feedFiles.length} captured feed files`);
  
  // Initialize RSS parser
  const parser = new Parser({
    customFields: {
      item: ['media:content', 'description', 'pubDate', 'content']
    }
  });
  
  // Process each feed file
  for (const file of feedFiles) {
    const feedPath = path.join(capturedFeedsDir, file);
    console.log(`\nProcessing feed: ${file}`);
    
    try {
      // Parse the feed - use readFile since parseFile is not available
      const feedContent = fs.readFileSync(feedPath, 'utf8');
      const feed = await parser.parseString(feedContent);
      console.log(`Feed: ${feed.title || file} with ${feed.items.length} articles`);
      
      // Process each item
      for (let i = 0; i < feed.items.length; i++) {
        const item = feed.items[i];
        
        // Extract clean text
        const title = item.title || '';
        const description = item.description ? htmlToText(item.description, { wordwrap: false }) : '';
        const content = item.content ? htmlToText(item.content, { wordwrap: false }) : '';
        
        console.log(`\n--- Article ${i+1}/${feed.items.length}: ${title.substring(0, 50)}${title.length > 50 ? '...' : ''} ---`);
        
        // Test title
        const titleDetections = enhancedDetectionWithContext(title, politicians);
        if (titleDetections.length > 0) {
          console.log(`\nTitle detections (${titleDetections.length}):`);
          printDetections(titleDetections, 'TITLE');
        } else {
          console.log('No politicians detected in title');
        }
        
        // Test description
        const descriptionDetections = enhancedDetectionWithContext(description, politicians);
        if (descriptionDetections.length > 0) {
          console.log(`\nDescription detections (${descriptionDetections.length}):`);
          printDetections(descriptionDetections, 'DESCRIPTION');
        } else {
          console.log('No politicians detected in description');
        }
        
        // Test content (if available)
        if (content && content.length > 50) {
          const contentDetections = enhancedDetectionWithContext(content, politicians);
          if (contentDetections.length > 0) {
            console.log(`\nContent detections (${contentDetections.length}):`);
            printDetections(contentDetections, 'CONTENT');
          } else {
            console.log('No politicians detected in content');
          }
        }
        
        // Compare with standard detection
        const standardDetection = politicianDetection.findPoliticianMentions(
          title + ' ' + description + ' ' + content, 
          politicians
        );
        
        console.log(`\nStandard detection found: ${standardDetection.join(', ') || 'None'}`);
        
        console.log('\n' + '-'.repeat(80));
        
        // Limit to 5 articles per feed for brevity
        if (i >= 4) {
          console.log(`\nLimiting to 5 articles per feed. ${feed.items.length - 5} more articles not shown.`);
          break;
        }
      }
    } catch (error) {
      console.error(`Error processing feed ${file}:`, error);
    }
  }
}

// Pretty print the detections
function printDetections(detections, section) {
  detections.forEach((detection, index) => {
    console.log(`${index + 1}. ${detection.politicianName} (as ${detection.detectedAs}: "${detection.detectedTerm}")`);
    
    // Highlight the detection in the context
    const context = detection.context.full;
    // Calculate where to truncate for readability
    const startIndex = Math.max(0, context.indexOf('[') - 60);
    const endIndex = Math.min(context.length, context.indexOf(']') + 60);
    const displayContext = context.substring(startIndex, endIndex);
    
    console.log(`   ${section} CONTEXT: ...${displayContext}...`);
  });
}

// Run the main function if this script is executed directly
if (require.main === module) {
  parseAndTestFeeds().catch(err => {
    console.error('Error running detection test:', err);
    process.exit(1);
  });
}

module.exports = {
  enhancedDetectionWithContext,
  parseAndTestFeeds
}; 