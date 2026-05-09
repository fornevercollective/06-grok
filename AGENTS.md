# AGENTS.md — Grok & model volume (`03.models/06-grok`)

This folder is the **home for Grok-related work** on qbitOS: documentation for agents, offline layout conventions, and pointers to training vs inference trees elsewhere on the volume.

It **extends and merges** context from:

- `/Volumes/qbitOS/AGENTS.md` — qbitOS root, volume layout, agent guidelines
- `/Volumes/qbitOS/AGENTS_USERS_TREF.md` — `/Users/tref` hub, UV-Speed, space constraints

---

## System overview (qbitOS + tref)

- **`/Volumes/qbitOS`**: Primary high-capacity storage for **qbitOS / UV-Speed** — checkpoints, backups, GitHub clones, engines (`llama.cpp`, `vllm`), and **`03.models`**.
- **`/Users/tref`**: Interactive hub (near capacity). **Large artifacts belong on `/Volumes/qbitOS`**, not under home.

---

## `03.models` layout (numbered trees)

| Prefix | Path | Role |
|--------|------|------|
| **μ / evolving stack** | `03.models/00-mu` | Tensor / transformer / training experiments (μgrad-related). |
| **Ollama offline mirror** | `03.models/01-ollama/` | Manifests under `manifests/registry.ollama.ai/library`; blobs under `01-ollama/blobs/`. |
| **Checkpoints** | `03.models/02-checkpoints/` | e.g. LoRA / router training runs. |
| **Backups** | `03.models/03-backups/` | Snapshots. |
| **Requirements** | `03.models/04-requirements/` | Dependency pins / lists as used by your workflow. |
| **Tinygrad models** | `03.models/05-tinygrad-model/` | Tinygrad training artifacts and models. |
| **Grok (this tree)** | `03.models/06-grok/` | Grok docs, version log, offline Ollama notes; optional weights exports here if you keep them separate from `01-ollama`. |

**Legacy note:** An empty sibling folder `03.models/grok` may exist from early layout; **`06-grok` is the canonical Grok project folder** going forward.

---

## Offline Grok → Ollama registry path (when released)

When a Grok-compatible bundle is available for local/Ollama-style use, the **manifest/library mirror** lives at:

`/Volumes/qbitOS/03.models/01-ollama/manifests/registry.ollama.ai/library`

Details and a version table: **`OFFLINE_OLLAMA.md`** and **`VERSIONS.md`** in this directory.

---

## xAI API & docs (reference)

- **REST base:** `https://api.x.ai` — `Authorization: Bearer <XAI_API_KEY>`
- **Documentation MCP (search/list pages):** `https://docs.x.ai/api/mcp` — tools such as `search_docs`, `get_doc_page`, `list_doc_pages`, `get_llms_txt`
- **Protos:** `https://github.com/xai-org/xai-proto`

Use these for cloud Grok; use **`01-ollama/.../library`** plus this folder for **offline** parity once mirrored.

---

## Merged guidelines (from root `AGENTS.md`)

1. **Large files**: Store models, datasets, and big builds on **`/Volumes/qbitOS`**.
2. **Repos**: Prefer **`/Volumes/qbitOS/github/`** for qbitOS org work.
3. **Compliance**: See each repo’s `README.qmd` for Control Envelope rules.

---

## Merged guidelines (from `AGENTS_USERS_TREF.md`)

1. **Gold standard**: Sensitive work in `uvspeed/` — run `uvspeed-bridge pre` before changes where applicable.
2. **Space**: Keep **`/Users/tref`** light; **`/Volumes/qbitOS`** for bulk.
3. **Launch**: Portable stack via `/Users/tref/uv-speed-portable/launch.sh` when working in that tree.

---

## Iron Line / QPU (brief)

- **Iron Line L0–L7**: Boot through security/rendering layers (see user agent doc for latency tiers).
- **QPU**: `ibm_miami`; optimal patch rows 0–2, cols 4–9 for μgrad work; avoid listed noisy qubits in `AGENTS_USERS_TREF.md`.

---

## Agent instructions specific to this folder

1. Prefer **`06-grok`** for new Grok-specific docs, manifests sidecars, and training notes.
2. When mirroring **offline** Grok into Ollama layout, use **`01-ollama/manifests/registry.ollama.ai/library`** and update **`VERSIONS.md`**.
3. Do not fill **`/Users/tref`** with weights; use **`03.models`** paths above.
