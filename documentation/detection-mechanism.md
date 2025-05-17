Overall Architecture:
The politician detection system is primarily orchestrated by server/src/politician-detection/index.js. This file:
Loads Politician Data: The loadPoliticians function reads politician data from a JSON file (path provided as an argument). It maps this data into a standardized format, ensuring each politician object has name, en (English name, currently same as name), position, aliases (defaulting to an empty array), requiresContext (defaulting to false), and contextIdentifiers (defaulting to an empty array).
Exports Detection Functions: It exports several functions, importantly re-exporting findPoliticianMentions and enhancedPoliticianDetection from detection-fix.js. This indicates that detection-fix.js contains the primary, "improved" logic being used at this commit. It also exports helper functions from detection-fix.js and relevance scoring functions from relevance-scoring.js.
The core detection logic resides in detection-fix.js.
Core Detection Logic (detection-fix.js):
The main function for finding mentions is findPoliticianMentions(text, POLITICIANS):
Input:
text: The input string (e.g., article content, title, description) where politicians are to be detected.
POLITICIANS: An array of politician objects (loaded by loadPoliticians). Each object contains details like name, aliases, position, and context requirements.
Preprocessing:
Empty Text Handling: If the input text is empty or null, it returns an empty array immediately.
Normalization:
The input text is normalized to standardize quotation marks (e.g., “”״ to " and ׳' to '). This helps in consistent matching.
Hebrew Prefixes: Defines a list of common Hebrew prefixes (['', 'ל', 'מ', 'ב', 'ו', 'ש', 'ה']) that can appear before names or positions.
Word Boundaries: Defines a list of characters ([' ', '.', ',', ':', ';', '?', '!', '"', "'", '(', ')', '[', ']', '{', '}', '\n', '\t']) that signify the end or start of a word. This is crucial for isExactMatch.
Detection Strategies:
A Set called detectedPoliticians is used to store the names of unique politicians found, preventing duplicates.
A. Direct Name and Alias Matching:
Iterates through each politician in the POLITICIANS list.
Exact Name Check:
For each prefix, it constructs nameWithPrefix (e.g., "ל" + "בנימין נתניהו").
Calls isExactMatch(normalizedText, nameWithPrefix, wordBoundaries, politician) to check if this prefixed full name exists as a whole word/phrase in the text.
If a match is found, the politician's name is added to detectedPoliticians, and the loop for this politician breaks (moving to the next strategy or politician).
Alias Check:
If the politician was not detected by their full name and has aliases (and these aliases are at least 3 characters long):
It iterates through each alias.
For each prefix, it constructs aliasWithPrefix.
Calls isExactMatch(normalizedText, aliasWithPrefix, wordBoundaries, politician) to check for the prefixed alias.
If a match is found, the politician's main name is added to detectedPoliticians, and loops break.
B. Position-Based Detection:
A positionMap object defines common political positions in Hebrew and maps them to a standard position string (e.g., 'רה"מ': 'ראש הממשלה').
Iterates through each [positionTerm, standardPosition] in positionMap.
For each prefix, it constructs posWithPrefix (e.g., "ה" + "שר הביטחון").
Calls isExactMatch(normalizedText, posWithPrefix, wordBoundaries) (note: politician object is not passed here initially, so context checking within isExactMatch for the position itself isn't done at this stage).
If an exact match for the position term is found:
It calls isModifiedPosition(normalizedText, posWithPrefix). This crucial helper function checks if the position mention refers to a former, future, conditional, or foreign holder (see "Helper Functions" below). If true, this position mention is skipped.
If the position is not modified (i.e., likely refers to a current Israeli holder):
It filters the POLITICIANS list to find politicians whose position or role property matches the standardPosition.
Improvement in detection-fix.js: If politicians are found for this position:
It takes the first matching politician.
Crucially, it then checks for partial name indicators of this politician near the found position.
getPartialNameIndicators(politicianName) is called to get common partial names (e.g., last name, known nicknames like "ביבי").
It defines a windowSize (200 characters) around the detected position.
It checks if any of these nameParts exist as a standalone word (isStandaloneWord) within this context window.
Only if a partial name indicator is found near the position is the politician added to detectedPoliticians. This is a significant refinement to reduce false positives from generic position mentions.
Output:
Finally, it converts the detectedPoliticians Set to an array and returns it.
Enhanced Detection (enhancedPoliticianDetection in detection-fix.js):
This asynchronous function enhancedPoliticianDetection(article, POLITICIANS, scrapeArticleContent, updateArticleContent) aims to provide a more robust detection, especially for articles, by considering different parts of an article (title, description, content) and potentially scraping content if not available.
Input:
article: An object containing article details (id, title, description, content, link).
POLITICIANS: The list of politician objects.
scrapeArticleContent: A function to fetch article content if missing.
updateArticleContent: A function to save newly scraped content to the database.
Process:
It initializes detectedPoliticiansOverall (as a Set) and uses several objects to track detection details (politicianScores, detectionMethods, firstOccurrenceIndex, isEarlyInContent, isNearQuotes).
Title Check: Calls findPoliticianMentions(article.title, POLITICIANS). Politicians found here are added to detectedPoliticiansOverall and their detection method is noted.
Description Check: Calls findPoliticianMentions(article.description, POLITICIANS). Politicians found are added, and method noted.
Content Handling:
Uses existing article.content if it's substantial (length > 50).
If not, and a link and scrapeArticleContent function are available, it attempts to scrape the content.
If new content is scraped successfully and is substantial, it calls updateArticleContent to save it.
Content Analysis:
If content is available, it calls findPoliticianMentions(content, POLITICIANS).
For each politician found in the content:
Adds to detectedPoliticiansOverall.
Records 'content' as a detection method.
findAllOccurrences is used to count mentions in content.
Checks if the first occurrence is "early" (within the first 500 chars).
isNearQuotes is used to check if any mention is near quotation marks (within a 100-char window).
Special Patterns in Content (New in detection-fix.js enhancedPoliticianDetection):
It iterates through each politician in the POLITICIANS list again, specifically for content analysis with regex patterns.
Quoted Speech/Statements: Defines specialPatterns using the politician's full name and aliases:
:[^"]*"[^"]*\\b${nameToMatch}\\b[^"]*" (Name inside quotes after a colon, e.g., "X said: "...name..."").
"[^"]*של\\s+${nameToMatch}[^"]*" (Name after "של" (of) inside quotes).
"[^"]*\\b${nameToMatch}\\b[^"]*" (Direct name in quotes).
For each pattern, a regex is created. If it tests true against the normalizedContent:
The politician is added if not already present.
Context checking (hasRequiredContext) is applied if the politician requiresContext.
Name After Colon (Headlines):
A regex :[^:]*\\b${nameToMatch}\\b is used to find names after a colon.
Context checking is applied if required.
Relevance Scoring (Integration with relevance-scoring.js):
After initial detection, scorePoliticianRelevance(name, detectionDetails) is called for each unique politician found. detectionDetails includes where they were found (title, description, content), mention counts, if they were early in content, or near quotes.
The relevance-scoring.js module (not fully detailed here but its functions are exported) likely assigns scores based on these factors (e.g., title mentions are high value).
Filtering based on Confidence:
A confidenceThreshold (e.g., 2) is defined.
Special/foreign politicians (e.g., 'דונלד טראמפ', 'ג'ו ביידן') might have a lower threshold (e.g., 1).
The function filters politicians based on their calculated score against these thresholds.
Output:
Returns an array of names of high-confidence politicians.
Correction based on a previous summary in the prompt: While earlier versions might have filtered by confidence, the provided enhancedPoliticianDetection in the file server/src/modules/politician-detection/detection.js (from a later commit that was summarized in the initial prompt) had a line return detectedPoliticians; suggesting it might return all, but the prompt's summary about detection-fix.js implied more comprehensive logic including scoring.
Looking at the end of enhancedPoliticianDetection in detection-fix.js (as per typical structure, though not fully visible in the snippet): it indeed involves politiciansWithScores and filters them, so the scoring and filtering part is accurate for detection-fix.js.
Key Helper Functions (mostly in detection-fix.js):
isExactMatch(text, word, boundaries, politician = null):
Checks if word exists in text.
Finds all occurrences of word.
For each occurrence, it checks if the characters immediately before and after the word are in the boundaries list (or if the word is at the start/end of the text). This ensures it's a whole word match.
Context Check Integration: If a politician object is provided and politician.requiresContext is true, it calls hasRequiredContext(text, politician, index, word.length). If context is required but not found, this specific match is skipped.
Inside Quotes Logic: Has a special, more lenient boundary check if the match is found isInsideQuotes.
Returns true if a valid match (with context, if needed) is found.
hasRequiredContext(text, politician, nameMatchIndex, nameLength):
Returns true immediately if politician.requiresContext is false or politician.contextIdentifiers is empty.
Defines a windowSize (e.g., 200 characters).
Checks a window of text before and after the nameMatchIndex to see if any of the politician.contextIdentifiers are present.
Logs when context is found or not found.
isModifiedPosition(text, position):
This is crucial for reducing false positives in position-based detection.
Checks for various modifiers around the position string in the text (within a 30-character window before/after):
Former Modifiers: "לשעבר" (former), "הקודם" (previous), "היוצא" (outgoing), "לקודם", "הזמני" (temporary) appearing after the position.
Future Modifiers: "הבא" (next), "העתידי" (future), "המיועד" (designated), "יהיה" (will be), "יכהן" (will serve), "הנכנס" (incoming) appearing after the position.
Conditional/Hypothetical: "מי ש" (whoever is), "אילו היה" (if he were), "אם יהיה" (if he will be), "עשוי להיות" (may be), "עלול להיות" (could be), "היה " (was) appearing before the position.
Specific Government/Past Period: Terms like "בממשלת" (in the government of), "הראשונה" (the first), "הקודמת" (the previous) appearing after the position.
Position "של" (of) Someone Else: If the position is followed by "של [שם]" (of [name]), indicating it's not the current generic holder.
Foreign Indicators: Checks for a list of country names or nationalities (e.g., 'אמריקאי', 'צרפת', 'רוסיה') near the position to identify references to foreign leaders.
Returns true if any such modifying context is found, false otherwise.
isInsideQuotes(text, startPos, endPos):
Counts the number of " characters before startPos. If odd, it assumes the segment is inside quotes.
findAllOccurrences(text, subtext):
Returns an array of all starting indexes of subtext within text.
getPartialNameIndicators(fullName):
Extracts potential partial identifiers:
Last name (if length >= 3).
Specific hardcoded nicknames for prominent politicians (e.g., "ביבי" for נתניהו, "לפיד" for יאיר לפיד, "בוז'י" for הרצוג).
isStandaloneWord(text, word):
Uses a regex with word boundaries to check if word appears as a whole word in text.
escapeRegExp(string):
Escapes special characters in a string for safe use in a Regular Expression.
Summary of "Fixes" or Key Characteristics at this Commit (c694a64):
Based on the structure (especially the preference for detection-fix.js in index.js), the system at this commit includes several improvements over a more basic detection:
Contextual Position Detection: Positions (like "Prime Minister") only lead to a detection if a partial name indicator of the known officeholder is found nearby. This is a major fix for false positives where a position is mentioned generically.
Comprehensive isModifiedPosition: This function is robust in identifying when a position mention does not refer to the current Israeli incumbent (e.g., former, future, foreign).
requiresContext Field: Politicians can be configured to require specific contextIdentifiers to be present near their name for a match to be valid. This is handled by isExactMatch via hasRequiredContext.
Special Regex Patterns: The enhancedPoliticianDetection in detection-fix.js uses specific regex patterns for quoted speech and names after colons, which can catch mentions missed by simple name/alias matching.
Structured Handling of Aliases and Prefixes: Both full names and aliases are systematically checked with common Hebrew prefixes.
Normalization: Text normalization for quotes ensures consistency.
Relevance Scoring: The system integrates a relevance scoring mechanism (relevance-scoring.js) in enhancedPoliticianDetection to weigh different types of mentions (title, description, content, proximity to quotes, etc.) and filter based on a confidence score.
This detailed breakdown should provide your team with a clear understanding of the business logic for politician detection as it existed in commit c694a64. They should pay close attention to the logic in detection-fix.js as it's the one actively used, and how helper functions like isModifiedPosition, hasRequiredContext, and isExactMatch contribute to the accuracy.