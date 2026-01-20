import { useLanguage } from '../context/LanguageContext';
import { Link } from 'react-router-dom';
import { 
  UserPlus, 
  CreditCard, 
  Gavel, 
  Trophy,
  Clock,
  ArrowRight,
  CheckCircle,
  Zap
} from 'lucide-react';
import { Button } from '../components/ui/button';

export default function HowItWorks() {
  const { t } = useLanguage();

  const steps = [
    {
      icon: UserPlus,
      title: "1. Registrieren",
      description: "Erstellen Sie kostenlos ein Konto in nur wenigen Sekunden. Keine versteckten Gebühren.",
      color: "from-blue-500 to-cyan-500"
    },
    {
      icon: CreditCard,
      title: "2. Gebote kaufen",
      description: "Wählen Sie ein Gebotspaket. Jedes Gebot kostet ab 0,50€. Mehr Gebote = mehr Bonus!",
      color: "from-green-500 to-emerald-500"
    },
    {
      icon: Gavel,
      title: "3. Bieten",
      description: "Klicken Sie auf 'Bieten' bei einer Auktion. Jedes Gebot erhöht den Preis um nur 0,01€ und verlängert die Zeit.",
      color: "from-yellow-500 to-orange-500"
    },
    {
      icon: Trophy,
      title: "4. Gewinnen!",
      description: "Der letzte Bieter gewinnt, wenn der Timer abläuft. Sparen Sie bis zu 99% auf Top-Produkte!",
      color: "from-purple-500 to-pink-500"
    }
  ];

  const features = [
    {
      title: "Faire Auktionen",
      description: "Jeder hat die gleiche Chance zu gewinnen. Kein Glücksspiel, nur Strategie.",
      icon: CheckCircle
    },
    {
      title: "Echtzeit-Updates",
      description: "Verfolgen Sie alle Gebote live. Keine Verzögerungen, keine Überraschungen.",
      icon: Zap
    },
    {
      title: "Timer-Verlängerung",
      description: "Bei jedem Gebot wird der Timer um 10-15 Sekunden verlängert.",
      icon: Clock
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a1929] to-[#0d2538] pt-20 pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            So funktioniert <span className="text-[#FFD700]">BidBlitz</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            In nur 4 einfachen Schritten zu Top-Produkten für einen Bruchteil des Preises
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {steps.map((step, index) => (
            <div 
              key={index}
              className="bg-[#1a3a52]/50 rounded-2xl p-6 border border-gray-700/50 hover:border-[#FFD700]/30 transition-all group"
            >
              <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <step.icon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>

        {/* How Bidding Works */}
        <div className="bg-[#1a3a52]/30 rounded-2xl p-8 mb-16 border border-gray-700/50">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            Wie funktioniert das Bieten?
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-[#FFD700]/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl font-bold text-[#FFD700]">0,01€</span>
              </div>
              <h4 className="text-white font-semibold mb-2">Preiserhöhung</h4>
              <p className="text-gray-400 text-sm">Jedes Gebot erhöht den Preis um nur 1 Cent</p>
            </div>
            
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-cyan-500/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl font-bold text-cyan-400">+10s</span>
              </div>
              <h4 className="text-white font-semibold mb-2">Zeit-Bonus</h4>
              <p className="text-gray-400 text-sm">Der Timer wird um 10-15 Sekunden verlängert</p>
            </div>
            
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl font-bold text-green-400">99%</span>
              </div>
              <h4 className="text-white font-semibold mb-2">Ersparnis</h4>
              <p className="text-gray-400 text-sm">Sparen Sie bis zu 99% auf Top-Marken</p>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-8 text-center">Warum BidBlitz?</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="flex items-start gap-4 p-4"
              >
                <div className="w-10 h-10 rounded-lg bg-[#FFD700]/20 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-5 h-5 text-[#FFD700]" />
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-1">{feature.title}</h4>
                  <p className="text-gray-400 text-sm">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Example Calculation */}
        <div className="bg-gradient-to-r from-[#FFD700]/10 to-[#FF4D4D]/10 rounded-2xl p-8 mb-16 border border-[#FFD700]/30">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            Beispiel-Rechnung
          </h2>
          
          <div className="max-w-lg mx-auto">
            <div className="flex justify-between items-center py-3 border-b border-gray-700/50">
              <span className="text-gray-400">iPhone 15 Pro (UVP)</span>
              <span className="text-white font-semibold">1.199,00 €</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-700/50">
              <span className="text-gray-400">Auktions-Endpreis</span>
              <span className="text-[#FFD700] font-semibold">12,47 €</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-700/50">
              <span className="text-gray-400">Ihre Gebote (25 Stück)</span>
              <span className="text-white font-semibold">12,50 €</span>
            </div>
            <div className="flex justify-between items-center py-3 text-lg">
              <span className="text-white font-bold">Ihr Gesamtpreis</span>
              <span className="text-green-400 font-bold">24,97 €</span>
            </div>
            <div className="text-center mt-4">
              <span className="inline-block bg-green-500/20 text-green-400 px-4 py-2 rounded-full text-sm font-semibold">
                Sie sparen: 1.174,03 € (98%)
              </span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">
            Bereit zum Sparen?
          </h2>
          <p className="text-gray-400 mb-6">
            Jetzt registrieren und sofort mit dem Bieten beginnen!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register">
              <Button className="bg-[#FFD700] hover:bg-[#FCD34D] text-black font-bold px-8 py-3 text-lg">
                Jetzt registrieren
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link to="/auctions">
              <Button variant="outline" className="border-gray-600 text-white hover:bg-white/10 px-8 py-3 text-lg">
                Auktionen ansehen
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
