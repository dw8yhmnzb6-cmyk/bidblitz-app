// Navigation to existing, separately authorized customer tools. Never grants rights.
const NATIVE_PROJECTS = new Set(['bidblitz', 'pay', 'staff', 'identity', 'taxi', 'scooter', 'food', 'auctions', 'merchant', 'pool', 'tickets', 'car-rental', 'mining', 'ev']);
const REMOTE = {
  eyes: { label: 'Kunden & Suchguthaben', actions: ['Kunden ansehen', 'Sperren / Entsperren', 'Suchguthaben korrigieren'], note: 'Suchguthaben in Credits. Die Kundenliste und das Guthabenformular stehen im Eyes-Adminbereich.' },
  trade: { label: 'Kunden & Lizenzverwaltung', actions: ['Kunden ansehen', 'Sperren / Entsperren', 'Lizenzbefreiung / Freimonate'], note: 'Im Trade-Admin „Customers“ öffnen. Lizenzvorteile sind keine Broker- oder Wallet-Gutschriften.' },
  nex: { label: 'Mitglieder & Abos', actions: ['Mitglieder ansehen', 'Sperren / Entsperren', 'Manuelle Abos verwalten'], note: 'Im NEX-Admin „Mitglieder“ öffnen. Provider-Abos bleiben beim Zahlungsanbieter verwaltet; eine Geldgutschrift ist hier noch nicht angebunden.' },
  stack: { label: 'Organisationen ansehen', actions: ['Organisationen ansehen'], note: 'Stack zeigt die Organisationen im Admin-Center. Kundensperren und Gutschriften sind dort noch nicht implementiert.' },
};
// Public project origins observed during this repair; no central login is implied.
const SEPARATE_PROJECT_SITES = { aion: 'https://aion.bidblitz.ae', verify: 'https://verify.bidblitz.ae' };

export function projectCustomerControls(project) {
  if (NATIVE_PROJECTS.has(project.id) && project.open_mode === 'internal') {
    return { available: true, native: true, label: 'Kunden verwalten', actions: ['Kunden ansehen', 'Sperren / Entsperren', 'Wallet-Gutschriften'], note: 'Gemeinsame BidBlitz-Kundenkonten. Wallet-Gutschriften erfolgen mit Grund, Admin-Bestätigung und Buchungsprotokoll.', customerPath: '/admin/manage', creditPath: '/admin/wallet' };
  }
  const remote = REMOTE[project.id];
  if (remote && project.open_mode === 'sso') return { ...remote, available: true, native: false };
  return { available: false, native: false, actions: [], note: 'Die Kundenverwaltung kann erst nach Anbindung und Prüfung des eigenen Projekt-Admins verwendet werden.' };
}

export function separateProjectUrl(project) {
  if (project.status === 'hidden') return null;
  const candidate = project.admin_url || project.url || SEPARATE_PROJECT_SITES[project.id];
  if (typeof candidate !== 'string' || /[\\\s]/.test(candidate)) return null;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || (url.port && url.port !== '443')) return null;
    return url.href;
  } catch { return null; }
}
