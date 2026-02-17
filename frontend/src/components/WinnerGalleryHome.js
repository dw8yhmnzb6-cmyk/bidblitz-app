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
  },
  ar: {
    title: 'الفائزون الحقيقيون',
    subtitle: 'شاهد ماذا فاز الآخرون',
    wonFor: 'فاز بـ',
    saved: 'وُفِّر',
    viewAll: 'عرض كل الفائزين',
    testimonialTitle: 'ماذا يقول فائزونا'
  },
  ae: {
    title: 'الفائزون الحقيقيون',
    subtitle: 'شاهد ماذا فاز الآخرون',
    wonFor: 'فاز بـ',
    saved: 'وُفِّر',
    viewAll: 'عرض كل الفائزين',
    testimonialTitle: 'ماذا يقول فائزونا'
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

// Demo testimonials with more variety and better Albanian translations
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
      fr: 'Incroyable! J\'ai gagné un MacBook pour seulement 24€. J\'étais sceptique au début, mais maintenant je suis accro!',
      ar: 'لا يصدق! فزت بجهاز MacBook بـ 24€ فقط. كنت متشككاً في البداية، لكن الآن أنا مدمن!',
      ae: 'لا يصدق! فزت بجهاز MacBook بـ 24€ فقط. كنت متشككاً في البداية، لكن الآن أنا مدمن!'
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
      fr: 'La fonction Bid Buddy est géniale. J\'ai gagné une TV en dormant!',
      ar: 'ميزة Bid Buddy عبقرية. فزت بتلفزيون وأنا نائم!',
      ae: 'ميزة Bid Buddy عبقرية. فزت بتلفزيون وأنا نائم!'
    }
  },
  {
    id: '3',
    name: 'Burim M.',
    city: 'Prishtinë',
    avatar: '👨‍🎓',
    rating: 5,
    text: {
      de: 'Beste Penny Auction Seite! Der Support ist super und die Lieferung war schnell.',
      en: 'Best penny auction site! Support is great and delivery was fast.',
      sq: 'Faqja më e mirë e ankandeve! Mbështetja është e shkëlqyer dhe dërgesa ishte shumë e shpejtë.',
      xk: 'Faqja më e mirë e ankandeve! Mbështetja është e shkëlqyer dhe dërgesa ishte shumë e shpejtë.',
      tr: 'En iyi açık artırma sitesi! Destek harika ve teslimat hızlıydı.',
      fr: 'Meilleur site d\'enchères! Le support est super et la livraison était rapide.',
      ar: 'أفضل موقع مزادات! الدعم رائع والتوصيل كان سريعاً.',
      ae: 'أفضل موقع مزادات! الدعم رائع والتوصيل كان سريعاً.'
    }
  },
  {
    id: '4',
    name: 'Drita K.',
    city: 'Tiranë',
    avatar: '👩‍💻',
    rating: 5,
    text: {
      de: 'Ich habe einen PlayStation 5 für 12€ gewonnen! Meine Freunde glauben mir immer noch nicht.',
      en: 'I won a PlayStation 5 for €12! My friends still don\'t believe me.',
      sq: 'Fitova një PlayStation 5 për 12€! Miqtë e mi ende nuk më besojnë.',
      xk: 'Fitova një PlayStation 5 për 12€! Miqtë e mi ende nuk më besojnë.',
      tr: 'PlayStation 5\'i 12€\'ya kazandım! Arkadaşlarım hala inanmıyor.',
      fr: 'J\'ai gagné une PlayStation 5 pour 12€! Mes amis ne me croient toujours pas.',
      ar: 'فزت بـ PlayStation 5 بـ 12€! أصدقائي لا يصدقونني حتى الآن.',
      ae: 'فزت بـ PlayStation 5 بـ 12€! أصدقائي لا يصدقونني حتى الآن.'
    }
  },
  {
    id: '5',
    name: 'Fatmir H.',
    city: 'Prizren',
    avatar: '👨‍🔧',
    rating: 5,
    text: {
      de: 'Die App ist einfach zu benutzen und die Auktionen sind fair. Empfehle es jedem!',
      en: 'The app is easy to use and the auctions are fair. Recommend it to everyone!',
      sq: 'Aplikacioni është i lehtë për t\'u përdorur dhe ankandat janë të drejta. Ua rekomandoj të gjithëve!',
      xk: 'Aplikacioni është i lehtë për t\'u përdorur dhe ankandat janë të drejta. Ua rekomandoj të gjithëve!',
      tr: 'Uygulama kullanımı kolay ve açık artırmalar adil. Herkese tavsiye ederim!',
      fr: 'L\'application est facile à utiliser et les enchères sont équitables. Je le recommande à tout le monde!',
      ar: 'التطبيق سهل الاستخدام والمزادات عادلة. أنصح به للجميع!',
      ae: 'التطبيق سهل الاستخدام والمزادات عادلة. أنصح به للجميع!'
    }
  },
  {
    id: '6',
    name: 'Lisa M.',
    city: 'Hamburg',
    avatar: '👩‍🎨',
    rating: 5,
    text: {
      de: 'Schon 3 Gewinne in einem Monat! Die Strategie-Tipps haben mir sehr geholfen.',
      en: 'Already 3 wins in one month! The strategy tips helped me a lot.',
      sq: 'Tashmë 3 fitore në një muaj! Këshillat e strategjisë më ndihmuan shumë.',
      xk: 'Tashmë 3 fitore në një muaj! Këshillat e strategjisë më ndihmuan shumë.',
      tr: 'Bir ayda zaten 3 kazanç! Strateji ipuçları çok yardımcı oldu.',
      fr: 'Déjà 3 victoires en un mois! Les conseils de stratégie m\'ont beaucoup aidé.',
      ar: 'بالفعل 3 فوزات في شهر واحد! نصائح الاستراتيجية ساعدتني كثيراً.',
      ae: 'بالفعل 3 فوزات في شهر واحد! نصائح الاستراتيجية ساعدتني كثيراً.'
    }
  },
  {
    id: '7',
    name: 'Arben S.',
    city: 'Gjakovë',
    avatar: '👨‍🏫',
    rating: 5,
    text: {
      de: 'Die Restaurant-Gutscheine sind großartig! Spare jetzt regelmäßig beim Essen gehen.',
      en: 'The restaurant vouchers are great! Now I regularly save money eating out.',
      sq: 'Kuponat e restoranteve janë fantastike! Tani kursej rregullisht kur dal për të ngrënë.',
      xk: 'Kuponat e restoranteve janë fantastike! Tani kursej rregullisht kur dal për të ngrënë.',
      tr: 'Restoran kuponları harika! Artık dışarıda yemek yerken düzenli tasarruf ediyorum.',
      fr: 'Les coupons de restaurant sont géniaux! J\'économise régulièrement maintenant quand je mange dehors.',
      ar: 'قسائم المطاعم رائعة! الآن أوفر بانتظام عند تناول الطعام بالخارج.',
      ae: 'قسائم المطاعم رائعة! الآن أوفر بانتظام عند تناول الطعام بالخارج.'
    }
  },
  {
    id: '8',
    name: 'Vlora B.',
    city: 'Ferizaj',
    avatar: '👩‍⚕️',
    rating: 5,
    text: {
      de: 'Mein iPhone kam schneller als erwartet und war originalverpackt. Top Service!',
      en: 'My iPhone arrived faster than expected and was factory sealed. Top service!',
      sq: 'iPhone im arriti më shpejt se sa prisja dhe ishte i paketuar në fabrikë. Shërbim i shkëlqyer!',
      xk: 'iPhone im arriti më shpejt se sa prisja dhe ishte i paketuar në fabrikë. Shërbim i shkëlqyer!',
      tr: 'iPhone\'um beklenenden hızlı geldi ve fabrika mühürlüydü. Harika servis!',
      fr: 'Mon iPhone est arrivé plus vite que prévu et était scellé d\'usine. Service top!',
      ar: 'وصل الآيفون الخاص بي أسرع من المتوقع وكان مغلفاً من المصنع. خدمة ممتازة!',
      ae: 'وصل الآيفون الخاص بي أسرع من المتوقع وكان مغلفاً من المصنع. خدمة ممتازة!'
    }
  }
];

