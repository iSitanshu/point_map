/** Toasts, modals and confirmations. The app's only interruption surface. */

import { el, qs } from "../lib/util.js";

const toastRoot = () => qs("#toast-root") || document.body;
const modalRoot = () => qs("#modal-root") || document.body;

export function toast(message, { level = "info", timeout = 3600, action } = {}) {
  const node = el("div", { class: ["toast", `toast--${level}`], role: "status" }, [
    el("span", { class: "toast__text", text: message }),
    action && el("button", {
      class: "toast__action",
      type: "button",
      text: action.label,
      on: { click: () => { action.onClick(); dismiss(); } },
    }),
    el("button", {
      class: "toast__close", type: "button", text: "✕",
      "aria-label": "Dismiss", on: { click: () => dismiss() },
    }),
  ]);

  let removed = false;
  function dismiss() {
    if (removed) return;
    removed = true;
    node.classList.add("is-leaving");
    setTimeout(() => node.remove(), 180);
  }

  toastRoot().appendChild(node);
  if (timeout) setTimeout(dismiss, timeout);
  return dismiss;
}

/**
 * A modal. Escape and a backdrop click both close it, because a dialog that
 * traps you is worse than one you dismiss by accident.
 */
export function openModal({ title, body, footer, width = "640px", onClose, className }) {
  const overlay = el("div", { class: "modal-overlay" });
  const dialog = el("div", {
    class: ["modal", className],
    style: { "--modal-width": width },
    role: "dialog",
    "aria-modal": "true",
    "aria-label": typeof title === "string" ? title : "Dialog",
  });

  let closed = false;
  function close(reason = "dismiss") {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKeydown);
    overlay.remove();
    onClose?.(reason);
  }

  function onKeydown(event) {
    if (event.key === "Escape") {
      event.stopPropagation();
      close("escape");
    }
  }

  const header = el("header", { class: "modal__head" }, [
    typeof title === "string" ? el("h2", { class: "modal__title", text: title }) : title,
    el("button", {
      class: "modal__close", type: "button", text: "✕",
      "aria-label": "Close", on: { click: () => close("close-button") },
    }),
  ]);

  dialog.append(header, el("div", { class: "modal__body" }, [body]));
  if (footer) dialog.appendChild(el("footer", { class: "modal__foot" }, [footer]));

  overlay.appendChild(dialog);
  overlay.addEventListener("mousedown", (event) => {
    if (event.target === overlay) close("backdrop");
  });
  document.addEventListener("keydown", onKeydown);
  modalRoot().appendChild(overlay);

  // Focus the first real control so keyboard users are not stranded.
  setTimeout(() => {
    const target = dialog.querySelector("input, select, textarea, button:not(.modal__close)");
    target?.focus();
  }, 20);

  return { close, dialog, overlay };
}

export function confirmDialog({
  title, body, confirmLabel = "Confirm", cancelLabel = "Cancel", danger = false,
}) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const { close } = openModal({
      title,
      width: "460px",
      body: typeof body === "string" ? el("p", { class: "modal__text", text: body }) : body,
      footer: el("div", { class: "modal__actions" }, [
        el("button", {
          class: "btn", type: "button", text: cancelLabel,
          on: { click: () => { finish(false); close(); } },
        }),
        el("button", {
          class: ["btn", danger ? "btn--danger" : "btn--primary"],
          type: "button",
          text: confirmLabel,
          on: { click: () => { finish(true); close(); } },
        }),
      ]),
      onClose: () => finish(false),
    });
  });
}
