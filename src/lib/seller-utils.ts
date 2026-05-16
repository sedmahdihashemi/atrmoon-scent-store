export function slugify(input: string): string {
  return input
    .toString()
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "p-" + Math.random().toString(36).slice(2, 8);
}

export const orderStatusLabels: Record<string, string> = {
  pending_contact: "در انتظار تماس",
  confirmed_by_seller: "تأیید فروشنده",
  preparing: "در حال آماده‌سازی",
  shipped: "ارسال شد",
  completed: "تکمیل‌شده",
  cancelled: "لغو شد",
  rejected_by_seller: "ردشده توسط فروشنده",
};

export const orderStatusFlow: string[] = [
  "pending_contact", "confirmed_by_seller", "preparing", "shipped", "completed", "cancelled", "rejected_by_seller",
];