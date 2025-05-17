# Fixing Politician Detection Issues

This document explains the issue with politician detection and provides steps to fix it. The main problem involves foreign key constraints not being enforced in the database, which causes politicians to appear associated with the wrong articles.

## Understanding the Problem

The politician detection mechanism is working correctly, but due to a database configuration issue:

1. Foreign key constraints between the `politician_mentions` table and the `articles` table are not enforced
2. This allows invalid references to exist, where politician mentions point to non-existent articles
3. When new articles are added, the IDs may conflict with these invalid references
4. As a result, politicians appear to randomly move between articles

## Solution Overview

We've implemented two fixes to address this issue:

1. **Fix #1: Foreign Key Enforcement**
   - Added `PRAGMA foreign_keys = ON` in the main application to enforce foreign key constraints
   - This prevents future invalid references

2. **Fix #2: Cleanup Script**
   - Created `reset-foreign-keys.js` to clean up existing invalid references
   - This script enables foreign key constraints and removes invalid politician mentions

3. **Fix #3: Use the Reset Politicians API**
   - The `/api/reset-politicians` endpoint can be used to reprocess all articles 

## Step-by-Step Fix Instructions

### Step 1: Run the Foreign Key Reset Script

```powershell
# Navigate to the server directory
cd server

# Run the reset script
node reset-foreign-keys.js
```

This will:
- Enable foreign key constraints
- Delete any invalid politician mentions
- Display database statistics before and after cleanup

### Step 2: Start the Server with Foreign Key Enforcement

```powershell
# Start the server (which now enforces foreign keys)
npm run dev
```

### Step 3: Reset and Reprocess All Politician Mentions

Use the administrative API endpoint to reset and reprocess all politician mentions:

```powershell
# Set your admin API key (replace YOUR_ADMIN_KEY with your actual key)
$apiKey = "YOUR_ADMIN_KEY"

# Call the reset endpoint (with proper PowerShell syntax)
Invoke-RestMethod -Uri "http://localhost:3000/api/reset-politicians" -Method Post -Headers @{
    "x-admin-api-key" = $apiKey
}
```

Alternatively, use a tool like Postman or curl to make the API request:

**API Endpoint:** `POST http://localhost:3000/api/reset-politicians`  
**Headers:** `x-admin-api-key: YOUR_ADMIN_KEY`

## Verification

After completing these steps:

1. The politician detection should work correctly for all articles
2. Foreign key constraints are enforced, preventing future issues
3. All politician mentions in the database are valid

## Technical Details

### Foreign Key Constraints

The database schema includes a foreign key constraint:

```sql
CREATE TABLE politician_mentions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL,
  politician_name TEXT NOT NULL,
  FOREIGN KEY (article_id) REFERENCES articles(id)
)
```

However, SQLite does not enforce foreign keys by default. This has been fixed by explicitly enabling foreign key constraints with:

```javascript
db.run('PRAGMA foreign_keys = ON');
```

### Reset Politicians API

The `/api/reset-politicians` endpoint:
1. Clears all existing politician mentions
2. Reprocesses all articles in the database
3. Adds politician mentions based on the content of each article

This ensures all politician mentions are correctly associated with their articles. 