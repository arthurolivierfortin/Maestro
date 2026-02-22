# Phase 38 — Checkpoint

## 38-A : Sandbox images
**Statut** : DONE
**Entites creees** : SandboxImage, SandboxCheckpoint (TypeScript interfaces in sandbox-manager.ts)
**Manager** : SandboxManager (CLI-local, git worktrees, .maestro/sandboxes/)
**CLI create/list/inspect/delete/provision/destroy** : OUI
**Tests** : 14 (all passing)
**Commit** : de0fdf6

## 38-B : Integration sessions
**Statut** : DONE
**--sandbox flag** : OUI — auto-provisions worktree, sets options.repo
**--checkpoint flag** : OUI — selects checkpoint (default: first)
**Worktree isole** : OUI — agent works in worktree, original repo untouched
**_sandbox variable** : OUI — {imageId, checkpointId, worktreePath} stored for audit/replay
**reset-sandbox** : OUI — destroys + re-provisions at same path, updates _sandbox variable
**Volume de sortie persist** : NON (not implemented — artifacts live in worktree, not separate /output/)
**E2E verified** : OUI — Cantante sandbox create → session create --sandbox → verify _sandbox → reset-sandbox → verify content changed → cleanup
**Tests** : 15 (all passing, +1 resetWorktree test)
**Commit** : 43341e9

## 38-C : Batch testing
**Statut** : DONE
**Commande** : `maestro foundry test <block-id> --sandbox <id> --all-checkpoints`
**Options** : `--checkpoints a,b` (filter), `--input-key` (default: repoPath), `--input key=value` (extra inputs), `--json`
**Flow** : For each checkpoint → provision worktree → execute block via API → collect result → destroy worktree → report
**Rapport** : Per-checkpoint OK/FAIL/ERROR + duration + tokens, aggregate fitness (pass rate)
**JSON output** : OUI — structured results with per-checkpoint outputs and summary
**Failure reporting** : OUI — lists failed checkpoints with error messages
**E2E verified** : OUI — 3 checkpoints on Cantante, tested OK (100%), FAIL (0%), and filtered (2/3)
**Implementation** : `batchTestBlock()` in cli.ts (~120 lines), wired to `foundry test` subcommand
**Backend changes** : NONE — CLI-side orchestration using existing block execute API

## 38-D : Docker sandbox
**Statut** : DONE
**Architecture** : Dispatch in SandboxManager by `image.type` ('git-worktree' vs 'docker'), no new class
**createDocker()** : OUI — validates Dockerfile, copies scripts, builds Docker image (`maestro-sandbox-<id>`)
**provisionDocker()** : OUI — `docker run -d` with volume mounts (/workspace, /output, /checkpoints), container marker file
**destroyDocker()** : OUI — `docker stop` + `docker rm`, cleans mount dir, preserves /output
**Type dispatch** : OUI — provisionWorktree, destroyWorktree, resetWorktree, inspect, delete all route by type
**Container marker** : `.maestro-container` file in mount dir enables destroyWorktree to route correctly
**CLI** : `sandbox create --type docker --dockerfile <path> --checkpoint "name:script.sh"`
**Inspect** : Shows script paths for docker, git refs for git-worktree
**Delete** : Stops containers, removes Docker image, cleans dirs
**Output volume** : `.maestro/sandboxes/<id>/output/` — persists across resets
**Tests** : 22 (15 git-worktree + 7 docker: detect, reject no Dockerfile, reject missing script, create, inspect, provision+verify, delete)
**E2E verified** : OUI — create docker sandbox, list (type=docker), inspect (scripts), batch test (2 checkpoints 100% fitness, verified stdout from checkpoint script), delete
**Anti-patterns followed** : Docker not required (isDockerAvailable check), no multi-container, no Docker Hub, no Compose
