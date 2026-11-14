/**
 * Photos and videos for one location, organised by slot.
 *
 * Slots rather than a generic gallery (ADR-0007): the bathroom and the
 * street-at-night shots are the ones people forget to take and the ones that
 * decide it, so the UI asks for them by name.
 */

import { el } from "../lib/util.js";
import { MEDIA_SLOTS, newMediaItem } from "../model.js";
import {
  renderMediaElement, detectType, putFile, compressImage, removeFile,
  getRecord, usage, formatBytes, downloadAllLocal,
} from "../media.js";
import { invalidateThumb } from "../map/marker-view.js";
import { toast, confirmDialog } from "./toast.js";
import * as store from "../store.js";

const MAX_ITEMS = 10;

function slotLabel(value) {
  return MEDIA_SLOTS.find((slot) => slot.value === value)?.label || "Other";
}

async function downloadLocal(item) {
  const id = String(item.src).replace(/^idb:/, "");
  const record = await getRecord(id);
  if (!record?.blob) {
    toast("That file is no longer in this browser's storage", { level: "warn" });
    return;
  }
  const url = URL.createObjectURL(record.blob);
  const link = el("a", { href: url, download: record.name || "media" });
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function renderMediaPanel(point, { onChange } = {}) {
  const panel = el("div", { class: "media-panel" });

  const repaint = () => {
    invalidateThumb(point.id);
    panel.replaceChildren(...build());
    onChange?.();
  };

  async function addItem({ slot, src, caption }) {
    if ((point.media || []).length >= MAX_ITEMS) {
      toast(`${MAX_ITEMS} items is the limit for one place — delete one first`, { level: "warn" });
      return;
    }
    store.addMedia(point.id, newMediaItem({ slot, src, caption, type: detectType(src) }));
    repaint();
  }

  async function handleUpload(files, slot) {
    const list = Array.from(files || []);
    if (!list.length) return;

    for (const file of list) {
      if ((point.media || []).length >= MAX_ITEMS) {
        toast(`Stopped at ${MAX_ITEMS} items`, { level: "warn" });
        break;
      }
      try {
        const prepared = file.type.startsWith("image/") ? await compressImage(file) : file;
        if (prepared.size > 60 * 1024 * 1024) {
          toast(`${file.name} is ${formatBytes(prepared.size)} — too big for browser storage. Upload it to Drive and paste the link instead.`,
            { level: "warn", timeout: 7000 });
          continue;
        }
        const record = await putFile(prepared);
        store.addMedia(point.id, newMediaItem({
          slot,
          type: "local",
          src: `idb:${record.id}`,
          caption: file.name,
        }));
      } catch (err) {
        console.error(err);
        toast(`Could not store ${file.name}`, { level: "error" });
      }
    }
    repaint();
  }

  async function removeItem(item) {
    const ok = await confirmDialog({
      title: "Remove this media?",
      body: item.type === "local"
        ? "The uploaded file will be deleted from this browser's storage. Download it first if you want to keep it."
        : "The link will be removed from this location. The file itself is untouched.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;

    if (item.type === "local") {
      await removeFile(String(item.src).replace(/^idb:/, "")).catch(() => {});
    }
    store.removeMedia(point.id, item.id);
    repaint();
  }

  /* ----------------------------------------------------------------- build -- */

  function build() {
    const items = point.media || [];
    const grouped = new Map();
    for (const item of items) {
      const key = item.slot || "other";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(item);
    }

    const gallery = items.length
      ? el("div", { class: "media-grid" },
        [...grouped.entries()].map(([slot, slotItems]) => el("div", { class: "media-group" }, [
          el("h4", { class: "media-group__title", text: slotLabel(slot) }),
          ...slotItems.map((item) => el("figure", { class: "media-item" }, [
            renderMediaElement(item),
            el("figcaption", { class: "media-item__foot" }, [
              el("input", {
                class: "media-item__caption",
                value: item.caption || "",
                placeholder: "caption",
                on: {
                  change: (event) => store.updateMedia(point.id, item.id, { caption: event.target.value }),
                },
              }),
              el("div", { class: "media-item__actions" }, [
                item.type === "local" && el("button", {
                  class: "icon-btn", type: "button", text: "⤓", title: "Download this file",
                  on: { click: () => downloadLocal(item) },
                }),
                el("button", {
                  class: "icon-btn", type: "button", text: "✕", title: "Remove",
                  on: { click: () => removeItem(item) },
                }),
              ]),
            ]),
          ])),
        ])))
      : el("p", {
        class: "muted",
        text: "No photos or videos yet. The two worth having: the bathroom, and the street outside at night.",
      });

    /* --- the two ways to add ------------------------------------------- */
    const slotSelect = el("select", { class: "control control--inline" },
      MEDIA_SLOTS.map((slot) => el("option", { value: slot.value, text: slot.label })));

    const srcInput = el("input", {
      class: "control",
      type: "text",
      placeholder: "Paste a YouTube/Drive link, a photo URL, or media/your-file.jpg",
    });

    const linkRow = el("div", { class: "media-add" }, [
      slotSelect,
      srcInput,
      el("button", {
        class: "btn btn--small", type: "button", text: "Add link",
        on: {
          click: () => {
            const src = srcInput.value.trim();
            if (!src) return;
            addItem({ slot: slotSelect.value, src, caption: "" });
            srcInput.value = "";
          },
        },
      }),
    ]);

    const fileInput = el("input", {
      type: "file",
      accept: "image/*,video/*,audio/*",
      multiple: true,
      class: "visually-hidden",
      id: `upload-${point.id}`,
      on: { change: (event) => handleUpload(event.target.files, slotSelect.value) },
    });

    const uploadRow = el("div", { class: "media-add" }, [
      fileInput,
      el("label", { class: "btn btn--small", for: `upload-${point.id}`, text: "⬆ Upload from this device" }),
      el("small", {
        class: "muted",
        // The honest caveat, at the point of upload rather than in a doc.
        text: "Stored in this browser only — it won't travel inside a JSON export, and browsers can evict it. Use a link for anything you'd hate to lose.",
      }),
    ]);

    const storageNote = el("div", { class: "media-storage" });
    usage().then(({ count, bytes }) => {
      if (!count) return;
      storageNote.replaceChildren(
        el("small", { class: "muted", text: `${count} uploaded file${count === 1 ? "" : "s"} in this browser · ${formatBytes(bytes)}` }),
        el("button", {
          class: "link-btn", type: "button", text: "download all",
          on: {
            click: async () => {
              const n = await downloadAllLocal();
              toast(`Downloading ${n} file${n === 1 ? "" : "s"}`);
            },
          },
        }),
      );
    }).catch(() => {});

    return [gallery, linkRow, uploadRow, storageNote];
  }

  panel.replaceChildren(...build());
  return panel;
}
