/**
 * A runtime-safe order number generator.
 * (Your existing createOrderNumber.ts exports a constant; that's not safe for repeated calls.)
 */
export function makeOrderNumber(prefix = "FD"): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  const rand = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `${prefix}${yy}${mm}${dd}${hh}${mi}${ss}${ms}${rand}`;
}
