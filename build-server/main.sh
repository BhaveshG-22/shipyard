#!/bin/bash

export GIT_URL="$GIT_URL"
export GIT_ROOT="$GIT_ROOT"

# Initialize empty git repo
git init /home/app/output
cd /home/app/output

# Set remote and pull only sparse content
git remote add origin "$GIT_URL"
git sparse-checkout init --cone
git sparse-checkout set "$GIT_ROOT"
git pull origin main

# Move folder content to root
mv "$GIT_ROOT"/* .
rm -rf "$GIT_ROOT"

exec node /home/app/script.js
