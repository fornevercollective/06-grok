// server.js - Run with: npm install ws && node server.js
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

let railwayState = {
  activeAgents: { Oppie: true, Leo: true, Enrico: true, Hans: true },
  tasks: [],
  isPaused: false,
  depth: 4,
  connectedClients: 0
};

console.log("Grok Isomorphic Railway Server running on ws://localhost:8080");

wss.on('connection', (ws) => {
  railwayState.connectedClients++;
  console.log(`Client connected. Total: ${railwayState.connectedClients}`);

  // Send current state
  ws.send(JSON.stringify({ type: "state", state: railwayState }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === "toggleAgent") {
        railwayState.activeAgents[data.name] = data.value;
      } else if (data.type === "createTask") {
        railwayState.tasks.unshift({
          id: "R" + Math.floor(Math.random()*90000),
          title: data.title,
          stage: "POLL",
          status: "ON RAIL"
        });
      } else if (data.type === "pause") railwayState.isPaused = true;
      else if (data.type === "resume") railwayState.isPaused = false;
      else if (data.type === "forceMerge") {
        railwayState.tasks.forEach(t => t.status = "MERGED");
      }

      // Broadcast new state to ALL clients
      const update = JSON.stringify({ type: "state", state: railwayState });
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(update);
      });

    } catch (e) { console.error(e); }
  });

  ws.on('close', () => {
    railwayState.connectedClients--;
    console.log(`Client disconnected. Total: ${railwayState.connectedClients}`);
  });
});
