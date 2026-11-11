/** Reveal checkout links when cached presale markup arrives after sales open. */
export function revealPresales(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>("[data-presale-notify]").forEach((btn) => {
    const onSaleAt = btn.dataset.presaleNotify!;
    const live = btn.nextElementSibling;
    if (
      Date.now() >= Date.parse(onSaleAt) &&
      live instanceof HTMLElement &&
      live.hasAttribute("data-presale-live")
    ) {
      btn.hidden = true;
      live.removeAttribute("hidden");
    }
  });
}

revealPresales(document);

// Server islands insert cards after the initial document scan has finished.
new MutationObserver((records) => {
  const hasPresaleContent = records.some((record) =>
    Array.from(record.addedNodes).some(
      (node) =>
        node instanceof Element &&
        (node.matches("[data-presale-notify], [data-presale-live]") ||
          node.querySelector("[data-presale-notify], [data-presale-live]")),
    ),
  );
  if (hasPresaleContent) revealPresales(document);
}).observe(document, { childList: true, subtree: true });
