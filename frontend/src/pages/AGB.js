import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, FileText, Loader2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AGB() {
  const { language, t , mappedLanguage } = useLanguage();
  // Use mappedLanguage for regional variants (e.g., xk -> sq)
  const langKey = mappedLanguage || language;
  const [pageContent, setPageContent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        // Map language code to API format (use 'en' for non-German languages)
        const apiLang = language === 'de' ? 'de' : 'en';
        const res = await axios.get(`${API}/pages/agb?lang=${apiLang}`);
        setPageContent(res.data);
      } catch (error) {
        console.error('Failed to load page content:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchContent();
  }, [language]);

  return (
    <div className="min-h-screen pt-24 pb-12 px-4" data-testid="agb-page">
      <div className="max-w-4xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-[#94A3B8] hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          {t('nav.backToHome') || 'Back to Home'}
        </Link>

        <div className="glass-card rounded-2xl p-8 space-y-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-[#06B6D4]/20 flex items-center justify-center">
              <FileText className="w-7 h-7 text-[#06B6D4]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">{pageContent?.title || 'Allgemeine Geschäftsbedingungen'}</h1>
              <p className="text-[#94A3B8]">Stand: Januar 2026</p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-[#06B6D4] animate-spin" />
            </div>
          ) : pageContent?.content ? (
            <div 
              className="prose prose-invert max-w-none prose-headings:text-white prose-p:text-[#94A3B8] prose-a:text-[#FFD700] prose-strong:text-white prose-li:text-[#94A3B8]"
              dangerouslySetInnerHTML={{ __html: pageContent.content }}
            />
          ) : (
            /* Fallback content */
            <div className="space-y-6 text-[#94A3B8]">
              <section className="space-y-3">
                <h2 className="text-xl font-bold text-white">§ 1 Geltungsbereich</h2>
                <p>
                  Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für alle über die Plattform bidblitz.ae 
                  (betrieben von bidblitz.ae FZCO, Dubai Silicon Oasis, VAE) geschlossenen Verträge zwischen 
                  dem Anbieter und dem Kunden. Der Anbieter ist:
                </p>
                <div className="bg-white/5 rounded-lg p-4 mt-2">
                  <p className="font-semibold text-white">bidblitz.ae FZCO</p>
                  <p>Dubai Silicon Oasis, DDP Building A1</p>
                  <p>Dubai, Vereinigte Arabische Emirate</p>
                  <p>CEO: Afrim Krasniqi</p>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-xl font-bold text-white">§ 2 Vertragsgegenstand</h2>
                <p>
                  bidblitz.ae betreibt eine Penny-Auktion-Plattform, bei der registrierte Nutzer auf Produkte 
                  bieten können. Jedes Gebot erhöht den Preis um einen Cent (0,01 €) und verlängert die 
                  Auktionszeit. Der letzte Bieter bei Ablauf der Zeit gewinnt das Produkt.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-xl font-bold text-white">§ 3 Registrierung und Nutzerkonto</h2>
                <ul className="list-disc list-inside space-y-1">
                  <li>Die Nutzung der Plattform erfordert eine Registrierung.</li>
                  <li>Nutzer müssen mindestens 18 Jahre alt sein.</li>
                  <li>Die angegebenen Daten müssen wahrheitsgemäß und vollständig sein.</li>
                  <li>Jeder Nutzer darf nur ein Konto führen.</li>
                  <li>Das Passwort ist geheim zu halten und darf nicht weitergegeben werden.</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h2 className="text-xl font-bold text-white">§ 4 Gebote und Gebotspaket</h2>
                <ul className="list-disc list-inside space-y-1">
                  <li>Gebote werden in Paketen erworben und sind kostenpflichtig.</li>
                  <li>Einmal erworbene Gebote können nicht zurückgegeben oder in Geld umgewandelt werden.</li>
                  <li>Pro Gebotsabgabe wird ein Gebot vom Nutzerkonto abgezogen.</li>
                  <li>Die aktuellen Preise für Gebotspakete sind auf der Plattform einsehbar.</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h2 className="text-xl font-bold text-white">§ 5 Auktionsablauf</h2>
                <ul className="list-disc list-inside space-y-1">
                  <li>Jedes Gebot erhöht den Auktionspreis um 0,01 €.</li>
                  <li>Jedes Gebot setzt den Countdown zurück (8-15 Sekunden je nach Auktion).</li>
                  <li>Der Nutzer, dessen Gebot bei Ablauf des Countdowns aktiv ist, gewinnt.</li>
                  <li>Der Gewinner zahlt den finalen Auktionspreis zuzüglich Versandkosten.</li>
                  <li>Die "Sofort-Kaufen" Option ermöglicht den Direktkauf zum Marktpreis abzüglich verwendeter Gebote.</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h2 className="text-xl font-bold text-white">§ 6 Preise und Zahlung</h2>
                <ul className="list-disc list-inside space-y-1">
                  <li>Alle Preise verstehen sich inklusive der gesetzlichen Mehrwertsteuer (wo anwendbar).</li>
                  <li>Zahlungen erfolgen per Kreditkarte, PayPal oder anderen angebotenen Zahlungsmethoden.</li>
                  <li>Der Rechnungsbetrag ist sofort fällig.</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h2 className="text-xl font-bold text-white">§ 7 Lieferung</h2>
                <ul className="list-disc list-inside space-y-1">
                  <li>Die Lieferung erfolgt an die vom Kunden angegebene Adresse.</li>
                  <li>Die Lieferzeit beträgt in der Regel 5-14 Werktage.</li>
                  <li>Bei internationaler Lieferung können zusätzliche Zölle und Gebühren anfallen.</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h2 className="text-xl font-bold text-white">§ 8 Widerrufsrecht</h2>
                <p>
                  Für digitale Inhalte (Gebotspakete) gilt: Mit dem Kauf stimmen Sie zu, dass die Ausführung 
                  des Vertrags sofort beginnt und Sie auf Ihr Widerrufsrecht verzichten, sobald die Gebote 
                  Ihrem Konto gutgeschrieben werden.
                </p>
                <p className="mt-2">
                  Für gewonnene physische Produkte gilt ein 14-tägiges Widerrufsrecht ab Erhalt der Ware 
                  gemäß den gesetzlichen Bestimmungen.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-xl font-bold text-white">§ 9 Haftung</h2>
                <p>
                  bidblitz.ae haftet nur für Schäden, die auf vorsätzlichem oder grob fahrlässigem Verhalten 
                  beruhen. Die Haftung für leichte Fahrlässigkeit ist ausgeschlossen, soweit gesetzlich zulässig.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-xl font-bold text-white">§ 10 Sperrung und Kündigung</h2>
                <p>
                  bidblitz.ae behält sich das Recht vor, Nutzerkonten bei Verstoß gegen diese AGB oder bei 
                  Verdacht auf Betrug oder Manipulation zu sperren oder zu löschen.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-xl font-bold text-white">§ 11 Anwendbares Recht</h2>
                <p>
                  Es gilt das Recht der Vereinigten Arabischen Emirate. Gerichtsstand ist Dubai, VAE, 
                  soweit gesetzlich zulässig.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-xl font-bold text-white">§ 12 Schlussbestimmungen</h2>
                <p>
                  Sollten einzelne Bestimmungen dieser AGB unwirksam sein, bleibt die Wirksamkeit der 
                  übrigen Bestimmungen unberührt. bidblitz.ae behält sich das Recht vor, diese AGB jederzeit 
                  zu ändern. Änderungen werden den Nutzern per E-Mail oder bei der nächsten Anmeldung mitgeteilt.
                </p>
              </section>

              <div className="mt-8 p-4 bg-white/5 rounded-lg">
                <p className="text-sm">
                  <strong className="text-white">bidblitz.ae FZCO</strong><br />
                  Dubai Silicon Oasis, DDP Building A1<br />
                  Dubai, Vereinigte Arabische Emirate<br />
                  CEO: Afrim Krasniqi<br />
                  E-Mail: legal@bidblitz.ae
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Related Links */}
        <div className="mt-8 flex flex-wrap gap-4 justify-center">
          <Link to="/impressum" className="text-[#94A3B8] hover:text-[#FFD700] transition-colors">
            Impressum
          </Link>
          <span className="text-[#94A3B8]">•</span>
          <Link to="/datenschutz" className="text-[#94A3B8] hover:text-[#FFD700] transition-colors">
            Datenschutz
          </Link>
        </div>
      </div>
    </div>
  );
}
