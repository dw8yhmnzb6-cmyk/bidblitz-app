/* Native BOX inbox UI. Mount inside BidBlitz; no external navigation or iframe. */
(function (global) {
  "use strict";
  function mount(container, options) {
    options = options || {};
    if (container.__boxInbox) return container.__boxInbox;
    const fetcher = options.fetcher || global.fetch.bind(global);
    let disposed = false, busy = false, controller = null, next = null;
    const el = (tag, text) => {
      const node = document.createElement(tag);
      if (text !== undefined) node.textContent = String(text);
      return node;
    };
    const heading = el("h2", "BOX-Verwaltung");
    const intro = el("p", "Standortbewerbungen direkt in BidBlitz ansehen.");
    const load = el("button", "Bewerbungen laden");
    load.type = "button";
    load.style.cssText = "min-height:44px;padding:10px 16px;margin:12px 0;border-radius:10px;background:#21483c;color:#fff";
    const status = el("p", "Noch nicht geladen.");
    status.setAttribute("role", "status");
    const list = el("div");
    const more = el("button", "Weitere Bewerbungen");
    more.type = "button"; more.hidden = true;
    more.style.cssText = "min-height:44px;padding:10px 16px;margin-top:12px";
    container.replaceChildren(heading, intro, load, status, list, more);
    const messages = {
      401: "Deine BidBlitz-Anmeldung ist abgelaufen. Bitte erneut anmelden.",
      403: "Für dein Konto fehlt die Berechtigung für diesen BOX-Bereich.",
      502: "Der BOX-Posteingang ist derzeit nicht erreichbar.",
      503: "Die interne BOX-Anbindung ist noch nicht verfügbar."
    };
    async function read(after, append) {
      if (disposed || busy) return;
      busy = true;
      load.disabled = more.disabled = true;
      controller = new AbortController();
      status.textContent = "Bewerbungen werden geladen …";
      if (!append) { list.replaceChildren(); next = null; more.hidden = true; }
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetcher("/api/admin/box/partner-applications?after=" + encodeURIComponent(after), {
          method: "GET", credentials: "same-origin", cache: "no-store",
          headers: {Accept: "application/json"}, signal: controller.signal
        });
        if (disposed) return;
        if (!response.ok) throw new Error(messages[response.status] || "Die Bewerbungen konnten nicht geladen werden.");
        const data = await response.json();
        if (disposed) return;
        if (!data || !Array.isArray(data.applications) || data.applications.length > 50 ||
            typeof data.has_more !== "boolean" ||
            (data.has_more && (!Number.isSafeInteger(data.next_cursor) || data.next_cursor <= Number(after)))) {
          throw new Error("Die BOX-Antwort konnte nicht verarbeitet werden.");
        }
        for (const application of data.applications) {
          if (!application || typeof application !== "object" || Array.isArray(application)) throw new Error("Ungültige Bewerbung.");
        }
        for (const application of data.applications) {
          const card = el("article");
          card.style.cssText = "padding:16px 0;border-top:1px solid #ccd8d1;overflow-wrap:anywhere";
          card.append(el("h3", application.business || "Standortbewerbung"));
          for (const [key, label] of [
            ["reference", "Referenz"], ["status", "Status"], ["city", "Ort"],
            ["address", "Adresse"], ["contact", "Ansprechpartner"], ["email", "E-Mail"],
            ["phone", "Telefon"], ["hours", "Öffnungszeiten"], ["space", "Verfügbarer Platz"]
          ]) {
            if (typeof application[key] === "string" && application[key])
              card.append(el("p", label + ": " + application[key]));
          }
          list.append(card);
        }
        next = data.has_more ? data.next_cursor : null;
        more.hidden = next === null;
        status.textContent = list.childElementCount ? list.childElementCount + " Bewerbungen angezeigt."
          : "Es sind noch keine Standortbewerbungen eingegangen.";
      } catch (error) {
        if (!disposed) status.textContent = error.name === "AbortError"
          ? "Zeitüberschreitung. Bitte erneut versuchen." : error.message;
      } finally {
        clearTimeout(timeout); busy = false;
        if (!disposed) load.disabled = more.disabled = false;
      }
    }
    const reload = () => read(0, false);
    const loadMore = () => { if (next !== null) read(next, true); };
    load.addEventListener("click", reload);
    more.addEventListener("click", loadMore);
    const handle = {reload, destroy() {
      disposed = true;
      if (controller) controller.abort();
      load.removeEventListener("click", reload);
      more.removeEventListener("click", loadMore);
      delete container.__boxInbox;
    }};
    container.__boxInbox = handle;
    return handle;
  }
  global.BidBlitzBoxInbox = Object.freeze({mount});
})(window);
