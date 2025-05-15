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