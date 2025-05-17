# PowerShell script to fix the politician-detection module integration

# Backup the original file
Copy-Item server/src/index.js server/src/index.js.bak

Write-Host "Creating a clean version of server/src/index.js..."

# Get the content of the file
$content = Get-Content server/src/index.js -Raw

# Fix the require statement for the adapter
$content = $content -replace "const politicianDetection = require\('\.\/politician-detection'\);", "const politicianDetectionAdapter = require('./politician-detection-adapter');" 

# Fix the calls to politician detection functions
$content = $content -replace "politicianDetection\.findPoliticianMentions\(([^,]+),\s*POLITICIANS\)", "politicianDetectionAdapter.findPoliticianMentions($1)"
$content = $content -replace "politicianDetection\.enhancedPoliticianDetection\(([^,]+),\s*POLITICIANS[^)]+\)", "politicianDetectionAdapter.enhancedPoliticianDetection($1)"
$content = $content -replace "politicianDetection\.scorePoliticianRelevance\(([^,]+),\s*([^)]+)\)", "politicianDetectionAdapter.scorePoliticianRelevance($2, $1)"
$content = $content -replace "politicianDetection\.getRelevantPoliticians", "politicianDetectionAdapter.getRelevantPoliticians"
$content = $content -replace "politicianDetection\.updatePoliticianMentions", "politicianDetectionAdapter.updatePoliticianMentions"

# Remove reference to POLITICIANS variable
$content = $content -replace "const POLITICIANS = politicianDetection\.loadPoliticians\(politiciansPath\);", ""

# Add initialization after scrapeArticleContent function
$initCode = @"

// Initialize the politician detection adapter
politicianDetectionAdapter.initialize({
  db: db,
  scrapeContent: scrapeArticleContent
});

"@

$content = $content -replace "// Scrape article content from URL\r?\nconst scrapeArticleContent = async \(url\) => \{[\s\S]+?return '';\r?\n  \}\r?\n\};", "`$&`n$initCode"

# Save the modified content
$content | Set-Content -Path server/src/index.js

Write-Host "Done. All references to the old politician-detection module have been updated to use the new adapter."
Write-Host "Please restart the server with: cd server; npm run dev" 