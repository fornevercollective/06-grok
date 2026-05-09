#!/bin/bash
echo "🚄 Starting Grok Railway v14 - All Backends"

gnome-terminal -- bash -c "cd rust && cargo run; exec bash" &
gnome-terminal -- bash -c "cd python && uv run server.py; exec bash" &
gnome-terminal -- bash -c "cd node && npm run dev; exec bash" &

echo "All servers launched in separate terminals."
echo "Open railway-v14.html in your browser."
