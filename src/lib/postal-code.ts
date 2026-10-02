// Iranian postal codes are exactly 10 digits with a few position rules
// (no all-same-digit run at the start, certain digits disallowed per
// position). This is the canonical pattern used by the persian-tools
// library — strict enough to reject garbage, loose enough for real codes.
const IRAN_POSTAL_RE = /^(?!(\d)\1{3})[13-9]{4}[1346-9][013-9]{5}$/;

// Users may type Persian (۰۹) or Arabic (٠٩) numerals; fold them to ASCII.
export function toEnglishDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

// Strip to digits only (drops spaces, dashes, Persian/Arabic numerals folded).
export function normalizePostalCode(input: string): string {
  return toEnglishDigits(input).replace(/\D/g, "");
}

export function isValidIranPostalCode(input: string): boolean {
  return IRAN_POSTAL_RE.test(normalizePostalCode(input));
}
