# Decisions

Architecture Decision Records. One file per decision that was expensive to make or will be expensive to reverse.

Each record states the **context**, the **options actually considered**, the **decision**, and the **consequences we accepted**. A decision is never recorded without its rejected alternatives — the alternatives are the useful part when revisiting it later.

| # | Decision | Status |
|---|---|---|
| [0001](ADR-0001-map-provider.md) | OpenStreetMap by default, Google Maps behind one adapter | Accepted |
| [0002](ADR-0002-local-first-storage.md) | Local-first storage, no backend, no accounts | Accepted |
| [0003](ADR-0003-no-build-step.md) | Vanilla ES modules, no build step, no framework | Accepted |
| [0004](ADR-0004-marker-readability.md) | Three-tier zoom detail, colour by status, 25-pill cap | Accepted |
| [0005](ADR-0005-money-model.md) | Seven money inputs, two headline numbers, three lenses | Accepted |
| [0006](ADR-0006-schema-driven-forms.md) | One required field; schema-driven progressive forms | Accepted |
| [0007](ADR-0007-media-handling.md) | Slot-based media across three storage routes | Accepted |
| [0008](ADR-0008-post-move-in-scope.md) | Ship the post-move-in ledger in v1, not v2 | Accepted |

## Status values

- **Proposed** — written, not yet acted on
- **Accepted** — implemented, or being implemented now
- **Superseded by ADR-00xx** — kept for history; never delete a record

## Writing a new one

Copy the shape of an existing file. Number sequentially. If a decision turns out wrong, do not edit the old record — write a new one that supersedes it and say why the first was wrong. The record of a bad call is worth more than a tidy folder.
