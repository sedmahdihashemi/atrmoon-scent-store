const KEY = "atrmoon_cart_session";
const CART_ID_KEY = "atrmoon_cart_id";

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
  if (typeof window !== "undefined") {
    localStorage.removeItem(KEY);
    localStorage.removeItem(CART_ID_KEY);
  }
}

export function getStoredCartId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CART_ID_KEY);
}

export function setStoredCartId(id: string) {
  if (typeof window !== "undefined") localStorage.setItem(CART_ID_KEY, id);
}

export function formatToman(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return v.toLocaleString("fa-IR") + " تومان";
}