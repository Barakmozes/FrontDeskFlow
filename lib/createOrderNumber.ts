/**
 * createOrderNumber.ts
 *
 * Backwards compatible:
 * - Keeps ORDER_NUMBER export (legacy imports)
 * - Adds createOrderNumber() for unique numbers per click
 */
export const createOrderNumber = (prefix = "BARAK") => {
  const now = new Date();

  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const ms = String(now.getMilliseconds()).padStart(3, "0");

  // Prevent collisions from ultra-fast clicks or multiple tabs.
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `${prefix}${yy}${mm}${dd}${hh}${min}${ss}${ms}${rand}`;
};

// Legacy compatibility (some parts of the old app may import ORDER_NUMBER)
export const ORDER_NUMBER = createOrderNumber();
