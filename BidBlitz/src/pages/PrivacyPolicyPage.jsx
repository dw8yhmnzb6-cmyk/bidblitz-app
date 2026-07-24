import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicyPage({ onBack }) {
  const today = new Date().toLocaleDateString('de-DE');
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="privacy-policy-page">
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center" data-testid="privacy-back">
            <ArrowLeft size={18} />
          </button>
        )}
        <h1 className="text-base font-bold">Datenschutzerklärung</h1>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-6 prose prose-invert prose-sm">
        <p className="text-xs text-gray-400">Stand: {today} · BidBlitz LLC, Dubai (UAE)</p>

        <h2 className="text-lg font-bold mt-6 mb-2">1. Verantwortlicher</h2>
        <p>BidBlitz LLC, Dubai Internet City, Dubai, Vereinigte Arabische Emirate. Kontakt: <a href="mailto:privacy@bidblitz.ae" className="text-blue-400">privacy@bidblitz.ae</a>.</p>

        <h2 className="text-lg font-bold mt-6 mb-2">2. Verarbeitete Daten</h2>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li><strong>Account:</strong> E-Mail, Name, Telefonnummer, User-ID und Sicherheitsprotokolle</li>
          <li><strong>KYC & Uploads:</strong> Ausweis-Foto, Selfie, Geburtsdatum und optionale Upload-Dokumente</li>
          <li><strong>Zahlung:</strong> Zahlungsreferenzen, Wallet- und Rechnungsprotokolle, Stripe Customer-ID (keine Kartendaten im App-Backend)</li>
          <li><strong>Nutzung:</strong> QR-Pay-, POS-, Invoicing-, Staff- und Mobility-Ereignisse zur Bereitstellung der Funktionen und Betrugsprävention</li>
          <li><strong>Standort:</strong> Nur wenn Taxi/Mobility oder Nearby Services aktiv genutzt werden</li>
        </ul>

        <h2 className="text-lg font-bold mt-6 mb-2">3. Drittanbieter (Datenverarbeitung)</h2>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li><strong>Stripe</strong> — Zahlungsabwicklung und Karten-Vaulting</li>
          <li><strong>Resend</strong> — Transaktions- und Support-E-Mails</li>
          <li><strong>LiveKit</strong> — Echtzeitkommunikation für Business- und Commerce-Funktionen</li>
          <li><strong>Mapbox</strong> — Karten, Adresssuche und Mobility-Darstellung</li>
          <li><strong>AI-Provider über Emergent</strong> — KYC-Bildprüfung und Support-/Produktassistenz</li>
          <li><strong>MongoDB</strong> — Produktive Datenspeicherung</li>
        </ul>

        <h2 className="text-lg font-bold mt-6 mb-2">4. Rechtsgrundlagen (DSGVO Art. 6)</h2>
        <p className="text-sm">Vertragserfüllung (lit. b), berechtigtes Interesse (lit. f, Betrugsprävention), Einwilligung (lit. a, Marketing-Emails).</p>

        <h2 className="text-lg font-bold mt-6 mb-2">5. Speicherdauer</h2>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>Account: bis Löschung durch User + 90 Tage Backup-Retention</li>
          <li>KYC-Dokumente: 5 Jahre nach Account-Schließung (UAE Anti-Money-Laundering)</li>
          <li>Transaktions-Logs: 10 Jahre (UAE Steuerrecht)</li>
          <li>Chat-Logs: 12 Monate</li>
        </ul>

        <h2 className="text-lg font-bold mt-6 mb-2">6. Deine Rechte</h2>
        <p className="text-sm">Auskunft, Berichtigung, Löschung, Datenübertragbarkeit, Widerspruch und Beschwerde bei der zuständigen Aufsichtsbehörde. Anfragen an <a href="mailto:privacy@bidblitz.ae" className="text-blue-400">privacy@bidblitz.ae</a>, Antwort innerhalb von 30 Tagen.</p>

        <h2 className="text-lg font-bold mt-6 mb-2">7. Cookies</h2>
        <p className="text-sm">Technisch notwendig: Session-Cookies und Sicherheits-Mechanismen. Optional (mit Einwilligung): Analytics und Crash-Monitoring. Du kannst die Einwilligung jederzeit über die Privacy-Einstellungen widerrufen.</p>

        <h2 className="text-lg font-bold mt-6 mb-2">8. Änderungen</h2>
        <p className="text-sm">Wir informieren bei wesentlichen Änderungen per E-Mail oder In-App-Hinweis. Diese Version: {today}.</p>
      </div>
    </div>
  );
}
