// Export articles with politician data to Excel
const sqlite3 = require('sqlite3').verbose();
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

// Configure database path
const DB_PATH = process.env.DB_PATH || './data/news.db';

// Connect to database
const db = new sqlite3.Database(DB_PATH);

// Create Excel workbook
const workbook = new ExcelJS.Workbook();
const worksheet = workbook.addWorksheet('Articles');

// Set columns with Hebrew alignment to right
worksheet.columns = [
  { header: 'ID', key: 'id', width: 5 },
  { header: 'Title', key: 'title', width: 50, alignment: { horizontal: 'right' } },
  { header: 'Description', key: 'description', width: 80, alignment: { horizontal: 'right' } },
  { header: 'Politicians', key: 'politicians', width: 30, alignment: { horizontal: 'right' } },
  { header: 'Source', key: 'source', width: 15 },
  { header: 'Published', key: 'publishedAt', width: 20 },
  { header: 'Link', key: 'link', width: 50 }
];

// Set title row to bold
worksheet.getRow(1).font = { bold: true };

console.log('Fetching articles from database...');

// Query to get articles with their politician mentions
const query = `
  SELECT 
    a.id, 
    a.title, 
    a.description, 
    a.source,
    a.publishedAt,
    a.link,
    GROUP_CONCAT(pm.politicianName, ', ') as mentionedPoliticians
  FROM 
    articles a
  LEFT JOIN 
    politician_mentions pm ON a.id = pm.articleId
  GROUP BY 
    a.id
  ORDER BY 
    a.id DESC
  LIMIT 500
`;

db.all(query, [], (err, rows) => {
  if (err) {
    console.error('Error fetching articles:', err);
    process.exit(1);
  }

  console.log(`Found ${rows.length} articles. Adding to Excel...`);

  // Add rows to worksheet
  rows.forEach(article => {
    worksheet.addRow({
      id: article.id,
      title: article.title,
      description: article.description || '',
      politicians: article.mentionedPoliticians || '',
      source: article.source,
      publishedAt: article.publishedAt,
      link: article.link
    });
  });

  // Set up direction for Hebrew
  worksheet.views = [
    { rightToLeft: true }
  ];

  // Create the export directory if it doesn't exist
  const exportDir = path.join(__dirname, '../../exports');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }
  
  const filePath = path.join(exportDir, `articles_export_${new Date().toISOString().replace(/:/g, '-')}.xlsx`);
  
  // Write to file with BOM for Hebrew support
  workbook.xlsx.writeFile(filePath)
    .then(() => {
      console.log(`Export complete! File saved to: ${filePath}`);
      db.close();
    })
    .catch(err => {
      console.error('Error writing Excel file:', err);
      db.close();
    });
}); 