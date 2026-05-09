const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

let state = {
  activeAgents: { Oppie: true, Leo: true, Enrico: true, Hans: true },
  tasks: [],
  isPaused: false,
  depth: 4
};

console.log("🚄 Grok Railway Server (Node.js/npm) running on ws://localhost:8080");

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({type:"state", state}));

  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.type === "toggleAgent") state.activeAgents[msg.name] = msg.value;
    if (msg.type === "createTask") state.tasks.unshift({id:"R"+Date.now()%99999, title:msg.title, stage:"POLL", status:"ON RAIL"});
    if (msg.type === "pause") state.isPaused = true;
    if (msg.type === "resume") state.isPaused = false;
    if (msg.type === "forceMerge") state.tasks.forEach(t => t.status = "MERGED");

    const update = JSON.stringify({type:"state", state});
    wss.clients.forEach(c => c.readyState === WebSocket.OPEN && c.send(update));
  });
});
