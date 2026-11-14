/**
 * Add / edit a location.
 *
 * Built entirely from FIELD_GROUPS, so it never needs touching when the schema
 * changes. Two rules from ADR-0006 are visible here:
 *   - nothing is required except a location, and Save is never blocked
 *   - groups past Essentials and Money start collapsed
 */

import { el, deepClone, getPath, setPath, num, todayISO } from "../lib/util.js";
import { FIELD_GROUPS, newPoint, completeness, pointTitle } from "../model.js";
import { parseListingText } from "../lib/parse-whatsapp.js";
import { renderField } from "./fields.js";
import { openModal, confirmDialog, toast } from "./toast.js";
import * as store from "../store.js";

/* --------------------------------------------------------- completeness ring */

function renderRing(value) {
  const size = 34;
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const percent = Math.round(value * 100);

  return el("div", {
    class: "ring",
    title: `${percent}% filled in — every field is optional`,
  }, [
    el("svg", {
      width: size, height: size, viewBox: `0 0 ${size} ${size}`,
      html: `
        <circle cx="17" cy="17" r="${radius}" class="ring__track"></circle>
        <circle cx="17" cy="17" r="${radius}" class="ring__value"
          stroke-dasharray="${circumference}"
          stroke-dashoffset="${circumference * (1 - value)}"
          transform="rotate(-90 17 17)"></circle>`,
    }),
    el("span", { class: "ring__label", text: `${percent}%` }),
  ]);
}

/* ------------------------------------------------------- WhatsApp importer -- */

function openPasteDialog(onApply) {
  const textarea = el("textarea", {
    class: "control control--area",
    rows: 8,
    placeholder: "Paste the broker's message here…\n\n"
      + "e.g. \"Sai Krupa PG Andheri East, 3 sharing with food, rent 15k, "
      + "deposit 30000, brokerage 1 month, 9876543210\"",
  });

  const results = el("div", { class: "parse-results" });
  let parsed = { fields: [], name: "" };
  const chosen = new Set();

  const paint = () => {
    if (!parsed.fields.length && !parsed.name) {
      results.replaceChildren(el("p", {
        class: "muted",
        text: textarea.value.trim()
          ? "Nothing recognisable found — fill the form in by hand, it's quicker than fighting this."
          : "Paste a message above to see what can be pulled out of it.",
      }));
      return;
    }

    results.replaceChildren(
      el("p", { class: "parse-results__head", text: "Tap anything wrong to drop it. Nothing is saved until you press Apply." }),
      el("div", { class: "chips chips--parse" }, [
        parsed.name && el("button", {
          class: ["chip", "chip--parse", chosen.has("name") && "is-on"],
          type: "button",
          on: { click: () => { toggle("name"); paint(); } },
        }, [el("b", { text: "Name: " }), parsed.name]),

        ...parsed.fields.map((field) => el("button", {
          class: ["chip", "chip--parse", chosen.has(field.path) && "is-on"],
          type: "button",
          title: `matched on "${field.evidence}"`,
          on: { click: () => { toggle(field.path); paint(); } },
        }, [el("b", { text: `${field.label}: ` }), field.display])),
      ]),
    );
  };

  const toggle = (key) => (chosen.has(key) ? chosen.delete(key) : chosen.add(key));

  const reparse = () => {
    parsed = parseListingText(textarea.value);
    chosen.clear();
    if (parsed.name) chosen.add("name");
    for (const field of parsed.fields) chosen.add(field.path); // opt-out, not opt-in
    paint();
  };

  textarea.addEventListener("input", reparse);
  paint();

  const { close } = openModal({
    title: "Paste a broker's message",
    width: "620px",
    body: el("div", { class: "stack" }, [textarea, results]),
    footer: el("div", { class: "modal__actions" }, [
      el("button", { class: "btn", type: "button", text: "Cancel", on: { click: () => close() } }),
      el("button", {
        class: "btn btn--primary", type: "button", text: "Apply to form",
        on: {
          click: () => {
            const patch = [];
            if (parsed.name && chosen.has("name")) patch.push({ path: "name", value: parsed.name });
            for (const field of parsed.fields) {
              if (chosen.has(field.path)) patch.push({ path: field.path, value: field.value });
            }
            close();
            onApply(patch);
          },
        },
      }),
    ]),
  });

  setTimeout(() => textarea.focus(), 30);
}

/* ------------------------------------------------------------------- form -- */

/**
 * @param {object}   options
 * @param {string?}  options.pointId        editing an existing point
 * @param {object?}  options.initial        prefill (used when adding from a map click)
 * @param {Function?} options.onRequestPick ask the shell to let the user re-click the map
 */
