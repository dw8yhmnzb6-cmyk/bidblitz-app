import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { ChevronDown, ChevronUp, HelpCircle, Search } from 'lucide-react';

const FAQItem = ({ question, answer, isOpen, onClick, isDarkMode }) => {
  return (
    <div className={`border-b last:border-b-0 ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
      <button
        onClick={onClick}
        className={`w-full py-5 flex items-center justify-between text-left transition-colors px-4 -mx-4 rounded-lg ${
          isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50'
        }`}
      >
        <span className={`font-medium pr-8 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{question}</span>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-amber-500 flex-shrink-0" />
        ) : (
          <ChevronDown className={`w-5 h-5 flex-shrink-0 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
        )}
      </button>
      {isOpen && (
        <div className={`pb-5 leading-relaxed pl-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          {answer}
        </div>
      )}
    </div>
  );
};

// Multilingual FAQ content
const faqContent = {
  de: {
    title: "Häufig gestellte Fragen",
    subtitle: "Antworten auf die häufigsten Fragen zu bidblitz.ae",
    searchPlaceholder: "Fragen durchsuchen...",
    resultsFor: "Ergebnis(se) für",
    noResults: "Keine Ergebnisse gefunden. Kontaktieren Sie uns für weitere Hilfe.",
    stillQuestions: "Ihre Frage nicht gefunden?",
    contactText: "Unser Support-Team hilft Ihnen gerne weiter!",
    contactButton: "Kontakt aufnehmen",
    categories: [
      {
        title: "Allgemein",
        faqs: [
          { question: "Was ist bidblitz.ae?", answer: "bidblitz.ae ist eine Penny-Auktions-Plattform, auf der Sie Top-Markenprodukte für einen Bruchteil des Preises ersteigern können. Jedes Gebot erhöht den Preis um nur 0,01€ und verlängert den Timer." },
          { question: "Ist bidblitz.ae seriös?", answer: "Ja! bidblitz.ae ist ein seriöses Unternehmen mit Sitz in Dubai, UAE. Alle Auktionen sind transparent und fair. Wir versenden echte Produkte an echte Gewinner." },
          { question: "Wie kann ich Geld sparen?", answer: "Bei bidblitz.ae können Sie Produkte für bis zu 99% unter dem Marktpreis ersteigern. Ein iPhone im Wert von 1.199€ kann z.B. für unter 50€ ersteigert werden." }
        ]
      },
      {
        title: "Bieten & Auktionen",
        faqs: [
          { question: "Wie funktioniert das Bieten?", answer: "Jedes Gebot kostet Sie einen Ihrer gekauften Gebote (ab 0,50€). Der Auktionspreis steigt um 0,01€ und der Timer wird um 10-15 Sekunden verlängert. Der letzte Bieter gewinnt!" },
          { question: "Was ist der Auto-Bidder?", answer: "Der Auto-Bidder bietet automatisch für Sie in den letzten Sekunden einer Auktion. Sie legen fest, wie viele Gebote maximal verwendet werden sollen." },
          { question: "Wie lange dauert eine Auktion?", answer: "Die Dauer variiert. Bei jedem Gebot wird der Timer verlängert. Auktionen können von wenigen Minuten bis zu mehreren Stunden dauern." }
        ]
      },
      {
        title: "Gebote & Preise",
        faqs: [
          { question: "Was kosten Gebote?", answer: "Gebote kosten ab 0,50€ pro Stück. Je mehr Gebote Sie kaufen, desto günstiger wird der Einzelpreis. Außerdem erhalten Sie bei größeren Paketen Gratis-Gebote!" },
          { question: "Verfallen meine Gebote?", answer: "Nein! Ihre Gebote verfallen nicht und können jederzeit verwendet werden." },
          { question: "Welche Zahlungsmethoden werden akzeptiert?", answer: "Wir akzeptieren Kreditkarten, Klarna, SEPA-Lastschrift und Kryptowährungen über Coinbase Commerce." }
        ]
      }
    ]
  },
  en: {
    title: "Frequently Asked Questions",
    subtitle: "Answers to the most common questions about bidblitz.ae",
    searchPlaceholder: "Search questions...",
    resultsFor: "result(s) for",
    noResults: "No results found. Contact us for further help.",
    stillQuestions: "Didn't find your question?",
    contactText: "Our support team is happy to help you!",
    contactButton: "Contact Us",
    categories: [
      {
        title: "General",
        faqs: [
          { question: "What is bidblitz.ae?", answer: "bidblitz.ae is a penny auction platform where you can win top brand products for a fraction of the price. Each bid increases the price by only €0.01 and extends the timer." },
          { question: "Is bidblitz.ae legitimate?", answer: "Yes! bidblitz.ae is a legitimate company based in Dubai, UAE. All auctions are transparent and fair. We ship real products to real winners." },
          { question: "How can I save money?", answer: "At bidblitz.ae, you can win products for up to 99% below market price. An iPhone worth €1,199 can be won for under €50." }
        ]
      },
      {
        title: "Bidding & Auctions",
        faqs: [
          { question: "How does bidding work?", answer: "Each bid costs one of your purchased bids (from €0.50). The auction price increases by €0.01 and the timer extends by 10-15 seconds. The last bidder wins!" },
          { question: "What is the Auto-Bidder?", answer: "The Auto-Bidder automatically bids for you in the last seconds of an auction. You set the maximum number of bids to use." },
          { question: "How long does an auction last?", answer: "Duration varies. The timer extends with each bid. Auctions can last from a few minutes to several hours." }
        ]
      },
      {
        title: "Bids & Pricing",
        faqs: [
          { question: "How much do bids cost?", answer: "Bids start at €0.50 each. The more bids you buy, the cheaper the unit price. Plus, you get free bonus bids with larger packages!" },
          { question: "Do my bids expire?", answer: "No! Your bids never expire and can be used at any time." },
          { question: "What payment methods are accepted?", answer: "We accept credit cards, Klarna, SEPA direct debit, and cryptocurrencies via Coinbase Commerce." }
        ]
      }
    ]
  },
  sq: {
    title: "Pyetjet e Bëra Shpesh",
    subtitle: "Përgjigje për pyetjet më të zakonshme rreth bidblitz.ae",
    searchPlaceholder: "Kërko pyetje...",
    resultsFor: "rezultat(e) për",
    noResults: "Nuk u gjetën rezultate. Na kontaktoni për ndihmë të mëtejshme.",
    stillQuestions: "Nuk e gjetët pyetjen tuaj?",
    contactText: "Ekipi ynë i mbështetjes është i gatshëm t'ju ndihmojë!",
    contactButton: "Na Kontaktoni",
    categories: [
      {
        title: "Të Përgjithshme",
        faqs: [
          { question: "Çfarë është bidblitz.ae?", answer: "bidblitz.ae është një platformë ankandesh penny ku mund të fitoni produkte të markave të njohura me një pjesë të çmimit. Çdo ofertë rrit çmimin me vetëm 0.01€ dhe zgjat kohëmatësin." },
          { question: "A është bidblitz.ae i besueshëm?", answer: "Po! bidblitz.ae është një kompani legjitime me bazë në Dubai, UAE. Të gjitha ankandet janë transparente dhe të drejta. Ne dërgojmë produkte reale tek fituesit realë." },
          { question: "Si mund të kursej para?", answer: "Në bidblitz.ae, mund të fitoni produkte deri në 99% nën çmimin e tregut. Një iPhone me vlerë 1,199€ mund të fitohet për nën 50€." }
        ]
      },
      {
        title: "Ofertimi & Ankandet",
        faqs: [
          { question: "Si funksionon ofertimi?", answer: "Çdo ofertë kushton një nga ofertat tuaja të blera (nga 0.50€). Çmimi i ankandit rritet me 0.01€ dhe kohëmatësi zgjatet me 10-15 sekonda. Ofertuesi i fundit fiton!" },
          { question: "Çfarë është Auto-Bidder?", answer: "Auto-Bidder oferton automatikisht për ju në sekondat e fundit të një ankandi. Ju vendosni numrin maksimal të ofertave për të përdorur." },
          { question: "Sa kohë zgjat një ankand?", answer: "Kohëzgjatja varion. Kohëmatësi zgjatet me çdo ofertë. Ankandet mund të zgjasin nga disa minuta deri në disa orë." }
        ]
      },
      {
        title: "Ofertat & Çmimet",
        faqs: [
          { question: "Sa kushtojnë ofertat?", answer: "Ofertat fillojnë nga 0.50€ secila. Sa më shumë oferta blini, aq më lirë bëhet çmimi për njësi. Plus, merrni oferta bonus falas me paketat më të mëdha!" },
          { question: "A skadojnë ofertat e mia?", answer: "Jo! Ofertat tuaja nuk skadojnë kurrë dhe mund të përdoren në çdo kohë." },
          { question: "Cilat metoda pagese pranohen?", answer: "Ne pranojmë karta krediti, Klarna, debitim direkt SEPA, dhe kriptovaluta përmes Coinbase Commerce." }
        ]
      }
    ]
  },
  tr: {
    title: "Sık Sorulan Sorular",
    subtitle: "bidblitz.ae hakkında en yaygın sorulara cevaplar",
    searchPlaceholder: "Soru ara...",
    resultsFor: "sonuç",
    noResults: "Sonuç bulunamadı. Daha fazla yardım için bizimle iletişime geçin.",
    stillQuestions: "Sorunuzu bulamadınız mı?",
    contactText: "Destek ekibimiz size yardımcı olmaktan mutluluk duyar!",
    contactButton: "Bize Ulaşın",
    categories: [
      {
        title: "Genel",
        faqs: [
          { question: "bidblitz.ae nedir?", answer: "bidblitz.ae, en iyi marka ürünlerini fiyatın küçük bir bölümüyle kazanabileceğiniz bir penny açık artırma platformudur. Her teklif fiyatı sadece 0,01€ artırır ve zamanlayıcıyı uzatır." },
          { question: "bidblitz.ae güvenilir mi?", answer: "Evet! bidblitz.ae, Dubai, BAE merkezli meşru bir şirkettir. Tüm açık artırmalar şeffaf ve adildir. Gerçek kazananlara gerçek ürünler gönderiyoruz." },
          { question: "Nasıl para tasarruf edebilirim?", answer: "bidblitz.ae'de ürünleri piyasa fiyatının %99'a kadar altında kazanabilirsiniz. 1.199€ değerinde bir iPhone 50€'nun altında kazanılabilir." }
        ]
      },
      {
        title: "Teklif Verme & Açık Artırmalar",
        faqs: [
          { question: "Teklif verme nasıl çalışır?", answer: "Her teklif, satın aldığınız tekliflerden birini kullanır (0,50€'dan başlayan). Açık artırma fiyatı 0,01€ artar ve zamanlayıcı 10-15 saniye uzar. Son teklif veren kazanır!" },
          { question: "Otomatik Teklif Verici nedir?", answer: "Otomatik Teklif Verici, bir açık artırmanın son saniyelerinde sizin için otomatik olarak teklif verir. Kullanılacak maksimum teklif sayısını siz belirlersiniz." },
          { question: "Bir açık artırma ne kadar sürer?", answer: "Süre değişir. Zamanlayıcı her teklifle uzar. Açık artırmalar birkaç dakikadan birkaç saate kadar sürebilir." }
        ]
      },
      {
        title: "Teklifler & Fiyatlandırma",
        faqs: [
          { question: "Teklifler ne kadar?", answer: "Teklifler tanesi 0,50€'dan başlar. Ne kadar çok teklif alırsanız, birim fiyat o kadar ucuz olur. Ayrıca büyük paketlerde ücretsiz bonus teklifler alırsınız!" },
          { question: "Tekliflerim sona erer mi?", answer: "Hayır! Teklifleriniz asla sona ermez ve her zaman kullanılabilir." },
          { question: "Hangi ödeme yöntemleri kabul ediliyor?", answer: "Kredi kartları, Klarna, SEPA doğrudan borçlandırma ve Coinbase Commerce üzerinden kripto para birimlerini kabul ediyoruz." }
        ]
      }
    ]
  },
  fr: {
    title: "Questions Fréquemment Posées",
    subtitle: "Réponses aux questions les plus courantes sur bidblitz.ae",
    searchPlaceholder: "Rechercher des questions...",
    resultsFor: "résultat(s) pour",
    noResults: "Aucun résultat trouvé. Contactez-nous pour plus d'aide.",
    stillQuestions: "Vous n'avez pas trouvé votre question?",
    contactText: "Notre équipe de support est là pour vous aider!",
    contactButton: "Contactez-nous",
    categories: [
      {
        title: "Général",
        faqs: [
          { question: "Qu'est-ce que bidblitz.ae?", answer: "bidblitz.ae est une plateforme d'enchères au centime où vous pouvez gagner des produits de grandes marques pour une fraction du prix. Chaque enchère augmente le prix de seulement 0,01€ et prolonge le minuteur." },
          { question: "bidblitz.ae est-il fiable?", answer: "Oui! bidblitz.ae est une entreprise légitime basée à Dubaï, EAU. Toutes les enchères sont transparentes et équitables. Nous expédions de vrais produits aux vrais gagnants." },
          { question: "Comment puis-je économiser de l'argent?", answer: "Chez bidblitz.ae, vous pouvez gagner des produits jusqu'à 99% en dessous du prix du marché. Un iPhone d'une valeur de 1 199€ peut être gagné pour moins de 50€." }
        ]
      },
      {
        title: "Enchères & Ventes",
        faqs: [
          { question: "Comment fonctionnent les enchères?", answer: "Chaque enchère coûte une de vos enchères achetées (à partir de 0,50€). Le prix de la vente augmente de 0,01€ et le minuteur s'allonge de 10-15 secondes. Le dernier enchérisseur gagne!" },
          { question: "Qu'est-ce que l'Auto-Bidder?", answer: "L'Auto-Bidder enchérit automatiquement pour vous dans les dernières secondes d'une vente. Vous définissez le nombre maximum d'enchères à utiliser." },
          { question: "Combien de temps dure une vente aux enchères?", answer: "La durée varie. Le minuteur s'allonge à chaque enchère. Les ventes peuvent durer de quelques minutes à plusieurs heures." }
        ]
      },
      {
        title: "Enchères & Tarifs",
        faqs: [
          { question: "Combien coûtent les enchères?", answer: "Les enchères commencent à 0,50€ chacune. Plus vous achetez d'enchères, moins le prix unitaire est cher. De plus, vous obtenez des enchères bonus gratuites avec les plus grands forfaits!" },
          { question: "Mes enchères expirent-elles?", answer: "Non! Vos enchères n'expirent jamais et peuvent être utilisées à tout moment." },
          { question: "Quels modes de paiement sont acceptés?", answer: "Nous acceptons les cartes de crédit, Klarna, le prélèvement SEPA et les cryptomonnaies via Coinbase Commerce." }
        ]
      }
    ]
  }
};

