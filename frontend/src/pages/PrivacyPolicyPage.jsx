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
          <li><strong>Account:</strong> Email, Name, Passwort-Hash (bcrypt), Telefonnummer</li>
          <li><strong>KYC:</strong> Ausweis-Foto, Selfie, Geburtsdatum (verschlüsselt, MongoDB GridFS)</li>
          <li><strong>Zahlung:</strong> Stripe Customer-ID, Transaktions-Logs (keine Kartendaten — Stripe Vault)</li>
          <li><strong>Nutzung:</strong> Chat-Logs (Landing-Bot), Auktions-Gebote, POS-Bons, Sales-Anfragen</li>
          <li><strong>Geo-Daten:</strong> IP-Adresse, ungefährer Standort (Taxi-Modul)</li>
        </ul>

        <h2 className="text-lg font-bold mt-6 mb-2">3. Drittanbieter (Datenverarbeitung)</h2>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li><strong>Stripe</strong> (Irland) — Zahlungsabwicklung, PCI-DSS Level 1</li>
          <li><strong>Resend</strong> (USA) — Transaktions-Emails (DSGVO-Auftragsverarbeitung)</li>
          <li><strong>LiveKit</strong> (USA) — WebRTC Streaming für Live-Shopping</li>
          <li><strong>Google Gemini</strong> via Emergent — KYC AI-Verifizierung, Chatbot</li>
          <li><strong>OpenAI</strong> via Emergent — Lead-Scoring, Chatbot</li>
          <li><strong>MongoDB Atlas</strong> (EU/USA) — Datenbank</li>
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
        <p className="text-sm">Auskunft, Berichtigung, Löschung, Datenübertragbarkeit, Widerspruch, Beschwerde bei der Aufsichtsbehörde. Anfragen an <a href="mailto:privacy@bidblitz.ae" className="text-blue-400">privacy@bidblitz.ae</a>, Antwort innerhalb 30 Tage.</p>

        <h2 className="text-lg font-bold mt-6 mb-2">7. Cookies</h2>
        <p className="text-sm">Technisch notwendig: Session-Cookie (JWT, HttpOnly). Optional (mit Consent): Analytics, Crash-Monitoring (Sentry). Du kannst die Einwilligung jederzeit über den Cookie-Banner widerrufen.</p>

        <h2 className="text-lg font-bold mt-6 mb-2">8. Änderungen</h2>
        <p className="text-sm">Wir informieren bei wesentlichen Änderungen via Email + In-App-Banner. Diese Version: {today}.</p>

        <p className="text-xs text-gray-500 mt-8 italic">
          ⚠️ Hinweis: Diese Erklärung ist ein Template — bitte vor Production durch deinen Anwalt prüfen lassen.
        </p>
      </div>
    </div>
  );
}
