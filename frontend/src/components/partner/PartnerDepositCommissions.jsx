/**
 * PartnerDepositCommissions - Dashboard for partner deposit commissions
 * Shows earned commissions from customer deposits
 */
import { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Users, Calendar, Gift, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

const translations = {
  de: {
    title: 'Einzahlungs-Provisionen',
    subtitle: 'Verdienst aus Kundeneinzahlungen',
    totalCommission: 'Gesamte Provision',
    totalDeposits: 'Vermittelte Einzahlungen',
    customerCount: 'Kunden',
    avgCommission: 'Ø Provision',
    recentCommissions: 'Letzte Provisionen',
    noCommissions: 'Noch keine Provisionen',
    noCommissionsDesc: 'Vermitteln Sie Kundeneinzahlungen, um Provisionen zu verdienen.',
    customer: 'Kunde',
    deposit: 'Einzahlung',
    commission: 'Provision',
    date: 'Datum',
    rate: 'Rate',
    refresh: 'Aktualisieren',
    howItWorks: 'So funktioniert\'s',
    howItWorksDesc: 'Wenn ein Kunde über Sie einzahlt, erhalten Sie automatisch eine Provision zwischen 2-5% je nach Angebot.',
    tipTitle: 'Tipp',
    tipDesc: 'Teilen Sie Ihre Kundennummer mit Neukunden - bei deren erster Einzahlung verdienen Sie mit!'
  },
  en: {
    title: 'Deposit Commissions',
    subtitle: 'Earnings from customer deposits',
    totalCommission: 'Total Commission',
    totalDeposits: 'Facilitated Deposits',
    customerCount: 'Customers',
    avgCommission: 'Avg Commission',
    recentCommissions: 'Recent Commissions',
    noCommissions: 'No commissions yet',
    noCommissionsDesc: 'Facilitate customer deposits to earn commissions.',
    customer: 'Customer',
    deposit: 'Deposit',
    commission: 'Commission',
    date: 'Date',
    rate: 'Rate',
    refresh: 'Refresh',
    howItWorks: 'How it works',
    howItWorksDesc: 'When a customer deposits through you, you automatically receive a commission of 2-5% depending on the offer.',
    tipTitle: 'Tip',
    tipDesc: 'Share your customer number with new customers - you earn from their first deposit!'
  },
  sq: {
    title: 'Komisionet e Depozitave',
    subtitle: 'Fitimet nga depozitat e klientëve',
    totalCommission: 'Komisioni Total',
    totalDeposits: 'Depozita të Ndërmjetësuara',
    customerCount: 'Klientë',
    avgCommission: 'Ø Komision',
    recentCommissions: 'Komisionet e Fundit',
    noCommissions: 'Ende nuk ka komisione',
    noCommissionsDesc: 'Ndërmjetësoni depozitat e klientëve për të fituar komisione.',
    customer: 'Klient',
    deposit: 'Depozitë',
    commission: 'Komision',
    date: 'Data',
    rate: 'Norma',
    refresh: 'Rifresko',
    howItWorks: 'Si funksionon',
    howItWorksDesc: 'Kur një klient depoziton përmes jush, ju automatikisht merrni një komision prej 2-5% në varësi të ofertës.',
    tipTitle: 'Këshillë',
    tipDesc: 'Ndani numrin tuaj të klientit me klientët e rinj - ju fitoni nga depozita e tyre e parë!'
  },
  tr: {
    title: 'Yatırım Komisyonları',
    subtitle: 'Müşteri yatırımlarından kazanç',
    totalCommission: 'Toplam Komisyon',
    totalDeposits: 'Aracılık Edilen Yatırımlar',
    customerCount: 'Müşteriler',
    avgCommission: 'Ort. Komisyon',
    recentCommissions: 'Son Komisyonlar',
    noCommissions: 'Henüz komisyon yok',
    noCommissionsDesc: 'Komisyon kazanmak için müşteri yatırımlarına aracılık edin.',
    customer: 'Müşteri',
    deposit: 'Yatırım',
    commission: 'Komisyon',
    date: 'Tarih',
    rate: 'Oran',
    refresh: 'Yenile',
    howItWorks: 'Nasıl çalışır',
    howItWorksDesc: 'Bir müşteri sizin aracılığınızla yatırım yaptığında, teklife bağlı olarak otomatik olarak %2-5 komisyon alırsınız.',
    tipTitle: 'İpucu',
    tipDesc: 'Müşteri numaranızı yeni müşterilerle paylaşın - ilk yatırımlarından siz de kazanın!'
  }
};

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PartnerDepositCommissions = ({ token, language = 'de' }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);
  
  const t = translations[language] || translations.de;

  const fetchStats = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${API}/deposit-offers/partner/stats?token=${token}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setStats(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching commission stats:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [token]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 bg-gray-200 rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <p className="text-red-500 text-center">Fehler beim Laden der Daten</p>
      </div>
    );
  }

  const { deposits = [], stats: statsData = {} } = stats || {};
  const hasCommissions = deposits.length > 0;

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden" data-testid="partner-deposit-commissions">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Gift className="w-7 h-7" />
              {t.title}
            </h2>
            <p className="text-emerald-100 mt-1">{t.subtitle}</p>
          </div>
          <button
            onClick={fetchStats}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            title={t.refresh}
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* Total Commission */}
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4">
            <div className="flex items-center gap-2 text-emerald-600 mb-2">
              <DollarSign className="w-5 h-5" />
              <span className="text-sm font-medium">{t.totalCommission}</span>
            </div>
            <p className="text-2xl font-bold text-emerald-700">
              €{(statsData.total_commission || 0).toFixed(2)}
            </p>
          </div>

          {/* Total Deposits */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
            <div className="flex items-center gap-2 text-blue-600 mb-2">
              <TrendingUp className="w-5 h-5" />
              <span className="text-sm font-medium">{t.totalDeposits}</span>
            </div>
            <p className="text-2xl font-bold text-blue-700">
              €{(statsData.total_deposits || 0).toFixed(2)}
            </p>
          </div>

          {/* Customer Count */}
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4">
            <div className="flex items-center gap-2 text-purple-600 mb-2">
              <Users className="w-5 h-5" />
              <span className="text-sm font-medium">{t.customerCount}</span>
            </div>
            <p className="text-2xl font-bold text-purple-700">
              {statsData.deposit_count || 0}
            </p>
          </div>

          {/* Average Commission */}
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4">
            <div className="flex items-center gap-2 text-amber-600 mb-2">
              <Calendar className="w-5 h-5" />
              <span className="text-sm font-medium">{t.avgCommission}</span>
            </div>
            <p className="text-2xl font-bold text-amber-700">
              €{statsData.deposit_count ? ((statsData.total_commission || 0) / statsData.deposit_count).toFixed(2) : '0.00'}
            </p>
          </div>
        </div>

        {/* Commission History */}
        {hasCommissions ? (
          <div className="border rounded-xl overflow-hidden">
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <span className="font-semibold text-gray-700">{t.recentCommissions}</span>
              {expanded ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
            </button>
            
            {expanded && (
              <div className="divide-y">
                {deposits.slice(0, 10).map((deposit, index) => (
                  <div key={index} className="p-4 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">
                        €{(deposit.amount || 0).toFixed(2)} {t.deposit}
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(deposit.created_at).toLocaleDateString('de-DE')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-600">
                        +€{(deposit.partner_commission || 0).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {((deposit.partner_commission / deposit.amount) * 100).toFixed(0)}% {t.rate}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 bg-gray-50 rounded-xl">
            <Gift className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">{t.noCommissions}</p>
            <p className="text-gray-500 text-sm mt-1">{t.noCommissionsDesc}</p>
          </div>
        )}

        {/* How it works */}
        <div className="mt-6 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-4">
          <h3 className="font-semibold text-emerald-800 mb-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            {t.howItWorks}
          </h3>
          <p className="text-sm text-emerald-700">{t.howItWorksDesc}</p>
          
          <div className="mt-3 p-3 bg-white rounded-lg border border-emerald-200">
            <p className="text-xs text-emerald-600 font-medium">💡 {t.tipTitle}</p>
            <p className="text-xs text-emerald-600 mt-1">{t.tipDesc}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PartnerDepositCommissions;
