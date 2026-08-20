#!/bin/bash

# ZFlap Documentation Generation Script
# This script generates Doxygen documentation for the ZFlap project

echo "Generating ZFlap documentation..."

# Check if Doxygen is installed
if ! command -v doxygen &> /dev/null; then
    echo "Error: Doxygen is not installed. Please install it using:"
    echo "  brew install doxygen"
    exit 1
fi

# Generate documentation
doxygen Doxyfile

if [ $? -eq 0 ]; then
    echo "Documentation generated successfully!"
    echo "Open docs/html/index.html in your browser to view the documentation."
else
    echo "Error: Failed to generate documentation."
    exit 1
fi
