# Democra.c News Server

RSS feed aggregator server for the Democra.c app.

## Features

- Collects news from multiple Israeli news sources
- Detects mentions of politicians in news articles
- Provides a REST API for accessing the news feed
- SQLite database for persistent storage

## Local Development

1. Install dependencies:
   ```
   npm install
   ```

2. Create `.env` file (see `.env.example` for reference)

3. Start the development server:
   ```
   npm run dev
   ```

## API Endpoints

- `GET /` - API documentation
- `GET /api/news` - Get all news articles with pagination
- `GET /api/news/:id` - Get a specific news article
- `POST /api/refresh` - Trigger a manual feed update

## Deployment on Render

This repository is configured to deploy automatically on Render.com with the following settings:

1. Service Type: Web Service
2. Environment: Node.js
3. Build Command: `npm install`
4. Start Command: `npm start`

### Environment Variables

Make sure to configure the following environment variables on Render:

- `PORT`: The port the server will run on (Render sets this automatically)
- `UPDATE_INTERVAL`: Interval in milliseconds between feed updates (default: 300000 - 5 minutes)
- `CORS_ORIGIN`: CORS origins to allow (use "*" to allow all origins)
- `DB_PATH`: Path to the SQLite database (default: ./data/news.db)

### Troubleshooting Deployment Issues

If you encounter deployment problems:

1. Verify your package.json has valid JSON syntax
2. Ensure the project structure is correct (index.js in the root or properly referenced in package.json)
3. Check that all required dependencies are listed in package.json
4. Confirm environment variables are properly set

## License

MIT 