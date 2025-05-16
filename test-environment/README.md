# Democracy Server Test Environment

This is a separate test environment for the Democracy Server application. It allows you to test and develop new features in isolation without affecting the production codebase.

## Purpose

The test environment provides:

1. **Isolated Testing**: Develop and test new features without risking the production codebase
2. **Captured Data**: Use real RSS feeds captured and saved for consistent testing
3. **Test Infrastructure**: Run unit and integration tests against the modified code
4. **Feature Development**: Safely try out new approaches before integrating with production

## Setup

```bash
# Install dependencies
npm install

# Capture RSS feeds for testing
npm run capture-feeds

# Run tests
npm test

# Start the test server
npm run start:test
```

## Directory Structure

- `/src` - Source code (copied from production with test adaptations)
- `/config` - Environment-specific configuration
- `/data` - Test data including captured feeds
- `/test` - Test suites
- `/tools` - Utilities for testing

## Testing Workflow

1. **Capture Data**: Run `npm run capture-feeds` to get fresh RSS feed data
2. **Develop Features**: Modify the code in `/src` to implement new features
3. **Write Tests**: Create tests in `/test` to verify your changes
4. **Run Tests**: Execute `npm test` to validate your changes
5. **Manual Testing**: Run `npm run start:test` to start the server for manual testing

## Sample Usage Flow

### Testing the Politician Detection Module

1. **Start the test server**:
   ```bash
   npm run start:test
   ```

2. **Test from the browser**:
   Open http://localhost:3001 in your browser to see the test server home page

3. **Test politician detection via API**:
   ```bash
   curl -X POST http://localhost:3001/api/test/detect \
     -H "Content-Type: application/json" \
     -d '{"text": "ראש הממשלה בנימין נתניהו וראש האופוזיציה יאיר לפיד"}'
   ```

4. **View captured feeds**:
   Open http://localhost:3001/api/test/feed in your browser to see available feeds

5. **Run automated tests**:
   ```bash
   npm test
   ```

### Adding a New Feature

To develop and test a new feature (e.g., improving politician detection):

1. **Copy production code**:
   Already done for politician detection module

2. **Modify the code**:
   Edit files in `/src/politician-detection/` to implement your changes

3. **Write tests**:
   Add or modify tests in `/test/unit/politician-detection.test.js`

4. **Run tests to verify**:
   ```bash
   npm test
   ```

5. **Test against real data**:
   ```bash
   npm run start:test
   # Use the API to test with real captured articles
   ```

## Migration to Production

Once you've validated your changes in the test environment, you can:

1. Apply the same changes to the production codebase
2. Run tests to ensure everything works properly
3. Deploy the updated production code

## Notes

- The test environment uses a different port (3001) to avoid conflicts with production
- Test databases are in-memory by default for faster tests
- The test environment disables external services by default (e.g., Groq API) 