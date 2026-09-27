const IRAN_MOBILE_RE = /^09\d{9}$/;

// Accepts 09xxxxxxxxx, 9xxxxxxxxx, +989xxxxxxxxx, 00989xxxxxxxxx (with or
// without spaces/dashes) and folds them all to the canonical 09xxxxxxxxx
// shape that profiles.phone is stored/compared in. Returns null if the
// result still isn't a real Iranian mobile number.
export function normalizeIranPhone(input: string): string | null {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("0098")) d = d.slice(4);
  else if (d.startsWith("98")) d = d.slice(2);
  if (/^9\d{9}$/.test(d)) d = "0" + d;
  return IRAN_MOBILE_RE.test(d) ? d : null;
}

export function isValidIranPhone(input: string): boolean {
  return normalizeIranPhone(input) !== null;
}
