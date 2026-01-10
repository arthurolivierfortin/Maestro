📚 Docs : MAESTRO-004 – Add comprehensive roadmap and contribution guides


# 🎯 Purpose
This PR adds a comprehensive project roadmap and several area-specific developer guides to help contributors and maintainers get up to speed quickly. The documentation clarifies project structure, development areas (agents, backend, frontend, workflow engine), and contribution expectations.

# 📋 Changes Summary
- Added `ROADMAP.md` at repository root describing the project's short- and mid-term roadmap, priorities, and milestone guidance.
- Added developer guides under `docs/`:
  - `docs/agents-and-tools-guide.md` — guidance for building agents and tools
  - `docs/backend-guide.md` — backend architecture and contributor workflow
  - `docs/frontend-guide.md` — frontend structure, component conventions, and local dev tips
  - `docs/workflow-engine-guide.md` — workflow engine internals and extension points
- Minor update to `README.md` to reference the new documentation and roadmap.

# 🏗️ Technical Details
- These are documentation-only changes — no source code, configuration, or build artifacts were modified.
- The new guides follow existing project conventions and ADRs (see `docs/adr/`) and surface rules from the Clean Architecture and code conventions documents.
- File locations:
  - `ROADMAP.md` — high-level milestones, release cadence, and area owners
  - `docs/agents-and-tools-guide.md` — agent design patterns, prompt engineering notes, and recommended adapters
  - `docs/backend-guide.md` — layer responsibilities, service registration, and typical use-case patterns
  - `docs/frontend-guide.md` — React/TypeScript conventions, component structure, and testing guidance
  - `docs/workflow-engine-guide.md` — workflow node types, execution lifecycle, and monitoring hooks

# 🧪 Testing
- No automated tests are required for documentation changes. Manual checks recommended:
  - Verify links and relative references in Markdown render correctly.
  - Spell-check and grammar review.
  - Open major docs in VS Code Markdown preview or GitHub's preview to validate formatting.

# 📖 Documentation
- Files added:
  - `ROADMAP.md`
  - `docs/agents-and-tools-guide.md`
  - `docs/backend-guide.md`
  - `docs/frontend-guide.md`
  - `docs/workflow-engine-guide.md`
- File modified:
  - `README.md` (minor reference update)

# 🚀 Deployment Notes
- No deployment or runtime changes. Simply merge to `main` to make documentation available on the default branch and GitHub Pages (if configured).

# 🔗 Related Issues / PRs
- Branch: `copilot/create-roadmap-docs`
- Existing PR: Add comprehensive roadmap and area-specific development guides (may be already opened)

# 👥 Review Notes
- Focus review on:
  - Accuracy of architecture and process descriptions versus actual code (especially `backend/` and `frontend/` conventions).
  - Completeness of the roadmap: priorities, milestones, and suggested owners.
  - Consistency with ADRs in `docs/adr/`.
  - Broken links or typo fixes.
- Suggested reviewers: maintainers of `backend/`, `frontend/`, and `agents` areas.

# ✅ Checklist for Reviewers
- [ ] Confirm this is documentation-only (no behavior change).
- [ ] Validate links and relative references render correctly.
- [ ] Check that the roadmap milestones are realistic and aligned with current priorities.
- [ ] Suggest additions or items missing from area guides.

# Next Steps
- After approval, merge to `main`. Optionally, enable or update GitHub Pages / docs site to surface the new guides.
