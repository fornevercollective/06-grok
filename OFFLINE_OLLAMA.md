# Grok — Offline Ollama layout (when released)

When an official or community **Grok** model is available for local/Ollama use, store manifests and library metadata under the existing qbitOS Ollama registry mirror:

**Canonical path**

`/Volumes/qbitOS/03.models/01-ollama/manifests/registry.ollama.ai/library`

**Related storage**

- **Content-addressed blobs** (if using full Ollama layout): `/Volumes/qbitOS/03.models/01-ollama/blobs/`
- **Grok-specific notes and checkpoints** (training, exports, docs): `/Volumes/qbitOS/03.models/06-grok/`

**When populated**

1. Add or sync the model under `…/library/<namespace>/<model>` (or `library/<model>` if un-namespaced), matching Ollama’s usual tree.
2. Record the exact **image/tag or digest** and **pull date** in `VERSIONS.md` in this folder (create or append).

This file exists so agents and humans do not guess paths when the offline artifact ships.
