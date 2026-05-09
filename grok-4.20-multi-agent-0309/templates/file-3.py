from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import uvicorn, json, torch, torch.nn as nn, torch.optim as optim
from typing import List

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"])

# ====================== REAL PYTORCH TRAINING ======================
class IntentClassifier(nn.Module):
    def __init__(self):
        super().__init__()
        self.fc = nn.Sequential(
            nn.Linear(16, 64),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, 8)
        )
    
    def forward(self, x):
        return self.fc(x)

model = IntentClassifier()
optimizer = optim.Adam(model.parameters(), lr=0.01)
criterion = nn.CrossEntropyLoss()

# Training dataset (command -> intent index)
training_data = [
    ("pause railway", 0), ("stop the railway", 0),
    ("resume railway", 1), ("start the railway", 1),
    ("force merge", 2), ("merge everything", 2),
    ("export steno", 3), ("save as steno", 3),
    ("export json", 4),
    ("hop on opp", 5), ("hop on leo", 5), ("hop on enrico", 5), ("hop on hans", 5),
    ("hop off opp", 6), ("hop off leo", 6),
    ("increase depth", 7), ("decrease depth", 7),
]

def train_model(epochs=80):
    model.train()
    for epoch in range(epochs):
        total_loss = 0
        for text, label in training_data:
            # Simple bag-of-words embedding (16-dim)
            vec = torch.zeros(16)
            for i, char in enumerate(text[:16]):
                vec[i % 16] = ord(char) / 255.0
            vec = vec.unsqueeze(0)
            
            optimizer.zero_grad()
            output = model(vec)
            loss = criterion(output, torch.tensor([label]))
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
        if epoch % 20 == 0:
            print(f"[PyTorch] Epoch {epoch} - Loss: {total_loss/len(training_data):.4f}")
    print("[PyTorch] Training completed. Model is now live for voice intent classification.")

# Train on startup
train_model()

intent_map = ["pause", "resume", "merge", "export_steno", "export_json", "hop_on", "hop_off", "depth_change"]

def classify_command(text: str) -> str:
    model.eval()
    vec = torch.zeros(1, 16)
    for i, char in enumerate(text.lower()[:16]):
        vec[0, i % 16] = ord(char) / 255.0
    with torch.no_grad():
        output = model(vec)
        predicted = output.argmax(dim=1).item()
    return intent_map[predicted]

# ====================== STATE ======================
state = {
    "activeAgents": {"Oppie": True, "Leo": True, "Enrico": True, "Hans": True},
    "tasks": [],
    "isPaused": False,
    "depth": 4
}

clients: List[WebSocket] = []

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    clients.append(websocket)
    await websocket.send_text(json.dumps({"type": "state", "state": state}))
    
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            
            if msg["type"] == "toggleAgent":
                state["activeAgents"][msg["name"]] = msg["value"]
            elif msg["type"] == "createTask":
                state["tasks"].insert(0, {"id": f"R{len(state['tasks'])+1000}", "title": msg.get("title","New Task"), "stage": "POLL", "status": "ON RAIL"})
            elif msg["type"] == "voice_command":
                intent = classify_command(msg.get("text",""))
                state["lastIntent"] = intent
                print(f"[PyTorch] Classified voice command '{msg['text']}' → {intent}")
            
            update = json.dumps({"type": "state", "state": state})
            for client in clients[:]:
                try:
                    await client.send_text(update)
                except:
                    clients.remove(client)
    except:
        if websocket in clients:
            clients.remove(websocket)

if __name__ == "__main__":
    print("🚄 Grok Railway Server (Python + uv + REAL PyTorch Training)")
    print("PyTorch model trained on voice intent dataset.")
    uvicorn.run(app, host="0.0.0.0", port=8080)
