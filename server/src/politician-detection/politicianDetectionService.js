const fs = require('fs');

// --- Constants ---
const HEBREW_PREFIXES = ['', 'ל', 'מ', 'ב', 'ו', 'ש', 'ה'];
const WORD_BOUNDARIES = [' ', '.', ',', ':', ';', '?', '!', '"', "'", '(', ')', '[', ']', '{', '}', '\\n', '\\t', '<', '>'];
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
        .replace(/["""]/g, '"') // Normalize various quote types to standard double quotes
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

function isNearOtherPoliticians(textWindow, currentPolitician, allPoliticians, boundaries) {
  if (!textWindow || !currentPolitician || !allPoliticians || !Array.isArray(allPoliticians)) {
    return false;
  }

  for (const otherPolitician of allPoliticians) {
    // Skip if it's the same politician we're checking context for
    if (otherPolitician.name === currentPolitician.name) {
      continue;
    }

    // Check other politician's main name
    // Pass null for 'politician' and 'allPoliticians' to isExactMatch to prevent recursive context checks
    if (isExactMatch(textWindow, otherPolitician.name, boundaries, null, null)) {
      return true;
    }

    // Check other politician's aliases
    if (otherPolitician.aliases && otherPolitician.aliases.length > 0) {
      for (const alias of otherPolitician.aliases) {
        if (alias.length < 2) continue;
        // Pass null for 'politician' and 'allPoliticians' to isExactMatch
        if (isExactMatch(textWindow, alias, boundaries, null, null)) {
          return true;
        }
      }
    }
  }
  return false;
}

function isExactMatch(text, word, boundaries, politician = null, allPoliticians = null) {
  if (!text || !word || !boundaries) return false;
  
  const indexes = findAllOccurrences(text, word);

  for (const index of indexes) {
    const beforeChar = index === 0 ? ' ' : text[index - 1];
    const afterChar = index + word.length >= text.length ? ' ' : text[index + word.length];

    const isBoundaryBefore = index === 0 || boundaries.includes(beforeChar) || beforeChar === '\n';
    const isBoundaryAfter = (index + word.length) >= text.length || boundaries.includes(afterChar);

    // --- START: Diagnostic logging for specific false positive investigation ---
    if (word.includes("רונן בר") || (politician && (politician.name === "רונן בר" || politician.he === "רונן בר"))) {
      const contextSnippet = text.substring(Math.max(0, index - 20), Math.min(text.length, index + word.length + 20));
      console.log(`[[isExactMatch DIAGNOSTIC]]
        Word: '${word}'
        Politician: ${politician ? (politician.name || politician.he) : 'N/A'}
        Index: ${index}
        BeforeChar: '${beforeChar}' (isBoundaryBefore: ${isBoundaryBefore})
        AfterChar: '${afterChar}' (isBoundaryAfter: ${isBoundaryAfter})
        Text Snippet: "...${contextSnippet}..."
      `);
    }
    // --- END: Diagnostic logging ---
    
    if (isBoundaryBefore && isBoundaryAfter) {
      if (politician && politician.requiresContext) {
        let contextMet = false;
        // 1. Check specific contextIdentifiers if they exist and allPoliticians is available for the next step
        if (politician.contextIdentifiers && politician.contextIdentifiers.length > 0) {
          if (hasRequiredContext(text, politician, index, word.length)) {
            contextMet = true;
          }
        }

        // 2. If not met by specific identifiers (and allPoliticians list is available), check for proximity to other politicians
        if (!contextMet && allPoliticians) { // Ensure allPoliticians is available
          const windowSize = 200; // Define context window size
          const startContextWindow = Math.max(0, index - windowSize);
          const endContextWindow = Math.min(text.length, index + word.length + windowSize);
          const textWindowForContext = text.substring(startContextWindow, endContextWindow);

          if (isNearOtherPoliticians(textWindowForContext, politician, allPoliticians, boundaries)) {
            contextMet = true;
          }
        }

        if (!contextMet) {
          continue; // Context requirements not met, try next occurrence of 'word'
        }
      }
      return true; // Match found (either no context required, or context was met)
    }

    // Lenient check if inside quotes (existing logic)
    if (isInsideQuotes(text, index)) {
      const isSpaceOrBoundaryBefore = beforeChar === ' ' || boundaries.includes(beforeChar) || beforeChar === '\n';
      const isSpaceOrBoundaryAfter = afterChar === ' ' || boundaries.includes(afterChar);
      if (isSpaceOrBoundaryBefore && isSpaceOrBoundaryAfter) {
        if (politician && politician.requiresContext) { // Repeat context check for quoted matches
          let contextMetInQuotes = false;
          if (politician.contextIdentifiers && politician.contextIdentifiers.length > 0) {
            if (hasRequiredContext(text, politician, index, word.length)) {
              contextMetInQuotes = true;
            }
          }
          if (!contextMetInQuotes && allPoliticians) {
            const windowSize = 200;
            const startContextWindow = Math.max(0, index - windowSize);
            const endContextWindow = Math.min(text.length, index + word.length + windowSize);
            const textWindowForContext = text.substring(startContextWindow, endContextWindow);
            if (isNearOtherPoliticians(textWindowForContext, politician, allPoliticians, boundaries)) {
              contextMetInQuotes = true;
            }
          }
          if (!contextMetInQuotes) {
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
    const politicianName = politician.name || politician.he;
    if (!politicianName) return;

    let detectedThisPolitician = false;

    // 1. Check exact full name
    for (const prefix of HEBREW_PREFIXES) {
      const nameWithPrefix = prefix + politicianName;
      if (isExactMatch(_normalizedText, nameWithPrefix, WORD_BOUNDARIES, politician, POLITICIANS)) {
        detectedPoliticians.add(politicianName);
        detectedThisPolitician = true;
        break;
      }
    }
    if (detectedThisPolitician) return; // Already found by full name

    // 2. Check aliases
    if (politician.aliases && politician.aliases.length > 0) {
      for (const alias of politician.aliases) {
        if (alias.length < 2) continue;
        for (const prefix of HEBREW_PREFIXES) {
          const aliasWithPrefix = prefix + alias;
          if (isExactMatch(_normalizedText, aliasWithPrefix, WORD_BOUNDARIES, politician, POLITICIANS)) {
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
      if (isExactMatch(_normalizedText, posWithPrefix, WORD_BOUNDARIES, null, null)) {
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
  // --- DEBUG LOGGING --- Removed for commit ---
  // console.log(`[[enhancedPoliticianDetection]] Processing Article ID: ${article.id}`);
  // console.log(`  Title length: ${article.title ? article.title.length : 'N/A'}`);
  // console.log(`  Description length: ${article.description ? article.description.length : 'N/A'}`);
  // console.log(`  Content length: ${article.content ? article.content.length : 'N/A'}`);
  // --- END DEBUG LOGGING ---

  // console.log('\n\n\n\n\n[[DEBUG]] Starting enhancedPoliticianDetection for article:', article.id); 
  if (!article || (!article.content && !article.description && !article.title)) {
    console.warn('Article has no content, description, or title. Skipping enhanced detection.', article.id);
    return [];
  }

  let fullText = article.content || '';
  let title = article.title || ''; // Make mutable
  let description = article.description || ''; // Make mutable

  // --- Start of new cleaning block for title, description, and fullText ---
  // console.log(`[[DEBUG]] Original title: "${title}"`);
  // console.log(`[[DEBUG]] Original description: "${description}"`);
  // console.log(`[[DEBUG]] Original fullText: "${fullText.substring(0, 200)}..."`);

  // Clean title
  title = title.replace(/<[^>]+>/g, ' '); // Strip HTML tags
  title = title.replace(/\[https?:\/\/[^\\\]]*?\]/g, ' '); // Remove [URL] placeholders
  title = title.replace(/https?:\/\/[^\s)]+/g, ' '); // Remove general URLs
  title = title.replace(/__IMAGE_URL__/g, ' '); // Remove image placeholders
  title = title.replace(/\s+/g, ' ').trim(); // Normalize whitespace

  // Clean description
  description = description.replace(/<[^>]+>/g, ' '); // Strip HTML tags
  description = description.replace(/\[https?:\/\/[^\\\]]*?\]/g, ' '); // Remove [URL] placeholders
  description = description.replace(/https?:\/\/[^\s)]+/g, ' '); // Remove general URLs
  description = description.replace(/__IMAGE_URL__/g, ' '); // Remove image placeholders
  description = description.replace(/\s+/g, ' ').trim(); // Normalize whitespace

  // Clean fullText
  fullText = fullText.replace(/<[^>]+>/g, ' '); // Strip HTML tags
  fullText = fullText.replace(/\[https?:\/\/[^\\\]]*?\]/g, ' '); // Remove [URL] placeholders
  fullText = fullText.replace(/https?:\/\/[^\s)]+/g, ' '); // Remove general URLs
  fullText = fullText.replace(/__IMAGE_URL__/g, ' '); // Remove image placeholders
  fullText = fullText.replace(/\s+/g, ' ').trim(); // Normalize whitespace
  
  // console.log(`[[DEBUG]] Cleaned title: "${title}"`);
  // console.log(`[[DEBUG]] Cleaned description: "${description}"`);
  // console.log(`[[DEBUG]] Cleaned fullText: "${fullText.substring(0,200)}..."`);
  // --- End of new cleaning block ---

  // If content is too short or missing, try to use description or scrape if function provided
  if (fullText.length < 200 && description.length > fullText.length) {
    fullText = description;
  }

  if (fullText.length < 200 && scrapeArticleContent && typeof scrapeArticleContent === 'function') {
    try {
      console.log(`Scraping article content for ID: ${article.id}, URL: ${article.link}`);
      const scrapedContent = await scrapeArticleContent(article.link);
      if (scrapedContent && scrapedContent.length > fullText.length) {
        fullText = scrapedContent;
        if (updateArticleContent && typeof updateArticleContent === 'function') {
          await updateArticleContent(article.id, fullText); // Update DB with full content
        }
      }
    } catch (error) {
      console.error(`Error scraping article ${article.id}:`, error);
    }
  }

  const combinedText = title + ' ' + description + ' ' + fullText;
  let _normalizedText = normalizeText(combinedText); // Make _normalizedText mutable
  _normalizedText = _normalizedText.replace(/\s+/g, ' ').trim(); // Normalize whitespace after combining and normalizing quotes

  // console.log(`[[DEBUG]] Combined and normalized _normalizedText for detection: ${_normalizedText.substring(0, 500)}`);

  const allDetectedMentions = new Set();

  // Split text into sentences (basic split by period, question mark, exclamation mark)
  // CORRECTED REGEX: Changed from /[.?!|פרסום ראשון:]+/ to /[.?!]+/ to preserve colons within sentences
  const sentences = _normalizedText.split(/[.?!]+/).filter(s => s.trim().length > 10);
  // console.log(`[[DEBUG]] Sentences array: ${JSON.stringify(sentences)}`); 

  // --- Regexes from detection-fix.js for specific patterns ---
  const saidRegex = /אמר\s+([א-ת"'\s]+)/g; // "אמר X"
  const accordingToRegex = /לדברי\s+([א-ת"'\s]+)/g; // "לדברי X"
  const ministerRegex = /שר\s+([א-ת]+)/g; // "שר X"
  const knessetMemberRegex = /(חבר הכנסת|ח"כ)\s+([א-ת]+)/g; // "ח"כ X"
  const chairmanRegex = /(יו"ר|יושב ראש)\s+([א-ת\s"'\-]+)/g; // "יו"ר X"
  const positionNameRegex = /(ראש הממשלה|שר הביטחון|שר האוצר|שר החוץ|יו"ר הכנסת|נשיא המדינה|הרמטכ"ל|ראש האופוזיציה)\s+([א-ת\s"'\-]+)/g;
  const formerPositionRegex = /(לשעבר|לפני כן|קודם לכן)\s+([א-ת\s"'\-]+)/g;
  const directQuoteRegex = /"([^"]+)"\s*(?:אמר|מסר|לדברי|הוסיף(?:ה)?)\s+([א-ת\s"'\-]+)/g; // "Quote" said X
  const colonRegex = /([^:]+):\s*\"([^\"]+)\"/g; // Speaker: "Quote"
  const netanyahuSpecialRegex = /(נתניהו|ראש הממשלה)(?:\s*[:]\s*|\s+אמר\s*|\s+טען\s*|\s+הוסיף\s*|\s+הגיב\s*)/g;
  const trumpSpecialRegex = /טראמפ(?:\s*[:]\s*|\s+אמר\s*|\s+טען\s*|\s+הוסיף\s*|\s+הגיב\s*)/g;
  const russianFormerRegex = /бывшего\\s+([А-Яа-яЁё\\s]+)/g; // For Russian "former X"

  // Process title and description separately first for higher relevance
  const titleMentions = findPoliticianMentions(title, POLITICIANS); // Now title is cleaned
  titleMentions.forEach(p => allDetectedMentions.add(p));

  const descriptionMentions = findPoliticianMentions(description, POLITICIANS); // Now description is cleaned
  descriptionMentions.forEach(p => allDetectedMentions.add(p));

  // Process sentences
  for (const sentence of sentences) {
    let sentenceToProcess = sentence;
    // Remove the __IMAGE_URL__ placeholder from the current sentence - This should be largely covered by upfront cleaning
    // but kept for safety if sentence splitting re-introduces or if some part was missed.
    sentenceToProcess = sentenceToProcess.replace(/__IMAGE_URL__/g, ' ').trim();
    // console.log(`[[DEBUG]] Processing sentence (URL placeholders removed): '${sentenceToProcess}'`);


    // Apply regexes to find potential mentions within the sentence context
    let match;

    // Handle "Speaker: \"Quote\""
    while ((match = colonRegex.exec(sentenceToProcess)) !== null) {
      const textBeforeColon = sentenceToProcess.substring(0, match.index);
      // console.log(`[[DEBUG]] ColonRegex: textBeforeColon = '${textBeforeColon}'`); 
      // CORRECTED: Use allPoliticians parameter
      const mentionsInSpeaker = findPoliticianMentions(textBeforeColon, POLITICIANS);
      // console.log(`[[DEBUG]] ColonRegex: mentionsInSpeaker for '${textBeforeColon}' = ${JSON.stringify(mentionsInSpeaker)}`); 
      mentionsInSpeaker.forEach(mention => {
        if (!allDetectedMentions.has(mention)) {
          allDetectedMentions.add(mention);
        }
      });
      // Also process the quoted part
      const textInQuotes = match[2]; // Content of the quote
      if (textInQuotes) {
        // console.log(`[[DEBUG]] ColonRegex: textInQuotes = '${textInQuotes}'`); 
        // CORRECTED: Use allPoliticians parameter
        const mentionsInQuoteText = findPoliticianMentions(textInQuotes, POLITICIANS, true); // pass true for isInsideQuotes
        // console.log(`[[DEBUG]] ColonRegex: mentionsInQuoteText for '${textInQuotes}' = ${JSON.stringify(mentionsInQuoteText)}`); 
        mentionsInQuoteText.forEach(mention => {
            if (!allDetectedMentions.has(mention)) {
                allDetectedMentions.add(mention);
            }
        });
      }
    }

    // Handle "Quote" said X
    while ((match = directQuoteRegex.exec(sentenceToProcess)) !== null) {
      // match[1] is the quote, match[2] is the speaker
      const speaker = match[2];
      if (speaker) {
        // CORRECTED: Use allPoliticians parameter
        const speakerMentions = findPoliticianMentions(speaker, POLITICIANS);
        speakerMentions.forEach(p => allDetectedMentions.add(p));
      }
      const inDirectQuotes = match[1];
      if (inDirectQuotes) {
        // CORRECTED: Use allPoliticians parameter
        const quoteMentions = findPoliticianMentions(inDirectQuotes, POLITICIANS);
        quoteMentions.forEach(p => allDetectedMentions.add(p));
      }
    }

    // General pass on the sentence itself (or remaining parts if regexes modified it)
    // CORRECTED: Use allPoliticians parameter
    const sentenceMentions = findPoliticianMentions(sentenceToProcess, POLITICIANS);
    sentenceMentions.forEach(p => allDetectedMentions.add(p));
  }

  // --- Relevance Scoring (Simplified - combines elements from relevance.js) ---
  const scoredPoliticians = [];
  const mentionDetails = {}; // politicianName: { count: 0, inTitle: false, inDescription: false, inContent: false, positions: [] }

  // Initialize scoring structure
  POLITICIANS.forEach(p => {
    const name = p.name || p.he;
    if (name) {
      mentionDetails[name] = { count: 0, inTitle: false, inDescription: false, inContent: false, positions: [] };
    }
  });

  // Populate mention details from allDetectedMentions and original text parts
  allDetectedMentions.forEach(politicianName => {
    if (mentionDetails[politicianName]) {
      // Count occurrences in title
      if (title.includes(politicianName)) {
          mentionDetails[politicianName].inTitle = true;
          mentionDetails[politicianName].count += findAllOccurrences(title, politicianName).length * 3; // Higher weight for title
      }
      // Count occurrences in description
      if (description.includes(politicianName)) {
          mentionDetails[politicianName].inDescription = true;
          mentionDetails[politicianName].count += findAllOccurrences(description, politicianName).length * 2; // Medium weight for description
      }
      // Count occurrences in main content (fullText)
      if (fullText.includes(politicianName)) {
          mentionDetails[politicianName].inContent = true;
          mentionDetails[politicianName].count += findAllOccurrences(fullText, politicianName).length;
      }

      // Check aliases too for counts (simplified)
      const politicianData = POLITICIANS.find(p => (p.name || p.he) === politicianName);
      if (politicianData && politicianData.aliases) {
        politicianData.aliases.forEach(alias => {
          if (title.includes(alias)) mentionDetails[politicianName].count += findAllOccurrences(title, alias).length * 3;
          if (description.includes(alias)) mentionDetails[politicianName].count += findAllOccurrences(description, alias).length * 2;
          if (fullText.includes(alias)) mentionDetails[politicianName].count += findAllOccurrences(fullText, alias).length;
        });
      }
    } else {
        // This case should ideally not happen if allDetectedMentions come from POLITICIANS list
        // but as a safeguard:
        mentionDetails[politicianName] = { count: 1, inTitle: title.includes(politicianName), inDescription: description.includes(politicianName), inContent: fullText.includes(politicianName), positions: [] };
    }
  });
  
  // Convert to scored list
  for (const name in mentionDetails) {
    if (mentionDetails[name].count > 0) {
      scoredPoliticians.push({ name, score: mentionDetails[name].count, details: mentionDetails[name] });
    }
  }

  // Sort by score
  scoredPoliticians.sort((a, b) => b.score - a.score);

  // Select top N politicians (e.g., top 5 or those above a score threshold)
  const RELEVANT_POLITICIAN_THRESHOLD = 1; // Example: min score to be considered relevant
  const MAX_RELEVANT_POLITICIANS = 7;    // Example: max number of relevant politicians

  const relevantPoliticians = scoredPoliticians
    .filter(p => p.score >= RELEVANT_POLITICIAN_THRESHOLD)
    .slice(0, MAX_RELEVANT_POLITICIANS)
    .map(p => p.name);

  // Return unique names
  return [...new Set(relevantPoliticians)];
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
  escapeRegExp,
  isNearOtherPoliticians
}; 