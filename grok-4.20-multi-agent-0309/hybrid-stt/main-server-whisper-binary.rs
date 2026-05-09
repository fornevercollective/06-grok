use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::IntoResponse,
    routing::get,
    Router,
};
use futures_util::{SinkExt, StreamExt};
use ironraw::IronSession;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::process::Command;
use std::sync::{Arc, Mutex};
use tempfile::NamedTempFile;
use tokio::sync::broadcast;
use uuid::Uuid;

type SharedState = Arc<Mutex<RailwayState>>;
type Sessions = Arc<Mutex<HashMap<String, IronSession>>>;
type Tx = broadcast::Sender<String>;

#[derive(Serialize, Deserialize, Clone)]
struct RailwayState {
    active_agents: HashMap<String, bool>,
    tasks: Vec<Task>,
    is_paused: bool,
    depth: u32,
    last_intent: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
struct Task {
    id: String,
    title: String,
    stage: String,
    status: String,
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "type")]
enum ClientMessage {
    Join { client: String },
    ToggleAgent { name: String, value: bool },
    CreateTask { title: String },
    VoiceCommand { text: String },
    AudioData { data: Vec<u8> },           // Raw audio blob from browser
    Pause,
    Resume,
    ForceMerge,
    TerminalInput { session_id: String, text: String },
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
    println!("🚄 GROK TEAM RAILWAY v15 — Rust Server with Whisper");
    println!("WebSocket: ws://0.0.0.0:8080/ws");
    println!("Hybrid STT: Browser first → Server-side Whisper fallback");
    println!("Make sure whisper.cpp binary is in PATH as 'whisper-cli'");
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

    let session = IronSession::new(client_id.clone());
    sessions.lock().unwrap().insert(client_id.clone(), session.clone());

    println!("[Rust] {} connected — IronRaw session active", client_id);

    // Send initial state
    let current = state.lock().unwrap().clone();
    let init = serde_json::json!({
        "type": "state",
        "state": current,
        "terminal_text": session.terminal_text(),
        "client_id": client_id.clone()
    });
    let _ = socket.send(Message::Text(init.to_string())).await;

    loop {
        tokio::select! {
            Some(Ok(msg)) = socket.recv() => {
                match msg {
                    Message::Binary(audio_data) => {
                        log_and_broadcast(&tx, &format!("[AUDIO] Received {} bytes from {}", audio_data.len(), client_id));
                        let transcription = run_whisper_on_audio(&audio_data).await;
                        log_and_broadcast(&tx, &format!("[WHISPER] {}", transcription));
                        
                        if let Some(sess) = sessions.lock().unwrap().get_mut(&client_id) {
                            sess.output_lines.push(format!("[STT] {}", transcription));
                        }
                        
                        let result = serde_json::json!({
                            "type": "stt_result",
                            "text": transcription,
                            "confidence": 0.92
                        });
                        let _ = socket.send(Message::Text(result.to_string())).await;
                    }
                    Message::Text(text) => {
                        if let Ok(cmd) = serde_json::from_str::<ClientMessage>(&text) {
                            handle_command(cmd, &state, &sessions, &tx, &client_id).await;
                        }
                    }
                    Message::Close(_) => break,
                    _ => {}
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

async fn handle_command(
    cmd: ClientMessage,
    state: &SharedState,
    sessions: &Sessions,
    tx: &Tx,
    client_id: &str,
) {
    let mut s = state.lock().unwrap();
    let mut session_map = sessions.lock().unwrap();

    match cmd {
        ClientMessage::VoiceCommand { text } => {
            let intent = classify_voice_command(&text);
            s.last_intent = Some(intent.clone());
            log_and_broadcast(tx, &format!("[VOICE] {} → {}", text, intent));
        }
        ClientMessage::TerminalInput { session_id, text } => {
            if let Some(sess) = session_map.get_mut(&session_id) {
                sess.input_buffer = text;
                let resp = sess.submit_line();
                log_and_broadcast(tx, &format!("[TERMINAL] {}: {}", session_id, resp));
            }
        }
        ClientMessage::ToggleAgent { name, value } => {
            s.active_agents.insert(name.clone(), value);
            log_and_broadcast(tx, &format!("[AGENT] {} toggled to {}", name, value));
        }
        ClientMessage::CreateTask { title } => {
            let task = Task {
                id: format!("R{}", 1000 + s.tasks.len()),
                title,
                stage: "POLL".to_string(),
                status: "ON RAIL".to_string(),
            };
            s.tasks.insert(0, task);
            log_and_broadcast(tx, &format!("[TASK] New task created"));
        }
        ClientMessage::Pause => { s.is_paused = true; log_and_broadcast(tx, "[SYSTEM] Railway paused"); }
        ClientMessage::Resume => { s.is_paused = false; log_and_broadcast(tx, "[SYSTEM] Railway resumed"); }
        ClientMessage::ForceMerge => {
            for t in &mut s.tasks { t.status = "MERGED".to_string(); }
            log_and_broadcast(tx, "[HITL] Force merge executed");
        }
        _ => {}
    }

    let update = serde_json::json!({ "type": "state", "state": s.clone() });
    let _ = tx.send(update.to_string());
}

fn classify_voice_command(text: &str) -> String {
    let lower = text.to_lowercase();
    if lower.contains("pause") { "pause".into() }
    else if lower.contains("resume") { "resume".into() }
    else if lower.contains("merge") { "force_merge".into() }
    else if lower.contains("steno") { "export_steno".into() }
    else { "unknown".into() }
}

async fn run_whisper_on_audio(audio_data: &[u8]) -> String {
    // Save to temporary WAV file
    let temp_file = match tempfile::Builder::new()
        .prefix("whisper_audio_")
        .suffix(".webm")
        .tempfile()
    {
        Ok(f) => f,
        Err(_) => return "Failed to create temp file".to_string(),
    };

    if let Err(e) = std::fs::write(temp_file.path(), audio_data) {
        return format!("Failed to write audio: {}", e);
    }

    // Call whisper.cpp CLI (assumes `whisper-cli` is in PATH)
    let output = Command::new("whisper-cli")
        .arg(temp_file.path())
        .arg("--model")
        .arg("models/ggml-base.en.bin")   // Change to your model
        .arg("--output-txt")
        .output();

    match output {
        Ok(o) if o.status.success() => {
            String::from_utf8_lossy(&o.stdout).trim().to_string()
        }
        Ok(o) => format!("Whisper failed: {}", String::from_utf8_lossy(&o.stderr)),
        Err(e) => format!("Failed to run whisper-cli: {}", e),
    }
}

fn log_and_broadcast(tx: &Tx, message: &str) {
    println!("{}", message);
    let log_msg = serde_json::json!({
        "type": "log",
        "text": message
    });
    let _ = tx.send(log_msg.to_string());
}
