// politician_detection_toolkit/tools/refine-detection.js
// Node.js script

const fs = require('fs').promises;
const path = require('path');
// Assuming politicianDetectionService.js is in ../src/
// Adjust path if necessary based on final structure
const { enhancedPoliticianDetection, findPoliticianMentions, normalizeText, cleanText } = require('../src/politicianDetectionService');

const POLITICIANS_PATH = path.join(__dirname, '..', 'data', 'politicians.json');
const FEEDBACK_PATH = path.join(__dirname, 'feedback.json'); // Expects feedback.json in the same directory
const SUGGESTIONS_PATH = path.join(__dirname, 'refinement-suggestions.md');

// --- Utility to simulate fetching article content ---
// IMPORTANT: This needs to be replaced with actual data fetching logic.
// See ARTICLE_PROCESSING_SIMULATION_README.md
async function getArticleContentById(articleId, articleTitleForReference) {
    console.warn(`SIMULATION: Attempting to get content for articleId: ${articleId}. THIS IS SIMULATED DATA.`);
    // In a real scenario, you'd fetch from a DB, API, or file system
    // For now, return a mock structure. Ensure it has title, description, content
    return {
        id: articleId,
        title: articleTitleForReference || `Simulated Title for ${articleId}`,
        description: `Simulated description for ${articleId}. This is placeholder text. The real description would contain relevant information for detection. Sometimes, names appear only in descriptions.`,
        content: `Simulated full content for ${articleId}. This placeholder content needs to be replaced with actual article text to test the politician detection realistically. For example, a sentence might be: 'השר יאיר לפיד נאם בכנסת, בעוד שחבר הכנסת בני גנץ הקשיב לדבריו. גם רונן ברגמן הוזכר בהקשר אחר, ולא רונן בר.' This demonstrates potential matches and non-matches.`,
        link: `http://example.com/articles/${articleId}` // Keep link for reference
    };
}
// --- End Simulation ---

async function main() {
    console.log("Starting politician detection refinement process...");

    let politicians;
    try {
        const politiciansData = await fs.readFile(POLITICIANS_PATH, 'utf8');
        politicians = JSON.parse(politiciansData);
        console.log(`Loaded ${politicians.length} politicians from ${POLITICIANS_PATH}`);
    } catch (err) {
        console.error(`Error loading politicians.json: ${err.message}`);
        process.exit(1);
    }

    let feedbackEntries;
    try {
        const feedbackData = await fs.readFile(FEEDBACK_PATH, 'utf8');
        feedbackEntries = JSON.parse(feedbackData);
        console.log(`Loaded ${feedbackEntries.length} feedback entries from ${FEEDBACK_PATH}`);
    } catch (err) {
        console.error(`Error loading feedback.json: ${err.message}. If it's the first run, create an empty JSON array '[]'.`);
        feedbackEntries = []; // Start with empty if not found, to allow first run
    }

    const stillUnresolvedFeedback = [];
    const suggestionsLog = [`# Politician Detection Refinement Suggestions (${new Date().toISOString()})\n`];

    for (const feedbackItem of feedbackEntries) {
        const articleId = feedbackItem.articleId;
        const articleTitle = feedbackItem.articleTitleForReference;
        suggestionsLog.push(`\n## Processing Article ID: ${articleId} (Title: ${articleTitle || 'N/A'})`);

        const articleData = await getArticleContentById(articleId, articleTitle);
        if (!articleData) {
            suggestionsLog.push(`  - ERROR: Could not retrieve article data for ${articleId}. Skipping.`);
            stillUnresolvedFeedback.push(feedbackItem); // Keep it for next time
            continue;
        }

        // Use the core detection logic.
        // Note: enhancedPoliticianDetection might have dependencies like scrapeArticleContent not available here.
        // We might need to call findPoliticianMentions more directly after cleaning.
        let detectedForArticle = [];
        let combinedText = `${articleData.title || ''} ${articleData.description || ''} ${articleData.content || ''}`;
        
        // Basic cleaning similar to what enhancedPoliticianDetection might do
        let textForDetection = cleanText(combinedText, true, true, false); // removeHTML, removeURLs, !removePunctuation
        textForDetection = normalizeText(textForDetection);

        if (textForDetection.trim()) {
             detectedForArticle = findPoliticianMentions(textForDetection, politicians);
        } else {
            suggestionsLog.push("  - WARN: Article has no text content after cleaning. Cannot perform detection.");
        }
        
        let allIssuesInItemResolved = true;

        for (const issue of feedbackItem.reportedIssues) {
            const targetPoliticianName = issue.politicianName;
            const issueType = issue.type; // "missed" or "false_positive"
            
            const officialPoliticianEntry = politicians.find(p => p.name === targetPoliticianName);
            if (!officialPoliticianEntry) {
                suggestionsLog.push(`  - WARN (Issue for '${targetPoliticianName}'): Politician not found in politicians.json. Please check spelling or add entry.`);
                allIssuesInItemResolved = false; // This issue itself is a data problem
                continue; // Next issue
            }

            const isCurrentlyDetected = detectedForArticle.some(detected => detected.name === targetPoliticianName);

            if (issueType === "missed") {
                if (isCurrentlyDetected) {
                    suggestionsLog.push(`  - RESOLVED: Missed politician '${targetPoliticianName}' is now detected.`);
                }
                else {
                    allIssuesInItemResolved = false;
                    suggestionsLog.push(`  - UNRESOLVED (Missed): '${targetPoliticianName}' still not detected.`);
                    // Suggestion logic for missed:
                    const context = issue.contextSnippet || "";
                    const detailName = issue.detailsForMissed || "";
                    if (detailName && !officialPoliticianEntry.aliases.includes(detailName)) {
                        suggestionsLog.push(`    - SUGGESTION: Text in article was '${detailName}'. Consider adding this as an alias for '${targetPoliticianName}'. Context: "${context}"`);
                    }
                    else {
                        suggestionsLog.push(`    - INFO: Check word boundaries or normalization for '${targetPoliticianName}'. Context: "${context}"`);
                    }
                }
            }
            else if (issueType === "false_positive") {
                if (!isCurrentlyDetected) {
                    suggestionsLog.push(`  - RESOLVED: False positive for '${targetPoliticianName}' no longer occurs (not detected).`);
                }
                else {
                    allIssuesInItemResolved = false;
                    suggestionsLog.push(`  - UNRESOLVED (False Positive): '${targetPoliticianName}' is still detected.`);
                    suggestionsLog.push(`    - INFO: Investigate why '${targetPoliticianName}' is being matched. Context: "${issue.contextSnippet || ""}"`);
                    // More advanced: check if it's a substring of a longer name in the text.
                }
            }
        }
        if (!allIssuesInItemResolved) {
            stillUnresolvedFeedback.push(feedbackItem);
        }
    }

    try {
        await fs.writeFile(SUGGESTIONS_PATH, suggestionsLog.join('\n'), 'utf8');
        console.log(`Refinement suggestions saved to ${SUGGESTIONS_PATH}`);
    } catch (err) {
        console.error(`Error writing suggestions file: ${err.message}`);
    }

    try {
        await fs.writeFile(FEEDBACK_PATH, JSON.stringify(stillUnresolvedFeedback, null, 2), 'utf8');
        console.log(`Feedback file updated: ${FEEDBACK_PATH}. ${stillUnresolvedFeedback.length} items remain.`);
    } catch (err) {
        console.error(`Error updating feedback.json: ${err.message}`);
    }

    console.log("Refinement process complete.");
}

main().catch(console.error); 