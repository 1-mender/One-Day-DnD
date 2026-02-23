(function () {
  var root = document.getElementById("root");
  if (!root) return;

  var panel = document.createElement("div");
  panel.id = "bootstrap-guard";
  panel.style.display = "none";
  panel.style.margin = "12px";
  panel.style.padding = "12px";
  panel.style.border = "1px solid #8b6b3e";
  panel.style.borderRadius = "10px";
  panel.style.background = "#f6ead1";
  panel.style.color = "#2b2216";
  panel.style.fontFamily = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
  panel.style.whiteSpace = "pre-wrap";
  panel.style.lineHeight = "1.35";
  panel.style.fontSize = "14px";
  panel.textContent = "Loading UI...";
  document.body.appendChild(panel);

  var finished = false;
  var timerId = null;

  function hasUi() {
    return !!(root.firstElementChild || (root.textContent && root.textContent.trim()));
  }

  function hidePanel() {
    if (panel && panel.parentNode) {
      panel.parentNode.removeChild(panel);
    }
  }

  function done() {
    if (finished) return;
    if (!hasUi()) return;
    finished = true;
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
    hidePanel();
  }

  function showPanel(msg) {
    if (finished) return;
    panel.style.display = "block";
    panel.textContent = "UI failed to start.\n" + msg;
  }

  if (typeof MutationObserver !== "undefined") {
    try {
      var mo = new MutationObserver(function () { done(); });
      mo.observe(root, { childList: true, subtree: true });
    } catch (_e) {
      // ignore observer setup errors
    }
  }

  window.addEventListener("error", function (evt) {
    var msg = evt && evt.message ? String(evt.message) : "unknown_error";
    showPanel("JS error: " + msg);
  });

  window.addEventListener("unhandledrejection", function (evt) {
    var reason = evt && evt.reason ? String(evt.reason) : "unknown_rejection";
    showPanel("Unhandled rejection: " + reason);
  });

  timerId = setTimeout(function () {
    if (!hasUi()) {
      showPanel("No UI render after 6s.\nTry opening: /api/server/info and /assets/index-*.js");
    } else {
      done();
    }
  }, 6000);
})();
