/**
 * Enhanced configuration file for test environment
 * 
 * This provides the same interface as the production config but with
 * environment-specific overrides and test-specific features.
 */

const path = require('path');
const fs = require('fs');

// Determine environment
const NODE_ENV = process.env.NODE_ENV || 'development';
console.log(`Running in ${NODE_ENV} environment`);

// Load environment-specific config
let envConfig = {};
const configFile = path.join(__dirname, '../config', `${NODE_ENV}.js`);

try {
  if (fs.existsSync(configFile)) {
    envConfig = require(configFile);
    console.log(`Loaded configuration from ${configFile}`);
  } else {
    console.warn(`No configuration found for ${NODE_ENV}, using defaults`);
  }
} catch (error) {
  console.error(`Error loading config from ${configFile}:`, error);
}

// Default configuration
const defaultConfig = {
  port: process.env.PORT || 3000,
  isProduction: NODE_ENV === 'production',
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
  db: {
    path: process.env.DB_PATH || './data/news.db',
    inMemory: false
  },
  updateInterval: parseInt(process.env.UPDATE_INTERVAL || 3600000),
  cors: {
    origin: process.env.CORS_ORIGIN || '*'
  },
  feeds: {
    useCapturedFeeds: false,
    capturedFeedsDir: './data/captured-feeds',
    defaultRateLimit: 10 * 60 * 1000 // 10 minutes between requests
  },
  politicians: {
    path: path.join(__dirname, '../../data/politicians/politicians.json')
  },
  features: {
    useSummarization: !!process.env.GROQ_API_KEY,
    detectPoliticians: true
  }
};

// Merge default and environment-specific config
const config = {
  ...defaultConfig,
  ...envConfig,
  // Deep merge for nested objects
  db: { ...defaultConfig.db, ...envConfig.db },
  cors: { ...defaultConfig.cors, ...envConfig.cors },
  feeds: { ...defaultConfig.feeds, ...envConfig.feeds },
  politicians: { ...defaultConfig.politicians, ...envConfig.politicians },
  features: { ...defaultConfig.features, ...envConfig.features }
};

module.exports = config; 