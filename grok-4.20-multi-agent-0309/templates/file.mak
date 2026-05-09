# ================================================
# Grok Railway v14 - Makefile (Docker Alternative)
# ================================================

.PHONY: all rust python node dashboard clean

all: rust python node

# === Rust Backend ===
rust:
	cd rust && cargo run

rust-build:
	cd rust && cargo build --release

# === Python Backend (uv + PyTorch) ===
python:
	cd python && uv run server.py

python-train:
	cd python && uv run -m python -c "
import server
server.train_model(50)
print('Training completed')
"

# === Node.js Backend ===
node:
	cd node && npm run dev

# === Frontend Dashboard ===
dashboard:
	@echo "Opening dashboard..."
	@if command -v xdg-open > /dev/null; then xdg-open railway-v14.html; \
	elif command -v open > /dev/null; then open railway-v14.html; \
	else echo "Please open railway-v14.html manually"; fi

# === Run multiple backends in background ===
multi:
	@echo "Starting all backends..."
	@tmux new-session -d -s railway 'cd rust && cargo run'
	@tmux split-window -h -t railway 'cd python && uv run server.py'
	@tmux split-window -v -t railway 'cd node && npm run dev'
	@tmux attach -t railway

# === Cleanup ===
clean:
	cd rust && cargo clean
	cd python && rm -rf __pycache__ .venv
	cd node && rm -rf node_modules

help:
	@echo "Available commands:"
	@echo "  make rust        → Run Rust server"
	@echo "  make python      → Run Python + PyTorch server"
	@echo "  make node        → Run Node.js server"
	@echo "  make multi       → Run all 3 in tmux (recommended)"
	@echo "  make dashboard   → Open HTML dashboard"
