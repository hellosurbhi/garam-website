/** Programmatic geolocation prefills do not dispatch input events. */
export function trackEnteredCity(input: HTMLInputElement | null) {
  let enteredValue: string | undefined;
  input?.addEventListener("input", () => {
    enteredValue = input.value;
  });
  return (): "entered" | undefined =>
    enteredValue?.trim() && input?.value === enteredValue
      ? "entered"
      : undefined;
}
