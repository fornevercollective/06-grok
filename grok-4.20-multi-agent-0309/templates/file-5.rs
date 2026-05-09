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

// ====================== DATA STRUCTURES ======================
#[derive(Serialize, Deserialize, Clone, Default)]
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
#[serde(tag = "type")]
enum ClientMessage {
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
type BroadcastTx = broadcast::Sender<String>;

// ====================== INITIAL STATE ======================
fn initial_state() -> RailwayState {
    RailwayState {
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
    }
}

// Simple Rust voice intent classifier (mirrors PyTorch version)
fn classify_voice_command(text: &str) -> String {
    let lower = text.to_lowercase();
    if lower.contains("pause") {
        "pause".into()
    } else if lower.contains("resume") {
        "resume".into()
    } else if lower.contains("merge") {
        "force_merge".into()
    } else if lower.contains("steno") {
        "export_steno".into()
    } else if lower.contains("json") {
        "export_json".into()
    } else if lower.contains("hop on") {
        "hop_on".into()
    } else if lower.contains("hop off") {
        "hop_off".into()
    } else if lower.contains("depth") {
        "depth_change".into()
    } else if lower.contains("clear") {
        "clear_staging".into()
    } else {
        "unknown".into()
    }
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
    println!("🚄 GROK TEAM RAILWAY SERVER v14 (Rust + Axum) — FULL PARITY");
    println!("WebSocket endpoint → ws://0.0.0.0:8080/ws");
    println!("Dashboard ready → open railway-v14.html in multiple browsers");
    println!("Supports real multi-user, voice commands, PyTorch-style intent routing");
    println!("{}", "=".repeat(70));

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080")
        .await
        .expect("bind failed");
    axum::serve(listener, app).await.unwrap();
}

async fn handle_socket(mut socket: WebSocket, state: SharedState, tx: BroadcastTx) {
    let client_id = format!("Client-{}", Uuid::new_v4().simple());
    let mut rx = tx.subscribe();

    println!("[Rust] {} connected", client_id);

    // Send initial state
    {
        let current = state.lock().unwrap().clone();
        let msg = serde_json::json!({ "type": "state", "state": current });
        let _ = socket.send(Message::Text(msg.to_string())).await;
    }

    // Broadcast updated client list
    let _ = tx.send(
        serde_json::json!({
            "type": "clients",
            "clients": vec![client_id.clone()]
        })
        .to_string(),
    );

    loop {
        tokio::select! {
            // Message from this client
            Some(Ok(msg)) = socket.recv() => {
                match msg {
                    Message::Text(text) => {
                        if let Ok(cmd) = serde_json::from_str::<ClientMessage>(&text) {
                            handle_client_message(cmd, &state, &tx, &client_id).await;
                        }
                    }
                    Message::Close(_) => break,
                    _ => continue,
                }
            }

            // Broadcast from other clients
            Ok(update) = rx.recv() => {
                let _ = socket.send(Message::Text(update)).await;
            }
        }
    }

    println!("[Rust] {} disconnected", client_id);
}

async fn handle_client_message(
    msg: ClientMessage,
    state: &SharedState,
    tx: &BroadcastTx,
    client_id: &str,
) {
    let mut s = state.lock().unwrap();

    match msg.payload {
        MessageType::ToggleAgent { name, value } => {
            s.active_agents.insert(name.clone(), value);
            log_to_all(tx, &format!("[AGENT] {} set to {} by {}", name, value, client_id));
        }
        MessageType::CreateTask { title } => {
            let task = Task {
                id: format!("R{}", 1000 + s.tasks.len()),
                title,
                stage: "POLL".to_string(),
                status: "ON RAIL".to_string(),
            };
            s.tasks.insert(0, task.clone());
            log_to_all(tx, &format!("[TASK] {} created by {}", task.id, client_id));
        }
        MessageType::VoiceCommand { text } => {
            let intent = classify_voice_command(&text);
            s.last_intent = Some(intent.clone());
            log_to_all(tx, &format!("[VOICE] '{}' → {} (from {})", text, intent, client_id));
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
            for t in &mut s.tasks {
                t.status = "MERGED".to_string();
            }
            log_to_all(tx, &format!("[HITL] Force merge by {}", client_id));
        }
        MessageType::Export { format } => {
            log_to_all(tx, &format!("[EXPORT] {} requested by {}", format, client_id));
        }
        _ => {}
    }

    // Broadcast new state to everyone
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
