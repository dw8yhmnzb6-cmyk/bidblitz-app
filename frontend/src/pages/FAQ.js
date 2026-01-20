import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
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

export default function FAQ() {
  const { t } = useLanguage();
  const [openIndex, setOpenIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const faqCategories = [
    {
      title: "Allgemein",
      faqs: [
        {
          question: "Was ist BidBlitz?",
          answer: "BidBlitz ist eine Penny-Auktions-Plattform, auf der Sie Top-Markenprodukte für einen Bruchteil des Preises ersteigern können. Jedes Gebot erhöht den Preis um nur 0,01€ und verlängert den Timer."
        },
        {
          question: "Ist BidBlitz seriös?",
          answer: "Ja! BidBlitz ist ein seriöses Unternehmen mit Sitz in Deutschland. Alle Auktionen sind transparent und fair. Wir versenden echte Produkte an echte Gewinner."
        },
        {
          question: "Wie kann ich Geld sparen?",
          answer: "Bei BidBlitz können Sie Produkte für bis zu 99% unter dem Marktpreis ersteigern. Ein iPhone im Wert von 1.199€ kann z.B. für unter 50€ ersteigert werden."
        }
      ]
    },
    {
      title: "Bieten & Auktionen",
      faqs: [
        {
          question: "Wie funktioniert das Bieten?",
          answer: "Jedes Gebot kostet Sie einen Ihrer gekauften Gebote (ab 0,50€). Der Auktionspreis steigt um 0,01€ und der Timer wird um 10-15 Sekunden verlängert. Der letzte Bieter gewinnt!"
        },
        {
          question: "Was passiert mit meinen Geboten, wenn ich nicht gewinne?",
          answer: "Verwendete Gebote werden nicht zurückerstattet. Sie können jedoch jederzeit neue Gebote kaufen und bei anderen Auktionen teilnehmen."
        },
        {
          question: "Kann ich mehrfach hintereinander bieten?",
          answer: "Ja, Sie können so oft bieten wie Sie möchten, solange Sie genügend Gebote haben. Beachten Sie aber, dass andere Nutzer auch bieten können."
        },
        {
          question: "Was ist der Auto-Bidder?",
          answer: "Der Auto-Bidder bietet automatisch für Sie in den letzten Sekunden einer Auktion. Sie legen fest, wie viele Gebote maximal verwendet werden sollen."
        },
        {
          question: "Wie lange dauert eine Auktion?",
          answer: "Die Dauer variiert. Bei jedem Gebot wird der Timer verlängert. Auktionen können von wenigen Minuten bis zu mehreren Stunden dauern."
        }
      ]
    },
    {
      title: "Gebote & Preise",
      faqs: [
        {
          question: "Was kosten Gebote?",
          answer: "Gebote kosten ab 0,50€ pro Stück. Je mehr Gebote Sie kaufen, desto günstiger wird der Einzelpreis. Außerdem erhalten Sie bei größeren Paketen Gratis-Gebote!"
        },
        {
          question: "Welche Gebotspakete gibt es?",
          answer: "Wir bieten verschiedene Pakete: 10 Gebote für 5€, 20+2 für 10€, 40+5 für 20€, 100+15 für 50€ und 200+30 für 100€."
        },
        {
          question: "Verfallen meine Gebote?",
          answer: "Nein! Ihre Gebote verfallen nicht und können jederzeit verwendet werden."
        },
        {
          question: "Welche Zahlungsmethoden werden akzeptiert?",
          answer: "Wir akzeptieren Kreditkarten, Klarna, SEPA-Lastschrift und Kryptowährungen über Coinbase Commerce."
        }
      ]
    },
    {
      title: "Gewinnen & Versand",
      faqs: [
        {
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
