use axum::{
    extract::ws::{WebSocket, WebSocketUpgrade, Message},
    response::IntoResponse,
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::broadcast;
use uuid::Uuid;
use futures_util::StreamExt;

// ====================== DATA STRUCTURES ======================
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

#[derive(Serialize, Deserialize)]
struct ClientMessage {
    #[serde(flatten)]
    payload: MessageType,
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "type")]
enum MessageType {
    Join { client: String },
    ToggleAgent { name: String, value: bool },
    CreateTask { title: String },
    VoiceCommand { text: String },
    Pause,
    Resume,
    ForceMerge,
    Export { format: String },
}

type SharedState = Arc<Mutex<RailwayState>>;
type Tx = broadcast::Sender<String>;

// ====================== STATE INITIALIZATION ======================
fn initial_state() -> RailwayState {
    RailwayState {
        active_agents: HashMap::from([
            ("Oppie".to_string(), true),
            ("Leo".to_string(), true),
            ("Enrico".to_string(), true),
            ("Hans".to_string(), true),
        ]),
        tasks: vec![],
        is_paused: false,
        depth: 4,
        last_intent: None,
    }
}

// Simple intent classifier (Rust version of PyTorch model)
fn classify_voice_command(text: &str) -> String {
    let lower = text.to_lowercase();
    if lower.contains("pause") { "pause".to_string() }
    else if lower.contains("resume") { "resume".to_string() }
    else if lower.contains("merge") { "force_merge".to_string() }
    else if lower.contains("steno") { "export_steno".to_string() }
    else if lower.contains("json") { "export_json".to_string() }
    else if lower.contains("hop on") { "hop_on".to_string() }
    else if lower.contains("hop off") { "hop_off".to_string() }
    else if lower.contains("depth") { "depth_change".to_string() }
    else if lower.contains("clear") { "clear_staging".to_string() }
    else { "unknown".to_string() }
}

// ====================== MAIN ======================
#[tokio::main]
async fn main() {
    let state = Arc::new(Mutex::new(initial_state()));
    let (tx, _) = broadcast::channel::<String>(256);

    let app = Router::new().route("/ws", get(move |ws: WebSocketUpgrade| async move {
        ws.on_upgrade(move |socket| handle_socket(socket, state.clone(), tx.clone()))
    }));

    println!("\n{}", "=".repeat(70));
    println!("🚄 GROK TEAM RAILWAY SERVER v14 (Rust + Axum)");
    println!("WebSocket endpoint: ws://0.0.0.0:8080/ws");
    println!("Dashboard ready → Open railway-v14.html in multiple browsers");
    println!("Full parity with Python (PyTorch) and Node.js versions");
    println!("{}", "=".repeat(70));

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn handle_socket(mut socket: WebSocket, state: SharedState, tx: Tx) {
    let client_id = format!("Client-{}", Uuid::new_v4().simple());
    let mut rx = tx.subscribe();

    println!("[Rust] {} connected", client_id);

    // Send current state
    {
        let current_state = state.lock().unwrap().clone();
        let msg = serde_json::json!({
            "type": "state",
            "state": current_state
        });
        let _ = socket.send(Message::Text(msg.to_string())).await;
    }

    // Broadcast updated client list
    let _ = tx.send(serde_json::json!({
        "type": "clients",
        "clients": vec![client_id.clone()]
    }).to_string());

    loop {
        tokio::select! {
            // Incoming message from client
            Some(Ok(msg)) = socket.recv() => {
                let text = match msg {
                    Message::Text(t) => t,
                    Message::Close(_) => break,
                    _ => continue,
                };

                match serde_json::from_str::<MessageType>(&text) {
                    Ok(cmd) => handle_command(cmd, &state, &tx, &client_id).await,
                    Err(e) => eprintln!("[Rust] JSON parse error: {}", e),
                }
            }

            // Broadcasted updates from other clients
            Ok(update) = rx.recv() => {
                let _ = socket.send(Message::Text(update)).await;
            }
        }
    }

    println!("[Rust] {} disconnected", client_id);
}

async fn handle_command(cmd: MessageType, state: &SharedState, tx: &Tx, client_id: &str) {
    let mut s = state.lock().unwrap();

    match cmd {
        MessageType::ToggleAgent { name, value } => {
            s.active_agents.insert(name.clone(), value);
            log_to_all(tx, &format!("[AGENT] {} toggled to {} by {}", name, value, client_id));
        }
        MessageType::CreateTask { title } => {
            let task = Task {
                id: format!("R{}", 1000 + s.tasks.len()),
                title,
                stage: "POLL".to_string(),
                status: "ON RAIL".to_string(),
            };
            s.tasks.insert(0, task.clone());
            log_to_all(tx, &format!("[TASK] New task created: {}", task.id));
        }
        MessageType::VoiceCommand { text } => {
            let intent = classify_voice_command(&text);
            s.last_intent = Some(intent.clone());
            log_to_all(tx, &format!("[VOICE] {} → {}", text, intent));
        }
        MessageType::Pause => {
            s.is_paused = true;
            log_to_all(tx, &format!("[SYSTEM] Railway paused by {}", client_id));
        }
        MessageType::Resume => {
            s.is_paused = false;
            log_to_all(tx, &format!("[SYSTEM] Railway resumed by {}", client_id));
        }
        MessageType::ForceMerge => {
            for task in &mut s.tasks {
                task.status = "MERGED".to_string();
            }
            log_to_all(tx, &format!("[HITL] Force merge executed by {}", client_id));
        }
        _ => {}
    }

    // Broadcast updated state
    let update = serde_json::json!({
        "type": "state",
        "state": s.clone()
    });
    let _ = tx.send(update.to_string());
}

fn log_to_all(tx: &Tx, message: &str) {
    println!("{}", message);
    let log_msg = serde_json::json!({
        "type": "log",
        "text": message
    });
    let _ = tx.send(log_msg.to_string());
}
