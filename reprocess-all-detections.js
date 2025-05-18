const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { loadPoliticians, enhancedPoliticianDetection } = require('./new/politicianDetectionService');

const DB_PATH = path.join(__dirname, 'server/data/news.db');
const POLITICIANS_PATH = path.join(__dirname, 'data/politicians/politicians.json');

const db = new sqlite3.Database(DB_PATH);
const politicians = loadPoliticians(POLITICIANS_PATH);

async function updateMentions(articleId, detected) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('DELETE FROM politician_mentions WHERE articleId = ?', [articleId], function(err) {
        if (err) return reject(err);
        if (!detected || detected.length === 0) return resolve(0);
        const stmt = db.prepare('INSERT INTO politician_mentions (articleId, politicianName) VALUES (?, ?)');
        for (const p of detected) {
          stmt.run(articleId, p.name, err2 => {
            if (err2) console.error(`Error inserting mention for article ${articleId}:`, err2.message);
          });
        }
        stmt.finalize(err3 => {
          if (err3) return reject(err3);
          resolve(detected.length);
        });
      });
    });
  });
}

async function main() {
  db.all('SELECT * FROM articles', async (err, articles) => {
    if (err) {
      console.error('Error fetching articles:', err);
      process.exit(1);
    }
    console.log(`Processing ${articles.length} articles for politician detection...`);
    let totalMentions = 0;
    for (const article of articles) {
      const detected = await enhancedPoliticianDetection(article, politicians, null, null);
      console.log(`Article ${article.id}: Detected ${detected.length} politicians.`);
      await updateMentions(article.id, detected);
      totalMentions += detected.length;
    }
    console.log(`Done. Total mentions inserted: ${totalMentions}`);
    db.close();
  });
}

main(); 