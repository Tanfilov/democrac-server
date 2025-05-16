# Politician Detection Algorithm: Technical Documentation

## Overview

This document provides a technical overview of the improved politician detection algorithm implemented in the democracy-server application. The algorithm identifies politicians mentioned in news articles through various detection mechanisms and applies a relevance scoring system to determine the most significant politicians covered in each article.

## Algorithm Components

### 1. Text Normalization

Before any detection takes place, input text undergoes normalization:

```javascript
const normalizedText = text
  .replace(/[""״]/g, '"')  // Normalize various quote types to standard quotes
  .replace(/['׳']/g, "'"); // Normalize various apostrophe types
```

This ensures consistent handling of quotes and apostrophes, which is especially important in Hebrew text where multiple variants of these characters exist.

### 2. Direct Name and Alias Detection

The primary detection mechanism searches for exact matches of politician names and aliases:

```javascript
POLITICIANS.forEach(politician => {
  const politicianName = politician.name || politician.he; // Support both name structures
  // ...detection logic with name and aliases
});
```

Key features:
- Supports both `name` and `he` properties for backward compatibility
- Handles Hebrew prefixes (ל, מ, ב, ו, ש, ה) that may be attached to names
- Enforces word boundaries to avoid partial matches
- Checks for aliases when main name isn't found

### 3. Position-Based Detection with Verification

The position-based detection identifies politicians through their official positions (e.g., "ראש הממשלה"/Prime Minister) with additional verification steps:

```javascript
// Only detect by position if there's a partial name indicator nearby
const positionIndex = normalizedText.indexOf(posWithPrefix);
const windowSize = 200; // Characters to check before and after the position
// ...get context around position...

// Get name parts that wouldn't be detected on their own
const nameParts = getPartialNameIndicators(politicianName);

// Check if any partial name indicators are present in the context
const hasPartialNameIndicator = nameParts.some(part => 
  context.includes(part) && 
  isStandaloneWord(context, part)
);
```

This approach:
- Maps position titles to standardized forms
- Verifies position mentions by requiring a partial name indicator (last name or nickname) nearby
- Uses a configurable context window (default: 200 characters)
- Includes special handling for well-known politicians (Netanyahu/ביבי, Herzog/בוז׳י, etc.)

### 4. Position Qualification Detection

The algorithm carefully excludes non-current positions using sophisticated qualification detection:

```javascript
function isModifiedPosition(text, position) {
  // ...
  // 1. Former position modifiers
  const formerModifiers = ['לשעבר', 'הקודם', 'היוצא', 'לקודם', 'הזמני'];
  // 2. Future position modifiers
  const futureModifiers = ['המיועד', 'הבא', 'העתידי', 'לעתיד'];
  // 3. Specific government or past period contexts
  // 4. Position "של" (of) someone else
  // 5. Mentions of "לכהן" (to serve) or "מונה" (appointed)
}
```

This function identifies qualifiers that indicate:
- Former/previous positions
- Future/potential positions
- Historical references
- References to other people's positions

### 5. Required Context Checking

For politicians with common names, the algorithm can require specific contextual identifiers:

```javascript
function hasRequiredContext(text, politician, nameMatchIndex, nameLength) {
  if (!politician.requiresContext) return true;
  
  // Define window size to look for context
  const windowSize = 200;
  // ...check for required context identifiers in window...
}
```

This prevents false positives for politicians who might share names with other public figures.

### 6. Relevance Scoring System

The enhanced detection applies a sophisticated scoring system to rank detected politicians:

```javascript
// Check title - highest confidence (10 points per mention)
titlePoliticians.forEach(p => {
  confidenceScores[p] = (confidenceScores[p] || 0) + 10;
});

// Description mentions (5 points)
// Early content mentions (3 bonus points)
// Multiple mentions (1 point per mention, capped at 5)
// Quote proximity (2 bonus points)
```

The scoring system assigns different weights based on:
- Title mentions (10 points each): Highest importance
- Description mentions (5 points each): Medium importance
- Multiple content mentions (1 point each, up to 5 additional points)
- Early content mentions (3 bonus points): Content appearing in first 20% of text
- Quote proximity (2 bonus points): Mentions near quoted text

### 7. Special Cases Handling

The algorithm has special handling for international politicians:

```javascript
const specialPoliticians = [
  'דונלד טראמפ', 
  'ג\'ו ביידן', 
  'קמאלה האריס',
  'עמנואל מקרון'
];

// Filter results with special threshold for foreign politicians
const highConfidencePoliticians = politiciansWithScores
  .filter(p => {
    if (specialPoliticians.includes(p.name)) {
      return p.score >= 2; // Lower threshold
    }
    return p.score >= 3; // Normal threshold
  });
```

Foreign politicians use a lower confidence threshold since they might be mentioned less prominently but still be relevant.

## Helper Functions

### Word Boundary Detection

```javascript
function isExactMatch(text, word, boundaries, politician = null) {
  // Standard boundary check
  const isMatch = (boundaries.includes(beforeChar) || index === 0) && 
                 (boundaries.includes(afterChar) || index + word.length === text.length);
  
  // Special handling for text inside quotes
  if (isInsideQuotes(text, index, index + word.length)) {
    // More lenient boundary checking...
  }
}
```

This ensures we only match complete words, with special handling for text inside quotation marks.

### Quote Proximity Detection

```javascript
function isNearQuotes(text, politician) {
  // Window size to check for quotes
  const windowSize = 100;
  
  // Check each occurrence for nearby quotes
  for (const position of positions) {
    // ... extract window around position ...
    if (window.match(/["''״]/)) {
      return true;
    }
  }
}
```

This function identifies when politicians are mentioned near quoted speech, which often indicates direct statements by or about them.

## Usage Example

```javascript
const article = {
  id: 123,
  title: "Article title with politician names",
  description: "Article description may mention politicians",
  content: "Full article content..."
};

const detectedPoliticians = await enhancedPoliticianDetection(
  article, 
  POLITICIANS,
  optionalScrapeFunction,
  optionalUpdateFunction
);
```

The result is an array of politician names sorted by relevance to the article content.

## Performance Considerations

- The algorithm uses several string search operations which have O(n) complexity
- Relevance scoring requires multiple passes through the text
- For very large articles, position-based detection with verification adds some overhead
- The implementation balances detection accuracy with performance

## Future Improvements

Potential future enhancements:
- Machine learning-based politician detection
- Entity disambiguation for politicians with similar names
- Recognition of political roles and relationships between politicians
- Integration with sentiment analysis to detect tone regarding politicians 