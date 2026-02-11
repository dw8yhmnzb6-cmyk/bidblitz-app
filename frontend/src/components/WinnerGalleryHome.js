import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const galleryTexts = {
  de: {
    title: 'Echte Gewinner',
    subtitle: 'Schau dir an, was andere gewonnen haben',
    wonFor: 'gewonnen für nur',
    saved: 'gespart',
    viewAll: 'Alle Gewinner ansehen',
    testimonialTitle: 'Was unsere Gewinner sagen'
  },
  en: {
    title: 'Real Winners',
    subtitle: 'See what others have won',
    wonFor: 'won for only',
    saved: 'saved',
    viewAll: 'View all winners',
    testimonialTitle: 'What our winners say'
  },
  sq: {
    title: 'Fituesit e Vërtetë',
    subtitle: 'Shiko çfarë kanë fituar të tjerët',
    wonFor: 'fituar për vetëm',
    saved: 'kursyer',
    viewAll: 'Shiko të gjithë fituesit',
    testimonialTitle: 'Çfarë thonë fituesit tanë'
  },
  xk: {
    title: 'Fituesit e Vërtetë',
    subtitle: 'Shiko çfarë kanë fituar të tjerët',
    wonFor: 'fituar për vetëm',
    saved: 'kursyer',
    viewAll: 'Shiko të gjithë fituesit',
    testimonialTitle: 'Çfarë thonë fituesit tanë'
  },
  tr: {
    title: 'Gerçek Kazananlar',
    subtitle: 'Diğerlerinin ne kazandığını gör',
    wonFor: 'sadece',
    saved: 'tasarruf',
    viewAll: 'Tüm kazananları gör',
    testimonialTitle: 'Kazananlarımız ne diyor'
  },
  fr: {
    title: 'Vrais Gagnants',
    subtitle: 'Voyez ce que les autres ont gagné',
    wonFor: 'gagné pour seulement',
    saved: 'économisé',
    viewAll: 'Voir tous les gagnants',
    testimonialTitle: 'Ce que disent nos gagnants'
  }
};

// Demo winners data
const demoWinners = [
  {
    id: '1',
    username: 'MaxM.',
    city: 'Berlin',
    product_name: 'iPhone 15 Pro Max',
    product_image: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=400',
    retail_price: 1449,
    final_price: 18.45,
    won_at: '2026-02-09'
  },
  {
    id: '2',
    username: 'SophieK.',
    city: 'München',
    product_name: 'MacBook Air M3',
    product_image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400',
    retail_price: 1299,
    final_price: 24.67,
    won_at: '2026-02-08'
  },
  {
    id: '3',
    username: 'ArbenK.',
    city: 'Prishtina',
    product_name: 'PlayStation 5',
    product_image: 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=400',
    retail_price: 549,
    final_price: 12.34,
    won_at: '2026-02-08'
  },
  {
    id: '4',
    username: 'LenaH.',
    city: 'Hamburg',
    product_name: 'Dyson V15 Detect',
    product_image: 'https://images.unsplash.com/photo-1558317374-067fb5f30001?w=400',
    retail_price: 699,
    final_price: 8.89,
    won_at: '2026-02-07'
  },
  {
    id: '5',
    username: 'FjollaM.',
    city: 'Tirana',
    product_name: 'Apple Watch Ultra 2',
    product_image: 'https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?w=400',
    retail_price: 899,
    final_price: 15.23,
    won_at: '2026-02-07'
  }
];

// Demo testimonials
const testimonials = [
  {
    id: '1',
    name: 'Thomas R.',
    city: 'Frankfurt',
    avatar: '👨‍💼',
    rating: 5,
    text: {
      de: 'Unglaublich! Ich habe ein MacBook für nur 24€ gewonnen. Am Anfang war ich skeptisch, aber jetzt bin ich süchtig!',
      en: 'Incredible! I won a MacBook for only €24. I was skeptical at first, but now I\'m hooked!',
      sq: 'E pabesueshme! Fitova një MacBook për vetëm 24€. Në fillim isha skeptik, por tani jam i varur!',
      xk: 'E pabesueshme! Fitova një MacBook për vetëm 24€. Në fillim isha skeptik, por tani jam i varur!',
      tr: 'İnanılmaz! Sadece 24€\'ya bir MacBook kazandım. Başta şüpheciydim ama şimdi bağımlıyım!',
      fr: 'Incroyable! J\'ai gagné un MacBook pour seulement 24€. J\'étais sceptique au début, mais maintenant je suis accro!'
    }
  },
  {
    id: '2',
    name: 'Elena S.',
    city: 'Wien',
    avatar: '👩‍🦰',
    rating: 5,
    text: {
      de: 'Die Bid Buddy Funktion ist genial. Ich habe im Schlaf einen TV gewonnen!',
      en: 'The Bid Buddy feature is genius. I won a TV while sleeping!',
      sq: 'Funksioni Bid Buddy është genial. Fitova një TV ndërsa flija!',
      xk: 'Funksioni Bid Buddy është genial. Fitova një TV ndërsa flija!',
      tr: 'Bid Buddy özelliği harika. Uyurken bir TV kazandım!',
      fr: 'La fonction Bid Buddy est géniale. J\'ai gagné une TV en dormant!'
    }
  },
  {
    id: '3',
    name: 'Burim M.',
    city: 'Prishtina',
    avatar: '👨‍🎓',
    rating: 5,
    text: {
      de: 'Beste Penny Auction Seite! Der Support ist super und die Lieferung war schnell.',
      en: 'Best penny auction site! Support is great and delivery was fast.',
      sq: 'Faqja më e mirë e ankandeve! Mbështetja është super dhe dërgesa ishte e shpejtë.',
      xk: 'Faqja më e mirë e ankandeve! Mbështetja është super dhe dërgesa ishte e shpejtë.',
      tr: 'En iyi açık artırma sitesi! Destek harika ve teslimat hızlıydı.',
      fr: 'Meilleur site d\'enchères! Le support est super et la livraison était rapide.'
    }
  }
];

