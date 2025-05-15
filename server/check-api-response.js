// A script to check the format of the API response
// Run with: node check-api-response.js

const http = require('http');
const url = require('url');

const port = process.env.PORT || 3000;
const host = 'localhost';

const options = {
  hostname: host,
  port: port,
  path: '/api/news?limit=5&onlyWithPoliticians=true',
  method: 'GET',
  headers: {
    'Accept': 'application/json'
  }
};

console.log(`Sending request to http://${host}:${port}${options.path}`);

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      
      console.log(`\nTotal articles: ${response.news.length}`);
      console.log(`Total pages: ${response.pagination.pages}`);
      console.log(`Total articles matching criteria: ${response.pagination.total}`);
      
      // Check if there are articles
      if (response.news.length === 0) {
        console.log('\nNo articles found with politicians. Make sure there are articles in the database with politician mentions.');
        return;
      }
      
      // Check mentionedPoliticians format
      console.log('\n--- Mentioned Politicians Format ---');
      response.news.forEach((article, index) => {
        console.log(`\nArticle ${index + 1} (ID: ${article.id}): ${article.title.slice(0, 50)}...`);
        
        if (!article.mentionedPoliticians || article.mentionedPoliticians.length === 0) {
          console.log('  WARNING: mentionedPoliticians is empty even though onlyWithPoliticians=true');
        } else {
          console.log(`  Politicians mentioned: ${article.mentionedPoliticians.length}`);
          console.log(`  Politicians data type: ${typeof article.mentionedPoliticians}`);
          console.log(`  Is array: ${Array.isArray(article.mentionedPoliticians)}`);
          console.log(`  Content: ${JSON.stringify(article.mentionedPoliticians)}`);
        }
      });
      
      // Check database query result type and formatting
      console.log('\n--- Suggested Fix for Empty mentionedPoliticians ---');
      console.log('1. Check your SQL query in the /api/news endpoint:');
      console.log('   Make sure GROUP_CONCAT(pm.politicianName) as mentionedPoliticians is working');
      console.log('2. Check how you\'re parsing the mentionedPoliticians field:');
      console.log('   const mentionedPoliticians = row.mentionedPoliticians');
      console.log('     ? [...new Set(row.mentionedPoliticians.split(\',\').filter(p => p && p.trim() !== \'\'))]');
      console.log('     : [];');
      console.log('3. Make sure the articles actually have entries in the politician_mentions table');
      console.log('\n--- Manual Database Check ---');
      console.log('Run this SQL query to check politician_mentions:');
      console.log('SELECT a.id, a.title, COUNT(pm.politicianName) as count, GROUP_CONCAT(pm.politicianName) as politicians');
      console.log('FROM articles a');
      console.log('LEFT JOIN politician_mentions pm ON a.id = pm.articleId');
      console.log('GROUP BY a.id');
      console.log('ORDER BY count DESC');
      console.log('LIMIT 5;');
      
    } catch (error) {
      console.error('Error parsing response:', error);
      console.error('Raw response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.end(); 