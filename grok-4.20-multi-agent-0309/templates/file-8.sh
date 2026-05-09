# 1. Create project
uv init grok-railway
cd grok-railway

# 2. Install dependencies
uv add fastapi uvicorn[standard] websockets torch torchvision torchaudio --extra cpu

# 3. Save the code below as server.py
# 4. Run:
uv run server.py
