/**
 * Shared recovery path for Eventbrite modal checkout triggers.
 *
 * WHY this module exists: EBWidgets.createWidget() succeeding only means
 * Eventbrite's script registered a click handler, not that opening actually
 * works. In some mobile in-app browsers (Instagram/Facebook WKWebView,
 * Firefox iOS) Eventbrite's own click handler throws asynchronously:
 * window.webkit.messageHandlers probing, a __firefox__ reader global, or a
 * ChunkLoadError from Eventbrite's webpack runtime resolving its chunk path
 * against our origin instead of theirs. When that happens the modal never
 * opens, and since our trigger handler already called preventDefault() the
 * native href never fires either, so the button goes silently dead. That is
 * a real checkout-blocking bug (see GitHub #136, #151, #152, #153, #154,
 * #155, #156), not noise to filter. Both EventbriteWidgetInit.astro and
 * ApplySuccessPanel.tsx need the identical detection and recovery, so the
 * logic lives here once.
 *
 * WHY recovery navigates in the SAME tab: the check fires 2.5 seconds after
 * the click, long past the browser's transient user activation window
 * (about 1 second). window.open() without activation is popup-blocked, so a
 * new-tab recovery would silently do nothing for the exact users this path
 * exists to rescue. location.assign() needs no activation.
 */

import { capture, type CaptureProps } from "@/lib/analyticsCapture";
import { navigateTo } from "@/lib/navigation";

/** Full-screen backdrop Eventbrite injects into <body> when the modal opens. */
const MODAL_SELECTOR = "div.eds-structure_main";

/** How long after a trigger click the modal gets to appear before recovery. */
export const MODAL_OPEN_DEADLINE_MS = 2500;

export interface RecoveryOptions {
  /** Direct Eventbrite URL used when the widget never opens. Empty disables navigation. */
  fallbackUrl: string;
  /** Analytics properties attached to the widget_load_failed event. */
  failureProps: CaptureProps;
}

/** Single home for the failure telemetry both widget components report. */
export function reportWidgetFailure(failureProps: CaptureProps): void {
  capture("widget_load_failed", failureProps);
}

function nodeContainsModal(node: Node): boolean {
  return (
    node instanceof Element &&
    (node.matches(MODAL_SELECTOR) ||
      node.querySelector(MODAL_SELECTOR) !== null)
  );
}

/**
 * Call inside a modal trigger's click handler, after preventDefault().
 * Watches for the Eventbrite modal to appear within the deadline.
 *
 * WHY a MutationObserver on added nodes rather than checking the DOM at the
 * deadline: a user can open the modal and close it again before the deadline
 * fires. A presence check at that moment would misread a completed, normal
 * interaction as a widget failure and navigate the user away. Observing
 * insertions records that the modal DID appear, whatever happens afterwards.
 *
 * If the modal never appears: reports widget_load_failed, then recovers by
 * navigating the current tab to fallbackUrl (when non-empty).
 *
 * Returns a disposer. Callers keep one active watch per trigger by disposing
 * the previous watch before starting a new one, and dispose pending watches
 * on teardown (React effect cleanup).
 */
export function watchModalOpenAfterClick({
  fallbackUrl,
  failureProps,
}: RecoveryOptions): () => void {
  let settled = false;

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (nodeContainsModal(node)) {
          settle();
          return;
        }
      }
    }
  });

  const deadline = window.setTimeout(() => {
    if (settled) return;
    settle();
    reportWidgetFailure(failureProps);
    if (fallbackUrl) {
      navigateTo(fallbackUrl);
    }
  }, MODAL_OPEN_DEADLINE_MS);

  function settle(): void {
    if (settled) return;
    settled = true;
    observer.disconnect();
    window.clearTimeout(deadline);
  }

  // A modal already on screen at click time counts as appeared.
  if (document.querySelector(MODAL_SELECTOR)) {
    settle();
  } else {
    observer.observe(document.body, { childList: true, subtree: true });
  }

  return settle;
}

/**
 * For the catch around createWidget(): the widget is broken before any click
 * happened. Reports the failure once, then makes the trigger still work.
 *
 * WHY anchors get a conditional handler instead of none: a synchronous throw
 * inside createWidget() does not guarantee Eventbrite attached no handler of
 * its own first. If something suppressed the anchor's native navigation the
 * fallback rescues the click; if native navigation is intact it proceeds
 * untouched, so there is no double navigation. Buttons have no native
 * navigation, so their handler always navigates.
 */
export function installInitFailureFallback(
  el: HTMLElement | null,
  { fallbackUrl, failureProps }: RecoveryOptions,
): void {
  reportWidgetFailure(failureProps);
  if (!el || !fallbackUrl) return;

  const hasNativeHref =
    el instanceof HTMLAnchorElement && el.getAttribute("href") !== null;

  el.addEventListener("click", (event) => {
    if (hasNativeHref && !event.defaultPrevented) return;
    navigateTo(fallbackUrl);
  });
}
