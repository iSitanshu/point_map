# ADR-0003 — Vanilla ES modules, no build step, no framework

**Status:** Accepted · **Date:** 2026-11-14

## Context

The app is a map, a list, a form, a comparison table and a money dashboard. State is a single array of ~40 objects. The user's own framing was "easily I can update the location description and map" — the person maintaining this is the person using it, probably six months from now, probably wanting to add one field or change one label.

The default modern choice would be React + Vite + TypeScript. That default is worth examining rather than assuming.

## Options considered

| Option | Verdict |
|---|---|
| **React + Vite + TS** | Best ergonomics for complex UI; type safety on a 45-field schema is genuinely valuable. Costs `node_modules`, a dev server, a build step before anything runs, and a toolchain that rots — a six-month-old Vite project often needs an upgrade before it starts. Rejected. |
| **Svelte / Preact via CDN, no build** | Reactivity without a toolchain. Still a framework idiom to re-learn, and Svelte without a compiler loses its main advantage. Rejected. |
| **Single giant `index.html`** | Maximum portability, opens from disk. Becomes unnavigable past ~1,000 lines, and the brief asks for something maintainable. Rejected. |
| **Vanilla ES modules, many small files** | **Chosen.** |

## Decision

Plain ES modules, served statically, no dependencies for application code. The only external libraries are the map SDKs loaded from a CDN (ADR-0001).

Structure is one module per concern — `store.js`, `model.js`, `lib/money.js`, `map/*`, `ui/*` — each exporting named functions. State management is a 40-line observable store: `get()`, `update()`, `subscribe()`. Rendering is `render(container, state)` functions that rebuild their own subtree, which at this data volume is imperceptibly fast and removes every question about reconciliation.

Consciously given up: JSX, reactive bindings, a type checker.
Consciously kept: the ability to change a label, reload, and see it.

## Consequences

**Accepted:**
- Manual DOM construction is more verbose than JSX. Contained by one helper (`lib/util.js` → `el()`), which covers attributes, classes, datasets, events and children in a single call.
- No type checking on a large schema. Mitigated by making the schema itself data (`model.js` → `FIELD_GROUPS`), so forms, labels and validation all derive from one declaration that cannot drift from itself. This is where TypeScript would have earned its keep, and it is the real cost of this decision.
- Re-rendering whole panels would be wrong at 10,000 records. It is correct at 40, and the store can gain keyed updates later without touching the UI contract.
- ES modules need `http://`, so the app cannot be opened as a `file://` path. `start.sh` exists for exactly this and the README leads with it.

**Gained:**
- `git clone` → `./start.sh` → working app. No install, nothing to go stale, nothing to upgrade.
- Every file can be read and changed in a browser's devtools, on a phone, in six months, without recalling which bundler was fashionable.
- Zero supply-chain surface for application code.

## Revisit if

The app grows a second collaborator, or the money model needs tests complex enough to want a test runner. At that point Vite can be added over this structure incrementally — ES modules are already the input format a bundler wants.
