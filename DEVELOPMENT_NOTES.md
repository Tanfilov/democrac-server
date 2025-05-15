# Development Notes

## Environment Specifics

### Windows PowerShell
- **IMPORTANT**: Do not use `&&` for command chaining in PowerShell. Use semicolons (`;`) instead.
  - ❌ `cd server && npm run dev` 
  - ✅ `cd server; npm run dev`

### Deployment
- The production environment uses Render servers, not localhost
- Localhost (http://localhost:3000) is only used for local testing
- All production code must be designed to work with the Render deployment environment

## Package Management
- **IMPORTANT**: The project has two package.json files:
  - Root `/package.json` - Used for local development
  - Server `/server/package.json` - Used by Render for deployment
- When adding new dependencies, make sure to add them to **both** package.json files
- Run `npm install` in both root and server directories after pulling changes

## Common Operations

### Server Management
```powershell
# Start the development server
npm run dev

# Stop the running server (if needed)
# Find the process using port 3000
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess
# Kill the process
Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess
```

### Deployment
```powershell
# Commit changes
git add <files>
git commit -m "Descriptive message"
git push origin main

# After pushing, Render will automatically deploy the changes
```

## API Endpoints Reference

### News Retrieval
- `GET /api/news` - Get all news with parameters: page, limit, onlySummarized, onlyWithPoliticians, sort, order
- `GET /api/news/:id` - Get a specific news article

### Politician Detection
- `GET /api/politicians` - Get list of all tracked politicians
- `POST /api/summarize/:id` - Run enhanced politician detection for a specific article

### Statistics
- `GET /api/news-stats/all` - Get statistics about articles

### Administrative Endpoints (requires API key)
- `POST /api/refresh` - Trigger manual feed update
- `POST /api/clear` - Clear all news articles
- `POST /api/reset-politicians` - Reset politician mentions and reprocess

For detailed documentation, see `api-endpoints.md` 