export default function WinnerGalleryHome() {
  const { language } = useLanguage();
  const t = galleryTexts[language] || galleryTexts.de;
  const [winners, setWinners] = useState(demoWinners);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [liveStats, setLiveStats] = useState({ totalWinners: 2847, totalSavings: 458920 });
  const scrollRef = useRef(null);

  useEffect(() => {
    // Fetch real winners
    const fetchWinners = async () => {
      try {
        const response = await axios.get(`${API}/auctions/recent-winners?limit=10`);
        if (response.data?.winners?.length > 0) {
          setWinners(response.data.winners);
        }
        // Update stats if available
        if (response.data?.stats) {
          setLiveStats(response.data.stats);
        }
      } catch (error) {
        // Use demo data
      }
    };
    fetchWinners();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchWinners, 30000);
    return () => clearInterval(interval);
  }, []);

  // Animate stats counter
  useEffect(() => {
    const animateCounter = setInterval(() => {
      setLiveStats(prev => ({
        totalWinners: prev.totalWinners + Math.floor(Math.random() * 2),
        totalSavings: prev.totalSavings + Math.floor(Math.random() * 150)
      }));
    }, 8000);
    return () => clearInterval(animateCounter);
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

  // Stats translations
  const statsTexts = {
    de: { winners: 'Glückliche Gewinner', savings: 'Gesamtersparnis', avg: 'Durchschn. Ersparnis' },
    en: { winners: 'Happy Winners', savings: 'Total Savings', avg: 'Avg. Savings' },
    tr: { winners: 'Mutlu Kazananlar', savings: 'Toplam Tasarruf', avg: 'Ort. Tasarruf' },
    sq: { winners: 'Fitues të Lumtur', savings: 'Kursime Totale', avg: 'Mesatare' },
    xk: { winners: 'Fitues të Lumtur', savings: 'Kursime Totale', avg: 'Mesatare' },
    fr: { winners: 'Gagnants Heureux', savings: 'Économies Totales', avg: 'Économies Moy.' },
    ar: { winners: 'فائزون سعداء', savings: 'إجمالي التوفير', avg: 'متوسط التوفير' },
    ae: { winners: 'فائزون سعداء', savings: 'إجمالي التوفير', avg: 'متوسط التوفير' }
  };
  const st = statsTexts[language] || statsTexts.de;

  return (
    <div className="mb-8">
      {/* Live Stats Banner */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-4 mb-4 text-white">
        <div className="flex items-center justify-around text-center">
          <div>
            <div className="text-2xl sm:text-3xl font-bold">{liveStats.totalWinners.toLocaleString('de-DE')}</div>
            <div className="text-xs sm:text-sm text-green-100">{st.winners}</div>
          </div>
          <div className="w-px h-12 bg-white/30" />
          <div>
            <div className="text-2xl sm:text-3xl font-bold">€{liveStats.totalSavings.toLocaleString('de-DE')}</div>
            <div className="text-xs sm:text-sm text-green-100">{st.savings}</div>
          </div>
          <div className="w-px h-12 bg-white/30 hidden sm:block" />
          <div className="hidden sm:block">
            <div className="text-2xl sm:text-3xl font-bold">98%</div>
            <div className="text-xs sm:text-sm text-green-100">{st.avg}</div>
          </div>
        </div>
      </div>

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
                      loading="lazy"
                      decoding="async"
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
