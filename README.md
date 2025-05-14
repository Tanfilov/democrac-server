# Democra.c Server

A Node.js server that fetches RSS feeds from Israeli news sources, processes them to detect politician mentions, and serves them via a REST API for the Democra.c mobile app.

## Features

- Fetches news from multiple Israeli sources (Ynet, Walla News, Jerusalem Post)
- Automatically detects mentions of Israeli politicians
- Stores articles in SQLite database
- Provides REST API endpoints for the mobile app
- Updates feeds automatically every 5 minutes

## Setup Instructions

### Local Development

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd democrac-server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up the database:
   ```bash
   npm run setup
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

The server will run on http://localhost:3000 by default.

### Deployment to Render

1. Push this repository to GitHub

2. On Render, create a new Web Service
   - Connect to your GitHub repository
   - Select Node.js as runtime
   - Use these settings:
     - Build Command: `npm install`
     - Start Command: `npm start`
   - Add environment variables from `.env.example`

## API Endpoints

- `GET /` - Shows API information and available endpoints
- `GET /api/news` - Get paginated news articles
- `GET /api/news/:id` - Get a specific news article by ID
- `POST /api/refresh` - Manually trigger a feed update

### Pagination

The `/api/news` endpoint supports pagination with these query parameters:
- `page`: Page number (default: 1)
- `limit`: Number of items per page (default: 20)

Example: `/api/news?page=2&limit=10`

## Environment Variables

- `PORT` - Server port (default: 3000)
- `DB_PATH` - Path to SQLite database file (default: ./data/news.db)
- `UPDATE_INTERVAL` - Feed update interval in milliseconds (default: 300000)
- `CORS_ORIGIN` - CORS configuration (default: *)

## License

MIT 