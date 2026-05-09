# Hybrid STT reference bundle (Grok Railway)

Scripts and reference sources for **browser SpeechRecognition** with **Whisper.cpp CLI** fallback over WebSockets.

## Scripts

| File | Purpose |
|------|---------|
| `01-clone-build-whisper-cpp.sh` | Clone `ggerganov/whisper.cpp` and run `make` |
| `02-download-ggml-model.sh` | Download `base.en` GGML model (run from `whisper.cpp` or adjust paths) |
| `03-cargo-run-server.sh` | `cargo run` hint for the Rust server |

## Clients

- **`hybrid-stt-dashboard.html`** — Dark UI: browser STT, optional force-Whisper, `MediaRecorder` → binary WS frames.
- **`hybrid-stt-dashboard-alt.html`** — Simpler hybrid flow.
- **`railway-console-light-stub.html`** — Light-theme shell sketch (nav / inspector / main); not feature-complete vs `grok-railway-v15/railway-v15.html`.

## Server (reference)

- **`grok-railway-server.Cargo.toml`** — Axum + `ironraw` path pattern; align with your workspace crate name.
- **`main-server-whisper-binary.rs`** — Handles `Message::Binary` by writing a temp file and shelling out to `whisper-cli`. Expects `whisper-cli` on `PATH` and a valid model path (edit `run_whisper_on_audio`).

**Note:** Merge selectively into `grok-railway-v15/server` rather than blind copy; the live project may already have routing, static files, and `IronSession` wiring.

## Requirements

- `whisper-cli` (or adjust to your whisper.cpp binary name).
- Model file such as `models/ggml-base.en.bin` where the Rust command expects it.
- Serve the HTML over **http(s)** so WebSocket and mic permissions behave; avoid `file://`.
