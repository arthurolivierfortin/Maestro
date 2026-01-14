# Block Schema Reference

This document summarizes the `block.json` schema fields and common files expected for each `blockType`.

Common fields:

- `id` (string): Optional. Defaults to folder name.
- `name` (string): Human-readable name.
- `version` (string): Semver-like string.
- `blockType` (string): One of `prompt`, `tool`, `agent`, `workflow`, `inference`, `decision`, `validator`, `trigger`.
- `isAtomic` (bool): Whether the block should run as a single atomic operation.
- `description` (string): Short description.
- `metadata` (object): Arbitrary metadata (author, tags, createdAt).
- `config` (object): Type-specific configuration.

Files per type:

- Prompt: `template.md` or `config.templateFile`.
- Tool: `script.sh` (or `scriptFile`) and `schema.json` for I/O.
- Agent: `system-prompt.md`, `tools.json`.
- Workflow: `nodes.json`, `connections.json`.
- Inference: `prompts/` and `output-schema.json`.
- Decision: `condition.txt`.
- Validator: `schema.json`.
- Trigger: `trigger.json`.

See `docs/schemas/block.schema.json` for the authoritative JSON Schema.
