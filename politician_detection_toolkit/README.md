# Politician Detection Toolkit & Refinement Mechanism

## 1. Purpose

This toolkit provides core logic for detecting politician mentions in text and a systematic mechanism for debugging, refining, and improving the accuracy of these detections over time. It is designed to be adaptable for use in different environments.

The primary goal of the refinement mechanism is to create a tight feedback loop where user-identified errors in politician detection lead to actionable suggestions, data updates (primarily aliases), and potential improvements to the core detection logic.

## 2. Core Components

### 2.1. `src/politicianDetectionService.js`

This is the heart of the politician detection engine.

*   **Main Functions:**
    *   `enhancedPoliticianDetection(article, POLITICIANS, scrapeArticleContent, updateArticleContent)`: Orchestrates the detection process for a given article. It cleans the text, then uses `findPoliticianMentions`. (Note: `scrapeArticleContent` and `updateArticleContent` might be less relevant in a standalone context or would need adaptation).
    *   `findPoliticianMentions(text, POLITICIANS)`: Takes a piece of text and a list of politician objects and returns an array of detected politician objects with their mention details (count, positions, context).
    *   `isExactMatch(text, word, boundaries, politician, allPoliticians)`: A crucial helper function that determines if a politician's name or alias (`word`) is present in the `text` as a whole word, respecting defined `boundaries`. It can also contain logic to prevent specific known false positives (though this should be used sparingly in favor of general solutions).
    *   `normalizeText(text)`: Normalizes text for consistent matching (e.g., handling different types of quotes, whitespace).
    *   `cleanText(text, removeHtml, removeUrls, removePunctuation)`: Preprocesses text by removing HTML tags, URLs, and optionally punctuation to improve detection accuracy.
*   **Key Constants:**
    *   `WORD_BOUNDARIES`: An array of characters (e.g., space, period, comma, HTML brackets) that define what constitutes the end or beginning of a word. This is critical for the `isExactMatch` function.
    *   `HEBREW_PREFIXES`: An array of common Hebrew prefixes (e.g., 'ל', 'מ', 'ב', 'ו', 'ש', 'ה') that the system can optionally strip from the beginning of words or handle during matching to correctly identify names.
*   **Dependencies:**
    *   Relies on `data/politicians.json` for the list of politicians and their aliases.
    *   May use external libraries like `he` for HTML entity decoding if not removed by `cleanText`. (Ensure any such Node.js dependencies are noted).

### 2.2. `data/politicians.json`

This JSON file contains the list of all politicians the system knows about.

*   **Structure (per politician):**
    ```json
    {
      "name": "שם הפוליטיקאי הראשי", // Primary name
      "party": "שם המפלגה",
      "position": "תפקיד נוכחי",
      "gender": "male/female", // For contextual understanding, if used
      "aliases": [
        "כינוי 1",
        "שם מלא עם תואר",
        "שם באנגלית אם רלוונטי"
      ],
      "socialMedia": { // Optional
        "twitter": "handle",
        "facebook": "profile_url"
      },
      "imageUrl": "url_to_image", // Optional
      "isActive": true/false, // Optional, for filtering
      "lastUpdated": "YYYY-MM-DD" // Optional
    }
    ```
*   **Importance:** Keeping this file accurate and comprehensive, especially the `aliases` array, is critical for detection accuracy. The refinement mechanism heavily relies on suggesting new aliases.

### 2.3. `tools/refine-detection.js`

This Node.js script implements the "Iterative Politician Detection Refinement with Dynamic Feedback Pruning" workflow.

*   **Purpose:**
    1.  Reads problematic article cases from `tools/feedback.json`.
    2.  Re-processes these articles using the current `src/politicianDetectionService.js` and `data/politicians.json`.
    3.  Compares the new detection results against the expected behavior defined in `feedback.json`.
    4.  Generates a `refinement-suggestions.md` file detailing:
        *   Which issues are now resolved.
        *   For unresolved issues: specific suggestions (e.g., add an alias, investigate word boundaries).
    5.  Updates `tools/feedback.json` by removing entries for issues that have been resolved.
