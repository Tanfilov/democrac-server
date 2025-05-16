const fetch = require('node-fetch');

async function checkRss() {
  try {
    console.log('Fetching Ynet RSS feed...');
    const response = await fetch('https://www.ynet.co.il/Integration/StoryRss2.xml');
    const xmlData = await response.text();
    
    // Print first part of the RSS feed
    console.log('RSS feed (first 3000 chars):');
    console.log(xmlData.substring(0, 3000));
    
    // Look for sample items
    const sampleItem = xmlData.match(/<item>[\s\S]*?<\/item>/);
    if (sampleItem) {
      console.log('\n\nSample RSS item:');
      console.log(sampleItem[0]);
    }
  } catch (error) {
    console.error('Error fetching RSS feed:', error);
  }
}

checkRss(); 