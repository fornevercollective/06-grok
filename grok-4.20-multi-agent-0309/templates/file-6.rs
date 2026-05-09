use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::IntoResponse,
    routing::get,
    Router,
};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::broadcast;
use uuid::Uuid;

// ====================== IRONRAW TERMINAL CORE ======================
#[derive(Clone)]
struct IronSession {
    id: String,
    output_lines: Vec<String>,
    input_buffer: String,
    hot_metric: u64,
    cold_metric: u64,
}

impl IronSession {
    fn new(id: String) -> Self {
        Self {
            id,
            output_lines: vec![
                "IronRaw Terminal v15".to_string(),
                "Type commands or speak voice commands.".to_string(),
                "Metrics: hot/cold ops (live)".to_string(),
            ],
            input_buffer: String::new(),
            hot_metric: 142,
            cold_metric: 87,
        }
    }

    fn submit_line(&mut self) -> String {
        let line = std::mem::take(&mut self.input_buffer);
        self.output_lines.push(format!("> {}", line));

        let response = match line.trim() {
            "exit" => "Session terminated.".to_string(),
            cmd if cmd.starts_with("tree-sitter highlight") => {
                format!("Tree-sitter highlighted: {}", cmd.trim_start_matches("tree-sitter highlight "))
            }
            cmd if cmd.starts_with("wasm run") => {
                format!("WASM executed: {}", cmd.trim_start_matches("wasm run "))
            }
            "quantum run bell" => "Quantum bell state prepared.".to_string(),
            "export steno" => "Railway state exported as .steno".to_string(),
            _ if !line.trim().is_empty() => format!("Echo: {}", line),
            _ => "Empty command.".to_string(),
        };

        self.output_lines.push(response.clone());
        self.tick_metrics();
        response
    }

    fn push_char(&mut self, ch: char) {
        self.input_buffer.push(ch);
    }

    fn backspace(&mut self) {
        self.input_buffer.pop();
    }

    fn tick_metrics(&mut self) {
        self.hot_metric = self.hot_metric.saturating_add(3);
        self.cold_metric = self.cold_metric.saturating_add(1);
    }

    fn terminal_text(&self) -> String {
        let mut s = self.output_lines.join("\n");
        s.push_str(&format!("\n> {}_", self.input_buffer));
        s
    }

    fn window_title(&self) -> String {
        format!(
            "IronRaw #{} — Hot: {} ops/s · Cold: {} ops/s",
            self.id, self.hot_metric, self.cold_metric
        )
    }
}

// ====================== SERVER STATE ======================
#[derive(Serialize, Deserialize, Clone)]
struct Task {
    id: String,
    title: String,
    stage: String,
    status: String,
}

#[derive(Serialize, Deserialize, Clone)]
struct RailwayState {
    active_agents: HashMap<String, bool>,
    tasks: Vec<Task>,
    is_paused: bool,
    depth: u32,
    last_intent: Option<String>,
}

type SharedState = Arc<Mutex<RailwayState>>;
type Sessions = Arc<Mutex<HashMap<String, IronSession>>>;
type Tx = broadcast::Sender<String>;

#[derive(Serialize, Deserialize)]
#[serde(tag = "type")]
enum ClientMessage {
    Join { client: String },
    ToggleAgent { name: String, value: bool },
    CreateTask { title: String },
    VoiceCommand { text: String },
    Pause,
    Resume,
    ForceMerge,
    TerminalInput { session_id: String, text: String },
    TerminalBackspace { session_id: String },
}

