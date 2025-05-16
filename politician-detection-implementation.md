# Enhanced Politician Detection Mechanism

This document explains the enhanced politician detection mechanism implemented in the Democracy Server project. The mechanism detects politicians mentioned in Hebrew news articles using several sophisticated techniques.

## Implementation Overview

The implementation includes several key components:

### 1. Multi-Level Matching Approach

- **Exact Name Matching**: Detects politician names using word boundary detection
- **Position-Based Detection**: Identifies politicians by their positions (Prime Minister, Defense Minister, etc.)
- **Alias Detection**: Checks for alternative names or nicknames
- **Confidence Scoring**: Weighs mentions differently based on location (title, description, content)

### 2. Hebrew Language Handling

- **Prefix Handling**: Accounts for Hebrew prefixes (ל, מ, ב, ו, ש, ה) that may be attached to names
- **Quote Normalization**: Normalizes various types of quotes and apostrophes used in Hebrew text
- **Custom Word Boundaries**: Defines appropriate word boundaries for Hebrew text

### 3. Detection Techniques

- **Word Boundary Check**: Ensures names are standalone words, not parts of other words
- **Quote Context Analysis**: Special handling for text within quotation marks
- **Positional Context**: Maps positions to current officeholders

### 4. Confidence Scoring System

- Title mentions: Highest confidence (3 points)
- Description mentions: Medium confidence (2 points)
- Content mentions: Lower confidence (1 point)
- Multiple mentions across different sections increase confidence
- Special handling for foreign politicians with lower threshold

### 5. Content Acquisition

- Uses existing article content if available
- Scrapes content from the original source if needed

## Key Functions

### `findPoliticianMentions(text)`

The main function that identifies politicians mentioned in a text, returning an array of politician names:

```javascript
// Find politician mentions in text
const findPoliticianMentions = (text) => {
  if (!text) return [];
  
  // Hebrew prefixes that might appear before names
  const prefixes = ['', 'ל', 'מ', 'ב', 'ו', 'ש', 'ה'];
  const wordBoundaries = [' ', '.', ',', ':', ';', '?', '!', '"', "'", '(', ')', '[', ']', '{', '}', '\n', '\t', '"', '"'];
  
  // Normalize quotes in the text to standard quote characters
  const normalizedText = text
    .replace(/[""״]/g, '"')  // Normalize various quote types to standard quotes
    .replace(/['׳']/g, "'"); // Normalize various apostrophe types
  
  const detectedPoliticians = new Set();
  
  // 1. Direct name and alias matching
  POLITICIANS.forEach(politician => {
    // Check names with prefixes
    // Check aliases
  });
  
  // 2. Position-based detection
  Object.entries(positionMap).forEach(([positionTerm, standardPosition]) => {
    // Find politicians with this position
  });
  
  return Array.from(detectedPoliticians);
};
```

### `enhancedPoliticianDetection(article)`

This function implements the confidence-scoring system:

```javascript
const enhancedPoliticianDetection = async (article) => {
  // Check title (highest confidence)
  // Check description (medium confidence)
  // Check content or scrape if needed (lowest confidence)
  // Sort and filter by confidence score
};
```

### Helper Functions

- `isExactMatch(text, word, boundaries)`: Checks if a word appears as an exact match
- `isInsideQuotes(text, startPos, endPos)`: Determines if a word is inside quotation marks
- `findAllOccurrences(text, subtext)`: Finds all instances of a substring

## Note on Implementation

This implementation focuses on techniques 1-5 and 7 from the original plan, specifically excluding:
- Special Pattern Detection (#6) - The pattern-based regex detection for quoted speech patterns

## Usage

The detection mechanism is used in several places:
1. When processing new articles
2. When running manual detection via API endpoints
3. When reprocessing existing articles

To reprocess all articles with this detection mechanism, use the `/api/reset-politicians` endpoint. 