export default function WinnerGalleryHome() {
  const { language } = useLanguage();
  const t = galleryTexts[language] || galleryTexts.de;
  const [winners, setWinners] = useState(demoWinners);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const scrollRef = useRef(null);

  useEffect(() => {
    // Fetch real winners
    const fetchWinners = async () => {
      try {
        const response = await axios.get(`${API}/auctions/recent-winners?limit=10`);
        if (response.data?.winners?.length > 0) {
          setWinners(response.data.winners);
        }
      } catch (error) {
        // Use demo data
      }
    };
    fetchWinners();
  }, []);

  // Auto-rotate testimonials
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = 280;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="mb-8">
      {/* Winner Gallery */}
      <div className="bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-amber-500" />
              {t.title}
            </h2>
            <p className="text-gray-500 text-sm">{t.subtitle}</p>
          </div>
          <Link 
            to="/winner-gallery" 
            className="text-amber-500 hover:text-amber-600 text-sm font-medium"
          >
            {t.viewAll} →
          </Link>
        </div>

        {/* Scrollable gallery */}
        <div className="relative">
          <button 
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white shadow-lg rounded-full flex items-center justify-center text-gray-600 hover:text-amber-500 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div 
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto scrollbar-hide px-8 pb-2"
            style={{ scrollSnapType: 'x mandatory' }}
          >
            {winners.map((winner) => {
              const savings = winner.retail_price - winner.final_price;
              const savingsPercent = Math.round((savings / winner.retail_price) * 100);
              
              return (
                <div 
                  key={winner.id}
                  className="flex-shrink-0 w-64 bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 hover:shadow-lg transition-shadow"
                  style={{ scrollSnapAlign: 'start' }}
                >
                  <div className="relative h-36 bg-gray-100">
                    <img 
                      src={winner.product_image || 'https://via.placeholder.com/256x144'} 
                      alt={winner.product_name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                      -{savingsPercent}%
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="font-bold text-gray-800 text-sm truncate">{winner.product_name}</h3>
                    <p className="text-gray-500 text-xs mb-2">
                      {winner.username} aus {winner.city}
                    </p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-gray-400 text-xs line-through">€{winner.retail_price}</span>
                      <span className="text-green-500 font-bold">€{winner.final_price?.toFixed(2)}</span>
                    </div>
                    <p className="text-amber-500 text-xs mt-1">
                      €{savings.toFixed(0)} {t.saved}!
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          
          <button 
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white shadow-lg rounded-full flex items-center justify-center text-gray-600 hover:text-amber-500 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Testimonials */}
      <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl p-4">
        <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
          <Quote className="w-5 h-5 text-cyan-500" />
          {t.testimonialTitle}
        </h3>
        
        <div className="relative overflow-hidden">
          <div 
            className="flex transition-transform duration-500"
            style={{ transform: `translateX(-${currentTestimonial * 100}%)` }}
          >
            {testimonials.map((testimonial) => (
              <div key={testimonial.id} className="w-full flex-shrink-0 px-2">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-100 to-blue-100 flex items-center justify-center text-2xl flex-shrink-0">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-800">{testimonial.name}</span>
                      <span className="text-gray-400 text-sm">• {testimonial.city}</span>
                    </div>
                    <div className="flex gap-0.5 mb-2">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <p className="text-gray-600 text-sm italic">
                      "{testimonial.text[language] || testimonial.text.de}"
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Dots indicator */}
        <div className="flex justify-center gap-2 mt-3">
          {testimonials.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentTestimonial(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentTestimonial ? 'bg-cyan-500' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