// ====================== MAIN ======================
#[tokio::main]
async fn main() {
    let state = Arc::new(Mutex::new(RailwayState {
        active_agents: HashMap::from([
            ("Oppie".into(), true),
            ("Leo".into(), true),
            ("Enrico".into(), true),
            ("Hans".into(), true),
        ]),
        tasks: vec![],
        is_paused: false,
        depth: 4,
        last_intent: None,
    }));

    let sessions: Sessions = Arc::new(Mutex::new(HashMap::new()));
    let (tx, _) = broadcast::channel::<String>(512);

    let app = Router::new().route("/ws", get(move |ws: WebSocketUpgrade| async move {
        ws.on_upgrade(move |socket| {
            handle_socket(socket, state.clone(), sessions.clone(), tx.clone())
        })
    }));

    println!("\n{}", "=".repeat(80));
    println!("🚄 GROK TEAM RAILWAY v15 (Rust + IronRaw Terminal Integration)");
    println!("WebSocket: ws://0.0.0.0:8080/ws");
    println!("Dashboard: Open railway-v14.html (or v15.html)");
    println!("Voice commands, live terminal per client, PyTorch-style intent routing, multi-user sync");
    println!("{}", "=".repeat(80));

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn handle_socket(
    mut socket: WebSocket,
    state: SharedState,
    sessions: Sessions,
    tx: Tx,
) {
    let client_id = format!("Client-{}", Uuid::new_v4().simple());
    let mut rx = tx.subscribe();

    // Create IronRaw session for this client
    let session = IronSession::new(client_id.clone());
    sessions.lock().unwrap().insert(client_id.clone(), session.clone());

    println!("[Rust] {} connected — IronRaw session created", client_id);

    // Send initial state + terminal content
    send_initial_state(&mut socket, &state, &session).await;

    loop {
        tokio::select! {
            Some(Ok(msg)) = socket.recv() => {
                match msg {
                    Message::Text(text) => {
                        if let Ok(cmd) = serde_json::from_str::<ClientMessage>(&text) {
                            handle_client_command(cmd, &state, &sessions, &tx, &client_id).await;
                        }
                    }
                    Message::Close(_) => break,
                    _ => continue,
                }
            }
            Ok(update) = rx.recv() => {
                let _ = socket.send(Message::Text(update)).await;
            }
        }
    }

    sessions.lock().unwrap().remove(&client_id);
    println!("[Rust] {} disconnected", client_id);
}

async fn send_initial_state(socket: &mut WebSocket, state: &SharedState, session: &IronSession) {
    let current_state = state.lock().unwrap().clone();
    let init_msg = serde_json::json!({
        "type": "state",
        "state": current_state,
        "terminal_text": session.terminal_text(),
        "window_title": session.window_title(),
        "client_id": session.id,
    });
    let _ = socket.send(Message::Text(init_msg.to_string())).await;
}

async fn handle_client_command(
    cmd: ClientMessage,
    state: &SharedState,
    sessions: &Sessions,
    tx: &Tx,
    client_id: &str,
) {
    let mut s = state.lock().unwrap();
    let mut session_map = sessions.lock().unwrap();
    let session = session_map.get_mut(client_id);

    match cmd {
        ClientMessage::ToggleAgent { name, value } => {
            s.active_agents.insert(name.clone(), value);
            log_and_broadcast(tx, &format!("[AGENT] {} toggled → {}", name, value));
        }
        ClientMessage::CreateTask { title } => {
            let task = Task {
                id: format!("R{}", 1000 + s.tasks.len()),
                title,
                stage: "POLL".to_string(),
                status: "ON RAIL".to_string(),
            };
            s.tasks.insert(0, task.clone());
            log_and_broadcast(tx, &format!("[TASK] {} created", task.id));
        }
        ClientMessage::VoiceCommand { text } => {
            let intent = classify_voice_command(&text);
            s.last_intent = Some(intent.clone());
            log_and_broadcast(tx, &format!("[VOICE] '{}' → {}", text, intent));

            if let Some(sess) = session {
                if intent == "export_steno" {
                    sess.output_lines.push("Exported as .steno (Rust)".to_string());
                } else if intent == "force_merge" {
                    s.tasks.iter_mut().for_each(|t| t.status = "MERGED".to_string());
                }
            }
        }
        ClientMessage::TerminalInput { session_id, text } => {
            if let Some(sess) = session_map.get_mut(&session_id) {
                sess.input_buffer = text;
                let response = sess.submit_line();
                log_and_broadcast(tx, &format!("[TERMINAL] {}: {}", session_id, response));
            }
        }
        ClientMessage::TerminalBackspace { session_id } => {
            if let Some(sess) = session_map.get_mut(&session_id) {
                sess.backspace();
            }
        }
        ClientMessage::Pause => {
            s.is_paused = true;
            log_and_broadcast(tx, &format!("[SYSTEM] Railway paused by {}", client_id));
        }
        ClientMessage::Resume => {
            s.is_paused = false;
            log_and_broadcast(tx, &format!("[SYSTEM] Railway resumed by {}", client_id));
        }
        ClientMessage::ForceMerge => {
            for task in &mut s.tasks {
                task.status = "MERGED".to_string();
            }
            log_and_broadcast(tx, &format!("[HITL] Force merge by {}", client_id));
        }
        _ => {}
    }

    // Broadcast updated state to all clients (including dashboard)
    let update = serde_json::json!({
        "type": "state",
        "state": s.clone()
    });
    let _ = tx.send(update.to_string());
}

fn log_and_broadcast(tx: &Tx, message: &str) {
    println!("{}", message);
    let log_msg = serde_json::json!({
        "type": "log",
        "text": message
    });
    let _ = tx.send(log_msg.to_string());
}
