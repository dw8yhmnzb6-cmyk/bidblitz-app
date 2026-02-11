import { useState, useEffect } from 'react';
import { Trophy, Sparkles } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const tickerTexts = {
  de: {
    justWon: 'hat gerade gewonnen!',
    savings: 'gespart',
    congrats: 'Herzlichen Glückwunsch!',
    from: 'aus',
    forOnly: 'für nur'
  },
  en: {
    justWon: 'just won!',
    savings: 'saved',
    congrats: 'Congratulations!',
    from: 'from',
    forOnly: 'for only'
  },
  sq: {
    justWon: 'sapo fitoi!',
    savings: 'kursyer',
    congrats: 'Urime!',
    from: 'nga',
    forOnly: 'për vetëm'
  },
  xk: {
    justWon: 'sapo fitoi!',
    savings: 'kursyer',
    congrats: 'Urime!',
    from: 'nga',
    forOnly: 'për vetëm'
  },
  tr: {
    justWon: 'az önce kazandı!',
    savings: 'tasarruf',
    congrats: 'Tebrikler!',
    from: 'şehrinden',
    forOnly: 'sadece'
  },
  fr: {
    justWon: 'vient de gagner!',
    savings: 'économisé',
    congrats: 'Félicitations!',
    from: 'de',
    forOnly: 'pour seulement'
  }
};

// Generate random German/Albanian names for demo
const demoNames = [
  'Max M.', 'Anna S.', 'Lukas B.', 'Sophie K.', 'Felix R.',
  'Lena H.', 'Tim W.', 'Marie F.', 'Jonas P.', 'Emma L.',
  'Arben K.', 'Fjolla M.', 'Driton S.', 'Vlora B.', 'Besnik H.'
];

const demoCities = [
  'Berlin', 'München', 'Hamburg', 'Köln', 'Frankfurt',
  'Prishtina', 'Tirana', 'Wien', 'Zürich', 'Stuttgart'
];

const demoProducts = [
  { name: 'iPhone 15 Pro', price: 1199, wonFor: 12.45 },
  { name: 'PlayStation 5', price: 549, wonFor: 8.32 },
  { name: 'MacBook Air', price: 1299, wonFor: 15.67 },
  { name: 'Samsung TV 55"', price: 799, wonFor: 6.89 },
  { name: 'AirPods Pro', price: 279, wonFor: 3.21 },
  { name: 'Nintendo Switch', price: 329, wonFor: 4.56 },
  { name: 'Dyson Staubsauger', price: 599, wonFor: 7.23 },
  { name: 'Apple Watch', price: 449, wonFor: 5.78 }
];

export default function LiveWinnerTicker() {
  const { language } = useLanguage();
  const t = tickerTexts[language] || tickerTexts.de;
  const [winners, setWinners] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // Generate demo winners immediately on mount
    const generateDemoWinners = () => {
      const demo = Array(8).fill(null).map(() => {
        const product = demoProducts[Math.floor(Math.random() * demoProducts.length)];
        return {
          username: demoNames[Math.floor(Math.random() * demoNames.length)],
          city: demoCities[Math.floor(Math.random() * demoCities.length)],
          product_name: product.name,
          retail_price: product.price,
          final_price: parseFloat((product.wonFor + Math.random() * 5).toFixed(2)),
          won_at: new Date().toISOString()
        };
      });
      setWinners(demo);
    };

    // Initialize with demo data
    generateDemoWinners();

    // Fetch real winners or use demo data
    const fetchWinners = async () => {
      try {
        const response = await axios.get(`${API}/auctions/recent-winners?limit=10`);
        if (response.data?.winners?.length > 0) {
          setWinners(response.data.winners);
        }
      } catch (error) {
        // Keep demo data
        console.log('Using demo winners');
      }
    };

    fetchWinners();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchWinners, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (winners.length === 0) return;

    const rotateInterval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % winners.length);
        setIsAnimating(false);
      }, 500);
    }, 4000);

    return () => clearInterval(rotateInterval);
  }, [winners.length]);

  if (winners.length === 0) return null;

  const winner = winners[currentIndex];
  const savings = winner.retail_price - winner.final_price;
  const savingsPercent = Math.round((savings / winner.retail_price) * 100);

  return (
    <div className="bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-6 overflow-hidden">
      <div className={`flex items-center gap-3 transition-all duration-500 ${isAnimating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
        {/* Trophy Icon */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center flex-shrink-0 animate-pulse">
          <Trophy className="w-5 h-5 text-white" />
        </div>

        {/* Winner Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-amber-500">{winner.username}</span>
            <span className="text-gray-500 text-sm">{t.from} {winner.city}</span>
            <span className="text-gray-400 text-sm">{t.justWon}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-gray-800 font-medium truncate">{winner.product_name}</span>
            <span className="text-xs text-gray-500">{t.forOnly}</span>
            <span className="text-green-500 font-bold">€{winner.final_price?.toFixed(2)}</span>
          </div>
        </div>

        {/* Savings Badge */}
        <div className="hidden sm:flex flex-col items-end flex-shrink-0">
          <div className="flex items-center gap-1 text-green-500">
            <Sparkles className="w-4 h-4" />
            <span className="font-bold">{savingsPercent}%</span>
          </div>
          <span className="text-xs text-gray-500">{t.savings}</span>
        </div>
      </div>
    </div>
  );
}
