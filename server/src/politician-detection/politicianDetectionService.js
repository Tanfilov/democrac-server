const fs = require('fs');

// --- Constants ---
const HEBREW_PREFIXES = ['', 'ל', 'מ', 'ב', 'ו', 'ש', 'ה'];
const WORD_BOUNDARIES = [' ', '.', ',', ':', ';', '?', '!', '"', "'", '(', ')', '[', ']', '{', '}', '\\n', '\\t'];
const POSITION_MAP = {
    'ראש הממשלה': 'ראש הממשלה',
    'רה"מ': 'ראש הממשלה',
    'ראש ממשלת ישראל': 'ראש הממשלה', // Added from a later version for completeness
    'ראש האופוזיציה': 'ראש האופוזיציה',
    'יו"ר האופוזיציה': 'ראש האופוזיציה', // Added from a later version
    'שר הביטחון': 'שר הביטחון',
    'שר האוצר': 'שר האוצר',
    'שר החוץ': 'שר החוץ',
    'שר הפנים': 'שר הפנים',
    'השר לביטחון לאומי': 'השר לביטחון לאומי',
    'יושב ראש הכנסת': 'יושב ראש הכנסת',
    'נשיא המדינה': 'נשיא המדינה',
    'הנשיא': 'נשיא המדינה',
    'רמטכ"ל': 'הרמטכ"ל', // Added from a later version
    'הרמטכ"ל': 'הרמטכ"ל' // Added from a later version
};

// --- Utility Functions ---

function escapeRegExp(string) {
  if (typeof string !== 'string') return '';
  return string.replace(/[.*+?^${}()|[\]\\\\]/g, '\\\\$&');
}

function findAllOccurrences(text, subtext) {
  if (!text || !subtext) return [];
  const indexes = [];
  let i = -1;
  while ((i = text.indexOf(subtext, i + 1)) !== -1) {
    indexes.push(i);
  }
  return indexes;
}

function isInsideQuotes(text, startPos) {
  if (!text || typeof startPos !== 'number') return false;
  let quoteCount = 0;
  for (let i = 0; i < startPos; i++) {
    if (text[i] === '"') quoteCount++;
  }
  return quoteCount % 2 === 1;
}

