import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { usePageTranslations } from '../i18n/pageTranslations';
import { ChevronDown, ChevronUp, HelpCircle, Search } from 'lucide-react';

const FAQItem = ({ question, answer, isOpen, onClick }) => {
  return (
    <div className="border-b border-gray-700/50 last:border-b-0">
      <button
        onClick={onClick}
        className="w-full py-5 flex items-center justify-between text-left hover:bg-white/5 transition-colors px-4 -mx-4 rounded-lg"
      >
        <span className="text-white font-medium pr-8">{question}</span>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-[#FFD700] flex-shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
        )}
      </button>
      {isOpen && (
        <div className="pb-5 text-gray-400 leading-relaxed pl-4">
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
    subtitle: "Antworten auf die häufigsten Fragen zu BidBlitz",
    searchPlaceholder: "Fragen durchsuchen...",
    stillQuestions: "Noch Fragen?",
    contactText: "Unser Support-Team hilft Ihnen gerne weiter.",
    contactButton: "Kontakt aufnehmen",
    categories: [
      {
        title: "Allgemein",
        faqs: [
          { question: "Was ist BidBlitz?", answer: "BidBlitz ist eine Penny-Auktions-Plattform, auf der Sie Top-Markenprodukte für einen Bruchteil des Preises ersteigern können. Jedes Gebot erhöht den Preis um nur 0,01€ und verlängert den Timer." },
          { question: "Ist BidBlitz seriös?", answer: "Ja! BidBlitz ist ein seriöses Unternehmen mit Sitz in Dubai, UAE. Alle Auktionen sind transparent und fair. Wir versenden echte Produkte an echte Gewinner." },
          { question: "Wie kann ich Geld sparen?", answer: "Bei BidBlitz können Sie Produkte für bis zu 99% unter dem Marktpreis ersteigern. Ein iPhone im Wert von 1.199€ kann z.B. für unter 50€ ersteigert werden." }
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
    subtitle: "Answers to the most common questions about BidBlitz",
    searchPlaceholder: "Search questions...",
    stillQuestions: "Still have questions?",
    contactText: "Our support team is happy to help you.",
    contactButton: "Contact Us",
    categories: [
      {
        title: "General",
        faqs: [
          { question: "What is BidBlitz?", answer: "BidBlitz is a penny auction platform where you can win top brand products for a fraction of the price. Each bid increases the price by only €0.01 and extends the timer." },
          { question: "Is BidBlitz legitimate?", answer: "Yes! BidBlitz is a legitimate company based in Dubai, UAE. All auctions are transparent and fair. We ship real products to real winners." },
          { question: "How can I save money?", answer: "At BidBlitz, you can win products for up to 99% below market price. An iPhone worth €1,199 can be won for under €50." }
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
    subtitle: "Përgjigje për pyetjet më të zakonshme rreth BidBlitz",
    searchPlaceholder: "Kërko pyetje...",
    stillQuestions: "Ende keni pyetje?",
    contactText: "Ekipi ynë i mbështetjes është i gatshëm t'ju ndihmojë.",
    contactButton: "Na Kontaktoni",
    categories: [
      {
        title: "Të Përgjithshme",
        faqs: [
          { question: "Çfarë është BidBlitz?", answer: "BidBlitz është një platformë ankandesh penny ku mund të fitoni produkte të markave të njohura me një pjesë të çmimit. Çdo ofertë rrit çmimin me vetëm 0.01€ dhe zgjat kohëmatësin." },
          { question: "A është BidBlitz i besueshëm?", answer: "Po! BidBlitz është një kompani legjitime me bazë në Dubai, UAE. Të gjitha ankandet janë transparente dhe të drejta. Ne dërgojmë produkte reale tek fituesit realë." },
          { question: "Si mund të kursej para?", answer: "Në BidBlitz, mund të fitoni produkte deri në 99% nën çmimin e tregut. Një iPhone me vlerë 1,199€ mund të fitohet për nën 50€." }
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
    subtitle: "BidBlitz hakkında en yaygın sorulara cevaplar",
    searchPlaceholder: "Soru ara...",
    stillQuestions: "Hala sorularınız mı var?",
    contactText: "Destek ekibimiz size yardımcı olmaktan mutluluk duyar.",
    contactButton: "Bize Ulaşın",
    categories: [
      {
        title: "Genel",
        faqs: [
          { question: "BidBlitz nedir?", answer: "BidBlitz, en iyi marka ürünlerini fiyatın küçük bir bölümüyle kazanabileceğiniz bir penny açık artırma platformudur. Her teklif fiyatı sadece 0,01€ artırır ve zamanlayıcıyı uzatır." },
          { question: "BidBlitz güvenilir mi?", answer: "Evet! BidBlitz, Dubai, BAE merkezli meşru bir şirkettir. Tüm açık artırmalar şeffaf ve adildir. Gerçek kazananlara gerçek ürünler gönderiyoruz." },
          { question: "Nasıl para tasarruf edebilirim?", answer: "BidBlitz'de ürünleri piyasa fiyatının %99'a kadar altında kazanabilirsiniz. 1.199€ değerinde bir iPhone 50€'nun altında kazanılabilir." }
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
    subtitle: "Réponses aux questions les plus courantes sur BidBlitz",
    searchPlaceholder: "Rechercher des questions...",
    stillQuestions: "Encore des questions?",
    contactText: "Notre équipe de support est là pour vous aider.",
    contactButton: "Contactez-nous",
    categories: [
      {
        title: "Général",
        faqs: [
          { question: "Qu'est-ce que BidBlitz?", answer: "BidBlitz est une plateforme d'enchères au centime où vous pouvez gagner des produits de grandes marques pour une fraction du prix. Chaque enchère augmente le prix de seulement 0,01€ et prolonge le minuteur." },
          { question: "BidBlitz est-il fiable?", answer: "Oui! BidBlitz est une entreprise légitime basée à Dubaï, EAU. Toutes les enchères sont transparentes et équitables. Nous expédions de vrais produits aux vrais gagnants." },
          { question: "Comment puis-je économiser de l'argent?", answer: "Chez BidBlitz, vous pouvez gagner des produits jusqu'à 99% en dessous du prix du marché. Un iPhone d'une valeur de 1 199€ peut être gagné pour moins de 50€." }
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
  const { t, language } = useLanguage();
  const texts = usePageTranslations(language);
  const [openIndex, setOpenIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  // Get FAQ content for current language
  const content = faqContent[language] || faqContent.de;
  const faqCategories = content.categories;
          question: "Wie erfahre ich, dass ich gewonnen habe?",
          answer: "Sie erhalten sofort eine E-Mail-Benachrichtigung und eine Nachricht in Ihrem Dashboard. Außerdem können Sie Push-Benachrichtigungen aktivieren."
        },
        {
          question: "Wie lange dauert der Versand?",
          answer: "Nach Zahlungseingang versenden wir innerhalb von 1-3 Werktagen. Die Lieferzeit beträgt in der Regel 3-5 Werktage in Deutschland."
        },
        {
          question: "Muss ich den Auktionspreis noch bezahlen?",
          answer: "Ja, der Gewinner zahlt den Auktions-Endpreis plus Versandkosten. Bei unserem Beispiel: Ein iPhone für 12,47€ + 4,99€ Versand = 17,46€ total!"
        },
        {
          question: "Was ist 'Sofortkauf'?",
          answer: "Mit Sofortkauf können Sie ein Produkt direkt zum ermäßigten Preis kaufen, ohne zu bieten. Der Preis liegt zwischen 70-90% des Originalpreises."
        }
      ]
    },
    {
      title: "Konto & Sicherheit",
      faqs: [
        {
          question: "Wie registriere ich mich?",
          answer: "Klicken Sie auf 'Registrieren', geben Sie Ihre E-Mail und ein sicheres Passwort ein. Die Registrierung ist kostenlos!"
        },
        {
          question: "Was ist 2FA?",
          answer: "Zwei-Faktor-Authentifizierung ist eine zusätzliche Sicherheitsebene. Nach dem Login müssen Sie einen Code aus einer Authenticator-App eingeben."
        },
        {
          question: "Kann ich mein Konto löschen?",
          answer: "Ja, kontaktieren Sie unseren Support und wir löschen Ihr Konto. Beachten Sie, dass ungenutzte Gebote nicht erstattet werden."
        }
      ]
    }
  ];

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
    <div className="min-h-screen bg-gradient-to-b from-[#0a1929] to-[#0d2538] pt-20 pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-16 h-16 rounded-full bg-[#FFD700]/20 flex items-center justify-center mx-auto mb-4">
            <HelpCircle className="w-8 h-8 text-[#FFD700]" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Häufige Fragen
          </h1>
          <p className="text-gray-400 max-w-lg mx-auto">
            Finden Sie Antworten auf die häufigsten Fragen zu BidBlitz
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-10">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Frage suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 rounded-xl bg-[#1a3a52] border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-[#FFD700]"
          />
        </div>

        {/* Search Results */}
        {filteredFaqs && (
          <div className="mb-10">
            <p className="text-gray-400 mb-4">
              {filteredFaqs.length} Ergebnis(se) für "{searchQuery}"
            </p>
            <div className="bg-[#1a3a52]/50 rounded-2xl p-6 border border-gray-700/50">
              {filteredFaqs.length > 0 ? (
                filteredFaqs.map((faq, index) => (
                  <FAQItem
                    key={faq.globalIndex}
                    question={faq.question}
                    answer={faq.answer}
                    isOpen={index === 0}
                    onClick={() => {}}
                  />
                ))
              ) : (
                <p className="text-gray-400 text-center py-4">
                  Keine Ergebnisse gefunden. Kontaktieren Sie uns für weitere Hilfe.
                </p>
              )}
            </div>
          </div>
        )}

        {/* FAQ Categories */}
        {!filteredFaqs && faqCategories.map((category, catIndex) => (
          <div key={catIndex} className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#FFD700]"></span>
              {category.title}
            </h2>
            <div className="bg-[#1a3a52]/50 rounded-2xl p-6 border border-gray-700/50">
              {category.faqs.map((faq, faqIndex) => {
                const globalIndex = `${catIndex}-${faqIndex}`;
                return (
                  <FAQItem
                    key={globalIndex}
                    question={faq.question}
                    answer={faq.answer}
                    isOpen={openIndex === globalIndex}
                    onClick={() => setOpenIndex(openIndex === globalIndex ? null : globalIndex)}
                  />
                );
              })}
            </div>
          </div>
        ))}

        {/* Contact CTA */}
        <div className="bg-gradient-to-r from-[#FFD700]/10 to-[#FF4D4D]/10 rounded-2xl p-8 text-center border border-[#FFD700]/30">
          <h3 className="text-xl font-bold text-white mb-2">
            Ihre Frage nicht gefunden?
          </h3>
          <p className="text-gray-400 mb-4">
            Unser Support-Team hilft Ihnen gerne weiter!
          </p>
          <a 
            href="/contact" 
            className="inline-flex items-center gap-2 bg-[#FFD700] hover:bg-[#FCD34D] text-black font-bold px-6 py-3 rounded-lg transition-colors"
          >
            Kontakt aufnehmen
          </a>
        </div>
      </div>
    </div>
  );
}
