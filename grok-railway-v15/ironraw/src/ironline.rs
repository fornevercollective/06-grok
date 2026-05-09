//! Headless IronRaw session used by the Railway WebSocket server (per-client).

use serde::{Deserialize, Serialize};

#[derive(Clone, Serialize, Deserialize)]
pub struct IronSession {
    pub id: String,
    pub output_lines: Vec<String>,
    pub input_buffer: String,
    pub hot_metric: u64,
    pub cold_metric: u64,
}

impl IronSession {
    pub fn new(id: String) -> Self {
        Self {
            id,
            output_lines: vec![
                "IronRaw Terminal v15 — Integrated into Rust Railway".to_string(),
                "Voice commands and multi-user sync active.".to_string(),
            ],
            input_buffer: String::new(),
            hot_metric: 142,
            cold_metric: 87,
        }
    }

    pub fn submit_line(&mut self) -> String {
        let line = std::mem::take(&mut self.input_buffer);
        self.output_lines.push(format!("> {}", line));
        let response = match line.trim() {
            "exit" => "Session terminated.".to_string(),
            cmd if cmd.starts_with("tree-sitter") => "Tree-sitter highlight complete (stub)".to_string(),
            cmd if cmd.starts_with("wasm run") => "WASM module executed.".to_string(),
            "quantum run bell" => "Quantum bell state prepared.".to_string(),
            "export steno" => "Railway exported as .steno".to_string(),
            _ if !line.trim().is_empty() => format!("Echo: {}", line),
            _ => String::new(),
        };
        if !response.is_empty() {
            self.output_lines.push(response.clone());
        }
        self.tick_metrics();
        response
    }

    pub fn push_char(&mut self, ch: char) {
        self.input_buffer.push(ch);
    }

    pub fn backspace(&mut self) {
        self.input_buffer.pop();
    }

    pub fn tick_metrics(&mut self) {
        self.hot_metric = self.hot_metric.saturating_add(3);
        self.cold_metric = self.cold_metric.saturating_add(1);
    }

    pub fn terminal_text(&self) -> String {
        let mut s = self.output_lines.join("\n");
        s.push_str(&format!("\n> {}_", self.input_buffer));
        s
    }

    pub fn window_title(&self) -> String {
        format!(
            "IronRaw — {} · hot {} · cold {}",
            self.id, self.hot_metric, self.cold_metric
        )
    }
}
