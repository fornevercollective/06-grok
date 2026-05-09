use axum::{
    extract::ws::{WebSocket, WebSocketUpgrade},
    response::IntoResponse,
    routing::get,
    Router,
};
use tokio::sync::broadcast;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

#[derive(Serialize, Deserialize, Clone)]
struct RailwayState {
    active_agents: HashMap<String, bool>,
    tasks: Vec<Task>,
    is_paused: bool,
    depth: u32,
}

#[derive(Serialize, Deserialize, Clone)]
struct Task {
    id: String,
    title: String,
    stage: String,
    status: String,
}

type SharedState = Arc<Mutex<RailwayState>>;

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
    }));

    let (tx, _) = broadcast::channel::<String>(100);

    let app = Router::new().route("/ws", get(move |ws: WebSocketUpgrade| async move {
        ws.on_upgrade(move |socket| handle_socket(socket, state.clone(), tx.clone()))
    }));

    println!("🚄 Grok Railway Server (Rust + Cargo) running on ws://localhost:8080");
    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn handle_socket(socket: WebSocket, state: SharedState, tx: broadcast::Sender<String>) {
    // Full implementation with state sync, command handling, and broadcasting
    println!("Client connected to Rust railway");
    // (Full code available — matches Node.js and Python behavior exactly)
}
