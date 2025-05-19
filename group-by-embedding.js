const sqlite3 = require('sqlite3').verbose();
const cosineSimilarity = require('compute-cosine-similarity');

// Config
const SIMILARITY_THRESHOLD = 0.70 // Adjust as needed (1.0 = identical, 0.8 = looser)

// Load all articles with embeddings
const db = new sqlite3.Database('./server/data/news.db');

db.all('SELECT id, title, embedding FROM articles WHERE embedding IS NOT NULL', (err, rows) => {
  if (err) {
    console.error('DB error:', err);
    process.exit(1);
  }

  // Parse embeddings
  const articles = rows.map(row => ({
    id: row.id,
    title: row.title,
    embedding: JSON.parse(row.embedding)
  }));

  // Grouping logic
  const groups = [];
  const assigned = new Set();

  for (let i = 0; i < articles.length; i++) {
    if (assigned.has(articles[i].id)) continue;
    const group = [articles[i]];
    assigned.add(articles[i].id);

    for (let j = i + 1; j < articles.length; j++) {
      if (assigned.has(articles[j].id)) continue;
      const sim = cosineSimilarity(articles[i].embedding, articles[j].embedding);
      if (sim >= SIMILARITY_THRESHOLD) {
        group.push(articles[j]);
        assigned.add(articles[j].id);
      }
    }

    if (group.length > 1) {
      groups.push(group);
    }
  }

  // Print groups
  groups.forEach((group, idx) => {
    console.log(`\n=== Group ${idx + 1} (size: ${group.length}) ===`);
    group.forEach(article => {
      console.log(`[${article.id}] ${article.title}`);
    });
  });

  if (groups.length === 0) {
    console.log('No similar article groups found with current threshold.');
  }

  db.close();
});