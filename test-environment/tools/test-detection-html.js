/**
 * Politician Detection HTML Report Generator
 * 
 * This tool creates an HTML report showing detected politicians in articles
 * with context highlighting for clear visualization of detection accuracy.
 */

const fs = require('fs');
const path = require('path');
const { loadPoliticians, findPoliticianMentions } = require('../../../src/politician-detection/politicianDetectionService');
const { exec } = require('child_process');
const os = require('os');

const POLITICIANS_FILE = path.join(__dirname, '../../../../data/politicians/politicians.json');
const ALL_POLITICIANS = loadPoliticians(POLITICIANS_FILE);

const testCases = [
    { text: "נפגש עם ראש הממשלה בנימין נתניהו ועם יו\"ר האופוזיציה יאיר לפיד.", expected: ["בנימין נתניהו", "יאיר לפיד"] },
    { text: "שר הביטחון יואב גלנט אישר את התוכניות.", expected: ["יואב גלנט"] },
    { text: "איתמר בן גביר דורש להגביר את האכיפה.", expected: ["איתמר בן גביר"] },
    { text: "אין כאן שמות של פוליטיקאים, רק טקסט רגיל.", expected: [] },
    { text: "בצלאל סמוטריץ\' הגיע להסכמות עם משרד ראש הממשלה.", expected: ["בצלאל סמוטריץ\'"] },
    { text: "בנימין נתניהו וגם יאיר לפיד נכחו בישיבה.", expected: ["בנימין נתניהו", "יאיר לפיד"] },
    { text: "השר גלנט נפגש עם הרמטכ\"ל הרצי הלוי.", expected: ["יואב גלנט", "הרצי הלוי"] },
    { text: "לפיד תקף את הממשלה ואת נתניהו", expected: ["יאיר לפיד", "בנימין נתניהו"] }
];

async function runTestsAndGenerateReport() {
    console.log(`Loaded ${ALL_POLITICIANS.length} politicians for HTML report generation.`);
    const results = [];
    for (const testCase of testCases) {
        const detected = findPoliticianMentions(testCase.text, ALL_POLITICIANS);
        results.push({
            text: testCase.text,
            expected: testCase.expected || [],
            detected: detected,
            isMatch: areArraysEqual(detected, testCase.expected || [])
        });
    }
    const reportPath = generateHtmlReport(results, ALL_POLITICIANS);
    openFileInBrowser(reportPath);
    console.log(`HTML report generated: ${reportPath}`);
}

function areArraysEqual(arr1, arr2) {
    if (!arr1 || !arr2) return false;
    if (arr1.length !== arr2.length) return false;
    const sortedA1 = [...arr1].sort();
    const sortedA2 = [...arr2].sort();
    return sortedA1.every((val, index) => val === sortedA2[index]);
}

function generateHtmlReport(results, politiciansForHighlighting) {
    let html = `<html><head><meta charset="UTF-8"><title>דוח בדיקת זיהוי פוליטיקאים</title><style>
        body { font-family: Arial, sans-serif; direction: rtl; margin: 20px; background-color: #f9f9f9; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        th, td { border: 1px solid #ccc; padding: 10px; text-align: right; vertical-align: top; }
        th { background-color: #e2e2e2; }
        h1 { text-align: center; color: #333; }
        .match { background-color: #d4edda; color: #155724; }
        .no-match { background-color: #f8d7da; color: #721c24; }
        .highlight { background-color: #fff3cd; color: #856404; font-weight: bold; padding: 1px 3px; border-radius: 3px; }
        em { color: #777; }
    </style></head><body><h1>דוח בדיקת זיהוי פוליטיקאים</h1><table>
    <tr><th>טקסט</th><th>צפוי לזהות</th><th>זוהה בפועל</th><th>התאמה</th></tr>`;
    results.forEach(res => {
        html += `<tr class="${res.isMatch ? 'match' : 'no-match'}">
            <td>${highlightMentions(res.text, res.detected, politiciansForHighlighting)}</td>
            <td>${res.expected.join(', ') || '<em>אין</em>'}</td>
            <td>${res.detected.join(', ') || '<em>אין</em>'}</td>
            <td>${res.isMatch ? '<strong>כן</strong>' : 'לא'}</td>
        </tr>`;
    });
    html += `</table></body></html>`;
    const outputPath = path.join(__dirname, '../data/detection-report.html');
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)){
        fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(outputPath, html);
    return outputPath;
}

function highlightMentions(text, detectedForThisText, allPoliticiansList) {
    let highlightedText = escapeHtml(text);
    const politiciansToHighlight = detectedForThisText && detectedForThisText.length > 0 ? detectedForThisText : [];
    const sortedHighlightable = [...new Set(politiciansToHighlight)]
        .map(name => allPoliticiansList.find(p => p.name === name) || {name: name, aliases: []})
        .filter(p => p && p.name)
        .sort((a,b) => b.name.length - a.name.length);

    for (const politician of sortedHighlightable) {
        const names = [politician.name, ...(politician.aliases || [])];
        for (const name of names) {
            if (!name) continue;
            if (politiciansToHighlight.includes(politician.name)) { 
                const escapedNameForRegex = escapeRegExp(name);
                highlightedText = highlightedText.replace(new RegExp(escapedNameForRegex, 'g'), (match) => `<span class="highlight">${escapeHtml(match)}</span>`);
            }
        }
    }
    return highlightedText;
}

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function escapeRegExp(string) {
  if (typeof string !== 'string') return '';
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function openFileInBrowser(filePath) {
    const command = os.platform() === 'win32' ? 'start' : os.platform() === 'darwin' ? 'open' : 'xdg-open';
    exec(`${command} "${filePath}"`, (err) => {
        if (err) console.error(`Failed to open report: ${err.message}`);
    });
}

if (require.main === module) {
    runTestsAndGenerateReport().catch(console.error);
}

module.exports = {
   // generateDetectionReport: runTestsAndGenerateReport
}; 