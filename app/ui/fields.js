/**
 * One renderer per field type, driven by the declarations in model.js.
 *
 * This is the module that makes ADR-0006 pay off: the add/edit form, the detail
 * drawer's inline editing and any future view all call renderField(), so a new
 * field in the schema needs no UI work at all.
 *
 * Every control reports `null` for "empty", never 0 or "" — the money engine
 * depends on that distinction.
 */

import { el, num, formatINR } from "../lib/util.js";

const optionList = (options = []) => options.map((option) => (
  typeof option === "string"
    ? { value: option, label: option }
    : { value: option.value, label: option.label ?? option.value, hint: option.hint }
));

/* ---------------------------------------------------------------- controls -- */

function textControl(field, value, onChange, type = "text") {
  return el("input", {
    class: "control",
    type,
    value: value ?? "",
    placeholder: field.placeholder || "",
    inputmode: type === "tel" ? "tel" : undefined,
    on: { input: (event) => onChange(event.target.value || "") },
  });
}

function textareaControl(field, value, onChange) {
  return el("textarea", {
    class: "control control--area",
    rows: field.rows || 3,
    placeholder: field.placeholder || "",
    value: value ?? "",
    on: { input: (event) => onChange(event.target.value || "") },
  });
}

function numberControl(field, value, onChange) {
  return el("input", {
    class: "control",
    type: "number",
    value: value ?? "",
    min: field.min ?? undefined,
    max: field.max ?? undefined,
    step: field.step ?? 1,
    placeholder: field.placeholder || "",
    on: { input: (event) => onChange(num(event.target.value)) },
  });
}

/**
 * Money gets a ₹ prefix and echoes the formatted value live beside the input.
 * With no validation (by design), that echo is what catches the extra zero:
 * "₹1,50,000" next to a rent field is obviously wrong in a way "150000" is not.
 */
function moneyControl(field, value, onChange) {
  const echo = el("span", { class: "field__echo", text: value === null || value === undefined ? "" : formatINR(value) });
  const input = el("input", {
    class: "control control--money",
    type: "number",
    inputmode: "numeric",
    value: value ?? "",
    min: 0,
    step: 100,
    placeholder: field.placeholder || "0",
    on: {
      input: (event) => {
        const parsed = num(event.target.value);
        echo.textContent = parsed === null ? "" : formatINR(parsed);
        onChange(parsed);
      },
    },
  });

  return el("div", { class: "money-input" }, [
    el("span", { class: "money-input__prefix", text: "₹" }),
    input,
    echo,
  ]);
}

function selectControl(field, value, onChange) {
  const options = optionList(field.options);
  return el("select", {
    class: "control",
    on: { change: (event) => onChange(event.target.value || "") },
  }, [
    el("option", { value: "", text: field.placeholder || "—" }),
    ...options.map((option) => el("option", {
      value: option.value,
      text: option.label,
      selected: String(value ?? "") === String(option.value),
    })),
  ]);
}

function boolControl(field, value, onChange) {
  return el("label", { class: "switch" }, [
    el("input", {
      type: "checkbox",
      checked: Boolean(value),
      on: { change: (event) => onChange(event.target.checked) },
    }),
    el("span", { class: "switch__track" }, [el("span", { class: "switch__dot" })]),
  ]);
}

/**
 * Tri-state: yes / no / not sure. "Not sure" is a real answer — food being
 * unknown must not be rounded down to "not included", which would silently add
 * ₹6,000 to the comparison.
 */
function tristateControl(field, value, onChange) {
  const choices = [
    { value: true, label: "Yes" },
    { value: false, label: "No" },
    { value: null, label: "Not sure" },
  ];
  const group = el("div", { class: "segmented" });
  group.append(...choices.map((choice) => el("button", {
    class: ["segmented__item", value === choice.value && "is-active"],
    type: "button",
    text: choice.label,
    on: {
      click: () => {
        onChange(choice.value);
        for (const node of group.children) node.classList.remove("is-active");
        group.children[choices.indexOf(choice)].classList.add("is-active");
      },
    },
  })));
  return group;
}

