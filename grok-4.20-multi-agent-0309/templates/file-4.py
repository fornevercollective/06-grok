clients_info = []
# When client connects:
clients_info.append({"id": "Client-"+str(len(clients_info)), "role": "user"})
await websocket.send_text(json.dumps({"type": "clients", "clients": [c["id"] for c in clients_info]}))
