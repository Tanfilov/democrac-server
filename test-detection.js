console.log('Script started');
const { loadPoliticians, enhancedPoliticianDetection } = require('./new/politicianDetectionService');
const path = require('path');

const politicians = loadPoliticians(path.join(__dirname, 'data/politicians/politicians.json'));
const article = {
  id: 14842,
  title: "מהכתרת האפיפיור - לפריז: הרצוג ייפגש עם מקרון, בצל הביקורת החריפה שלו נגד ישראל",
  description: "נשיא המדינה טס לביקור בזק היישר מרומא - וצפוי לדון עם נשיא צרפת על סוגיית החטופים, אחרי הביקורת שהשמיע רק בשבוע האחרון נגד מדיניות הממשלה בעזה. בהכ...",
  content: "נשיא המדינה טס לביקור בזק היישר מרומא - וצפוי לדון עם נשיא צרפת על סוגיית החטופים, אחרי הביקורת שהשמיע רק בשבוע האחרון נגד מדיניות הממשלה בעזה. בהכתרה פגש שורת מנהיגים - והפציר באפיפיור החדש: \"פעל להשבת החטופים\"",
  link: "https://www.ynet.co.il/news/article/hklzdtdwgl",
  imageUrl: "https://ynet-pic1.yit.co.il/picserver6/crop_images/2024/07/26/ryqtdMZY0/ryqtdMZY0_0_154_3000_1689_0_medium.jpg",
  source: "Ynet",
  publishedAt: "2025-05-18 19:24:53",
  guid: "https://www.ynet.co.il/news/article/hklzdtdwgl",
  createdAt: "2025-05-18T21:35:32.476Z",
  summary: ""
};

enhancedPoliticianDetection(article, politicians, null, null).then(result => {
  console.log('Detection result:', result);
  process.exit(0);
}); 