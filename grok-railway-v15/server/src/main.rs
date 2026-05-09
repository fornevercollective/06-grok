use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::{Html, Redirect},
    routing::{get, get_service},
    Router,
};
use ironraw::IronSession;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tokio::sync::broadcast;
use tower_http::services::ServeFile;
use uuid::Uuid;

type SharedState = Arc<Mutex<RailwayState>>;
type Sessions = Arc<Mutex<HashMap<String, IronSession>>>;
type Tx = broadcast::Sender<String>;

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RailwayState {
    active_agents: HashMap<String, bool>,
    tasks: Vec<Task>,
    is_paused: bool,
    depth: u32,
    last_intent: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Task {
    id: String,
    title: String,
    stage: String,
    status: String,
}

#[derive(Deserialize, Serialize)]
#[serde(tag = "type")]
enum ClientMessage {
    #[serde(rename = "join")]
    Join {
        client: String,
        #[serde(default)]
        role: Option<String>,
    },
    #[serde(rename = "toggleAgent")]
    ToggleAgent { name: String, value: bool },
    #[serde(rename = "createTask")]
    CreateTask { title: String },
    #[serde(rename = "voice_command")]
    VoiceCommand { text: String },
    #[serde(rename = "pause")]
    Pause,
    #[serde(rename = "resume")]
    Resume,
    #[serde(rename = "forceMerge")]
    ForceMerge,
    #[serde(rename = "export")]
    Export { format: String },
    TerminalInput { session_id: String, text: String },
    TerminalBackspace { session_id: String },
}

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

    let static_root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..");
    let dashboard_path = static_root.join("railway-v15.html");

    let app = Router::new()
        .route(
            "/ws",
            get(move |ws: WebSocketUpgrade| async move {
                ws.on_upgrade(move |socket| {
                    handle_socket(socket, state.clone(), sessions.clone(), tx.clone())
                })
            }),
        )
        .route(
            "/",
            get(|| async { Redirect::permanent("/railway-v15.html") }),
        )
        .route_service(
            "/railway-v15.html",
            get_service(ServeFile::new(dashboard_path)),
        )
        .route("/help", get(dashboard_help));

    println!("🚄 Grok Railway v15 (Rust + ironraw::IronSession)");
    println!("   Dashboard:  http://127.0.0.1:8080/railway-v15.html  (or / — live file from disk, refresh after edits)");
    println!("   WebSocket:  ws://127.0.0.1:8080/ws");
    println!("   Avoid file:// — use HTTP above so the browser allows WebSocket.");
    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn dashboard_help() -> Html<&'static str> {
    Html(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Grok Railway v15 — how to connect</title>
<style>
body{font-family:system-ui,sans-serif;max-width:42rem;margin:2rem auto;padding:0 1rem;line-height:1.5}
code{background:#eee;padding:0 .2rem}
</style>
</head>
<body>
<h1>Grok Railway v15</h1>
<p><strong>Pasting <code>ws://127.0.0.1:8080/ws</code> in the address bar shows a blank page</strong> — browsers do not render WebSocket URLs as a website.</p>
<p>Open <code>railway-v15.html</code> from disk (double-click) or serve the folder, then use the WebSocket URL in the dashboard’s input field.</p>
<p>WebSocket endpoint: <code>ws://127.0.0.1:8080/ws</code></p>
</body>
</html>"#,
    )
}

async fn handle_socket(mut socket: WebSocket, state: SharedState, sessions: Sessions, tx: Tx) {
    let client_id = format!("Client-{}", Uuid::new_v4().simple());
    let mut rx = tx.subscribe();

    let session = IronSession::new(client_id.clone());
    sessions.lock().unwrap().insert(client_id.clone(), session);

    let _ = broadcast_snapshot(&state, &sessions, &tx, None, &client_id);

    loop {
        tokio::select! {
            msg = socket.recv() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        if let Ok(cmd) = serde_json::from_str::<ClientMessage>(&text) {
                            handle_client_command(cmd, &state, &sessions, &tx, &client_id).await;
                            let sess = sessions.lock().unwrap().get(&client_id).cloned();
                            let _ = broadcast_snapshot(&state, &sessions, &tx, sess.as_ref(), &client_id);
                        }
                    }
                    Some(Ok(Message::Close(_))) | None => break,
                    _ => {}
                }
            }
            Ok(update) = rx.recv() => {
                let _ = socket.send(Message::Text(update)).await;
            }
        }
    }

    sessions.lock().unwrap().remove(&client_id);
    let _ = broadcast_snapshot(&state, &sessions, &tx, None, &client_id);
}

