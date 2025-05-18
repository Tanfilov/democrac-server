const Levenshtein = require('fast-levenshtein');
const sqlite3 = require('sqlite3').verbose();

// --- CONFIG ---
const JACCARD_THRESHOLD = 0.5;      // Show only pairs with Jaccard similarity above this
const LEVENSHTEIN_MAX = 20;         // ...or Levenshtein distance below this

// --- NORMALIZATION ---
function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-zA-Z0-9א-ת ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function jaccardSimilarity(str1, str2) {
  const set1 = new Set(normalize(str1).split(' '));
  const set2 = new Set(normalize(str2).split(' '));
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return intersection.size / union.size;
}

// --- MAIN ---
const db = new sqlite3.Database('./server/data/news.db');

db.all('SELECT id, title FROM articles', (err, rows) => {
  if (err) {
    console.error('DB error:', err);
    process.exit(1);
  }

  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const t1 = rows[i].title;
      const t2 = rows[j].title;
      const lev = Levenshtein.get(normalize(t1), normalize(t2));
      const jac = jaccardSimilarity(t1, t2);

      if (jac > JACCARD_THRESHOLD || lev < LEVENSHTEIN_MAX) {
        console.log(`\n[${rows[i].id}] "${t1}"\n[${rows[j].id}] "${t2}"`);
        console.log(`Levenshtein: ${lev}, Jaccard: ${jac.toFixed(2)}`);
      }
    }
  }
  db.close();
});