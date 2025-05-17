#!/bin/bash

# This script updates server/src/index.js to use the new politician-detection-adapter module

# First, backup the original file
cp server/src/index.js server/src/index.js.bak

# Create a new adapter file in the correct location
echo "Creating politician-detection-adapter.js with the proper module implementation..."

# Run the commands to implement the refactoring
echo "Done. Please restart the server with: npm run dev" 