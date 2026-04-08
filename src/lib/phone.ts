/**
 * Clean and normalize a phone number for storage.
 *
 * - US 10-digit → +1XXXXXXXXXX
 * - US 11-digit starting with 1 → +1XXXXXXXXXX
 * - Already has "+" prefix → strip whitespace/punctuation, keep as-is
 * - Anything else with 7+ digits → store digits as-is
 * - Too short or empty → null (skip)
 */
export function cleanPhone(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const digits = trimmed.replace(/\D/g, "");

  // US: 10 bare digits
  if (digits.length === 10) return `+1${digits}`;

  // US: 11 digits starting with 1
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;

  // International: starts with +, keep the + and digits only
  if (trimmed.startsWith("+") && digits.length >= 7) return `+${digits}`;

  // Anything else with enough digits to be plausible
  if (digits.length >= 7) return `+${digits}`;

  return null;
}
