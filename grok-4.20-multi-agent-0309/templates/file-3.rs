use axum::{
    extract::ws::{WebSocket, WebSocketUpgrade, Message},
    response::IntoResponse,
    routing::get,
    Router,
};
use tokio::sync::broadcast;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

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
type Tx = broadcast::Sender<String>;

#[derive(Serialize, Deserialize)]
struct ClientMessage {
    #[serde(flatten)]
    kind: MessageType,
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
}

#[tokio::main]
async fn main() {
    let state = Arc::new(Mutex::new(RailwayState {
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
    }));

    let (tx, _) = broadcast::channel::<String>(200);

    let app = Router::new().route("/ws", get(move |ws: WebSocketUpgrade| async move {
        ws.on_upgrade(move |socket| handle_socket(socket, state.clone(), tx.clone()))
    }));

    println!("🚄 Grok Railway Server (Rust + Cargo) — Full Feature Parity");
    println!("Listening on ws://0.0.0.0:8080");
    
    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn handle_socket(mut socket: WebSocket, state: SharedState, tx: Tx) {
    let mut rx = tx.subscribe();

    // Send current state
    {
        let s = state.lock().unwrap().clone();
        let _ = socket.send(Message::Text(serde_json::to_string(&serde_json::json!({
            "type": "state",
            "state": s
        })).unwrap())).await;
    }

    loop {
        tokio::select! {
            msg = socket.recv() => {
                let msg = match msg {
                    Some(Ok(Message::Text(text))) => text,
                    _ => break,
                };
                
                if let Ok(cmd) = serde_json::from_str::<MessageType>(&msg) {
                    let mut s = state.lock().unwrap();
                    match cmd {
                        MessageType::ToggleAgent { name, value } => { s.active_agents.insert(name, value); },
                        MessageType::CreateTask { title } => {
                            s.tasks.insert(0, Task {
                                id: format!("R{}", s.tasks.len() + 1000),
                                title,
                                stage: "POLL".to_string(),
                                status: "ON RAIL".to_string(),
                            });
                        },
                        MessageType::VoiceCommand { text } => {
                            s.last_intent = Some(text.clone());
                            println!("[Rust] Voice command received: {}", text);
                        },
                        MessageType::Pause => s.is_paused = true,
                        MessageType::Resume => s.is_paused = false,
                        MessageType::ForceMerge => s.tasks.iter_mut().for_each(|t| t.status = "MERGED".to_string()),
                        _ => {},
                    }

                    let update = serde_json::to_string(&serde_json::json!({
                        "type": "state",
                        "state": s.clone()
                    })).unwrap();
                    let _ = tx.send(update);
                }
            }
            Ok(update) = rx.recv() => {
                let _ = socket.send(Message::Text(update)).await;
            }
        }
    }
}
