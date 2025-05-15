require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');
const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Test URL
const url = 'https://www.ynet.co.il/news/article/b1900ffzwlx';

// Scrape article content from URL
async function scrapeArticleContent(url) {
  try {
    console.log(`Fetching article from: ${url}`);
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    // Remove unnecessary elements
    $('script, style, nav, header, footer, aside, iframe, .advertisement, .ads, .comments').remove();
    
    // Get title
    const title = $('h1').first().text().trim();
    console.log(`Title: ${title}`);
    
    // Get description/subtitle if available
    let description = '';
    $('.article-subtitle, .subtitle, .article-desc, h2').first().each((i, el) => {
      description = $(el).text().trim();
    });
    
    // Extract first 5 paragraphs
    const paragraphs = [];
    
    // For Ynet articles
    if (url.includes('ynet.co.il')) {
      console.log('Detected Ynet article, extracting first 5 paragraphs');
      
      // First try text editor paragraphs
      $('.text_editor_paragraph, .art_content, .art_body, article p').each((i, el) => {
        if (paragraphs.length < 5) {
          const text = $(el).text().trim();
          if (text && text.length > 20) { // Skip very short text
            paragraphs.push(text);
          }
        }
      });
      
      // If we didn't get enough paragraphs, try more general selectors
      if (paragraphs.length < 5) {
        $('p').each((i, el) => {
          if (paragraphs.length < 5) {
            const text = $(el).text().trim();
            if (text && text.length > 20 && !paragraphs.includes(text)) {
              paragraphs.push(text);
            }
          }
        });
      }
    } else {
      // Generic approach for other sites
      $('p').each((i, el) => {
        if (paragraphs.length < 5) {
          const text = $(el).text().trim();
          if (text && text.length > 20) {
            paragraphs.push(text);
          }
        }
      });
    }
    
    // Join the paragraphs together
    const content = paragraphs.join(' ');
    
    console.log(`Extracted ${paragraphs.length} paragraphs, total length: ${content.length} characters`);
    
    return { 
      title, 
      description,
      content,
      paragraphs
    };
  } catch (error) {
    console.error(`Error scraping article content from ${url}:`, error);
    return { title: '', description: '', content: '', paragraphs: [] };
  }
}

// Load politicians data for detection
async function loadPoliticians() {
  try {
    const politiciansPath = path.join(__dirname, 'data/politicians/politicians.json');
    if (fs.existsSync(politiciansPath)) {
      const politiciansData = JSON.parse(fs.readFileSync(politiciansPath, 'utf8'));
      return politiciansData.map(p => p.name);
    }
    return [];
  } catch (error) {
    console.error('Error loading politicians data:', error);
    return [];
  }
}

// Summarize article using Groq API
async function summarizeArticle(articleContent, title, politiciansList) {
  try {
    console.log('Summarizing article with Groq...');
    
    const prompt = `
    You are a professional Israeli news editor specializing in creating neutral, factual summaries.
    
    Here is a news article in Hebrew:
    Title: ${title}
    Content: ${articleContent}
    
    Instructions:
    1. Create a concise, neutral summary of this article in 3-4 sentences in HEBREW.
    2. DO NOT copy any sentences or phrases directly from the original text - you must completely rephrase everything in your own words.
    3. Use neutral, factual language - avoid creative or dramatic phrasing.
    4. Focus on the key facts, events, and context.
    5. Identify any Israeli politicians mentioned in this article from this list: ${politiciansList.join(', ')}
    
    Format your response as JSON:
    {
      "summary": "Your neutral, rephrased summary in Hebrew here...",
      "mentionedPoliticians": ["Politician Name 1", "Politician Name 2", ...]
    }
    
    Make sure to escape any special characters in the JSON properly.
    `;
    
    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama3-8b-8192',
      temperature: 0.2, // Lower temperature for more neutral/factual output
      max_tokens: 1000
    });
    
    // Get the raw response content
    const responseContent = completion.choices[0].message.content;
    console.log('Raw response:', responseContent);
    
    // Try to extract JSON from the response
    let result;
    try {
      // Extract JSON if it's wrapped in a code block
      const jsonMatch = responseContent.match(/```json\s*({[\s\S]*?})\s*```/) || 
                        responseContent.match(/```\s*({[\s\S]*?})\s*```/) ||
                        responseContent.match(/({[\s\S]*})/);
      
      if (jsonMatch && jsonMatch[1]) {
        result = JSON.parse(jsonMatch[1]);
      } else {
        result = JSON.parse(responseContent);
      }
    } catch (error) {
      console.error('Error parsing JSON from response:', error);
      
      // Manually extract summary and politicians as fallback
      const summaryMatch = responseContent.match(/"summary":\s*"([^"]+)"/);
      const politiciansMatch = responseContent.match(/"mentionedPoliticians":\s*\[(.*?)\]/);
      
      if (summaryMatch) {
        const summary = summaryMatch[1];
        const politiciansList = politiciansMatch ? 
          politiciansMatch[1].split(',').map(p => p.trim().replace(/"/g, '')) : [];
        
        result = {
          summary,
          mentionedPoliticians: politiciansList
        };
      } else {
        // Use the raw text as the summary if JSON parsing fails
        result = {
          summary: responseContent.substring(0, 500), // Limit to 500 chars
          mentionedPoliticians: []
        };
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error summarizing article with Groq:', error);
    
    // Check if there's a failed_generation in the error
    if (error.error?.error?.failed_generation) {
      console.log('Failed generation content:', error.error.error.failed_generation);
      
      // Try to extract useful information from the failed generation
      try {
        // Some cleanup to make it valid JSON
        const cleanedJson = error.error.error.failed_generation
          .replace(/\\\\/g, '\\')
          .replace(/\\n/g, '\n');
        
        const result = JSON.parse(cleanedJson);
        return result;
      } catch (jsonError) {
        console.error('Error parsing failed generation:', jsonError);
      }
    }
    
    return { summary: 'Error during summarization', mentionedPoliticians: [] };
  }
}

// Main function
async function main() {
  try {
    // Scrape the article
    const { title, content } = await scrapeArticleContent(url);
    if (!content) {
      console.error('Failed to extract article content.');
      return;
    }
    
    console.log('Article content extracted successfully.');
    console.log('\n----- ARTICLE FULL TEXT -----');
    console.log(content);
    console.log('---------------------------\n');
    
    // Load politicians data
    const politiciansList = await loadPoliticians();
    
    // Summarize the article
    const summary = await summarizeArticle(content, title, politiciansList);
    
    // Display the results
    console.log('\n----- SUMMARY RESULTS -----');
    console.log('Summary:', summary.summary);
    console.log('Mentioned Politicians:', summary.mentionedPoliticians);
    console.log('---------------------------');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the main function
main(); 