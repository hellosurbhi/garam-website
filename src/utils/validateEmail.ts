const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Returns an error string if the email is missing or malformed, undefined if valid.
 * Single source of truth used by the apply form and the capture-lead API.
 */
export function validateEmail(email: string): string | undefined {
  if (!email.trim()) return "Email is required";
  if (!EMAIL_RE.test(email.trim())) return "Please enter a valid email address";
  return undefined;
}
