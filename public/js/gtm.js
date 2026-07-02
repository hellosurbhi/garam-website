window.dataLayer = window.dataLayer || [];
function loadGTM() {
  if (window._gtmLoaded) return;
  window._gtmLoaded = true;
  (function (w, d, s, l, i) {
    w[l] = w[l] || [];
    w[l].push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
    var f = d.getElementsByTagName(s)[0],
      j = d.createElement(s),
      dl = l != "dataLayer" ? "&l=" + l : "";
    j.async = true;
    j.src = "https://www.googletagmanager.com/gtm.js?id=" + i + dl;
    f.parentNode.insertBefore(j, f);
  })(window, document, "script", "dataLayer", "GTM-KQCBBL2W");
}
if ("requestIdleCallback" in window) {
  requestIdleCallback(loadGTM, { timeout: 3000 });
} else {
  setTimeout(loadGTM, 2000);
}
