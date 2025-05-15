# Democracy Server API Endpoints

## News Articles

### GET /api/news
Get all news articles with flexible filtering options.

**Parameters:**
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Number of items per page (default: 20)
- `onlySummarized` (optional): If "true", only return articles with summaries
- `onlyWithPoliticians` (optional): If "true", only return articles mentioning politicians
- `sort` (optional): Field to sort by (default: "publishedAt")
- `order` (optional): Sort order, "asc" or "desc" (default: "desc")

**Example:**
```
GET /api/news?page=1&limit=10&onlyWithPoliticians=true&sort=publishedAt&order=desc
```

### GET /api/news/:id
Get a specific news article by ID.

**Example:**
```
GET /api/news/42
```

## Politician Detection

### GET /api/politicians
Get list of all tracked politicians.

### POST /api/summarize/:id
Run enhanced politician detection for a specific article.

**Example:**
```
POST /api/summarize/42
```

## Statistics

### GET /api/news-stats/all
Get statistics about articles, including counts of articles with politicians.

## Administrative Endpoints

### POST /api/refresh
Trigger a manual feed update (requires admin API key).

### POST /api/clear
Clear all news articles from the database (requires admin API key).

### POST /api/reset-politicians
Clear all politician mentions and reprocess articles (requires admin API key). 