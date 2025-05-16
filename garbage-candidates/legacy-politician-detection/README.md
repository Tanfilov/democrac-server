# Legacy Politician Detection Mechanisms

This folder contains saved copies of various politician detection implementations that were used in the Democracy Server project. These are kept for reference purposes as the server evolves.

## Files Overview

1. **findPoliticianMentions.js** - The main politician detection algorithm from server/src/index.js, including helper functions for exact matching and quote detection.

2. **enhancedPoliticianDetection.js** - The enhanced politician detection algorithm that incorporates confidence scoring based on where politicians are mentioned (title, description, content).

3. **test-detection.js** - A test implementation with improved detection for quoted speech and specific patterns.

4. **test-position-detection.js** - An implementation that detects politicians based on their positions (e.g., Prime Minister, Defense Minister).

5. **reprocess-politicians.js** - A simplified implementation used for reprocessing articles.

## Implementation Details

The detection mechanisms use various techniques:

- Exact matching with word boundaries
- Hebrew prefix handling (ל, מ, ב, etc.)
- Quote normalization and detection
- Position-based detection
- Alias detection
- Pattern matching for special cases (quotes, colons)

## Usage Notes

These files are not meant to be used directly. They are preserved for historical reference and to help inform future improvements to the politician detection system.

If you need to revert to a previous implementation or understand how the detection evolved, these files serve as valuable reference points. 