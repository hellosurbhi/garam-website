/**
 * Same-tab navigation seam.
 *
 * WHY this one-line module exists: window.location and its methods are
 * [LegacyUnforgeable] per the WHATWG spec, and jsdom 22+ enforces that, so
 * unit tests can neither spy on location.assign nor replace the location
 * object. Code that navigates must call this wrapper instead; tests mock
 * this module. Calling window.location.assign directly makes the caller
 * untestable, which is what removing this indirection breaks.
 */
export function navigateTo(url: string): void {
  window.location.assign(url);
}
