# ADR-0006 — One required field; schema-driven progressive forms

**Status:** Accepted · **Date:** 2026-11-14

## Context

Two facts pull in opposite directions.

The user asked for richness: *"phone number, name, all different forms for the location… another location stores a different set of information."* A park, a mess and a PG each want different fields.

The brainstorm's top risk was the opposite: **field fatigue kills the app**. Twelve required fields per PG at 11pm while a broker's message is still on screen means the pin never gets saved.

Both are right. The resolution is that the schema can be large as long as the *obligation* is tiny.

## Options considered

| Option | Verdict |
|---|---|
| **Hand-written form per `kind`** (one for PG, one for food, …) | Best-fitting forms. Four forms to keep in sync with the model; adding a field means editing several files. Rejected. |
| **One flat form with every field** | Trivial to write, brutal to use — a 45-field wall at 11pm. Rejected. |
| **Required-field validation to keep data clean** | Standard practice, and exactly wrong here: it blocks the save, and a blocked save means no record at all. Rejected. |
| **One declarative schema → progressive-disclosure form, one required field** | **Chosen.** |

## Decision

**The schema is data.** `app/model.js` exports `FIELD_GROUPS`: an array of groups, each with fields declaring `path`, `label`, `type`, `options`, `hint`, `width`. The add/edit form, the detail drawer, the compare table and CSV export all derive from it. Adding a field is **one line in one file** and it appears everywhere, correctly labelled, with no form code touched. This also stands in for the type checker given up in ADR-0003 — there is one declaration to drift from, so nothing can drift.

**Exactly one required input: the pin location.** Name auto-fills to `Pin near <area>`. Every other field is optional forever. A record with a pin and a rent is a legitimate, useful record.

**Progressive disclosure.** Groups beyond *Essentials* (Money detail · Room · Food · Rules · Ratings · Commute · Research) render collapsed. The user opens what they know.

**A completeness ring, not red asterisks.** Each record shows how filled-in it is as a quiet ring. It invites completion without punishing a save — the difference between a nudge and a blocker.

**Edit in place, not in a modal.** Negotiation happens live on a phone call: *"if you drop ₹1,000 and I pay two months advance"* must become a new TMC while the owner is still talking. Rent, deposit and brokerage are inline number inputs in the detail drawer that recompute on every keystroke. The full form exists for the other 40 fields, where a modal is fine.

**Paste-a-WhatsApp-message.** One textarea extracts rent (`15000`, `15k`, `₹15,000`), deposit, sharing, food, phone (`[6-9]\d{9}`) and brokerage into **confirmable chips** — never auto-saved silently. This is where the brainstorm's "60 seconds to capture" requirement is actually won, so it ships in v1 rather than v2.

## Consequences

**Accepted:**
- Sparse data. Most points will have 7–15 of 45 fields filled. The money engine is built for this (ADR-0005: missing is never zero), and the compare table hides all-empty rows automatically.
- A declarative schema is less flexible than bespoke forms for genuinely odd field types — ratings and tags needed custom renderers, and a third such type would need another. Acceptable at three.
- No validation means typos persist (₹150000 for ₹15000). Mitigated by rendering money as formatted Indian currency live beside the input, where an extra zero is visually obvious.
- Two editing paths (inline for three money fields, form for the rest) is a small inconsistency, accepted because the negotiation scenario justifies it.

**Gained:**
- Capture is genuinely fast, which is the difference between a complete dataset and an abandoned one.
- Gandhi Park, Dabbu Veg and Sai PG coexist with no special-casing: same schema, different fields filled.
- Changing a label or adding "pets allowed" is a one-line edit by someone who has forgotten how the app works.

## Revisit if

Three or more field types need custom renderers, or the user asks for per-`kind` field ordering — both point toward per-kind schema *views* over the same field declarations, which this structure supports without a rewrite.
