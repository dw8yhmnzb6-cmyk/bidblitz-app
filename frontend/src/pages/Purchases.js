import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { 
  ArrowLeft, Package, Calendar, CreditCard, 
  Download, Zap, Loader2, Receipt
} from 'lucide-react';
import { Button } from '../components/ui/button';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Purchases page translations
const purchasesTexts = {
  de: {
    title: "Meine Käufe",
    subtitle: "Übersicht aller gekauften Gebotspakete",
    backToDashboard: "Zurück zum Dashboard",
    buyBids: "Gebote kaufen",
    totalPurchases: "Käufe gesamt",
    totalSpent: "Ausgegeben",
    bidsBought: "Gebote gekauft",
    noPurchases: "Noch keine Käufe",
    noPurchasesDesc: "Sie haben noch keine Gebotspakete gekauft.",
    bidPackage: "Gebotspaket",
    bids: "Gebote",
    price: "Preis",
    paid: "Bezahlt",
    pending: "Ausstehend"
  },
  en: {
    title: "My Purchases",
    subtitle: "Overview of all purchased bid packages",
    backToDashboard: "Back to Dashboard",
    buyBids: "Buy Bids",
    totalPurchases: "Total Purchases",
    totalSpent: "Total Spent",
    bidsBought: "Bids Bought",
    noPurchases: "No Purchases Yet",
    noPurchasesDesc: "You haven't purchased any bid packages yet.",
    bidPackage: "Bid Package",
    bids: "Bids",
    price: "Price",
    paid: "Paid",
    pending: "Pending"
  },
  sq: {
    title: "Blerjet e Mia",
    subtitle: "Përmbledhje e të gjitha paketave të blera",
    backToDashboard: "Kthehu te Paneli",
    buyBids: "Bli Oferta",
    totalPurchases: "Blerje Gjithsej",
    totalSpent: "Shpenzuar",
    bidsBought: "Oferta të Blera",
    noPurchases: "Ende pa Blerje",
    noPurchasesDesc: "Ju nuk keni blerë ende asnjë paketë ofertash.",
    bidPackage: "Paketë Ofertash",
    bids: "Oferta",
    price: "Çmimi",
    paid: "Paguar",
    pending: "Në Pritje"
  },
  xk: {
    title: "Blerjet e Mia",
    subtitle: "Përmbledhje e të gjitha paketave të blera",
    backToDashboard: "Kthehu te Paneli",
    buyBids: "Bli Oferta",
    totalPurchases: "Blerje Gjithsej",
    totalSpent: "Shpenzuar",
    bidsBought: "Oferta të Blera",
    noPurchases: "Ende pa Blerje",
    noPurchasesDesc: "Ju nuk keni blerë ende asnjë paketë ofertash.",
    bidPackage: "Paketë Ofertash",
    bids: "Oferta",
    price: "Çmimi",
    paid: "Paguar",
    pending: "Në Pritje"
  },
  tr: {
    title: "Satın Alımlarım",
    subtitle: "Satın alınan tüm teklif paketlerine genel bakış",
    backToDashboard: "Panele Dön",
    buyBids: "Teklif Satın Al",
    totalPurchases: "Toplam Satın Alım",
    totalSpent: "Toplam Harcanan",
    bidsBought: "Satın Alınan Teklifler",
    noPurchases: "Henüz Satın Alım Yok",
    noPurchasesDesc: "Henüz teklif paketi satın almadınız.",
    bidPackage: "Teklif Paketi",
    bids: "Teklifler",
    price: "Fiyat",
    paid: "Ödendi",
    pending: "Beklemede"
  },
  fr: {
    title: "Mes Achats",
    subtitle: "Aperçu de tous les forfaits achetés",
    backToDashboard: "Retour au Tableau de Bord",
    buyBids: "Acheter des Enchères",
    totalPurchases: "Achats Totaux",
    totalSpent: "Total Dépensé",
    bidsBought: "Enchères Achetées",
    noPurchases: "Pas Encore d'Achats",
    noPurchasesDesc: "Vous n'avez pas encore acheté de forfaits d'enchères.",
    bidPackage: "Forfait d'Enchères",
    bids: "Enchères",
    price: "Prix",
    paid: "Payé",
    pending: "En Attente"
  }
};

