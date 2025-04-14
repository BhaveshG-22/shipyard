#!/bin/bash

export GIT_URL="$GIT_URL"

# If GIT_ROOT is not passed, treat it as root clone
if [ -z "$GIT_ROOT" ] || [ "$GIT_ROOT" = "/" ]; then
  echo "📦 Cloning full repo (root)..."
  git clone "$GIT_URL" /home/app/output
  cd /home/app/output
else
  echo "📦 Cloning subfolder: $GIT_ROOT"
  git init /home/app/output
  cd /home/app/output

  git remote add origin "$GIT_URL"
  git sparse-checkout init --cone
  git sparse-checkout set "$GIT_ROOT"
  echo "📦 Pulling Branch: $GIT_BRANCH"
  git pull origin "$GIT_BRANCH"
  echo "📦 Pulled Branch: $GIT_BRANCH"

  mv "$GIT_ROOT"/* .
  rm -rf "$GIT_ROOT"
fi

exec node /home/app/script.js