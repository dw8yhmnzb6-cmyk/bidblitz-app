/*!
 * BidBlitz Pay JS SDK v1.0
 * Embed on any website to accept payments via BidBlitz Wallet.
 * Usage:
 *   <script src="https://bidblitz.ae/pay.js"></script>
 *   <script>
 *     BidBlitzPay.mount("#pay-button", {
 *       publicKey: "pk_live_xxx",
 *       amount: 29.90, currency: "EUR",
 *       orderId: "ORDER-123",
 *       description: "Bestellung #123",
 *       successUrl: window.location.origin + "/thanks",
 *       cancelUrl: window.location.origin + "/cart",
 *       webhookUrl: "https://merchant.com/api/bidblitz-webhook",
 *       onSuccess: (data) => console.log("paid", data),
 *       onCancel: (data) => console.log("cancelled", data),
 *     });
 *   </script>
 */
(function (global) {
  "use strict";
  // Backend origin is derived from the script's src attribute so SDK works
  // regardless of what domain the merchant hosts it on.
  var scripts = document.getElementsByTagName("script");
  var BASE = "";
  for (var i = 0; i < scripts.length; i++) {
    var src = scripts[i].src || "";
    if (src.indexOf("/pay.js") !== -1) {
      var u = new URL(src);
      BASE = u.origin;
      break;
    }
  }
  if (!BASE) BASE = global.BIDBLITZ_PAY_ORIGIN || "https://bidblitz.ae";

  var STYLE = [
    ".bbpay-btn{display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#00E0FF,#00E89D);",
    "color:#020408;border:none;border-radius:10px;padding:12px 22px;font-weight:800;font-size:14px;",
    "font-family:-apple-system,'Segoe UI',sans-serif;cursor:pointer;transition:transform .12s;box-shadow:0 4px 16px rgba(0,232,157,.25)}",
    ".bbpay-btn:hover{transform:translateY(-1px)}",
    ".bbpay-btn:disabled{opacity:.5;cursor:wait}",
    ".bbpay-btn svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2.2;stroke-linecap:round}",
    ".bbpay-overlay{position:fixed;inset:0;background:rgba(2,4,8,.75);backdrop-filter:blur(6px);z-index:999999;",
    "display:flex;align-items:center;justify-content:center;animation:bbpayfade .2s}",
    ".bbpay-frame{width:min(420px,95vw);height:min(640px,90vh);border:none;border-radius:16px;",
    "box-shadow:0 20px 60px rgba(0,0,0,.5);background:#020408}",
    ".bbpay-close{position:absolute;top:16px;right:16px;width:36px;height:36px;border-radius:50%;",
    "background:rgba(255,255,255,.1);color:#fff;border:none;font-size:18px;cursor:pointer}",
    "@keyframes bbpayfade{from{opacity:0}to{opacity:1}}",
  ].join("");

  function injectStyle() {
    if (document.getElementById("bbpay-style")) return;
    var s = document.createElement("style");
    s.id = "bbpay-style";
    s.innerHTML = STYLE;
    document.head.appendChild(s);
  }

  function api(path, body) {
    return fetch(BASE + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    }).then(function (r) { return r.json(); });
  }

  function createButton(opts) {
    var btn = document.createElement("button");
    btn.className = "bbpay-btn";
    btn.type = "button";
    var label = opts.label || ("Bezahlen " + (opts.amount || 0).toFixed(2) + " " + (opts.currency || "EUR"));
    btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>' +
                    '<span>' + escapeHtml(label) + '</span>';
    return btn;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function openCheckout(checkoutUrl, sessionId, opts) {
    injectStyle();
    var overlay = document.createElement("div");
    overlay.className = "bbpay-overlay";
    var closeBtn = document.createElement("button");
    closeBtn.className = "bbpay-close";
    closeBtn.innerHTML = "×";
    closeBtn.onclick = function () { cleanup("cancelled"); };
    var frame = document.createElement("iframe");
    frame.className = "bbpay-frame";
    frame.src = checkoutUrl + "?embed=1";
    overlay.appendChild(frame);
    overlay.appendChild(closeBtn);
    document.body.appendChild(overlay);

    // Poll session status (simple — no postMessage needed for MVP)
    var pollTimer = setInterval(function () {
      fetch(BASE + "/api/pay/session/" + sessionId).then(function (r) { return r.json(); })
        .then(function (s) {
          if (s.status === "paid") cleanup("paid", s);
          else if (s.status === "cancelled" || s.status === "expired") cleanup("cancelled", s);
        }).catch(function () { /* noop */ });
    }, 2000);

    function cleanup(outcome, data) {
      clearInterval(pollTimer);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (outcome === "paid" && typeof opts.onSuccess === "function") opts.onSuccess(data);
      if (outcome === "cancelled" && typeof opts.onCancel === "function") opts.onCancel(data);
    }
  }

  function launch(opts) {
    if (!opts.publicKey) throw new Error("BidBlitzPay: publicKey required");
    if (!opts.amount || opts.amount <= 0) throw new Error("BidBlitzPay: amount must be > 0");

    return api("/api/pay/session", {
      public_key: opts.publicKey,
      amount: Number(opts.amount),
      currency: opts.currency || "EUR",
      order_id: opts.orderId || "",
      description: opts.description || "",
      success_url: opts.successUrl || "",
      cancel_url: opts.cancelUrl || "",
      webhook_url: opts.webhookUrl || "",
      customer_email: opts.customerEmail || "",
      metadata: opts.metadata || {},
    }).then(function (res) {
      if (!res.ok || !res.checkout_url) {
        var msg = (res && res.detail) || "Session konnte nicht erstellt werden";
        if (typeof opts.onError === "function") opts.onError(msg);
        else alert("BidBlitz Pay: " + msg);
        return;
      }
      openCheckout(res.checkout_url, res.session_id, opts);
    });
  }

  function mount(selector, opts) {
    injectStyle();
    var nodes = typeof selector === "string" ? document.querySelectorAll(selector) : [selector];
    Array.prototype.forEach.call(nodes, function (host) {
      var btn = createButton(opts);
      btn.onclick = function () {
        btn.disabled = true;
        launch(opts).finally(function () { btn.disabled = false; });
      };
      // Clear host then append
      host.innerHTML = "";
      host.appendChild(btn);
    });
  }

  global.BidBlitzPay = {
    version: "1.0.0",
    baseUrl: BASE,
    mount: mount,
    launch: launch,
  };
})(window);
