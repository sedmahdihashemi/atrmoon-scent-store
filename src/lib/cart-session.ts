const KEY = "atrmoon_cart_session";

export function getOrCreateCartSession(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

export function clearCartSession() {
  if (typeof window !== "undefined") localStorage.removeItem(KEY);
}

export function formatToman(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return v.toLocaleString("fa-IR") + " تومان";
}