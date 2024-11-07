# Use a base image with Node.js
FROM node:18-buster

# Install necessary packages for VS Code extension testing and Python
RUN apt-get update && apt-get install -y \
    xvfb \
    libgtk2.0-dev \
    libgtk-3-dev \
    libnotify-dev \
    libgconf-2-4 \
    libnss3 \
    libxss1 \
    libasound2 \
    libxtst6 \
    xauth \
    python3 \
    python3-pip \
    xvfb

# Set the working directory
WORKDIR /app

# Set environment variables for Xvfb
ENV DISPLAY=:99

# Copy the entire project directory into the container
COPY extension /app/extension
COPY requirements.txt /app
COPY eval-runner.py /app

# Install Python dependencies
RUN pip3 install -r requirements.txt

# Set the entrypoint to run the Python script
ENTRYPOINT ["sh", "-c", "Xvfb :99 -screen 0 1024x768x16 & python3 eval-runner.py"]