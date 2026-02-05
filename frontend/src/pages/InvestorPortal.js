import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  TrendingUp, Users, DollarSign, BarChart3, 
  Briefcase, Target, ArrowUpRight, CheckCircle,
  Clock, Building2, Wallet, Star, Shield, Gift, Check
} from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, Line
} from 'recharts';
import { getFeatureTranslation } from '../i18n/featureTranslations';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Stats Card Component
const StatCard = ({ icon: Icon, label, value, subValue, color, trend }) => (
  <div className="glass-card rounded-xl p-4 sm:p-6">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-[#94A3B8] text-xs sm:text-sm">{label}</p>
        <p className={`text-xl sm:text-2xl font-bold ${color || 'text-white'} mt-1`}>{value}</p>
        {subValue && <p className="text-[#94A3B8] text-xs mt-1">{subValue}</p>}
      </div>
      <div className={`p-2 sm:p-3 rounded-xl bg-white/5`}>
        <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${color}`} />
      </div>
    </div>
    {trend && (
      <div className="flex items-center gap-1 mt-2 text-xs">
        <ArrowUpRight className="w-3 h-3 text-[#10B981]" />
        <span className="text-[#10B981]">{trend}</span>
      </div>
    )}
  </div>
);

// Package Card Component
const PackageCard = ({ pkg, selected, onSelect, onInvest, loading }) => {
  const isPopular = pkg.id === 'standard';
  
  return (
    <div 
      className={`relative glass-card rounded-2xl p-6 border-2 transition-all cursor-pointer ${
        selected ? 'border-[#7C3AED] bg-[#7C3AED]/10' : 'border-transparent hover:border-white/20'
      }`}
      onClick={() => onSelect(pkg.id)}
    >
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#7C3AED] rounded-full text-xs font-bold text-white">
          BELIEBT
        </div>
      )}
      
      <div className="text-center mb-4">
        <h3 className="text-xl font-bold text-white">{pkg.label}</h3>
        <p className="text-3xl font-bold text-[#FFD700] mt-2">
          €{pkg.amount.toLocaleString('de-DE')}
        </p>
        <p className="text-[#10B981] font-medium mt-1">{pkg.equity} Anteil</p>
      </div>
      
      <div className="space-y-2 mb-6">
        {pkg.perks.map((perk, i) => (
          <div key={i} className="flex items-center gap-2 text-sm text-[#94A3B8]">
            <Check className="w-4 h-4 text-[#10B981]" />
            {perk}
          </div>
        ))}
      </div>
      
      <Button
        onClick={(e) => {
          e.stopPropagation();
          onInvest(pkg.id);
        }}
        disabled={loading}
        className={`w-full ${selected ? 'btn-primary' : 'bg-white/10 hover:bg-white/20'}`}
      >
        {loading ? 'Wird geladen...' : 'Jetzt investieren'}
      </Button>
    </div>
  );
};

export default function InvestorPortal() {
  const { user, token } = useAuth();
  const { language } = useLanguage();
  const [searchParams] = useSearchParams();
  
  // Get translations
  const t = getFeatureTranslation('investorPortal', language);
  
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [packages, setPackages] = useState([]);
  const [myInvestments, setMyInvestments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedPackage, setSelectedPackage] = useState('standard');
  
  // Check for return from Stripe
  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    const success = searchParams.get('success');
    const cancelled = searchParams.get('cancelled');
    
    if (sessionId && success) {
      // Poll payment status
      pollPaymentStatus(sessionId);
    } else if (cancelled) {
      toast.error(t.paymentCancelled || 'Zahlung abgebrochen');
    }
  }, [searchParams, t]);
  
  const pollPaymentStatus = async (sessionId, attempts = 0) => {
    const maxAttempts = 5;
    
    if (attempts >= maxAttempts) {
      toast.error(t.paymentNotConfirmed || 'Zahlung konnte nicht bestätigt werden. Bitte kontaktieren Sie uns.');
      return;
    }
    
    try {
      const res = await axios.get(`${API}/investor/checkout/status/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data.payment_status === 'paid') {
        toast.success(`${t.investmentSuccess || 'Investition erfolgreich!'} €${res.data.amount.toLocaleString('de-DE')}`);
        fetchData();
        setActiveTab('my-investments');
        return;
      } else if (res.data.status === 'expired') {
        toast.error(t.sessionExpired || 'Zahlungssitzung abgelaufen');
        return;
      }
      
      // Continue polling
      setTimeout(() => pollPaymentStatus(sessionId, attempts + 1), 2000);
    } catch (error) {
      console.error('Payment status error:', error);
    }
  };
  
  useEffect(() => {
    fetchData();
  }, []);
  
  const fetchData = async () => {
    try {
      // Public stats
      const [statsRes, chartRes, packagesRes] = await Promise.all([
        axios.get(`${API}/investor/public/stats`),
        axios.get(`${API}/investor/public/growth-chart`),
        axios.get(`${API}/investor/packages`)
      ]);
      
      setStats(statsRes.data);
      setChartData(chartRes.data.chart_data || []);
      setPackages(packagesRes.data.packages || []);
      
      // User investments
      if (token) {
        try {
          const invRes = await axios.get(`${API}/investor/investments`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setMyInvestments(invRes.data.investments || []);
        } catch (e) {}
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleInvest = async (packageId) => {
    if (!token) {
      toast.error(t.pleaseLoginToInvest || 'Bitte melden Sie sich an, um zu investieren');
      return;
    }
    
    setCheckoutLoading(true);
    
    try {
      const res = await axios.post(`${API}/investor/checkout`, {
        package_id: packageId,
        origin_url: window.location.origin
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Redirect to Stripe
      window.location.href = res.data.checkout_url;
    } catch (error) {
      toast.error(error.response?.data?.detail || t.paymentError || 'Fehler bei der Zahlungsverarbeitung');
      setCheckoutLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D0D14] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#7C3AED] border-t-transparent" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[#0D0D14] pt-20 pb-12 px-4" data-testid="investor-portal">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
            💼 Investor Portal
          </h1>
          <p className="text-[#94A3B8]">
            Investieren Sie in die Zukunft von BidBlitz
          </p>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'overview', label: 'Übersicht', icon: BarChart3 },
            { id: 'invest', label: 'Investieren', icon: Wallet },
            { id: 'my-investments', label: 'Meine Investitionen', icon: Briefcase }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-[#7C3AED] text-white'
                  : 'bg-[#181824] text-[#94A3B8] hover:bg-[#1A1A2E]'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            {/* Key Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={Users}
                label="Gesamte Nutzer"
                value={stats.platform_stats?.total_users?.toLocaleString('de-DE') || 0}
                subValue={`+${stats.platform_stats?.new_users_30d || 0} (30 Tage)`}
                color="text-[#7C3AED]"
                trend={`${stats.growth_indicators?.monthly_growth_rate || 0}% Wachstum`}
              />
              <StatCard
                icon={DollarSign}
                label="Gesamtumsatz"
                value={`€${stats.financial_stats?.total_revenue_eur?.toLocaleString('de-DE') || 0}`}
                subValue={`Ø €${stats.financial_stats?.avg_transaction_value || 0}/Trans.`}
                color="text-[#10B981]"
              />
              <StatCard
                icon={BarChart3}
                label="Auktionen"
                value={stats.auction_stats?.total_auctions?.toLocaleString('de-DE') || 0}
                subValue={`${stats.auction_stats?.active_auctions || 0} aktiv`}
                color="text-[#06B6D4]"
              />
              <StatCard
                icon={TrendingUp}
                label="Erfolgsrate"
                value={`${stats.auction_stats?.success_rate || 0}%`}
                subValue={`${stats.auction_stats?.completed_auctions || 0} abgeschlossen`}
                color="text-[#F59E0B]"
              />
            </div>
            
            {/* Growth Chart */}
            <div className="glass-card rounded-xl p-6">
              <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#7C3AED]" />
                Wachstumskurve (12 Monate)
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#7C3AED" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="month" stroke="#94A3B8" fontSize={11} />
                    <YAxis stroke="#94A3B8" fontSize={11} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#181824', border: '1px solid #374151', borderRadius: '8px' }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="users" 
                      stroke="#7C3AED" 
                      fillOpacity={1} 
                      fill="url(#colorUsers)" 
                      name="Neue Nutzer"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#10B981" 
                      strokeWidth={2}
                      name="Umsatz (€)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            {/* Why Invest Section */}
            <div className="glass-card rounded-xl p-6">
              <h3 className="text-white font-bold text-lg mb-4">Warum in BidBlitz investieren?</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-[#181824] rounded-lg">
                  <div className="w-10 h-10 bg-[#7C3AED]/20 rounded-lg flex items-center justify-center mb-3">
                    <TrendingUp className="w-5 h-5 text-[#7C3AED]" />
                  </div>
                  <h4 className="text-white font-medium mb-1">Starkes Wachstum</h4>
                  <p className="text-[#94A3B8] text-sm">
                    {stats.growth_indicators?.monthly_growth_rate || 0}% monatliches Nutzerwachstum
                  </p>
                </div>
                <div className="p-4 bg-[#181824] rounded-lg">
                  <div className="w-10 h-10 bg-[#06B6D4]/20 rounded-lg flex items-center justify-center mb-3">
                    <Building2 className="w-5 h-5 text-[#06B6D4]" />
                  </div>
                  <h4 className="text-white font-medium mb-1">Bewährtes Modell</h4>
                  <p className="text-[#94A3B8] text-sm">
                    Penny-Auktionen sind ein etabliertes Geschäftsmodell
                  </p>
                </div>
                <div className="p-4 bg-[#181824] rounded-lg">
                  <div className="w-10 h-10 bg-[#10B981]/20 rounded-lg flex items-center justify-center mb-3">
                    <Target className="w-5 h-5 text-[#10B981]" />
                  </div>
                  <h4 className="text-white font-medium mb-1">Klare Strategie</h4>
                  <p className="text-[#94A3B8] text-sm">
                    Expansion in neue Märkte und Produktkategorien
                  </p>
                </div>
              </div>
            </div>
            
            {/* CTA */}
            <div className="glass-card rounded-xl p-6 text-center bg-gradient-to-r from-[#7C3AED]/20 to-[#06B6D4]/20 border border-[#7C3AED]/30">
              <h3 className="text-2xl font-bold text-white mb-2">Werden Sie Teil unserer Erfolgsgeschichte</h3>
              <p className="text-[#94A3B8] mb-4">Investieren Sie jetzt und profitieren Sie vom Wachstum</p>
              <Button 
                onClick={() => setActiveTab('invest')}
                className="btn-primary text-lg px-8"
              >
                Jetzt investieren
              </Button>
            </div>
          </div>
        )}
        
        {/* Invest Tab */}
        {activeTab === 'invest' && (
          <div className="space-y-8">
            
            {/* Vision Section */}
            <div className="glass-card rounded-2xl p-8 bg-gradient-to-br from-[#7C3AED]/10 to-[#06B6D4]/10 border border-[#7C3AED]/20">
              <h2 className="text-2xl font-bold text-white mb-4 text-center">🚀 Unsere Vision</h2>
              <p className="text-[#94A3B8] text-center max-w-3xl mx-auto mb-6">
                BidBlitz revolutioniert den E-Commerce durch spannende Penny-Auktionen. 
                Mit Ihrer Investition helfen Sie uns, europaweit zu expandieren und die 
                führende Plattform für Schnäppchenjäger zu werden.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4">
                  <div className="text-3xl font-bold text-[#FFD700]">€5M+</div>
                  <div className="text-[#94A3B8] text-sm">Zielumsatz 2027</div>
                </div>
                <div className="text-center p-4">
                  <div className="text-3xl font-bold text-[#10B981]">100K+</div>
                  <div className="text-[#94A3B8] text-sm">Nutzer-Ziel</div>
                </div>
                <div className="text-center p-4">
                  <div className="text-3xl font-bold text-[#06B6D4]">10+</div>
                  <div className="text-[#94A3B8] text-sm">Länder bis 2028</div>
                </div>
              </div>
            </div>
            
            {/* What Investors Get */}
            <div className="glass-card rounded-2xl p-8">
              <h2 className="text-2xl font-bold text-white mb-6 text-center">💎 Was Sie als Investor erhalten</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Rendite */}
                <div className="p-5 bg-[#181824] rounded-xl border border-[#10B981]/30">
                  <div className="w-12 h-12 bg-[#10B981]/20 rounded-xl flex items-center justify-center mb-4">
                    <TrendingUp className="w-6 h-6 text-[#10B981]" />
                  </div>
                  <h3 className="text-white font-bold mb-2">📈 Rendite-Potenzial</h3>
                  <p className="text-[#94A3B8] text-sm mb-3">
                    Profitieren Sie vom Wachstum. Bei erfolgreicher Expansion steigt der Wert Ihrer Anteile.
                  </p>
                  <div className="text-[#10B981] font-bold">Ziel: 20-50% p.a.*</div>
                </div>
                
                {/* Anteile */}
                <div className="p-5 bg-[#181824] rounded-xl border border-[#7C3AED]/30">
                  <div className="w-12 h-12 bg-[#7C3AED]/20 rounded-xl flex items-center justify-center mb-4">
                    <Star className="w-6 h-6 text-[#7C3AED]" />
                  </div>
                  <h3 className="text-white font-bold mb-2">🏆 Unternehmensanteile</h3>
                  <p className="text-[#94A3B8] text-sm mb-3">
                    Sie werden Miteigentümer von BidBlitz mit Stimmrecht bei wichtigen Entscheidungen.
                  </p>
                  <div className="text-[#7C3AED] font-bold">0.01% - 1% Equity</div>
                </div>
                
                {/* Exklusive Vorteile */}
                <div className="p-5 bg-[#181824] rounded-xl border border-[#FFD700]/30">
                  <div className="w-12 h-12 bg-[#FFD700]/20 rounded-xl flex items-center justify-center mb-4">
                    <Gift className="w-6 h-6 text-[#FFD700]" />
                  </div>
                  <h3 className="text-white font-bold mb-2">🎁 Exklusive Vorteile</h3>
                  <ul className="text-[#94A3B8] text-sm space-y-1">
                    <li>✓ VIP-Zugang lebenslang</li>
                    <li>✓ Monatliche Gratis-Gebote</li>
                    <li>✓ Exklusive Auktionen</li>
                    <li>✓ Persönlicher Support</li>
                  </ul>
                </div>
                
                {/* Transparenz */}
                <div className="p-5 bg-[#181824] rounded-xl border border-[#06B6D4]/30">
                  <div className="w-12 h-12 bg-[#06B6D4]/20 rounded-xl flex items-center justify-center mb-4">
                    <BarChart3 className="w-6 h-6 text-[#06B6D4]" />
                  </div>
                  <h3 className="text-white font-bold mb-2">📊 Volle Transparenz</h3>
                  <ul className="text-[#94A3B8] text-sm space-y-1">
                    <li>✓ Monatliche Reports</li>
                    <li>✓ Echtzeit-Dashboard</li>
                    <li>✓ Quartals-Meetings</li>
                    <li>✓ Direkter CEO-Kontakt</li>
                  </ul>
                </div>
              </div>
            </div>
            
            {/* Package Selection */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-2 text-center">Wählen Sie Ihr Investment-Paket</h2>
              <p className="text-[#94A3B8] text-center mb-6">Transparente Konditionen • Sofortige Zahlung • Sichere Abwicklung</p>
              
              {/* Package Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {packages.map(pkg => (
                  <PackageCard
                    key={pkg.id}
                    pkg={pkg}
                    selected={selectedPackage === pkg.id}
                    onSelect={setSelectedPackage}
                    onInvest={handleInvest}
                    loading={checkoutLoading}
                  />
                ))}
              </div>
            </div>
            
            {/* Trust Badges */}
            <div className="flex flex-wrap justify-center gap-6">
              <div className="flex items-center gap-2 text-[#94A3B8]">
                <Shield className="w-5 h-5 text-[#10B981]" />
                <span className="text-sm">SSL-verschlüsselt</span>
              </div>
              <div className="flex items-center gap-2 text-[#94A3B8]">
                <Star className="w-5 h-5 text-[#F59E0B]" />
                <span className="text-sm">Stripe-Zahlungen</span>
              </div>
              <div className="flex items-center gap-2 text-[#94A3B8]">
                <CheckCircle className="w-5 h-5 text-[#7C3AED]" />
                <span className="text-sm">DSGVO-konform</span>
              </div>
            </div>
            
            {/* Disclaimer */}
            <div className="text-center text-[#64748B] text-xs">
              *Renditeangaben sind Zielwerte und keine Garantie. Investitionen sind mit Risiken verbunden.
            </div>
          </div>
        )}
        
        {/* My Investments Tab */}
        {activeTab === 'my-investments' && (
          <div className="space-y-6">
            {!token ? (
              <div className="glass-card rounded-xl p-8 text-center">
                <Briefcase className="w-12 h-12 text-[#94A3B8] mx-auto mb-3" />
                <p className="text-white font-medium">Bitte melden Sie sich an</p>
                <p className="text-[#94A3B8] text-sm mt-1">
                  Um Ihre Investitionen zu sehen, müssen Sie angemeldet sein
                </p>
                <Button 
                  onClick={() => window.location.href = '/login'}
                  className="btn-primary mt-4"
                >
                  Anmelden
                </Button>
              </div>
            ) : myInvestments.length === 0 ? (
              <div className="glass-card rounded-xl p-8 text-center">
                <Briefcase className="w-12 h-12 text-[#94A3B8] mx-auto mb-3" />
                <p className="text-[#94A3B8]">Sie haben noch keine Investitionen</p>
                <Button 
                  onClick={() => setActiveTab('invest')}
                  className="btn-primary mt-4"
                >
                  Jetzt investieren
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Summary Card */}
                <div className="glass-card rounded-xl p-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-[#94A3B8] text-sm">Gesamtinvestition</p>
                      <p className="text-2xl font-bold text-[#10B981]">
                        €{myInvestments.reduce((sum, inv) => sum + (inv.amount || 0), 0).toLocaleString('de-DE')}
                      </p>
                    </div>
                    <div>
                      <p className="text-[#94A3B8] text-sm">Anteil</p>
                      <p className="text-2xl font-bold text-[#7C3AED]">
                        {myInvestments[0]?.equity || '0%'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[#94A3B8] text-sm">Status</p>
                      <p className="text-2xl font-bold text-white">Aktiv</p>
                    </div>
                    <div>
                      <p className="text-[#94A3B8] text-sm">Seit</p>
                      <p className="text-2xl font-bold text-white">
                        {myInvestments[0] ? new Date(myInvestments[0].created_at).toLocaleDateString('de-DE', {month: 'short', year: 'numeric'}) : '-'}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Investment History */}
                <h3 className="text-white font-bold text-lg">Investitions-Historie</h3>
                {myInvestments.map(inv => (
                  <div key={inv.id} className="glass-card rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">€{inv.amount?.toLocaleString('de-DE')}</p>
                        <p className="text-[#94A3B8] text-xs">
                          {new Date(inv.created_at).toLocaleDateString('de-DE')} • {inv.investment_type}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        inv.status === 'completed' ? 'bg-[#10B981]/20 text-[#10B981]' :
                        inv.status === 'pending' ? 'bg-[#F59E0B]/20 text-[#F59E0B]' :
                        'bg-red-500/20 text-red-500'
                      }`}>
                        {inv.status === 'completed' ? 'Abgeschlossen' :
                         inv.status === 'pending' ? 'Ausstehend' : inv.status}
                      </span>
                    </div>
                    {inv.perks && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {inv.perks.map((perk, i) => (
                          <span key={i} className="px-2 py-1 bg-white/5 rounded text-xs text-[#94A3B8]">
                            {perk}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
      </div>
    </div>
  );
}
