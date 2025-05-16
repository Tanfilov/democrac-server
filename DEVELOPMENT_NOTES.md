# Development Notes

## Environment Specifics

### Windows PowerShell
- **IMPORTANT**: Do not use `&&` for command chaining in PowerShell. Use semicolons (`;`) instead.
  - ❌ `cd server && npm run dev` 
  - ✅ `cd server; npm run dev`
- **IMPORTANT**: Always use PowerShell native commands, not Unix/Linux commands
  - ❌ `curl` and `jq` (these either don't work or behave differently in PowerShell)
  - ✅ `Invoke-RestMethod` and `Invoke-WebRequest`

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

## API Debugging & Testing

### Production vs Local Environment
- **IMPORTANT**: When debugging articles or API issues, always use the production API endpoints
- Production API is at `https://democrac-server.onrender.com`
- Never assume API endpoints are the same in local and production environments
- **CRITICAL RULE**: When debugging articles by ID, ALWAYS query the production API on Render, NOT localhost

### Article Debugging Protocol
1. **ALWAYS** use the production Render server for article debugging
2. **ALWAYS** use the `/api/news/:id` endpoint (NOT `/api/article/:id`)
3. **NEVER** use localhost when debugging production issues
4. Check the available endpoints first if unsure about API structure

```powershell
# DEBUGGING ARTICLE BY ID - OFFICIAL PROTOCOL
# When someone references an article ID, ALWAYS use this approach:

# 1. Define the production API root
$apiRoot = "https://democrac-server.onrender.com"

# 2. Retrieve article data from production (NOT localhost)
$article = Invoke-RestMethod -Uri "$apiRoot/api/news/90" -Method Get 

# 3. Examine the article data
$article | Format-List  # View all properties
$article.mentionedPoliticians  # Check which politicians were detected
```

### PowerShell API Debugging Commands
```powershell
# CHECKING AVAILABLE ENDPOINTS (ALWAYS DO THIS FIRST)
$apiRoot = "https://democrac-server.onrender.com"
$endpoints = Invoke-RestMethod -Uri $apiRoot -Method Get
$endpoints.endpoints

# FETCHING AND DISPLAYING ARTICLE BY ID (PROPERLY FORMATTED FOR WINDOWS)
function Get-NewsArticle {
    param (
        [Parameter(Mandatory=$true)]
        [int]$ArticleId
    )
    
    $apiRoot = "https://democrac-server.onrender.com"
    $article = Invoke-RestMethod -Uri "$apiRoot/api/news/$ArticleId" -Method Get
    
    # Display formatted article information
    Write-Host "ARTICLE #$($article.id): $($article.title)" -ForegroundColor Cyan
    Write-Host "Source: $($article.source) | Published: $($article.publishedAt)" -ForegroundColor Gray
    Write-Host "Link: $($article.link)" -ForegroundColor Blue
    Write-Host "Description: $($article.description)" -ForegroundColor White
    Write-Host "Mentioned Politicians: $($article.mentionedPoliticians -join ', ')" -ForegroundColor Yellow
    
    # Return the article object for further use if needed
    return $article
}

# USAGE EXAMPLES:
# Get-NewsArticle -ArticleId 90
# $article = Get-NewsArticle -ArticleId 90
```

### Available Endpoints in Production
```powershell
# CORRECT ENDPOINT USAGE:
$apiRoot = "https://democrac-server.onrender.com"

# Get all news (paginated)
Invoke-RestMethod -Uri "$apiRoot/api/news" -Method Get

# Get specific article (use /api/news/:id NOT /api/article/:id)
Invoke-RestMethod -Uri "$apiRoot/api/news/90" -Method Get

# Get politicians
Invoke-RestMethod -Uri "$apiRoot/api/politicians" -Method Get
```

## Common Operations

### Server Management
```powershell
# Start the development server
npm run dev

# IMPORTANT: Always stop any running servers before starting a new one
# Option 1: Find and kill the process using port 3000
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess
Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess

# Option 2: Kill all Node.js processes (useful when multiple servers are running)
Get-Process | Where-Object {$_.ProcessName -like '*node*'} | Stop-Process -Force

# Option 3: For all local development servers, ensure port is free before starting
# Check if port 3000 is in use
$portInUse = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Host "Port 3000 is in use. Stopping process..."
    Stop-Process -Id $portInUse.OwningProcess -Force
}
cd server; npm run dev
```

### Running Commands Sequentially in PowerShell
```powershell
# PowerShell doesn't support && operator like Bash
# Instead use semicolons to run commands sequentially
cd server; npm run dev

# For complex operations, use multiple lines:
cd server
npm run dev

# Or use a script block:
& {
    cd server
    npm run dev
}
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