function normalizeText(text) {
    if (!text) return '';
    return text
        .replace(/["“״""]/g, '"') // Normalize various quote types to standard double quotes
        .replace(/['׳`'']/g, "'"); // Normalize various apostrophe types to standard single quotes
}

// --- Core Detection Helper Functions ---

function hasRequiredContext(text, politician, nameMatchIndex, nameLength) {
  if (!politician || !politician.requiresContext || !politician.contextIdentifiers || politician.contextIdentifiers.length === 0) {
    return true; // No context required or invalid input
  }
  if (!text || typeof nameMatchIndex !== 'number' || typeof nameLength !== 'number') return false;

  const windowSize = 200;
  const startWindow = Math.max(0, nameMatchIndex - windowSize);
  const endWindow = Math.min(text.length, nameMatchIndex + nameLength + windowSize);
  const textWindow = text.substring(startWindow, endWindow);

  return politician.contextIdentifiers.some(context => textWindow.includes(context));
}

function isExactMatch(text, word, boundaries, politician = null) {
  if (!text || !word || !boundaries) return false;
  
  const indexes = findAllOccurrences(text, word);

  for (const index of indexes) {
    const beforeChar = index === 0 ? ' ' : text[index - 1];
    const afterChar = index + word.length >= text.length ? ' ' : text[index + word.length];

    const isBoundaryMatch = (boundaries.includes(beforeChar) || index === 0) &&
                           (boundaries.includes(afterChar) || index + word.length === text.length);

    if (isBoundaryMatch) {
      if (politician && politician.requiresContext) {
        if (!hasRequiredContext(text, politician, index, word.length)) {
          continue; 
        }
      }
      return true;
    }

    // Lenient check if inside quotes
    if (isInsideQuotes(text, index)) {
      const isSpaceOrBoundaryBefore = beforeChar === ' ' || boundaries.includes(beforeChar);
      const isSpaceOrBoundaryAfter = afterChar === ' ' || boundaries.includes(afterChar);
      if (isSpaceOrBoundaryBefore && isSpaceOrBoundaryAfter) {
        if (politician && politician.requiresContext) {
          if (!hasRequiredContext(text, politician, index, word.length)) {
            continue;
          }
        }
        return true;
      }
    }
  }
  return false;
}

function isModifiedPosition(text, position) {
  if (!text || !position) return false;
  const positionIndex = text.indexOf(position);
  if (positionIndex < 0) return false;

  const beforeText = text.substring(Math.max(0, positionIndex - 30), positionIndex);
  const afterText = text.substring(positionIndex + position.length, Math.min(text.length, positionIndex + position.length + 30));

  const formerModifiers = ['לשעבר', 'הקודם', 'היוצא', 'לקודם', 'הזמני'];
  for (const modifier of formerModifiers) {
    if (afterText.trim().startsWith(modifier) || afterText.match(new RegExp(`^[ \\t,.;:]+${modifier}`))) return true;
  }

  const futureModifiers = ['הבא', 'העתידי', 'המיועד', 'יהיה', 'יכהן', 'הנכנס'];
  for (const modifier of futureModifiers) {
    if (afterText.trim().startsWith(modifier) || afterText.match(new RegExp(`^[ \\t,.;:]+${modifier}`))) return true;
  }

  const conditionalModifiers = ['מי ש', 'אילו היה', 'אם יהיה', 'עשוי להיות', 'עלול להיות', 'היה '];
  for (const modifier of conditionalModifiers) {
    if (beforeText.trim().endsWith(modifier) || beforeText.includes(modifier + position)) return true;
  }
  
  if (afterText.match(/בממשלת|בממשל/) ||
      afterText.match(/הראשונה|השנייה|השלישית|הרביעית/) ||
      afterText.match(/הקודמת|היוצאת|הזמנית/)) {
    return true;
  }

  if (afterText.match(/[ \\t,.;:]*של[ \\t]+[א-ת]/)) return true;

  const foreignIndicators = [
    'אמריקאי', 'אמריקאית', 'אמריקה', 'ארצות הברית', 'ארה"ב', 'ארהב',
    'בריטי', 'בריטית', 'בריטניה', 'אנגלי', 'אנגליה',
    'צרפתי', 'צרפתית', 'צרפת', 'רוסי', 'רוסית', 'רוסיה',
    'גרמני', 'גרמנית', 'גרמניה', 'סיני', 'סינית', 'סין',
    'הודי', 'הודית', 'הודו', 'יפני', 'יפנית', 'יפן',
    'קנדי', 'קנדית', 'קנדה', 'אוסטרלי', 'אוסטרלית', 'אוסטרליה',
    'אירופי', 'אירופית', 'אירופה', 'ערבי', 'ערבית', 'ערב',
    'איראני', 'איראנית', 'איראן', 'האיראני', 'האיראנית',
    'לבנוני', 'לבנונית', 'לבנון', 'סורי', 'סורית', 'סוריה',
    'טורקי', 'טורקית', 'טורקיה', 'מצרי', 'מצרית', 'מצרים',
    'ירדני', 'ירדנית', 'ירדן', 'הזר', 'זרה', 'זר'
  ];
  const afterPositionClose = afterText.substring(0, Math.min(30, afterText.length));
  const beforePositionClose = beforeText.substring(Math.max(0, beforeText.length - 30));
  for (const indicator of foreignIndicators) {
    if (afterPositionClose.includes(indicator) || beforePositionClose.includes(indicator)) return true;
  }
  return false;
}

function getPartialNameIndicators(fullName) {
  if (!fullName) return [];
  const parts = [];
  const nameParts = fullName.split(' ');
  if (nameParts.length > 1 && nameParts[nameParts.length - 1].length >= 3) {
    parts.push(nameParts[nameParts.length - 1]);
  }
  // Specific known cases from detection-fix.js
  if (fullName === 'יצחק הרצוג') parts.push('הרצוג', 'בוז׳י', 'בוזי');
  else if (fullName === 'בנימין נתניהו') parts.push('ביבי', 'נתניהו'); // Added נתניהו as per detection.js
  else if (fullName === 'יאיר לפיד') parts.push('לפיד');
  else if (fullName === 'גדי איזנקוט') parts.push('איזנקוט'); // From detection.js nicknameMap
  else if (fullName === 'בני גנץ') parts.push('גנץ'); // From detection.js nicknameMap
  // Consider adding more from nicknameMap from original detection.js if they are partial and not full aliases
  return [...new Set(parts)]; // Ensure unique
}

function isStandaloneWord(text, word) {
  if(!text || !word) return false;
  const wordBoundariesEscaped = WORD_BOUNDARIES.map(b => escapeRegExp(b)).join('');
  const regex = new RegExp(`(^|[${wordBoundariesEscaped}"'])${escapeRegExp(word)}($|[${wordBoundariesEscaped}"'])`, 'i');
  return regex.test(text);
}

// --- Main Detection Functions ---

function findPoliticianMentions(text, POLITICIANS) {
  if (!text || !POLITICIANS || !Array.isArray(POLITICIANS)) return [];

  const _normalizedText = normalizeText(text);
  const detectedPoliticians = new Set();

  POLITICIANS.forEach(politician => {
    const politicianName = politician.name || politician.he; // Support 'he' field for name
    if (!politicianName) return;

    let detectedThisPolitician = false;

    // 1. Check exact full name
    for (const prefix of HEBREW_PREFIXES) {
      const nameWithPrefix = prefix + politicianName;
      if (isExactMatch(_normalizedText, nameWithPrefix, WORD_BOUNDARIES, politician)) {
        detectedPoliticians.add(politicianName);
        detectedThisPolitician = true;
        break;
      }
    }
    if (detectedThisPolitician) return; // Already found by full name

    // 2. Check aliases
    if (politician.aliases && politician.aliases.length > 0) {
      for (const alias of politician.aliases) {
        if (alias.length < 2) continue; // Original was <3, but some last names can be 2 (e.g. כץ)
        for (const prefix of HEBREW_PREFIXES) {
          const aliasWithPrefix = prefix + alias;
          if (isExactMatch(_normalizedText, aliasWithPrefix, WORD_BOUNDARIES, politician)) {
            detectedPoliticians.add(politicianName);
            detectedThisPolitician = true;
            break;
          }
        }
        if (detectedThisPolitician) break;
      }
    }
  });

  // 3. Position-based detection (from detection-fix.js)
  Object.entries(POSITION_MAP).forEach(([positionTerm, standardPosition]) => {
    for (const prefix of HEBREW_PREFIXES) {
      const posWithPrefix = prefix + positionTerm;
      if (isExactMatch(_normalizedText, posWithPrefix, WORD_BOUNDARIES)) { // No politician object for context here
        if (isModifiedPosition(_normalizedText, posWithPrefix)) {
          continue;
        }
        const politiciansWithPosition = POLITICIANS.filter(p =>
          (p.position === standardPosition) || (p.role === standardPosition)
        );

        if (politiciansWithPosition.length > 0) {
          const politician = politiciansWithPosition[0]; // Assuming first one is the current one
          const politicianName = politician.name || politician.he;
          if (!politicianName) continue;

          const positionIndex = _normalizedText.indexOf(posWithPrefix);
          const windowSize = 200;
          const contextStart = Math.max(0, positionIndex - windowSize);
          const contextEnd = Math.min(_normalizedText.length, positionIndex + posWithPrefix.length + windowSize);
          const context = _normalizedText.substring(contextStart, contextEnd);
          
          const nameParts = getPartialNameIndicators(politicianName);
          const hasPartialNameIndicator = nameParts.some(part =>
            context.includes(part) && isStandaloneWord(context, part)
          );

          if (hasPartialNameIndicator) {
            detectedPoliticians.add(politicianName);
          }
        }
      }
    }
  });
  return Array.from(detectedPoliticians);
}

// --- Relevance Scoring Helpers (Integrated from relevance-scoring.js) ---

function _findAllPositions(text, term) { // Renamed to avoid conflict if imported elsewhere
    if (!text || !term) return [];
    const indexes = [];
    let i = -1;
    const escapedTerm = escapeRegExp(term);
    const regex = new RegExp(`(^|\\s|[\\"'\`.,;:!?()[\\]{}])${escapedTerm}(?=$|\\s|[\\"'\`.,;:!?()[\\]{}])`, 'g');
    let match;
    while ((match = regex.exec(text)) !== null) {
        indexes.push(match.index + (match[1] ? match[1].length : 0));
    }
    return indexes;
}

function _containsQuotes(text) {
    if(!text) return false;
    const quoteRegex = /["״'`'']/; // More comprehensive quote check
    return quoteRegex.test(text);
}

function _containsAnyWord(text, words) {
    if(!text || !words || !words.length) return false;
    for (const word of words) {
        if (isStandaloneWord(text, word)) { // Use isStandaloneWord for better matching
            return true;
        }
    }
    return false;
}

function _countOccurrences(text, term) {
    if (!text || !term) return 0;
    return _findAllPositions(text, term).length;
}

function _countNearQuotes(text, term, windowSize = 100) {
    if (!text || !term) return 0;
    const positions = _findAllPositions(text, term);
    let nearQuoteCount = 0;
    positions.forEach(position => {
        const startWindow = Math.max(0, position - windowSize);
        const endWindow = Math.min(text.length, position + term.length + windowSize);
        const context = text.substring(startWindow, endWindow);
        if (_containsQuotes(context)) {
            nearQuoteCount++;
        }
    });
    return nearQuoteCount;
}

function _countInReactionContext(text, term, windowSize = 120) {
    if (!text || !term) return 0;
    const positions = _findAllPositions(text, term);
    let reactionContextCount = 0;
    const reactionVerbs = [
        'אמר', 'הגיב', 'התייחס', 'טען', 'ציין', 'ביקר', 'תקף', 'הבהיר', 
        'הדגיש', 'מסר', 'הצהיר', 'הודיע', 'כתב', 'פרסם', 'שיתף', 'הודה', 
        'הכחיש', 'קבע', 'הוסיף', 'הסביר', 'הזהיר', 'דרש', 'קרא ל'
    ];
    positions.forEach(position => {
        const startWindow = Math.max(0, position - windowSize);
        const endWindow = Math.min(text.length, position + term.length + windowSize);
        const context = text.substring(startWindow, endWindow);
        if (_containsAnyWord(context, reactionVerbs)) {
            reactionContextCount++;
        }
    });
    return reactionContextCount;
}


async function enhancedPoliticianDetection(article, POLITICIANS, scrapeArticleContent, updateArticleContent) {
  if (!article || !POLITICIANS || !Array.isArray(POLITICIANS)) return [];

  const detectedPoliticiansOverall = new Set();
  const politicianDetails = {}; // To store scores and reasons

  // Initialize details for all potential politicians
  POLITICIANS.forEach(p => {
      const name = p.name || p.he;
      if (name) {
        politicianDetails[name] = {
            name: name,
            score: 0,
            isRelevant: false,
            relevanceReason: [],
            mentions: { title: 0, description: 0, content: 0, earlyContent: 0, nearQuote: 0, inReactionContext: 0 },
            detectionMethods: []
        };
      }
  });
  
  const _normalizedTitle = normalizeText(article.title);
  const _normalizedDescription = normalizeText(article.description);
  let _normalizedContent = normalizeText(article.content);

  // Step 1: Initial detection using findPoliticianMentions
  if (article.title) {
    const titlePoliticians = findPoliticianMentions(_normalizedTitle, POLITICIANS);
    titlePoliticians.forEach(p => {
        detectedPoliticiansOverall.add(p);
        if(politicianDetails[p]) politicianDetails[p].detectionMethods.push('title_direct');
    });
  }
  if (article.description) {
    const descriptionPoliticians = findPoliticianMentions(_normalizedDescription, POLITICIANS);
    descriptionPoliticians.forEach(p => {
        detectedPoliticiansOverall.add(p);
        if(politicianDetails[p]) politicianDetails[p].detectionMethods.push('description_direct');
    });
  }

  // Step 2: Content Handling & Scraping
  if (!_normalizedContent && article.link && typeof scrapeArticleContent === 'function') {
    try {
      const scrapedContent = await scrapeArticleContent(article.link);
      if (scrapedContent) {
        _normalizedContent = normalizeText(scrapedContent);
        if (typeof updateArticleContent === 'function') {
          await updateArticleContent(article.id, _normalizedContent); // Save original non-normalized if preferred
        }
      }
    } catch (error) {
      console.error(`Error scraping content for article ${article.id}:`, error.message);
    }
  }

  if (_normalizedContent) {
    const contentPoliticiansDirect = findPoliticianMentions(_normalizedContent, POLITICIANS);
    contentPoliticiansDirect.forEach(p => {
        detectedPoliticiansOverall.add(p);
        if(politicianDetails[p]) politicianDetails[p].detectionMethods.push('content_direct');
    });

    // Step 3: Special Pattern Matching in Content (Quotes, Colons)
    POLITICIANS.forEach(politician => {
        const politicianName = politician.name || politician.he;
        if (!politicianName) return;

        const namesToMatch = [politicianName, ...(politician.aliases || [])].filter(n => n && n.length >=2);

        for (const name of namesToMatch) {
            const specialPatterns = [
                `:[^"]*"[^"]*\\\\b${escapeRegExp(name)}\\\\b[^"]*"`,
                `"[^"]*של\\\\s+${escapeRegExp(name)}[^"]*"`,
                `"[^"]*\\\\b${escapeRegExp(name)}\\\\b[^"]*"`
            ];
            for (const pattern of specialPatterns) {
                const regex = new RegExp(pattern, 'i');
                if (regex.test(_normalizedContent)) {
                    const match = _normalizedContent.match(regex);
                    if (match && (!politician.requiresContext || hasRequiredContext(_normalizedContent, politician, match.index, match[0].length))) {
                        detectedPoliticiansOverall.add(politicianName);
                        if(politicianDetails[politicianName]) politicianDetails[politicianName].detectionMethods.push('content_special_pattern');
                        break; 
                    }
                }
            }
            if (detectedPoliticiansOverall.has(politicianName) && politicianDetails[politicianName].detectionMethods.includes('content_special_pattern')) break;

            const colonPattern = new RegExp(`:[^:]*\\\\b${escapeRegExp(name)}\\\\b`, 'i');
            if (colonPattern.test(_normalizedContent)) {
                 const match = _normalizedContent.match(colonPattern);
                 if (match && (!politician.requiresContext || hasRequiredContext(_normalizedContent, politician, match.index, match[0].length))) {
                    detectedPoliticiansOverall.add(politicianName);
                    if(politicianDetails[politicianName]) politicianDetails[politicianName].detectionMethods.push('content_colon_pattern');
                    break;
                 }
            }
             if (detectedPoliticiansOverall.has(politicianName) && politicianDetails[politicianName].detectionMethods.includes('content_colon_pattern')) break;
        }
    });
  }
  
  // Step 4: Relevance Scoring for all detected politicians
  const uniqueDetectedNames = Array.from(detectedPoliticiansOverall);
  
  const contentLength = _normalizedContent ? _normalizedContent.length : 0;
  const earlyContentThreshold = Math.min(500, contentLength * 0.2);
  const earlyContentText = _normalizedContent ? _normalizedContent.substring(0, earlyContentThreshold) : "";
  const fullTextForScoring = `${_normalizedTitle || ''} ${_normalizedDescription || ''} ${_normalizedContent || ''}`;


  uniqueDetectedNames.forEach(name => {
    const detail = politicianDetails[name];
    if (!detail) return;

    detail.mentions.title = _countOccurrences(_normalizedTitle, name);
    detail.mentions.description = _countOccurrences(_normalizedDescription, name);
    detail.mentions.content = _countOccurrences(_normalizedContent, name);
    detail.mentions.earlyContent = _countOccurrences(earlyContentText, name);
    detail.mentions.nearQuote = _countNearQuotes(fullTextForScoring, name);
    detail.mentions.inReactionContext = _countInReactionContext(fullTextForScoring, name);

    // Apply scoring rules (from scorePoliticianRelevance)
    if (detail.mentions.title > 0 || detail.mentions.description > 0) {
        detail.isRelevant = true;
        detail.relevanceReason.push("Mentioned in title or description");
        detail.score += detail.mentions.title * 10;
        detail.score += detail.mentions.description * 5;
    } else if (detail.mentions.content > 0) {
        if (detail.mentions.content > 1) {
            detail.isRelevant = true;
            detail.relevanceReason.push("Mentioned multiple times in content");
            detail.score += detail.mentions.content;
        }
        if (detail.mentions.earlyContent > 0) {
            detail.isRelevant = true;
            detail.relevanceReason.push("Mentioned early in content");
            detail.score += 3;
        }
        if (detail.mentions.nearQuote > 0 || detail.mentions.inReactionContext > 0) {
            detail.isRelevant = true;
            if (detail.mentions.nearQuote > 0) {
                detail.relevanceReason.push("Mentioned near quotes");
                detail.score += detail.mentions.nearQuote * 2;
            }
            if (detail.mentions.inReactionContext > 0) {
                detail.relevanceReason.push("Mentioned in reaction context");
                detail.score += detail.mentions.inReactionContext * 3;
            }
        }
        if (!detail.isRelevant) {
            detail.relevanceReason.push("Background mention only");
             detail.score += 1; // Small score for any content mention
        }
    }
    // Ensure detectionMethods are unique
    if (detail.detectionMethods.length > 0) detail.detectionMethods = [...new Set(detail.detectionMethods)];
  });

  // Step 5: Filter based on relevance and score (from getRelevantPoliticians)
  const scoredPoliticians = Object.values(politicianDetails)
                                .filter(p => detectedPoliticiansOverall.has(p.name)) // only those actually detected
                                .sort((a, b) => b.score - a.score);

  // Default filtering options (can be parameterized later if needed)
  const filterOptions = { maxCount: 10, minScore: 1 }; // Increased maxCount slightly
  
  let relevantPoliticiansOutput = scoredPoliticians.filter(p => p.isRelevant && p.score >= filterOptions.minScore);

  if (relevantPoliticiansOutput.length === 0 && scoredPoliticians.length > 0) {
    const politiciansWithMinScore = scoredPoliticians.filter(p => p.score >= filterOptions.minScore);
    if (politiciansWithMinScore.length > 0) {
        // If no one is "relevant" by rule, but some have score, take top N (e.g. 3)
      relevantPoliticiansOutput = politiciansWithMinScore.slice(0, Math.min(3, politiciansWithMinScore.length));
    }
  }
  
  // Special handling for specific politicians (e.g., lower threshold)
  // This was in the original prompt's summary of enhanced detection logic;
  // It implies a threshold filter AFTER scoring.
  const highConfidencePoliticians = [];
  const specialPoliticians = ['דונלד טראמפ', 'ג\'ו ביידן', 'קמאלה האריס', 'עמנואל מקרון']; // Example

  relevantPoliticiansOutput.slice(0, filterOptions.maxCount).forEach(p => {
      let threshold = 2; // Default confidence threshold
      if (specialPoliticians.includes(p.name)) {
          threshold = 1; // Lower threshold for special/foreign politicians
      }
      if (p.score >= threshold) {
          highConfidencePoliticians.push(p.name);
      }
  });
  
  // If after all this, no one is selected but there were initial detections,
  // return top 1-2 if they have at least some minimal score (e.g. 1)
  // This is to ensure we don't return empty when there were clear, albeit low-scoring, mentions.
  if (highConfidencePoliticians.length === 0 && uniqueDetectedNames.length > 0) {
      const topScoring = scoredPoliticians.filter(p => p.score >=1).slice(0,2);
      return topScoring.map(p=>p.name);
  }

  return highConfidencePoliticians;
}


// --- Politician Data Loading Utility ---
function loadPoliticians(politiciansFilePath) {
  try {
    const politiciansData = fs.readFileSync(politiciansFilePath, 'utf8');
    const politiciansList = JSON.parse(politiciansData);
    return politiciansList.map(p => ({
      name: p.name,
      he: p.he || p.name, // Ensure 'he' exists, defaulting to name
      en: p.en || p.name, // Ensure 'en' exists
      position: p.position,
      aliases: p.aliases || [],
      requiresContext: p.requiresContext || false,
      contextIdentifiers: p.contextIdentifiers || []
    }));
  } catch (error) {
    console.error(`Error loading politicians data from ${politiciansFilePath}:`, error);
    return [];
  }
}

module.exports = {
  findPoliticianMentions,
  enhancedPoliticianDetection,
  loadPoliticians,
  // Export helpers if they are to be used externally or for testing
  normalizeText,
  isExactMatch,
  hasRequiredContext,
  isModifiedPosition,
  getPartialNameIndicators,
  isStandaloneWord,
  isInsideQuotes,
  findAllOccurrences,
  escapeRegExp
}; 