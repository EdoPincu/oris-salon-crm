#!/bin/bash
# Double-click launcher for Ori's Salon CRM.
# Starts the dev server if it isn't already running, then opens the app.

cd "$(dirname "$0")"

URL="http://localhost:3000"

if curl -s -o /dev/null -w "%{http_code}" --max-time 2 "$URL" 2>/dev/null | grep -q "200\|307\|308"; then
  echo "Server already running — opening browser."
  open "$URL"
else
  echo "Starting the dev server..."
  osascript -e 'tell application "Terminal" to do script "cd '"$(pwd)"' && npm run dev"'

  echo "Waiting for it to come up..."
  for i in $(seq 1 30); do
    sleep 1
    if curl -s -o /dev/null --max-time 2 "$URL" 2>/dev/null; then
      break
    fi
  done

  open "$URL"
fi
