import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Shield, Loader2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Datenschutz() {
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
        const res = await axios.get(`${API}/pages/datenschutz?lang=${apiLang}`);
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
    <div className="min-h-screen pt-24 pb-12 px-4" data-testid="datenschutz-page">
      <div className="max-w-4xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-[#94A3B8] hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          {t('nav.backToHome') || 'Back to Home'}
        </Link>

        <div className="glass-card rounded-2xl p-8 space-y-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-[#7C3AED]/20 flex items-center justify-center">
              <Shield className="w-7 h-7 text-[#7C3AED]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">{pageContent?.title || 'Datenschutzerklärung'}</h1>
              <p className="text-[#94A3B8]">Stand: Januar 2026</p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-[#7C3AED] animate-spin" />
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
                <h2 className="text-xl font-bold text-white">1. Verantwortlicher</h2>
                <p>Verantwortlich für die Datenverarbeitung auf dieser Website ist:</p>
                <div className="bg-white/5 rounded-lg p-4 mt-2">
                  <p className="font-semibold text-white">BidBlitz FZCO</p>
                  <p>Dubai Silicon Oasis, DDP Building A1</p>
                  <p>Dubai, Vereinigte Arabische Emirate</p>
                  <p>CEO: Afrim Krasniqi</p>
                  <p>E-Mail: datenschutz@bidblitz.ae</p>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-xl font-bold text-white">2. Datenschutz auf einen Blick</h2>
                <p>
                  Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren 
                  personenbezogenen Daten passiert, wenn Sie diese Website besuchen. Personenbezogene 
                  Daten sind alle Daten, mit denen Sie persönlich identifiziert werden können.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-xl font-bold text-white">3. Datenerfassung auf dieser Website</h2>
                <h3 className="text-lg font-semibold text-white mt-4">3.1 Wer ist verantwortlich?</h3>
                <p>
                  Die Datenverarbeitung auf dieser Website erfolgt durch den Websitebetreiber BidBlitz FZCO.
                </p>

                <h3 className="text-lg font-semibold text-white mt-4">3.2 Wie erfassen wir Ihre Daten?</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Daten, die Sie uns mitteilen (z.B. bei Registrierung, Bestellung)</li>
                  <li>Automatisch erfasste technische Daten (z.B. IP-Adresse, Browser, Betriebssystem)</li>
                  <li>Daten durch Cookies und Analyse-Tools</li>
                </ul>

                <h3 className="text-lg font-semibold text-white mt-4">3.3 Wofür nutzen wir Ihre Daten?</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Bereitstellung und Verbesserung unserer Dienste</li>
                  <li>Abwicklung von Käufen und Auktionen</li>
                  <li>Kommunikation mit Ihnen</li>
                  <li>Betrugsprävention und Sicherheit</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h2 className="text-xl font-bold text-white">4. Ihre Rechte</h2>
                <p>Sie haben jederzeit das Recht auf:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong className="text-white">Auskunft</strong> über Ihre gespeicherten Daten</li>
                  <li><strong className="text-white">Berichtigung</strong> unrichtiger Daten</li>
                  <li><strong className="text-white">Löschung</strong> Ihrer Daten</li>
                  <li><strong className="text-white">Einschränkung</strong> der Verarbeitung</li>
                  <li><strong className="text-white">Datenübertragbarkeit</strong></li>
                  <li><strong className="text-white">Widerspruch</strong> gegen die Verarbeitung</li>
                </ul>
                <p className="mt-2">
                  Zur Ausübung dieser Rechte kontaktieren Sie uns unter: datenschutz@bidblitz.ae
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-xl font-bold text-white">5. Cookies</h2>
                <p>
                  Diese Website verwendet Cookies. Cookies sind kleine Textdateien, die auf Ihrem Gerät 
                  gespeichert werden. Wir verwenden:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong className="text-white">Notwendige Cookies:</strong> Für den Betrieb der Website</li>
                  <li><strong className="text-white">Funktionale Cookies:</strong> Für bessere Nutzererfahrung</li>
                  <li><strong className="text-white">Analyse-Cookies:</strong> Zur Verbesserung unserer Dienste</li>
                </ul>
                <p className="mt-2">
                  Sie können Ihre Cookie-Einstellungen jederzeit in Ihrem Browser ändern.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-xl font-bold text-white">6. Zahlungsabwicklung</h2>
                <p>
                  Für die Zahlungsabwicklung nutzen wir externe Dienstleister wie Stripe. Bei Zahlungen 
                  werden die notwendigen Daten direkt an diese Dienstleister übermittelt und dort 
                  verarbeitet. Wir speichern keine vollständigen Kreditkartendaten.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-xl font-bold text-white">7. Datensicherheit</h2>
                <p>
                  Wir verwenden SSL/TLS-Verschlüsselung für die sichere Datenübertragung. Ihre Daten 
                  werden auf geschützten Servern gespeichert und durch technische und organisatorische 
                  Maßnahmen vor unbefugtem Zugriff geschützt.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-xl font-bold text-white">8. Speicherdauer</h2>
                <p>
                  Wir speichern Ihre Daten nur so lange, wie es für die Erfüllung der Zwecke erforderlich 
                  ist oder gesetzliche Aufbewahrungsfristen dies vorschreiben. Buchhaltungsdaten werden 
                  mindestens 7 Jahre aufbewahrt.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-xl font-bold text-white">9. Internationale Datenübertragung</h2>
                <p>
                  Da unser Unternehmen in Dubai ansässig ist, können Ihre Daten in die VAE übertragen 
                  werden. Für Nutzer aus der EU/EWR stellen wir sicher, dass angemessene Schutzmaßnahmen 
                  gemäß DSGVO getroffen werden.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-xl font-bold text-white">10. Änderungen dieser Datenschutzerklärung</h2>
                <p>
                  Wir behalten uns vor, diese Datenschutzerklärung bei Bedarf anzupassen. Die aktuelle 
                  Version ist stets auf dieser Seite verfügbar.
                </p>
              </section>

              <div className="mt-8 p-4 bg-white/5 rounded-lg">
                <p className="text-sm">
                  <strong className="text-white">Fragen zum Datenschutz?</strong><br />
                  Kontaktieren Sie uns: datenschutz@bidblitz.ae<br /><br />
                  <strong className="text-white">BidBlitz FZCO</strong><br />
                  Dubai Silicon Oasis, DDP Building A1<br />
                  Dubai, Vereinigte Arabische Emirate<br />
                  CEO: Afrim Krasniqi
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
          <Link to="/agb" className="text-[#94A3B8] hover:text-[#FFD700] transition-colors">
            AGB
          </Link>
        </div>
      </div>
    </div>
  );
}
