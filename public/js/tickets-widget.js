(function () {
  var dataEl = document.getElementById("gmd-widget-events");
  if (!dataEl) return;

  var widgetEvents;
  try {
    widgetEvents = JSON.parse(dataEl.textContent || "[]");
  } catch (_) {
    return;
  }
  if (!widgetEvents.length) return;

  var rootStyle = getComputedStyle(document.documentElement);
  var brandColor =
    rootStyle.getPropertyValue("--brand-red").trim() || "#DC2626";
  var fontColor = rootStyle.getPropertyValue("--charcoal").trim() || "#1A1A1A";
  var bgColor = rootStyle.getPropertyValue("--white").trim() || "#FFFFFF";

  function initWidgets() {
    widgetEvents.forEach(function (ev) {
      var config = {
        widgetType: "checkout",
        eventId: ev.eventId,
        modal: true,
        modalTriggerElementId: ev.triggerId,
        themeSettings: {
          brandColor: brandColor,
          fontColor: fontColor,
          background: bgColor,
        },
        onOrderComplete: function () {
          if (window.posthog) {
            window.posthog.capture("order_complete", {
              event_id: ev.eventId,
              city: ev.city,
            });
          }
        },
      };
      if (ev.promoCode) {
        config.promoCode = ev.promoCode;
      }
      try {
        window.EBWidgets.createWidget(config);
        var trigger = document.getElementById(ev.triggerId);
        if (trigger) {
          trigger.addEventListener("click", function (e) {
            e.preventDefault();
          });
        }
      } catch (_) {
        // Widget init failed; anchor href + target="_blank" provide native fallback
      }
    });
  }

  var script = document.createElement("script");
  script.src = "https://www.eventbrite.com/static/widgets/eb_widgets.js";
  script.async = true;
  script.onload = initWidgets;
  document.head.appendChild(script);

  // Close the Eventbrite modal when clicking outside it.
  // dataset.listenerAttached guards against double-registration if the observer
  // fires more than once before disconnecting.
  var modalObserverTimeout;
  var modalObserver = new MutationObserver(function () {
    var ebStructure = document.querySelector("div.eds-structure_main");
    if (!ebStructure) return;
    if (!ebStructure.dataset.listenerAttached) {
      ebStructure.dataset.listenerAttached = "1";
      ebStructure.addEventListener("click", function (e) {
        if (!e.target.closest(".eds-modal")) {
          var closeBtn = document.querySelector(
            ".eds-modal__close-button button",
          );
          if (closeBtn) closeBtn.click();
        }
      });
    }
    clearTimeout(modalObserverTimeout);
    modalObserver.disconnect();
  });
  modalObserver.observe(document.body, { childList: true, subtree: true });
  modalObserverTimeout = setTimeout(function () {
    modalObserver.disconnect();
  }, 30000);
  window.addEventListener("beforeunload", function () {
    clearTimeout(modalObserverTimeout);
    modalObserver.disconnect();
  });
})();
