from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import uvicorn, json, torch, torch.nn as nn
from typing import Dict

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"])

# ====================== DUMMY PYTORCH MODEL ======================
class DummyVoiceClassifier(nn.Module):
    def __init__(self):
        super().__init__()
        self.fc = nn.Sequential(
            nn.Linear(16, 32),
            nn.ReLU(),
            nn.Linear(32, 8)  # 8 possible intents
        )
    
    def forward(self, x):
        return self.fc(x)

model = DummyVoiceClassifier()
intent_map = ["pause", "resume", "merge", "export_steno", "hop_on", "hop_off", "increase_depth", "clear"]

def classify_voice_command(text: str) -> str:
    # Dummy embedding
    vec = torch.randn(1, 16) * 0.1
    with torch.no_grad():
        out = model(vec)
        idx = out.argmax().item()
    return intent_map[idx % len(intent_map)]

# ====================== STATE ======================
state = {
    "activeAgents": {"Oppie": True, "Leo": True, "Enrico": True, "Hans": True},
    "tasks": [],
    "isPaused": False,
    "depth": 4
}

clients = []

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    clients.append(websocket)
    await websocket.send_text(json.dumps({"type":"state", "state":state}))
    
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            
            if msg["type"] == "toggleAgent":
                state["activeAgents"][msg["name"]] = msg["value"]
            elif msg["type"] == "createTask":
                state["tasks"].insert(0, {"id": f"R{len(state['tasks'])+1000}", "title": msg["title"], "stage": "POLL", "status": "ON RAIL"})
            elif msg["type"] == "voice_command":
                intent = classify_voice_command(msg["text"])
                state["lastIntent"] = intent
                print(f"[PyTorch] Classified voice command as: {intent}")
            
            update = json.dumps({"type":"state", "state":state})
            for client in clients:
                try:
                    await client.send_text(update)
                except:
                    clients.remove(client)
    except:
        if websocket in clients:
            clients.remove(websocket)

if __name__ == "__main__":
    print("🚄 Grok Railway Server (Python + uv + PyTorch) running on ws://localhost:8080")
    print("PyTorch dummy model loaded for voice intent classification")
    uvicorn.run(app, host="0.0.0.0", port=8080)
