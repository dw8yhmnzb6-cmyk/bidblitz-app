import { ArrowLeft } from 'lucide-react';

export default function TermsPage({ onBack }) {
  const today = new Date().toLocaleDateString('de-DE');
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="terms-page">
      <div className="sticky top-0 z-20 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center" data-testid="terms-back">
            <ArrowLeft size={18} />
          </button>
        )}
        <h1 className="text-base font-bold">AGB / Nutzungsbedingungen</h1>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-6 prose prose-invert prose-sm">
        <p className="text-xs text-gray-400">Gültig ab: {today} · BidBlitz LLC, Dubai (UAE)</p>

        <h2 className="text-lg font-bold mt-6 mb-2">§1 Geltungsbereich</h2>
        <p className="text-sm">Diese Nutzungsbedingungen regeln die Nutzung der BidBlitz Super-App (Web + iOS + Android) durch volljährige Nutzer (18+). Anbieter: BidBlitz LLC, Dubai Internet City, UAE.</p>

        <h2 className="text-lg font-bold mt-6 mb-2">§2 Vertragsschluss</h2>
        <p className="text-sm">Mit der Registrierung kommt ein Nutzungsvertrag zustande. Du bestätigst, dass deine Angaben wahrheitsgemäß sind und du volljährig bist.</p>

        <h2 className="text-lg font-bold mt-6 mb-2">§3 KYC-Verifizierung</h2>
        <p className="text-sm">Für transaktionsbasierte Features wie Wallet-Aufladung, Geldtransfer, Merchant-Payouts und Taxi/Mobility kann eine Identitätsprüfung erforderlich sein. Wir nutzen AI-gestützte Verifikation plus manuelle Prüfung.</p>

        <h2 className="text-lg font-bold mt-6 mb-2">§4 Wallet, Zahlungen und Merchant-Tools</h2>
        <p className="text-sm">BidBlitz stellt Wallet-Zahlungen, QR Pay, Rechnungen, Merchant- und POS-Funktionen, Staff-Tools sowie Mobility-Dienste bereit. Zahlungen dürfen nur für legitime Transaktionen verwendet werden. Missbrauch, Fraud, Umgehung von Limits oder Identitätsfälschung führen zur Sperrung.</p>

        <h2 className="text-lg font-bold mt-6 mb-2">§5 Rechnungen, QR Pay und kontaktlose Funktionen</h2>
        <p className="text-sm">Rechnungen, Payment Links, QR Pay und NFC/RFID-Funktionen sind ausschließlich für echte Geschäfts- oder Privattransaktionen vorgesehen. Der Nutzer ist für die Richtigkeit der Zahlungsdaten verantwortlich.</p>

        <h2 className="text-lg font-bold mt-6 mb-2">§6 Wallet & Transfer</h2>
        <p className="text-sm">Wallet-Guthaben ist an deinen Account gebunden, nicht übertragbar. Geld-Transfer zwischen verifizierten Usern: max. 5.000 EUR/Tag. Negative Saldi nicht möglich.</p>

        <h2 className="text-lg font-bold mt-6 mb-2">§7 Live-Shopping</h2>
        <p className="text-sm">Live-Streams werden ggf. aufgezeichnet (Hinweis im Stream). Aufzeichnungen können 30 Tage gespeichert werden. Beleidigender Content führt zu Ban.</p>

        <h2 className="text-lg font-bold mt-6 mb-2">§8 Widerruf (EU/UAE-Verbraucher)</h2>
        <p className="text-sm">Für gesetzlich widerrufsfähige Käufe gelten die jeweils anwendbaren Verbraucherschutzrechte. Bereits ausgeführte digitale Zahlungs- und Wallet-Services können nach den gesetzlichen Vorgaben vom Widerruf ausgeschlossen sein.</p>

        <h2 className="text-lg font-bold mt-6 mb-2">§9 Haftung</h2>
        <p className="text-sm">Wir haften für Vorsatz + grobe Fahrlässigkeit unbegrenzt, für leichte Fahrlässigkeit auf vorhersehbaren Schaden. Keine Haftung für: Drittanbieter-Ausfälle (Stripe, LiveKit), höhere Gewalt, Hacker-Angriffe trotz angemessener Sicherheit.</p>

        <h2 className="text-lg font-bold mt-6 mb-2">§10 Account-Kündigung</h2>
        <p className="text-sm">Du kannst jederzeit kündigen via Profil → &quot;Account löschen&quot;. Wir kündigen bei Verstoß mit 14 Tagen Frist. Credits-Verfall siehe §5.</p>

        <h2 className="text-lg font-bold mt-6 mb-2">§11 Rechtswahl</h2>
        <p className="text-sm">UAE-Recht. Gerichtsstand Dubai. Verbraucher in der EU haben gesetzlichen Schutz nach dem Recht ihres Wohnsitzes.</p>

        <h2 className="text-lg font-bold mt-6 mb-2">§12 Änderungen</h2>
        <p className="text-sm">Änderungen werden 30 Tage vorher via E-Mail oder In-App angekündigt. Widerspruch gilt als Kündigung.</p>

        <h2 className="text-lg font-bold mt-6 mb-2">§13 Mobile Store Safe Mode</h2>
        <p className="text-sm">In mobilen Store-Builds werden Auktions-, Glücksspiel- und sonstige zufallsbasierte Module nicht bereitgestellt. BidBlitz Rewards in der Mobile-App basieren auf klaren, nicht-zufallsbasierten Nutzeraktionen.</p>
      </div>
    </div>
  );
}
