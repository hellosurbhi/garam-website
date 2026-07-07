(function () {
  var loader = document.getElementById("waiver-loader");
  if (!loader) return;

  var hidden = false;
  function hideLoader() {
    if (hidden) return;
    hidden = true;
    loader.style.opacity = "0";
    setTimeout(function () {
      loader.style.display = "none";
    }, 200);
  }

  var JOTFORM_ORIGINS = new Set([
    "https://form.jotform.com",
    "https://www.jotform.com",
  ]);
  var JOTFORM_FORM_ID = "261031391833047";
  window.addEventListener("message", function (e) {
    if (!JOTFORM_ORIGINS.has(e.origin)) return;
    // JotForm sends resize events as colon-delimited strings (e.g. "setHeight:539"),
    // not JSON. Handle this format first so the loader is dismissed immediately.
    if (typeof e.data === "string" && e.data.indexOf("setHeight:") === 0) {
      hideLoader();
      return;
    }
    try {
      var data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      if (
        data &&
        (data.action === "setHeight" || data.fromJotForm) &&
        String(data.formID || "") === JOTFORM_FORM_ID
      ) {
        hideLoader();
      }
    } catch (_) {}
  });

  setTimeout(hideLoader, 10000);
})();