export default function FAQ() {
  const { language , mappedLanguage } = useLanguage();
  // Use mappedLanguage for regional variants (e.g., xk -> sq)
  const langKey = mappedLanguage || language;
  const { isDarkMode } = useTheme();
  const [openIndex, setOpenIndex] = useState('0-0');
  const [searchQuery, setSearchQuery] = useState('');

  // Get FAQ content for current language
  const content = faqContent[langKey] || faqContent.de;
  const faqCategories = content.categories;

  // Flatten FAQs for search
  const allFaqs = faqCategories.flatMap((cat, catIndex) => 
    cat.faqs.map((faq, faqIndex) => ({
      ...faq,
      category: cat.title,
      globalIndex: `${catIndex}-${faqIndex}`
    }))
  );

  // Filter by search
  const filteredFaqs = searchQuery
    ? allFaqs.filter(faq => 
        faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : null;

  return (
    <div className={`min-h-screen pt-20 pb-16 ${isDarkMode ? 'bg-[#050509]' : 'bg-gradient-to-b from-cyan-50 to-cyan-100'}`}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
            <HelpCircle className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className={`text-3xl sm:text-4xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
            {content.title}
          </h1>
          <p className={`max-w-lg mx-auto ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {content.subtitle}
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-10">
          <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
          <input
            type="text"
            placeholder={content.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-12 pr-4 py-4 rounded-xl border focus:outline-none focus:border-amber-500 ${
              isDarkMode 
                ? 'bg-[#181824] border-white/10 text-white placeholder-gray-500' 
                : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400 shadow-sm'
            }`}
          />
        </div>

        {/* Search Results */}
        {filteredFaqs && (
          <div className="mb-10">
            <p className={`mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {filteredFaqs.length} {content.resultsFor} "{searchQuery}"
            </p>
            <div className={`rounded-2xl p-6 border ${isDarkMode ? 'bg-[#181824]/50 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
              {filteredFaqs.length > 0 ? (
                filteredFaqs.map((faq, index) => (
                  <FAQItem
                    key={faq.globalIndex}
                    question={faq.question}
                    answer={faq.answer}
                    isOpen={index === 0}
                    onClick={() => {}}
                    isDarkMode={isDarkMode}
                  />
                ))
              ) : (
                <p className={`text-center py-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {content.noResults}
                </p>
              )}
            </div>
          </div>
        )}

        {/* FAQ Categories */}
        {!filteredFaqs && faqCategories.map((category, catIndex) => (
          <div key={catIndex} className="mb-8">
            <h2 className={`text-xl font-bold mb-4 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              {category.title}
            </h2>
            <div className={`rounded-2xl p-6 border ${isDarkMode ? 'bg-[#181824]/50 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
              {category.faqs.map((faq, faqIndex) => {
                const globalIndex = `${catIndex}-${faqIndex}`;
                return (
                  <FAQItem
                    key={globalIndex}
                    question={faq.question}
                    answer={faq.answer}
                    isOpen={openIndex === globalIndex}
                    onClick={() => setOpenIndex(openIndex === globalIndex ? null : globalIndex)}
                    isDarkMode={isDarkMode}
                  />
                );
              })}
            </div>
          </div>
        ))}

        {/* Contact CTA */}
        <div className={`rounded-2xl p-8 text-center border ${
          isDarkMode 
            ? 'bg-gradient-to-r from-amber-500/10 to-red-500/10 border-amber-500/30' 
            : 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200'
        }`}>
          <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
            {content.stillQuestions}
          </h3>
          <p className={`mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {content.contactText}
          </p>
          <Link 
            to="/contact" 
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold px-6 py-3 rounded-lg transition-colors"
          >
            {content.contactButton}
          </Link>
        </div>
      </div>
    </div>
  );
}
