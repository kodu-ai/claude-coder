# Use the official Node.js 18 LTS image as the base
FROM node:18-buster

ENV TEST_ARG=${TEST_ARG}

# Install dependencies for Electron/Chromium, Xvfb, and Python
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libxrender1 \
    libxshmfence1 \
    libxtst6 \
    xdg-utils \
    xvfb \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /app

# # Download VS Code for Linux ARM64
# RUN curl -L "https://update.code.visualstudio.com/1.95.1/linux-arm64/stable?released=true" -o vscode.tar.gz && \
#     tar -xzf vscode.tar.gz && \
#     rm vscode.tar.gz


COPY eval/eval-runner.py .
COPY eval/requirements.txt .

# Install Python dependencies
RUN pip3 install -r requirements.txt

# Create the extension directory
RUN mkdir -p extension

# Change to the extension directory
WORKDIR /app/extension

# Copy package.json and package-lock.json to install dependencies
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application code
COPY . .

# Install global dependencies (if any), such as typescript
RUN npm install -g typescript

# Compile the extension code
RUN npm run compile

# Compile the test code
RUN npm run compile-tests

# Set environment variables for Xvfb
ENV DISPLAY=:99


WORKDIR /app

# Start Xvfb and run the tests
CMD ["bash", "-c", "Xvfb :99 -screen 0 1024x768x16 & python3 eval-runner.py \"$@\"", "--"]

