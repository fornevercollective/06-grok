from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import uvicorn, json

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"])

state = {
    "activeAgents": {"Oppie": True, "Leo": True, "Enrico": True, "Hans": True},
    "tasks": [],
    "isPaused": False,
    "depth": 4
}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    await websocket.send_text(json.dumps({"type":"state", "state":state}))
    
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            # Handle commands (same logic as Node.js)
            if msg["type"] == "toggleAgent":
                state["activeAgents"][msg["name"]] = msg["value"]
            # ... (add other handlers)
            
            update = json.dumps({"type":"state", "state":state})
            for client in app.websocket_clients:
                await client.send_text(update)
    except:
        pass

if __name__ == "__main__":
    print("🚄 Grok Railway Server (Python + uv) running on ws://localhost:8080")
    uvicorn.run(app, host="0.0.0.0", port=8080)