function ratingControl(field, value, onChange) {
  const current = num(value);
  const row = el("div", { class: "rating" });

  const paint = (upto) => {
    for (const [index, node] of [...row.querySelectorAll(".rating__star")].entries()) {
      node.classList.toggle("is-on", index < upto);
    }
  };

  row.append(...[1, 2, 3, 4, 5].map((score) => el("button", {
    class: ["rating__star", current !== null && score <= current && "is-on"],
    type: "button",
    text: "★",
    "aria-label": `${score} out of 5`,
    on: {
      click: () => { onChange(score); paint(score); },
      mouseenter: () => paint(score),
      mouseleave: () => paint(num(value) ?? 0),
    },
  })));

  row.appendChild(el("button", {
    class: "rating__clear",
    type: "button",
    text: "clear",
    on: { click: () => { onChange(null); paint(0); } },
  }));

  return row;
}

function tagsControl(field, value, onChange) {
  let tags = Array.isArray(value) ? [...value] : [];
  const chips = el("div", { class: "chips" });

  const paint = () => {
    chips.replaceChildren(...tags.map((tag) => el("span", { class: "chip" }, [
      tag,
      el("button", {
        class: "chip__x", type: "button", text: "✕", "aria-label": `Remove ${tag}`,
        on: {
          click: () => {
            tags = tags.filter((t) => t !== tag);
            onChange(tags);
            paint();
          },
        },
      }),
    ])));
  };
  paint();

  const add = (raw) => {
    const incoming = String(raw).split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    const next = [...new Set([...tags, ...incoming])];
    if (next.length === tags.length) return;
    tags = next;
    onChange(tags);
    paint();
  };

  const listId = field.suggestions ? `dl-${field.path.replace(/\W/g, "-")}` : null;
  const input = el("input", {
    class: "control control--tag",
    type: "text",
    placeholder: "type and press Enter",
    list: listId || undefined,
    on: {
      keydown: (event) => {
        if (event.key !== "Enter" && event.key !== ",") return;
        event.preventDefault();
        add(event.target.value);
        event.target.value = "";
      },
      blur: (event) => {
        if (!event.target.value.trim()) return;
        add(event.target.value);
        event.target.value = "";
      },
    },
  });

  return el("div", { class: "tags-field" }, [
    chips,
    input,
    listId && el("datalist", { id: listId },
      (field.suggestions || []).map((suggestion) => el("option", { value: suggestion }))),
  ]);
}

function linesControl(field, value, onChange) {
  return el("textarea", {
    class: "control control--area",
    rows: field.rows || 3,
    placeholder: field.placeholder || "https://…",
    value: Array.isArray(value) ? value.join("\n") : value || "",
    on: {
      input: (event) => onChange(
        event.target.value.split("\n").map((line) => line.trim()).filter(Boolean),
      ),
    },
  });
}

const CONTROLS = {
  text: (f, v, c) => textControl(f, v, c, "text"),
  tel: (f, v, c) => textControl(f, v, c, "tel"),
  url: (f, v, c) => textControl(f, v, c, "url"),
  date: (f, v, c) => textControl(f, v, c, "date"),
  textarea: textareaControl,
  number: numberControl,
  money: moneyControl,
  select: selectControl,
  bool: boolControl,
  tristate: tristateControl,
  rating: ratingControl,
  tags: tagsControl,
  lines: linesControl,
};

/* ------------------------------------------------------------------ public -- */

/** A labelled control for one schema field. */
export function renderField(field, value, onChange) {
  const build = CONTROLS[field.type] || CONTROLS.text;
  const inline = field.type === "bool" || field.type === "tristate";

  return el("div", {
    class: ["field", `field--${field.width || "half"}`, inline && "field--inline"],
    dataset: { path: field.path },
  }, [
    el("label", { class: "field__label", text: field.label }),
    build(field, value, onChange),
    field.hint && el("small", { class: "field__hint", text: field.hint }),
  ]);
}

/** A bare control with no label, for compact inline editing in the drawer. */
export function renderControl(field, value, onChange) {
  const build = CONTROLS[field.type] || CONTROLS.text;
  return build(field, value, onChange);
}