fn terminal_map(sessions: &Sessions) -> HashMap<String, String> {
    sessions
        .lock()
        .unwrap()
        .iter()
        .map(|(k, v)| (k.clone(), v.terminal_text()))
        .collect()
}

fn broadcast_snapshot(
    state: &SharedState,
    sessions: &Sessions,
    tx: &Tx,
    updated_session: Option<&IronSession>,
    client_id: &str,
) -> Result<usize, broadcast::error::SendError<String>> {
    let current_state = state.lock().unwrap().clone();
    let clients: Vec<String> = sessions.lock().unwrap().keys().cloned().collect();
    let terminal_by_client = terminal_map(sessions);

    let fallback = sessions.lock().unwrap().get(client_id).cloned();
    let term = updated_session
        .map(|s| s.terminal_text())
        .or_else(|| fallback.as_ref().map(|s| s.terminal_text()))
        .unwrap_or_default();
    let title = updated_session
        .map(|s| s.window_title())
        .or_else(|| fallback.as_ref().map(|s| s.window_title()))
        .unwrap_or_default();

    let update = serde_json::json!({
        "type": "state",
        "state": current_state,
        "terminalText": term,
        "terminalByClient": terminal_by_client,
        "windowTitle": title,
        "clientId": client_id,
        "clients": clients,
    });
    tx.send(update.to_string())
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

    match cmd {
        ClientMessage::Join { client, role } => {
            let label = format!("[JOIN] {client} {:?}", role);
            log_and_broadcast(tx, &label);
        }
        ClientMessage::ToggleAgent { name, value } => {
            s.active_agents.insert(name.clone(), value);
            log_and_broadcast(tx, &format!("[AGENT] {name} toggled → {value}"));
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
            log_and_broadcast(tx, &format!("[VOICE] '{}' → {intent}", text.trim()));

            if let Some(sess) = session_map.get_mut(client_id) {
                match intent.as_str() {
                    "export_steno" => sess
                        .output_lines
                        .push("Exported as .steno (Rust)".to_string()),
                    "force_merge" => {
                        s.tasks.iter_mut().for_each(|t| t.status = "MERGED".to_string());
                    }
                    "pause" => {
                        s.is_paused = true;
                    }
                    "resume" => {
                        s.is_paused = false;
                    }
                    _ => {}
                }
            }
        }
        ClientMessage::TerminalInput { session_id, text } => {
            if let Some(sess) = session_map.get_mut(&session_id) {
                sess.input_buffer = text;
                let response = sess.submit_line();
                log_and_broadcast(tx, &format!("[TERMINAL] {session_id}: {response}"));
            }
        }
        ClientMessage::TerminalBackspace { session_id } => {
            if let Some(sess) = session_map.get_mut(&session_id) {
                sess.backspace();
            }
        }
        ClientMessage::Pause => {
            s.is_paused = true;
            log_and_broadcast(tx, &format!("[SYSTEM] Railway paused by {client_id}"));
        }
        ClientMessage::Resume => {
            s.is_paused = false;
            log_and_broadcast(tx, &format!("[SYSTEM] Railway resumed by {client_id}"));
        }
        ClientMessage::ForceMerge => {
            for task in &mut s.tasks {
                task.status = "MERGED".to_string();
            }
            log_and_broadcast(tx, &format!("[HITL] Force merge by {client_id}"));
        }
        ClientMessage::Export { format } => {
            log_and_broadcast(tx, &format!("[EXPORT] Requested {format}"));
        }
    }
}

fn classify_voice_command(text: &str) -> String {
    let lower = text.to_lowercase();
    if lower.contains("pause") {
        return "pause".into();
    }
    if lower.contains("resume") {
        return "resume".into();
    }
    if lower.contains("merge") || lower.contains("force merge") {
        return "force_merge".into();
    }
    if lower.contains("steno") {
        return "export_steno".into();
    }
    if lower.contains("hop on") || lower.contains("hop off") {
        return "agent_hop".into();
    }
    "unknown".into()
}

fn log_and_broadcast(tx: &Tx, message: &str) {
    println!("{message}");
    let log_msg = serde_json::json!({ "type": "log", "text": message });
    let _ = tx.send(log_msg.to_string());
}
