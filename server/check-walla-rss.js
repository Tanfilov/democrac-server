const fetch = require('node-fetch');

async function checkWallaRss() {
  try {
    // Check Walla Politics RSS feed
    console.log('Fetching Walla Politics RSS feed...');
    const response1 = await fetch('https://rss.walla.co.il/feed/2686');
    const xmlData1 = await response1.text();
    
    // Print first part of the RSS feed
    console.log('Walla Politics RSS feed (first 3000 chars):');
    console.log(xmlData1.substring(0, 3000));
    
    // Look for sample items
    const sampleItem1 = xmlData1.match(/<item>[\s\S]*?<\/item>/);
    if (sampleItem1) {
      console.log('\n\nSample Walla Politics RSS item:');
      console.log(sampleItem1[0]);
    }

    console.log('\n\n' + '-'.repeat(80) + '\n\n');

    // Check Walla Knesset RSS feed
    console.log('Fetching Walla Knesset RSS feed...');
    const response2 = await fetch('https://rss.walla.co.il/feed/2689');
    const xmlData2 = await response2.text();
    
    // Print first part of the RSS feed
    console.log('Walla Knesset RSS feed (first 3000 chars):');
    console.log(xmlData2.substring(0, 3000));
    
    // Look for sample items
    const sampleItem2 = xmlData2.match(/<item>[\s\S]*?<\/item>/);
    if (sampleItem2) {
      console.log('\n\nSample Walla Knesset RSS item:');
      console.log(sampleItem2[0]);
    }
  } catch (error) {
    console.error('Error fetching Walla RSS feeds:', error);
  }
}

checkWallaRss(); 