document
  .querySelectorAll<HTMLElement>("[data-presale-notify]")
  .forEach((btn) => {
    const onSaleAt = btn.dataset.presaleNotify!;
    if (Date.now() >= Date.parse(onSaleAt)) {
      btn.hidden = true;
      const live = btn.nextElementSibling as HTMLElement | null;
      if (live?.hasAttribute("data-presale-live"))
        live.removeAttribute("hidden");
    }
  });
