import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import { Trophy, Star, TrendingDown, Clock, Users, ChevronRight, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/button';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Multilingual content
const winnersTexts = {
  de: {
    title: "Gewinner-Galerie",
    subtitle: "Sehen Sie, wer bei unseren Auktionen gewonnen hat",
    recentWinners: "Aktuelle Gewinner",
    topSavers: "Top-Sparer",
    viewAll: "Alle anzeigen",
    wonFor: "Gewonnen für",
    saved: "Gespart",
    retail: "UVP",
    bids: "Gebote",
    noWinners: "Noch keine Gewinner",
    firstWinner: "Seien Sie der erste Gewinner!",
    goToAuctions: "Zu den Auktionen"
  },
  en: {
    title: "Winners Gallery",
    subtitle: "See who won in our auctions",
    recentWinners: "Recent Winners",
    topSavers: "Top Savers",
    viewAll: "View all",
    wonFor: "Won for",
    saved: "Saved",
    retail: "RRP",
    bids: "Bids",
    noWinners: "No winners yet",
    firstWinner: "Be the first winner!",
    goToAuctions: "Go to Auctions"
  },
  sq: {
    title: "Galeria e Fituesve",
    subtitle: "Shikoni kush ka fituar në ankandet tona",
    recentWinners: "Fituesit e Fundit",
    topSavers: "Kursimtarët Kryesorë",
    viewAll: "Shiko të gjitha",
    wonFor: "Fituar për",
    saved: "Kursyer",
    retail: "Çmimi",
    bids: "Oferta",
    noWinners: "Ende pa fitues",
    firstWinner: "Bëhu fituesi i parë!",
    goToAuctions: "Shko te Ankandet"
  },
  tr: {
    title: "Kazananlar Galerisi",
    subtitle: "Açık artırmalarımızda kimin kazandığını görün",
    recentWinners: "Son Kazananlar",
    topSavers: "En Çok Tasarruf Edenler",
    viewAll: "Tümünü gör",
    wonFor: "Şu fiyata kazanıldı",
    saved: "Tasarruf",
    retail: "TSF",
    bids: "Teklif",
    noWinners: "Henüz kazanan yok",
    firstWinner: "İlk kazanan siz olun!",
    goToAuctions: "Açık Artırmalara Git"
  },
  fr: {
    title: "Galerie des Gagnants",
    subtitle: "Découvrez qui a gagné dans nos enchères",
    recentWinners: "Gagnants Récents",
    topSavers: "Top Économiseurs",
    viewAll: "Voir tout",
    wonFor: "Gagné pour",
    saved: "Économisé",
    retail: "Prix conseillé",
    bids: "Enchères",
    noWinners: "Pas encore de gagnants",
    firstWinner: "Soyez le premier gagnant!",
    goToAuctions: "Aller aux Enchères"
  }
};

const WinnerCard = ({ winner, texts, language }) => {
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString(language === 'de' ? 'de-DE' : language === 'fr' ? 'fr-FR' : language === 'tr' ? 'tr-TR' : 'en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div 
      className="bg-gradient-to-br from-[#181824] to-[#0F0F16] rounded-xl overflow-hidden border border-gray-200 hover:border-[#FFD700]/30 transition-all duration-300 hover:shadow-lg hover:shadow-[#FFD700]/5 group"
      data-testid={`winner-card-${winner.auction_id}`}
    >
      {/* Image Section */}
      <div className="relative aspect-square overflow-hidden bg-gradient-to-b from-cyan-50 to-cyan-100">
        <img
          src={winner.product_image || 'https://via.placeholder.com/300'}
          alt={winner.product_name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        
        {/* Savings Badge */}
        <div className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-[#10B981] text-gray-800 font-bold text-sm shadow-lg">
          -{winner.savings_percent}%
        </div>
        
        {/* Winner Badge */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#FFD700] flex items-center justify-center">
              <Trophy className="w-4 h-4 text-black" />
            </div>
            <span className="text-gray-800 font-bold truncate">{winner.winner_name}</span>
          </div>
        </div>
      </div>
      
      {/* Content Section */}
      <div className="p-4 space-y-3">
        <h3 className="text-gray-800 font-bold text-sm line-clamp-2 min-h-[40px]">
          {winner.product_name}
        </h3>
        
        {/* Price Comparison */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-gray-500 text-xs">{texts.wonFor}</p>
            <p className="text-2xl font-bold text-[#06B6D4]">
              €{winner.final_price?.toFixed(2)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-gray-500 text-xs">{texts.retail}</p>
            <p className="text-lg text-gray-500 line-through">
              €{winner.retail_price?.toFixed(2)}
            </p>
          </div>
        </div>
        
        {/* Stats */}
        <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-200">
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>{winner.total_bids} {texts.bids}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{formatDate(winner.ended_at)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function Winners() {
  const { language , mappedLanguage } = useLanguage();
  // Use mappedLanguage for regional variants (e.g., xk -> sq)
  const langKey = mappedLanguage || language;
  const texts = winnersTexts[langKey] || winnersTexts.de;
  const [winners, setWinners] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWinners();
  }, []);

  const fetchWinners = async () => {
    try {
      const response = await axios.get(`${API}/winners?limit=30`);
      // Transform data to include calculated fields
      const transformedWinners = response.data.map(auction => {
        const retailPrice = auction.product?.retail_price || 0;
        const finalPrice = auction.final_price || auction.current_price || 0;
        const savingsPercent = retailPrice > 0 
          ? Math.round((1 - finalPrice / retailPrice) * 100) 
          : 0;
        
        return {
          auction_id: auction.id,
          product_name: auction.product?.name || (language === 'en' ? 'Unknown Product' : 'Unbekanntes Produkt'),
          product_image: auction.product?.image_url || '',
          winner_name: auction.winner_name || (language === 'en' ? 'Anonymous' : 'Anonym'),
          final_price: finalPrice,
          retail_price: retailPrice,
          savings_percent: savingsPercent,
          total_bids: auction.total_bids || 0,
          ended_at: auction.ended_at || auction.end_time
        };
      });
      setWinners(transformedWinners);
    } catch (error) {
      console.error('Error fetching winners:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const totalSavings = winners.reduce((sum, w) => sum + (w.retail_price - w.final_price), 0);
  const avgSavings = winners.length > 0 
    ? Math.round(winners.reduce((sum, w) => sum + w.savings_percent, 0) / winners.length)
    : 0;

  // Multilingual stats labels
  const statsLabels = {
    de: { happyWinners: 'Glückliche Gewinner', totalSaved: 'Gesamt gespart', avgSavings: 'Durchschnittliche Ersparnis', realWinners: 'Echte Gewinner, echte Ersparnisse', ourWinners: 'Unsere', subtitle: 'Diese Nutzer haben bei BidBlitz fantastische Schnäppchen gemacht. Der nächste Gewinner könnten Sie sein!', bidNow: 'Jetzt bieten' },
    en: { happyWinners: 'Happy Winners', totalSaved: 'Total saved', avgSavings: 'Average savings', realWinners: 'Real winners, real savings', ourWinners: 'Our', subtitle: 'These users scored amazing deals at BidBlitz. You could be next!', bidNow: 'Bid Now' },
    sq: { happyWinners: 'Fitues të Lumtur', totalSaved: 'Totali i kursyer', avgSavings: 'Kursimi mesatar', realWinners: 'Fitues realë, kursime reale', ourWinners: 'Fituesit', subtitle: 'Këta përdorues kanë bërë pazare fantastike në BidBlitz. Tjetri mund të jeni ju!', bidNow: 'Oferoni Tani' },
    tr: { happyWinners: 'Mutlu Kazananlar', totalSaved: 'Toplam tasarruf', avgSavings: 'Ortalama tasarruf', realWinners: 'Gerçek kazananlar, gerçek tasarruflar', ourWinners: 'Kazananlarımız', subtitle: 'Bu kullanıcılar BidBlitz\'de harika fırsatlar yakaladı. Sıradaki siz olabilirsiniz!', bidNow: 'Şimdi Teklif Ver' },
    fr: { happyWinners: 'Gagnants Heureux', totalSaved: 'Total économisé', avgSavings: 'Économie moyenne', realWinners: 'Vrais gagnants, vraies économies', ourWinners: 'Nos', subtitle: 'Ces utilisateurs ont fait de super affaires sur BidBlitz. Vous pourriez être le prochain!', bidNow: 'Enchérir' }
  };
  const stats = statsLabels[langKey] || statsLabels.de;

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 bg-gradient-to-b from-cyan-50 to-cyan-100" data-testid="winners-page">
      <div className="max-w-7xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-200 mb-6">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span className="text-amber-600 text-sm font-medium">{stats.realWinners}</span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-800 mb-4">
            {stats.ourWinners} <span className="text-amber-500">{texts.title.replace('Gewinner-Galerie', 'Gewinner').replace('Winners Gallery', 'Winners').replace('Galeria e Fituesve', 'Fituesve').replace('Kazananlar Galerisi', 'Kazananlar').replace('Galerie des Gagnants', 'Gagnants')}</span>
          </h1>
          
          <p className="text-gray-500 text-lg max-w-2xl mx-auto mb-8">
            {stats.subtitle}
          </p>
          
          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-6 mb-8">
            <div className="bg-white shadow-md px-6 py-4 rounded-xl border border-gray-200">
              <div className="flex items-center gap-3">
                <Trophy className="w-8 h-8 text-amber-500" />
                <div className="text-left">
                  <p className="text-2xl font-bold text-gray-800">{winners.length}+</p>
                  <p className="text-gray-500 text-sm">{stats.happyWinners}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white shadow-md px-6 py-4 rounded-xl border border-gray-200">
              <div className="flex items-center gap-3">
                <TrendingDown className="w-8 h-8 text-green-500" />
                <div className="text-left">
                  <p className="text-2xl font-bold text-gray-800">€{totalSavings.toFixed(0)}</p>
                  <p className="text-gray-500 text-sm">{stats.totalSaved}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white shadow-md px-6 py-4 rounded-xl border border-gray-200">
              <div className="flex items-center gap-3">
                <Star className="w-8 h-8 text-orange-500" />
                <div className="text-left">
                  <p className="text-2xl font-bold text-gray-800">{avgSavings}%</p>
                  <p className="text-gray-500 text-sm">{stats.avgSavings}</p>
                </div>
              </div>
            </div>
          </div>
          
          <Link to="/auctions">
            <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold">
              {stats.bidNow}
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
        
        {/* Winners Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl h-96 animate-pulse" />
            ))}
          </div>
        ) : winners.length === 0 ? (
          <div className="text-center py-16 glass-card rounded-2xl">
            <Trophy className="w-16 h-16 text-gray-500 mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">{texts.noWinners}</h3>
            <p className="text-gray-500 mb-6">
              {texts.firstWinner}
            </p>
            <Link to="/auctions">
              <Button className="btn-primary">{texts.goToAuctions}</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {winners.map((winner) => (
              <WinnerCard key={winner.auction_id} winner={winner} texts={texts} language={language} />
            ))}
          </div>
        )}
        
        {/* CTA Section */}
        {winners.length > 0 && (
          <div className="mt-16 text-center">
            <div className="glass-card p-8 rounded-2xl max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                {language === 'en' ? 'Be the next winner!' : language === 'sq' ? 'Bëhuni fituesi i radhës!' : language === 'tr' ? 'Bir sonraki kazanan siz olun!' : language === 'fr' ? 'Soyez le prochain gagnant!' : 'Werden Sie der nächste Gewinner!'}
              </h2>
              <p className="text-gray-500 mb-6">
                {language === 'en' ? 'Register now and get 10 free bids to start.' : language === 'sq' ? 'Regjistrohuni tani dhe merrni 10 oferta falas për të filluar.' : language === 'tr' ? 'Şimdi kaydolun ve başlamak için 10 ücretsiz teklif alın.' : language === 'fr' ? 'Inscrivez-vous maintenant et obtenez 10 enchères gratuites pour commencer.' : 'Registrieren Sie sich jetzt und erhalten Sie 10 kostenlose Gebote zum Start.'}
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link to="/register">
                  <Button className="btn-primary">{language === 'en' ? 'Register Free' : language === 'sq' ? 'Regjistrohu Falas' : language === 'tr' ? 'Ücretsiz Kayıt' : language === 'fr' ? 'Inscription Gratuite' : 'Kostenlos registrieren'}</Button>
                </Link>
                <Link to="/auctions">
                  <Button variant="outline" className="border-gray-300 text-gray-800 hover:bg-white/10">
                    {texts.goToAuctions}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
