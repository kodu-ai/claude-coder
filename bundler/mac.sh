#!/bin/bash

# Check the processor type
ARCHITECTURE=$(uname -m)

# Set the URL for the appropriate VS Code version
if [ "$ARCHITECTURE" == "arm64" ]; then
  VSCODE_URL="https://update.code.visualstudio.com/latest/darwin-arm64/stable"
  echo "Detected Apple Silicon (M1/M2) architecture. Downloading ARM64 version of VS Code..."
else
  VSCODE_URL="https://update.code.visualstudio.com/latest/darwin/stable"
  echo "Detected Intel (x86_64) architecture. Downloading x86_64 version of VS Code..."
fi

# Check if Visual Studio Code is installed in the Applications folder
if [ ! -d "/Applications/Visual Studio Code.app" ]; then
  echo "Visual Studio Code is not installed. Installing now..."
  curl -L $VSCODE_URL -o vscode.zip
  unzip vscode.zip -d /Applications
  rm vscode.zip
else
  echo "Visual Studio Code is already installed in the Applications folder."
fi

# Install the VS Code extension
echo "Installing the VS Code extension..."
/Applications/Visual\ Studio\ Code.app/Contents/Resources/app/bin/code --install-extension kodu-ai.claude-dev-experimental

# Open VS Code and focus on the installed extension
echo "Opening Visual Studio Code and focusing on the extension..."
open -a "Visual Studio Code"
sleep 5
open "vscode://kodu-ai.claude-dev-experimental/kodu-claude-coder-main.plusButtonTapped"

echo "Installation and setup complete!"
