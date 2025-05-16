/**
 * Application configuration settings
 */

// Environment detection
const isProduction = process.env.NODE_ENV === 'production';

// Base URLs
const config = {
  // Server settings
  port: process.env.PORT || 3000,
  
  // API base URL
  apiBaseUrl: isProduction 
    ? 'https://democracy-server.onrender.com/api' 
    : 'http://localhost:3000/api',
    
  // Front-end base URL
  frontendBaseUrl: isProduction
    ? 'https://democracy-news.onrender.com'
    : 'http://localhost:3001',
    
  // Usage notes
  notes: {
    powershell: "Remember: In PowerShell use semicolons (;) not && for command chaining",
    deployment: "All API endpoints should be relative or use the config.apiBaseUrl"
  }
};

module.exports = config; 