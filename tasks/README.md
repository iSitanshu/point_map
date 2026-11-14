# Task board

A folder-as-status board. A task's **status is the folder it sits in** — moving the file is the only state change, so nothing can disagree with itself.

```
tasks/
├── BOARD.md     ← the index; read this first
├── next/        ← agreed, specified, ready to pick up. Ordered by the number.
├── later/       ← worth doing, not now. No commitment implied.
└── done/        ← shipped. Includes what was actually verified.
```

## Conventions

- **Filename:** `T-0NN-short-slug.md`. Numbers are permanent and never reused, even if a task is dropped.
- **Moving a task:** `git mv tasks/next/T-015-*.md tasks/done/` — then update its `Status:` line and tick its acceptance criteria.
- **Every task states its acceptance criteria as checkboxes.** A task without a way to tell it is finished is not a task, it is a wish.
- **Every task names the files it expects to touch.** If that list is unknown, the task needs breaking down first.
- **Size limit:** anything estimated over a day gets split. Three of the v1 tasks were split for exactly this reason.
- Tasks link to the decision that governs them (`decisions/ADR-00NN`). If a task contradicts an ADR, one of the two is wrong — resolve that before writing code.

## Task file shape

```markdown
# T-0NN — Title

**Status:** next | in progress | done | dropped
**Priority:** P0 (blocks use) | P1 (next real pain) | P2 (nice)
**Estimate:** S (<2h) | M (half day) | L (day)
**Governed by:** ADR-0005

## Why
One paragraph. What breaks, or what the user cannot do today.

## Acceptance criteria
- [ ] Observable, checkable statements

## Files
Paths expected to change

## Notes
Gotchas, prior art, rejected approaches
```

## Priorities

| | Meaning |
|---|---|
| **P0** | The app is unusable or loses data without it |
| **P1** | The next thing that will actually annoy the user |
| **P2** | Real value, no pain if it never happens |

Priority is set against *the user's current week*, not against general importance. A deposit-refund tracker is P2 in month one and P0 in month eleven — re-prioritise rather than pre-build.
