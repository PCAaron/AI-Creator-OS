import { resolve, sep } from "node:path";

/** 将外部 eventId 规范为安全文件名分量（非 OS 沙箱；仅降低路径穿越风险）。 */
export function safeFileToken(raw) {
  const s = String(raw ?? "unknown")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\.\./g, "_")
    .slice(0, 120);
  return s.length ? s : "unknown";
}

/** 目录边界：child 必须位于 parent 内（规范化后比较）。 */
export function isPathInside(child, parent) {
  const c = resolve(child);
  const p = resolve(parent);
  const prefix = p.endsWith(sep) ? p : p + sep;
  return c === p || c.startsWith(prefix);
}

export function resolveInside(baseDir, ...segments) {
  const target = resolve(baseDir, ...segments);
  if (!isPathInside(target, baseDir)) {
    throw new Error(`路径越界：${target} 不在 ${baseDir} 内`);
  }
  return target;
}