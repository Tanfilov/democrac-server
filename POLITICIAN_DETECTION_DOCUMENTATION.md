# Politician Detection Mechanism Documentation

## Overview

The politician detection system identifies mentions of politicians in news articles and associates them with the articles in the database. This document explains the complete mechanism, including business logic, architecture, database structure, functions, and APIs used.

## Business Logic

### Core Concept
The system scans article titles, descriptions, and content for mentions of known politicians. When a politician is detected with sufficient confidence (based on relevance scoring), the association is stored in the database.

### Detection Criteria
- Politicians are identified based on name matches in the article's title, description, or content
- The system uses a relevance scoring mechanism to determine if a mention is significant
- Title mentions are weighted more heavily than content mentions
- Foreign key constraints ensure data integrity between article and politician references

## Architecture

### Components
1. **Politician Data Source**: A JSON file (`politicians.json`) containing the list of tracked politicians
2. **Detection Engine**: Core functions to analyze text and identify politicians
3. **Database Layer**: SQLite database storing articles and politician associations
4. **API Layer**: Endpoints to trigger detection and retrieve results

### Data Flow
1. Articles are fetched from news sources and stored in the database
2. The detection system analyzes each article against the list of known politicians
3. When politicians are detected, the associations are stored in the `politician_mentions` table
4. APIs provide access to articles with their detected politicians

## Database Structure

### Tables
1. **`articles`**: Stores news articles with fields for title, description, content, etc.
2. **`politician_mentions`**: Junction table linking politicians to articles
   - Contains `article_id` and `politician_name` fields
   - Has foreign key constraint to ensure referential integrity to articles table

### Foreign Key Constraints
- **CRITICAL**: SQLite does not enable foreign key constraints by default
- Our application explicitly enables them with `PRAGMA foreign_keys = ON`
- This prevents orphaned politician mentions (references to non-existent articles)

## Functions and Implementation

### Core Detection Functions
1. **`enhancedPoliticianDetection`**: Main function that processes batches of articles
   - Batches articles to prevent overwhelming the system
   - Manages asynchronous processing
   - Updates statistics after completion

2. **`detectPoliticianMentions`**: Analyzes a single article for politician mentions
   - Takes article text and politician data as input
   - Returns detected politicians with relevance scores

3. **`calculatePoliticianRelevance`**: Determines how relevant a politician is to an article
   - Considers title, description, and content mention counts
   - Applies weighting factors to different parts of the article
   - Returns a score that determines if a politician should be associated

### Database Functions
1. **`savePoliticianMentions`**: Stores detected politicians in the database
   - Creates entries in the `politician_mentions` table
   - Enforces foreign key constraints

2. **`clearPoliticianMentions`**: Removes all politician mentions
   - Used when resetting the detection system
   - Ensures clean state before reprocessing

## API Endpoints

### Detection Endpoints
1. **`POST /api/summarize/:id`**: Run detection for a specific article
   - Triggers the politician detection for a single article
   - Updates the database with detected politicians

2. **`POST /api/reset-politicians`**: Reset and reprocess all politician mentions
   - Deletes all existing politician mentions
   - Reprocesses all articles in batches
   - Asynchronously updates the database with new detections

3. **`POST /api/fix-politician-detection/:id`**: Fix detection for a specific article
   - Targeted endpoint to rerun detection on a problematic article
   - Returns before and after states for debugging

### Query Endpoints
1. **`GET /api/news`**: Get news articles with optional politician filters
   - Supports `onlyWithPoliticians` parameter to filter articles
   - Returns articles with their associated politicians

2. **`GET /api/politicians`**: Get list of all tracked politicians
   - Returns the complete list of politicians the system can detect

## Troubleshooting and Maintenance

### Common Issues
1. **Missing politician detections**: Can occur when:
   - Foreign key constraints are disabled
   - Database has invalid references
   - Detection thresholds are too high

2. **Data integrity issues**: Detected when:
   - Politicians appear associated with wrong articles
   - Articles lose their politician associations

### Maintenance Tasks
1. **Reset politician detection**: Periodically run `/api/reset-politicians` to clean up and refresh politician mentions
2. **Check for orphaned records**: Use database tools to identify invalid foreign key references
3. **Monitor detection quality**: Use test scripts like `test-article93.js` to verify detection accuracy

## Performance Considerations

1. **Batch Processing**: Articles are processed in batches to prevent overwhelming the system
2. **Async Processing**: Detection runs asynchronously to avoid blocking the main thread
3. **Database Indexes**: Ensure proper indexing on the politician_mentions table for performance

## Conclusion

The politician detection system is a critical part of the application that allows users to track which politicians are mentioned in news articles. The system's effectiveness depends on proper database configuration, particularly ensuring foreign key constraints are enabled, and maintaining clean data relationships.

Regular maintenance through the reset-politicians endpoint helps ensure data integrity and proper politician detection over time. 