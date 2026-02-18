import fs from "node:fs";
import path from "node:path";

const IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);

const MIME_TO_EXT = Object.freeze({
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "application/pdf": ".pdf",
  "text/plain": ".txt"
});

export const DANGEROUS_UPLOAD_MIMES = new Set([
  "text/html",
  "application/xhtml+xml",
  "image/svg+xml",
  "application/javascript",
  "text/javascript"
]);

function readHead(filePath, maxBytes = 8192) {
  const fd = fs.openSync(filePath, "r");
  try {
    const buf = Buffer.alloc(maxBytes);
    const bytesRead = fs.readSync(fd, buf, 0, maxBytes, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    fs.closeSync(fd);
  }
}

function isPng(buf) {
  return (
    buf.length >= 8
    && buf[0] === 0x89
    && buf[1] === 0x50
    && buf[2] === 0x4e
    && buf[3] === 0x47
    && buf[4] === 0x0d
    && buf[5] === 0x0a
    && buf[6] === 0x1a
    && buf[7] === 0x0a
  );
}

function isJpeg(buf) {
  return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

function isGif(buf) {
  if (buf.length < 6) return false;
  const head = buf.subarray(0, 6).toString("ascii");
  return head === "GIF87a" || head === "GIF89a";
}

function isWebp(buf) {
  if (buf.length < 12) return false;
  return buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP";
}

function isPdf(buf) {
  return buf.length >= 5 && buf.subarray(0, 5).toString("ascii") === "%PDF-";
}

function isLikelyUtfText(buf) {
  if (!buf.length) return false;
  let control = 0;
  for (const b of buf) {
    if (b === 0x00) return false;
    const isControl = b < 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0d;
    if (isControl) control += 1;
  }
  return control / buf.length < 0.02;
}

export function detectMimeByMagic(buf, { allowText = true } = {}) {
  if (!Buffer.isBuffer(buf) || !buf.length) return "";
  if (isPng(buf)) return "image/png";
  if (isJpeg(buf)) return "image/jpeg";
  if (isGif(buf)) return "image/gif";
  if (isWebp(buf)) return "image/webp";
  if (isPdf(buf)) return "application/pdf";
  if (allowText && isLikelyUtfText(buf)) return "text/plain";
  return "";
}

export function sniffFileMime(filePath, { allowText = true } = {}) {
  try {
    const head = readHead(filePath);
    return detectMimeByMagic(head, { allowText });
  } catch {
    return "";
  }
}

function uniquePath(targetPath) {
  if (!fs.existsSync(targetPath)) return targetPath;
  const dir = path.dirname(targetPath);
  const ext = path.extname(targetPath);
  const base = path.basename(targetPath, ext);
  for (let i = 1; i <= 999; i += 1) {
    const next = path.join(dir, `${base}_${i}${ext}`);
    if (!fs.existsSync(next)) return next;
  }
  return path.join(dir, `${base}_${Date.now()}${ext}`);
}

function sanitizeBaseName(name) {
  const cleaned = String(name || "")
    .replace(/[^\w.\-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 80);
  return cleaned || `f_${Date.now()}`;
}

export function safeUnlink(filePath) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // best-effort cleanup
  }
}

export function isImageMime(mime) {
  return IMAGE_MIMES.has(String(mime || "").toLowerCase());
}

export function normalizeAllowedMimes(mimes) {
  const out = new Set();
  for (const mime of mimes || []) {
    const m = String(mime || "").trim().toLowerCase();
    if (!m) continue;
    if (m === "text/markdown") {
      out.add("text/plain");
      continue;
    }
    out.add(m);
  }
  return out;
}

export function finalizeUploadedFile(file, {
  allowText = true,
  allowedMimes = new Set(),
  deniedMimes = DANGEROUS_UPLOAD_MIMES
} = {}) {
  const srcPath = file?.path || "";
  if (!srcPath) return { ok: false, error: "file_required" };

  const detectedMime = sniffFileMime(srcPath, { allowText });
  if (!detectedMime) {
    safeUnlink(srcPath);
    return { ok: false, error: "unsupported_file_type" };
  }
  if (deniedMimes.has(detectedMime)) {
    safeUnlink(srcPath);
    return { ok: false, error: "unsupported_file_type" };
  }
  if (allowedMimes.size > 0 && !allowedMimes.has(detectedMime)) {
    safeUnlink(srcPath);
    return { ok: false, error: "unsupported_file_type" };
  }

  const ext = MIME_TO_EXT[detectedMime];
  if (!ext) {
    safeUnlink(srcPath);
    return { ok: false, error: "unsupported_file_type" };
  }

  const originalBase = path.basename(file.filename || path.parse(srcPath).name, path.extname(file.filename || ""));
  const base = sanitizeBaseName(originalBase);
  const desired = uniquePath(path.join(path.dirname(srcPath), `${base}${ext}`));
  try {
    if (desired !== srcPath) fs.renameSync(srcPath, desired);
  } catch {
    safeUnlink(srcPath);
    return { ok: false, error: "upload_failed" };
  }

  return {
    ok: true,
    mime: detectedMime,
    filename: path.basename(desired),
    path: desired
  };
}