export function openPointForm({ pointId = null, initial = {}, onRequestPick } = {}) {
  const existing = pointId ? store.pointById(pointId) : null;
  const draft = existing ? deepClone(existing) : newPoint(initial);
  if (!existing) Object.assign(draft, initial);

  const body = el("div", { class: "form" });
  const ringSlot = el("div", { class: "form__ring" });

  const refreshRing = () => ringSlot.replaceChildren(renderRing(completeness(draft)));

  const write = (path, value) => {
    setPath(draft, path, value);
    refreshRing();
    // A rejection needs its "why" field on screen immediately.
    if (path === "status") rebuild();
  };

  /* --- location row ---------------------------------------------------- */
  const locationSlot = el("div", { class: "form__location" });

  function locationRow() {
    const hasCoords = num(draft.lat) !== null && num(draft.lng) !== null;

    locationSlot.replaceChildren(el("div", { class: ["loc", !hasCoords && "loc--missing"] }, [
      el("div", { class: "loc__text" }, [
        el("strong", { text: hasCoords ? "📍 Location set" : "📍 No location yet" }),
        el("span", {
          class: "loc__coords",
          text: hasCoords
            ? `${Number(draft.lat).toFixed(5)}, ${Number(draft.lng).toFixed(5)}`
            : "Close this and click the map, or paste a Google Maps link below",
        }),
      ]),
      onRequestPick && el("button", {
        class: "btn btn--small",
        type: "button",
        text: hasCoords ? "Move pin" : "Pick on map",
        on: {
          click: () => {
            close();
            onRequestPick(draft, Boolean(existing));
          },
        },
      }),
    ]));
  }

  /* --- field groups ---------------------------------------------------- */
  function buildGroups() {
    return FIELD_GROUPS.map((group) => {
      const fieldsWrap = el("div", { class: "form__fields" },
        group.fields
          // The rejection reason only earns space once something is rejected.
          .filter((field) => field.path !== "rejectedReason" || draft.status === "rejected")
          .map((field) => renderField(field, getPath(draft, field.path), (value) => write(field.path, value))));

      const open = !group.collapsed || (group.id === "research" && draft.status === "rejected");

      return el("details", { class: "group", open }, [
        el("summary", { class: "group__head" }, [
          el("span", { class: "group__title", text: group.label }),
          el("span", { class: "group__count", text: `${group.fields.length} fields` }),
        ]),
        group.hint && el("p", { class: "group__hint", text: group.hint }),
        fieldsWrap,
      ]);
    });
  }

  const groupsSlot = el("div", { class: "form__groups" });
  const rebuild = () => {
    groupsSlot.replaceChildren(...buildGroups());
    refreshRing();
    locationRow();
  };

  body.append(
    el("div", { class: "form__top" }, [
      ringSlot,
      el("div", { class: "form__top-actions" }, [
        el("button", {
          class: "btn btn--small",
          type: "button",
          text: "📋 Paste a broker's message",
          on: {
            click: () => openPasteDialog((patch) => {
              for (const { path, value } of patch) setPath(draft, path, value);
              rebuild();
              toast(`Filled in ${patch.length} field${patch.length === 1 ? "" : "s"} — check them before saving`);
            }),
          },
        }),
      ]),
    ]),
    locationSlot,
    groupsSlot,
  );

  rebuild();

  /* --- save / delete ---------------------------------------------------- */
  function save() {
    draft.lastVerifiedAt = draft.lastVerifiedAt || todayISO();

    if (existing) {
      store.updatePoint(existing.id, draft);
      toast(`Saved ${pointTitle(draft)}`);
    } else {
      const created = store.addPoint(draft);
      store.select(created.id);
      toast(`Added ${pointTitle(created)}`);
    }
    close();
  }

  async function remove() {
    const ok = await confirmDialog({
      title: `Delete ${pointTitle(draft)}?`,
      body: draft.status === "rejected"
        ? "This one is already rejected and hidden. Keeping it preserves the reason it was ruled out — that note is usually the most useful thing in the dataset."
        : "This cannot be undone. Consider setting the status to Rejected instead, which hides it but keeps the research.",
      confirmLabel: "Delete anyway",
      danger: true,
    });
    if (!ok) return;
    store.removePoint(existing.id);
    toast("Deleted");
    close();
  }

  const footer = el("div", { class: "modal__actions modal__actions--split" }, [
    el("div", {}, [
      existing && el("button", {
        class: "btn btn--ghost btn--danger-text", type: "button", text: "Delete",
        on: { click: remove },
      }),
    ]),
    el("div", { class: "modal__actions" }, [
      el("button", { class: "btn", type: "button", text: "Cancel", on: { click: () => close() } }),
      el("button", {
        class: "btn btn--primary", type: "button",
        text: existing ? "Save changes" : "Add location",
        on: { click: save },
      }),
    ]),
  ]);

  const { close } = openModal({
    title: existing ? `Edit — ${pointTitle(existing)}` : "Add a location",
    width: "720px",
    className: "modal--form",
    body,
    footer,
  });

  // ⌘/Ctrl+Enter saves from anywhere in the form.
  body.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      save();
    }
  });

  return { close };
}
