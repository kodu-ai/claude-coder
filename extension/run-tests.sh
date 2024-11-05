#!/bin/bash

# Start Xvfb
Xvfb :99 -screen 0 1024x768x16 &

# Run tests
npm test