export default function Purchases() {
  const { token } = useAuth();
  const { language } = useLanguage();
  const texts = purchasesTexts[language] || purchasesTexts.de;
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPurchases();
  }, []);

  const fetchPurchases = async () => {
    try {
      const response = await axios.get(`${API}/user/purchases`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPurchases(response.data);
    } catch (error) {
      console.error('Error fetching purchases:', error);
    } finally {
      setLoading(false);
    }
  };

  // Stats
  const totalPurchases = purchases.length;
  const totalSpent = purchases.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalBidsBought = purchases.reduce((sum, p) => sum + (p.bids || 0), 0);

  return (
    <div className="min-h-screen pt-24 pb-12 px-4" data-testid="purchases-page">
      <div className="max-w-6xl mx-auto">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-[#94A3B8] hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          {texts.backToDashboard}
        </Link>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">{texts.title}</h1>
            <p className="text-[#94A3B8]">{texts.subtitle}</p>
          </div>
          <Link to="/buy-bids">
            <Button className="btn-primary">
              <Zap className="w-5 h-5 mr-2" />
              {texts.buyBids}
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#FFD700]/20 flex items-center justify-center">
                <Receipt className="w-6 h-6 text-[#FFD700]" />
              </div>
              <div>
                <p className="text-[#94A3B8] text-sm">{texts.totalPurchases}</p>
                <p className="text-2xl font-bold text-white">{totalPurchases}</p>
              </div>
            </div>
          </div>
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#10B981]/20 flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-[#10B981]" />
              </div>
              <div>
                <p className="text-[#94A3B8] text-sm">{texts.totalSpent}</p>
                <p className="text-2xl font-bold text-white">€{totalSpent.toFixed(2)}</p>
              </div>
            </div>
          </div>
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#7C3AED]/20 flex items-center justify-center">
                <Zap className="w-6 h-6 text-[#7C3AED]" />
              </div>
              <div>
                <p className="text-[#94A3B8] text-sm">{texts.bidsBought}</p>
                <p className="text-2xl font-bold text-white">{totalBidsBought}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Purchase List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#FFD700]" />
          </div>
        ) : purchases.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            <Package className="w-16 h-16 text-[#94A3B8] mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-bold text-white mb-2">{texts.noPurchases}</h3>
            <p className="text-[#94A3B8] mb-6">
              {texts.noPurchasesDesc}
            </p>
            <Link to="/buy-bids" className="btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-lg">
              <Zap className="w-5 h-5" />
              {texts.buyBids}
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {purchases.map((purchase, index) => (
              <div 
                key={index} 
                className="glass-card rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#FFD700] to-[#FF4D4D] flex items-center justify-center">
                    <Zap className="w-7 h-7 text-black" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{purchase.package_name || texts.bidPackage}</h3>
                    <p className="text-[#94A3B8] flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {new Date(purchase.created_at).toLocaleDateString(language === 'de' ? 'de-DE' : language === 'fr' ? 'fr-FR' : language === 'tr' ? 'tr-TR' : 'en-US', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-[#94A3B8] text-sm">{texts.bids}</p>
                    <p className="text-xl font-bold text-[#FFD700]">{purchase.bids}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[#94A3B8] text-sm">{texts.price}</p>
                    <p className="text-xl font-bold text-[#10B981]">€{purchase.amount?.toFixed(2)}</p>
                  </div>
                  <div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      purchase.status === 'paid' 
                        ? 'bg-[#10B981]/20 text-[#10B981]' 
                        : 'bg-[#F59E0B]/20 text-[#F59E0B]'
                    }`}>
                      {purchase.status === 'paid' ? texts.paid : texts.pending}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
