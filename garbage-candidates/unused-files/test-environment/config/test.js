module.exports = {
  port: 3001, // Use a different port for testing
  isProduction: false,
  apiBaseUrl: 'http://localhost:3001',
  db: {
    path: './data/test.db',
    inMemory: true // Use in-memory SQLite for faster tests
  },
  updateInterval: 60000, // 1 minute interval for testing
  cors: {
    origin: '*'
  },
  feeds: {
    // We'll use local captured feeds in test mode
    useCapturedFeeds: true,
    capturedFeedsDir: './data/captured-feeds',
    // Rate limits are reduced for testing
    defaultRateLimit: 5000 // 5 seconds between requests
  },
  politicians: {
    path: './data/politicians/politicians.json'
  },
  features: {
    useSummarization: false, // Disable Groq for tests
    detectPoliticians: true
  }
} 