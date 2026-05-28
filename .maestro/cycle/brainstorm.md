# Brainstorm — Monitor Page (Phase 66-E)

**Date:** 2026-05-27
**Roadmap phase:** Phase-66 (sub-phase 66-E)
**Tags:** [code-app]

## Problem

L'utilisateur ne peut pas voir combien il depense en tokens, l'usage par session, ni les limites de couts configures. Le Monitor page est critique pour le positionnement "production-grade orchestrator" — fitness mesurable, couts visibles.

## Decisions

- Page MonitorPage SIMPLE — cost summary + limits + per-session costs. PAS la version desktop 852 lignes.
- Backend API : /api/costs/summary (totaux), /api/costs/limits (spending guardrails), /api/sessions/{id}/costs (per-session)
- Reutiliser getStats() de providerService.ts deja fait pour models page (ne pas dupliquer)
- Tab 5 dans Header

## Scope (in)

- costsService.ts (getCostSummary, getCostLimits, getSessionCosts)
- useCostData hook (fetch summary + limits, polling 30s)
- MonitorPage (cost summary cards, limits display, session costs table)
- CostCard component (metric name, value, icon/color)
- SpendingBar component (usage vs limit, visual progress bar)
- Navigation tab 5

## Scope (out)

- Spending guardrail config/edit UI — cycle ulterieur
- Cost alerts/notifications — cycle ulterieur
- Historical cost graphs (chart.js etc.) — cycle ulterieur
- Fitness scores display — needs contracts API wiring, cycle ulterieur
- Per-block cost breakdown — cycle ulterieur

## Architecture

MonitorPage.tsx fetch /api/costs/summary + /api/costs/limits via costsService.ts. CostCard shows total tokens, total cost, sessions count. SpendingBar shows usage vs daily limit. Si limits non configurees, affiche "No limits set".

## TESTING-PROTOCOL layers applicable

- [x] Layer 1: Type Check
- [x] Layer 2: Unit Tests (costsService + useCostData)
