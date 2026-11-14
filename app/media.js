/**
 * Media storage and rendering.
 *
 * Three routes to attach a photo or video (ADR-0007), because no single one
 * covers both "standing outside a PG with a phone" and "must survive a cleared
 * browser":
 *
 *   image/video — a URL, or a path like `media/front-gate.jpg`
 *   embed       — a YouTube / Drive link, rewritten to its embed form
 *   local       — `idb:<id>`, a real File held in IndexedDB
 *
 * The honest caveat, surfaced at the point of upload: `local` blobs do not
 * travel inside the JSON export, and browsers can evict them.
 */

import { el, uid, escapeHtml } from "./lib/util.js";

const DB_NAME = "pointmap-media";
const DB_VERSION = 1;
const STORE = "files";

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function tx(mode, run) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const store = transaction.objectStore(STORE);
    const request = run(store);
    transaction.oncomplete = () => resolve(request?.result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

/* ------------------------------------------------------------- blob store -- */

/** Store a File and return the id to put in `media.src` as `idb:<id>`. */
export async function putFile(file) {
  const id = uid("blob");
  const payload = {
    id,
    name: file.name || "upload",
    type: file.type || "application/octet-stream",
    size: file.size ?? 0,
    blob: file,
    addedAt: new Date().toISOString(),
  };
  await tx("readwrite", (store) => store.put(payload));
  return payload;
}

export const getRecord = (id) => tx("readonly", (store) => store.get(id));
export const removeFile = (id) => tx("readwrite", (store) => store.delete(id));
export const listFiles = () => tx("readonly", (store) => store.getAll());

/**
 * Object URLs are cached per id and released by `releaseAll()` when a drawer
 * closes. Creating one per render leaks steadily, which on a phone ends as a
 * crashed tab rather than a slow one.
 */
const urlCache = new Map();

export async function getObjectURL(id) {
  if (urlCache.has(id)) return urlCache.get(id);
  const record = await getRecord(id);
  if (!record?.blob) return null;
  const url = URL.createObjectURL(record.blob);
  urlCache.set(id, url);
  return url;
}

export function releaseAll() {
  for (const url of urlCache.values()) URL.revokeObjectURL(url);
  urlCache.clear();
}

export async function usage() {
  const files = (await listFiles()) || [];
  const bytes = files.reduce((total, file) => total + (file.size ?? 0), 0);
  let quota = null;
  if (navigator.storage?.estimate) {
    const estimate = await navigator.storage.estimate();
    quota = estimate.quota ?? null;
  }
  return { count: files.length, bytes, quota };
}

export const formatBytes = (bytes) => {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Pull every local blob back out, so nothing is ever trapped in the browser. */
export async function downloadAllLocal() {
  const files = (await listFiles()) || [];
  for (const file of files) {
    const url = URL.createObjectURL(file.blob);
    const link = el("a", { href: url, download: file.name });
    document.body.appendChild(link);
    link.click();
    link.remove();
    await new Promise((resolve) => setTimeout(resolve, 300)); // browsers throttle bursts
    URL.revokeObjectURL(url);
  }
  return files.length;
}

/* -------------------------------------------------------------- transforms -- */

/**
 * Downscale an image before storing it. `imageOrientation: "from-image"` matters:
 * a canvas round-trip drops EXIF, so without it every portrait phone photo
 * comes back sideways.
 */
export async function compressImage(file, maxDimension = 1600, quality = 0.82) {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 400_000) return file;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch (err) {
    console.warn("Image compression failed — storing the original", err);
    return file;
  }
}

export async function toDataURI(id) {
  const record = await getRecord(id);
  if (!record?.blob) return null;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(record.blob);
  });
}

/* ----------------------------------------------------------- type sniffing -- */

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|bmp|svg)(\?|#|$)/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i;

/** Infer the media type from whatever the user pasted, so there is no picker. */
export function detectType(src) {
  const value = String(src || "").trim();
  if (!value) return "image";
  if (value.startsWith("idb:")) return "local";
  if (/youtube\.com|youtu\.be|drive\.google\.com|vimeo\.com/i.test(value)) return "embed";
  if (VIDEO_EXT.test(value)) return "video";
  if (IMAGE_EXT.test(value)) return "image";
  return "image";
}

/** Rewrite a share link into something that will actually render in an iframe. */
export function toEmbedURL(src) {
  const value = String(src || "").trim();

  const youtube = value.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  if (youtube) return `https://www.youtube-nocookie.com/embed/${youtube[1]}`;

  const drive = value.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`;

  const vimeo = value.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;

  return value;
}

/* -------------------------------------------------------------- rendering -- */

/**
 * One switch covering all three storage routes. Local blobs resolve
 * asynchronously, so the element is returned immediately and its `src` filled
 * in when the blob arrives — no spinner, no layout jump.
 */
export function renderMediaElement(item) {
  const type = item.type || detectType(item.src);

  if (type === "embed") {
    return el("iframe", {
      class: "media-frame",
      src: toEmbedURL(item.src),
      loading: "lazy",
      allow: "accelerometer; clipboard-write; encrypted-media; picture-in-picture",
      allowfullscreen: true,
      referrerpolicy: "strict-origin-when-cross-origin",
      title: item.caption || "Embedded video",
    });
  }

  if (type === "local") {
    const id = String(item.src).replace(/^idb:/, "");
    const placeholder = el("div", { class: "media-local", dataset: { blobId: id } }, [
      el("span", { class: "media-local__label", text: item.caption || "Loading…" }),
    ]);

    getRecord(id).then(async (record) => {
      if (!record) {
        placeholder.classList.add("media-local--missing");
        placeholder.replaceChildren(el("span", {
          class: "media-local__label",
          text: `${item.caption || "Uploaded file"} — no longer in this browser`,
        }));
        return;
      }
      const url = await getObjectURL(id);
      const isVideo = (record.type || "").startsWith("video");
      const isAudio = (record.type || "").startsWith("audio");
      const node = isVideo
        ? el("video", { class: "media-video", src: url, controls: true, preload: "none" })
        : isAudio
          ? el("audio", { class: "media-audio", src: url, controls: true })
          : el("img", { class: "media-image", src: url, loading: "lazy", alt: item.caption || "" });
      placeholder.replaceChildren(node);
    });

    return placeholder;
  }

  if (type === "video") {
    return el("video", { class: "media-video", src: item.src, controls: true, preload: "none" });
  }

  return el("img", {
    class: "media-image",
    src: item.src,
    loading: "lazy",
    alt: item.caption || "",
    on: {
      error: (event) => {
        const node = event.currentTarget;
        node.replaceWith(el("div", {
          class: "media-local media-local--missing",
          html: `<span class="media-local__label">Can't load<br><code>${escapeHtml(item.src)}</code></span>`,
        }));
      },
    },
  });
}

/** First usable image, for the map pill thumbnail at street zoom. */
export async function thumbnailFor(point) {
  const items = point.media || [];
  const image = items.find((item) => (item.type || detectType(item.src)) === "image");
  if (image) return image.src;
  const local = items.find((item) => (item.type || detectType(item.src)) === "local");
  if (local) return getObjectURL(String(local.src).replace(/^idb:/, ""));
  return null;
}
