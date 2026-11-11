/** Programmatic geolocation prefills do not dispatch input events. */
export function trackEnteredCity(input: HTMLInputElement | null) {
  let edited = false;
  input?.addEventListener("input", () => {
    edited = true;
  });
  return (): "entered" | undefined =>
    edited && input?.value.trim() ? "entered" : undefined;
}
