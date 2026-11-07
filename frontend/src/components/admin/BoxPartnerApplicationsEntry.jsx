/** Central Admin entry to the independently protected BOX inbox. */
export default function BoxPartnerApplicationsEntry() {
  return (
    <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4" data-testid="admin-box-partner-entry" aria-label="BOX-Standortbewerbungen">
      <h3 className="text-base font-bold text-gray-900">Bewerbungen für BOX-Standorte</h3>
      <p className="text-sm text-gray-600">Hier öffnest du die eingegangenen Standortbewerbungen von Geschäften im BOX-Adminbereich.</p>
      <a
        href="https://box.bidblitz.ae/admin/partner-applications"
        target="_blank" rel="noopener noreferrer"
        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-emerald-800 px-4 py-3 text-center text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
        data-testid="admin-box-partner-inbox"
      >BOX-Posteingang öffnen ↗</a>
      <p className="text-sm text-gray-600">Öffnet in einem neuen Tab. Für den Zugriff brauchst du eine aktive BOX-Anmeldung und eine Adminberechtigung für BOX.</p>
      <a
        href="https://box.bidblitz.ae/auth/login"
        target="_blank" rel="noopener noreferrer"
        className="inline-flex min-h-[44px] items-center rounded-lg px-2 text-sm font-semibold text-emerald-800 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
        data-testid="admin-box-partner-login"
      >Bei BOX anmelden ↗</a>
      <p className="text-sm text-gray-600">Falls „login_required“ erscheint, melde dich zuerst bei BOX an und öffne anschließend den Posteingang erneut.</p>
    </section>
  );
}