*   **Key Operations (Conceptual):**
    *   Loads `politicians.json`.
    *   Loads `feedback.json`.
    *   For each feedback item:
        *   Retrieves/simulates loading the article content (title, description, full text). **(See `ARTICLE_PROCESSING_SIMULATION_README.md`)**
        *   Calls `enhancedPoliticianDetection` (or its core parts).
        *   Compares detected politicians with the feedback's `politicianName` and `type` (`missed` or `false_positive`).
        *   If still an issue, performs analysis (e.g., checks if the name exists in text but wasn't matched due to boundaries, or if a missed name could be a new alias).
        *   Builds lists of resolved and unresolved issues.
    *   Writes `refinement-suggestions.md`.
    *   Overwrites `feedback.json` with only the unresolved issues.

### 2.4. `tools/sample-feedback.json`

A template file demonstrating the structure for reporting problematic articles.

*   **Structure:**
    ```json
    [
      {
        "articleId": "unique_article_identifier_or_URL",
        "articleTitleForReference": "כותרת המאמר לנוחות", // Optional, for easier human reading
        "reportedIssues": [
          {
            "type": "missed", // or "false_positive"
            "politicianName": "שם פוליטיקאי רשמי כפי שמופיע ב-politicians.json",
            "contextSnippet": "...קטע טקסט מהמאמר בו הבעיה התרחשה...",
            "detailsForMissed": "השם מופיע כ-'וריאציה של שם הפוליטיקאי'", // Only if type="missed", helps suggest alias
            "expectedBehavior": "Should have detected 'שם פוליטיקאי' here." // Or "Should NOT have detected..."
          }
        ]
      }
    ]
    ```

### 2.5. Optional Examples & Supporting Documentation (User-Provided)

To provide further context on how the `politicianDetectionService.js` has been used in a larger project or for more complex batch processing, you may wish to include additional files in this toolkit, such as:

*   **`examples/test-real-articles-example.js`:** An adapted version of a script that processes multiple articles (e.g., from local XML/JSON files) and generates a report. This can showcase batch processing and more complex invocation of the detection service.
*   **`docs/additional-development-notes.md`:** Relevant excerpts from development notes of the original project that shed light on design decisions or common issues related to politician detection.
*   **`examples/server-integration-snippets.js`:** Small, relevant code snippets showing how the detection service was called within a live server environment (e.g., within an API endpoint handler after fetching an article).

These files are not strictly required for the `refine-detection.js` mechanism to function with its simulated article fetching but can be invaluable for another team looking to understand or extend the toolkit.

## 3. Mechanism for Refining Detection (Workflow)

This workflow enables continuous improvement of the politician detection accuracy.

1.  **Identify Problematic Articles:**
    *   Through manual review of application output, user reports, or other means, identify articles where politician detection is incorrect (politicians are missed, or non-politicians are wrongly identified).

2.  **Populate `tools/feedback.json`:**
    *   For each problematic article, create an entry in `tools/feedback.json` based on the structure in `tools/sample-feedback.json`.
    *   Be specific about the `politicianName` (use the primary name from `politicians.json`), the `type` of error, and provide a `contextSnippet`. For `missed` types, the `detailsForMissed` field can be very helpful if you see the exact string that was missed.

3.  **Run the Refinement Script:**
    *   Execute `node tools/refine-detection.js` from the `politician_detection_toolkit` directory.
    *   This script will process the articles in `feedback.json` against the current detection logic and data.

4.  **Review Outputs:**
    *   **`refinement-suggestions.md`:** This file will be generated (or overwritten).
        *   It will list issues that were successfully RESOLVED by recent changes.
        *   Crucially, it will provide SUGGESTIONS for UNRESOLVED issues. These might include:
            *   Adding a new alias to `data/politicians.json`.
            *   Investigating word boundary issues for specific contexts.
            *   Noting potential needs for core logic adjustments in `src/politicianDetectionService.js` if patterns emerge.
    *   **`tools/feedback.json`:** This file will be automatically updated. Issues that were resolved by the script run will be removed. It will now only contain outstanding problems.

5.  **Implement Changes:**
    *   **Alias Updates:** Based on suggestions, directly edit `data/politicians.json` to add new aliases. This is often the quickest way to fix missed detections.
    *   **Logic Review:** If `refinement-suggestions.md` indicates patterns of errors that aliases alone can't fix (e.g., complex boundary cases, specific types of false positives needing disambiguation), the development team should review `src/politicianDetectionService.js` for potential generalizable improvements.

6.  **Iterate:**
    *   Repeat steps 3-5. With each iteration, `feedback.json` should shrink, and `refinement-suggestions.md` should show more resolved items.
    *   New problematic articles can be added to `feedback.json` at any time to include them in the refinement cycle.

## 4. Prerequisites for Standalone Use

*   **Node.js Environment:** The `refine-detection.js` script and `politicianDetectionService.js` are designed for a Node.js environment. Ensure Node.js (preferably a recent LTS version) is installed.
*   **Package Dependencies (if any):** `politicianDetectionService.js` might have dependencies (e.g., the `he` library for HTML decoding). If so, a `package.json` file listing these would be necessary, and `npm install` would need to be run. (This initial version assumes minimal external dependencies beyond Node.js built-ins for simplicity of extraction).
*   **Article Content Source:** The provided `refine-detection.js` will need a way to access article content (title, description, full text) for the `articleId`s specified in `feedback.json`. This is the most significant adaptation needed for standalone use. Refer to `ARTICLE_PROCESSING_SIMULATION_README.md` for strategies on how to adapt this part.

## 5. Adapting and Integrating the Toolkit

*   **Integrating Detection Logic:**
    *   The functions within `src/politicianDetectionService.js` (especially `enhancedPoliticianDetection` or `findPoliticianMentions`) can be imported and used in other Node.js applications.
    *   Ensure `data/politicians.json` is accessible to the service.
*   **Adapting `refine-detection.js`:**
    *   The most critical adaptation is how `refine-detection.js` fetches article content. It needs to be modified to read from the target system's database, file system, or API.
    *   The output paths for `