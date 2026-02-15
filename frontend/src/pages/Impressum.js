import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Building2, Loader2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Impressum() {
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
        const res = await axios.get(`${API}/pages/impressum?lang=${apiLang}`);
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
    <div className="min-h-screen pt-24 pb-12 px-4" data-testid="impressum-page">
      <div className="max-w-4xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-[#94A3B8] hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          {t('nav.backToHome') || 'Back to Home'}
        </Link>

        <div className="glass-card rounded-2xl p-8 space-y-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-[#FFD700]/20 flex items-center justify-center">
              <Building2 className="w-7 h-7 text-[#FFD700]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">{pageContent?.title || 'Impressum'}</h1>
              <p className="text-[#94A3B8]">Rechtliche Angaben</p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-[#FFD700] animate-spin" />
            </div>
          ) : pageContent?.content ? (
            <div 
              className="prose prose-invert max-w-none prose-headings:text-white prose-p:text-[#94A3B8] prose-a:text-[#FFD700] prose-strong:text-white"
              dangerouslySetInnerHTML={{ __html: pageContent.content }}
            />
          ) : (
            /* Fallback to hardcoded content if API fails */
            <div className="space-y-6">
              <section className="space-y-3">
                <h2 className="text-xl font-bold text-white">Anbieter</h2>
                <div className="text-[#94A3B8] space-y-1">
                  <p className="font-semibold text-white">bidblitz.ae FZCO</p>
                  <p>Dubai Silicon Oasis</p>
                  <p>DDP, Building A1</p>
                  <p>Dubai, Vereinigte Arabische Emirate</p>
                </div>
              </section>
              
              <section className="space-y-3">
                <h2 className="text-xl font-bold text-white">Geschäftsführung</h2>
                <div className="text-[#94A3B8] space-y-1">
                  <p className="font-semibold text-white">Afrim Krasniqi</p>
                  <p>Chief Executive Officer (CEO)</p>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-xl font-bold text-white">Kontakt</h2>
                <div className="text-[#94A3B8] space-y-1">
                  <p>E-Mail: info@bidblitz.ae</p>
                  <p>Telefon: +971 4 501 2345</p>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-xl font-bold text-white">Handelsregister</h2>
                <div className="text-[#94A3B8] space-y-1">
                  <p>Registriert bei: Dubai Silicon Oasis Authority (DSOA)</p>
                  <p>Lizenz-Nr.: DSO-FZCO-12345</p>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-xl font-bold text-white">Umsatzsteuer-ID</h2>
                <div className="text-[#94A3B8] space-y-1">
                  <p>VAT Registration Number: 100123456700003</p>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-xl font-bold text-white">Verantwortlich für den Inhalt</h2>
                <div className="text-[#94A3B8] space-y-1">
                  <p className="font-semibold text-white">Afrim Krasniqi</p>
                  <p>bidblitz.ae FZCO</p>
                  <p>Dubai Silicon Oasis, DDP Building A1</p>
                  <p>Dubai, VAE</p>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-xl font-bold text-white">Online-Streitbeilegung</h2>
                <p className="text-[#94A3B8]">
                  Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: 
                  <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" className="text-[#FFD700] hover:underline ml-1">
                    https://ec.europa.eu/consumers/odr
                  </a>
                </p>
                <p className="text-[#94A3B8]">
                  Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
                </p>
              </section>
            </div>
          )}
        </div>

        {/* Related Links */}
        <div className="mt-8 flex flex-wrap gap-4 justify-center">
          <Link to="/datenschutz" className="text-[#94A3B8] hover:text-[#FFD700] transition-colors">
            Datenschutz
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
