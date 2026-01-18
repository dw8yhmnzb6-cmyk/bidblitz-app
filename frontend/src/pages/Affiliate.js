import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Users, DollarSign, TrendingUp, Copy, CheckCircle, Gift, Zap, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Affiliate() {
  const { isAuthenticated, token } = useAuth();
  const [affiliateData, setAffiliateData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Registration form
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    payment_method: 'bank_transfer',
    payment_details: ''
  });

  useEffect(() => {
    if (isAuthenticated) {
      fetchAffiliateData();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const fetchAffiliateData = async () => {
    try {
      const response = await axios.get(`${API}/affiliates/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAffiliateData(response.data);
    } catch (error) {
      // Not registered as affiliate yet
      setAffiliateData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegistering(true);
    try {
      const response = await axios.post(`${API}/affiliates/register`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Erfolgreich als Affiliate registriert!');
      setAffiliateData(response.data.affiliate);
      fetchAffiliateData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Registrierung fehlgeschlagen');
    } finally {
      setRegistering(false);
    }
  };

  const copyLink = () => {
    const link = `https://bidblitz.de/register?ref=${affiliateData?.affiliate?.referral_code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Link kopiert!');
    setTimeout(() => setCopied(false), 2000);
  };

  const commissionTiers = [
    { leads: '01-05', commission: '3€' },
    { leads: '06-20', commission: '5€' },
    { leads: '21-50', commission: '7€' },
    { leads: '51+', commission: '9€' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFD700]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-12 px-4" data-testid="affiliate-page">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Affiliate <span className="text-[#FFD700]">Partner-Programm</span>
          </h1>
          <p className="text-[#94A3B8] text-lg max-w-2xl mx-auto">
            Verdienen Sie Geld, indem Sie BidBlitz empfehlen. Erhalten Sie bis zu €9 pro Lead!
          </p>
        </div>

        {/* Commission Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {commissionTiers.map((tier, index) => (
            <div key={index} className="glass-card p-6 rounded-xl text-center">
              <p className="text-[#94A3B8] text-sm mb-2">{tier.leads} Leads/Monat</p>
              <p className="text-3xl font-bold text-[#FFD700]">{tier.commission}</p>
              <p className="text-white text-sm mt-1">pro Lead</p>
            </div>
          ))}
        </div>

        {/* Base Commission Banner */}
        <div className="glass-card p-6 rounded-xl mb-12 border border-[#FFD700]/30 bg-gradient-to-r from-[#FFD700]/10 to-transparent">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[#FFD700]/20 flex items-center justify-center">
                <Gift className="w-8 h-8 text-[#FFD700]" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Mindestens €8 pro Lead</h3>
                <p className="text-[#94A3B8]">Wenn Ihr Lead ein Gebotspaket kauft (ab €10)</p>
              </div>
            </div>
            <div className="text-center md:text-right">
              <p className="text-4xl font-bold text-[#10B981]">€8+</p>
              <p className="text-[#94A3B8] text-sm">garantiert</p>
            </div>
          </div>
        </div>

        {!isAuthenticated ? (
          // Not logged in
          <div className="glass-card p-8 rounded-xl text-center">
            <h2 className="text-xl font-bold text-white mb-4">Jetzt anmelden</h2>
            <p className="text-[#94A3B8] mb-6">Melden Sie sich an, um am Affiliate-Programm teilzunehmen.</p>
            <Button className="btn-primary" onClick={() => window.location.href = '/login'}>
              Anmelden <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        ) : affiliateData?.affiliate ? (
          // Already registered as affiliate
          <div className="space-y-8">
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="glass-card p-6 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#7C3AED]/20 flex items-center justify-center">
                    <Users className="w-6 h-6 text-[#7C3AED]" />
                  </div>
                  <div>
                    <p className="text-[#94A3B8] text-sm">Empfehlungen</p>
                    <p className="text-2xl font-bold text-white">{affiliateData.affiliate.total_referrals}</p>
                  </div>
                </div>
              </div>
              <div className="glass-card p-6 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#10B981]/20 flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-[#10B981]" />
                  </div>
                  <div>
                    <p className="text-[#94A3B8] text-sm">Konvertiert</p>
                    <p className="text-2xl font-bold text-white">{affiliateData.affiliate.converted_leads}</p>
                  </div>
                </div>
              </div>
              <div className="glass-card p-6 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#FFD700]/20 flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-[#FFD700]" />
                  </div>
                  <div>
                    <p className="text-[#94A3B8] text-sm">Ausstehend</p>
                    <p className="text-2xl font-bold text-[#FFD700]">€{affiliateData.affiliate.pending_commission.toFixed(2)}</p>
                  </div>
                </div>
              </div>
              <div className="glass-card p-6 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#06B6D4]/20 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-[#06B6D4]" />
                  </div>
                  <div>
                    <p className="text-[#94A3B8] text-sm">Ausgezahlt</p>
                    <p className="text-2xl font-bold text-white">€{affiliateData.affiliate.paid_commission.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Current Tier */}
            <div className="glass-card p-6 rounded-xl">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Aktuelle Stufe</h3>
                  <p className="text-[#94A3B8]">{affiliateData.leads_this_month} Leads diesen Monat</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-[#FFD700]">€{affiliateData.commission_rate.toFixed(2)}</p>
                  <p className="text-[#94A3B8] text-sm">pro Lead</p>
                </div>
              </div>
            </div>

            {/* Referral Link */}
            <div className="glass-card p-6 rounded-xl">
              <h3 className="text-lg font-bold text-white mb-4">Ihr Empfehlungslink</h3>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 p-4 rounded-lg bg-[#181824] border border-white/10">
                  <code className="text-[#06B6D4] text-sm break-all">
                    https://bidblitz.de/register?ref={affiliateData.affiliate.referral_code}
                  </code>
                </div>
                <Button onClick={copyLink} className="btn-primary whitespace-nowrap">
                  {copied ? <CheckCircle className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                  {copied ? 'Kopiert!' : 'Link kopieren'}
                </Button>
              </div>
              <p className="text-[#94A3B8] text-sm mt-4">
                Teilen Sie diesen Link, um neue Nutzer zu werben und Provisionen zu verdienen.
              </p>
            </div>
          </div>
        ) : (
          // Registration Form
          <div className="glass-card p-8 rounded-xl max-w-xl mx-auto">
            <h2 className="text-xl font-bold text-white mb-6">Als Affiliate registrieren</h2>
            <form onSubmit={handleRegister} className="space-y-6">
              <div className="space-y-2">
                <Label className="text-white">Name</Label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="Ihr vollständiger Name"
                  className="bg-[#181824] border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white">E-Mail für Benachrichtigungen</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  placeholder="affiliate@beispiel.de"
                  className="bg-[#181824] border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white">Auszahlungsmethode</Label>
                <Select 
                  value={formData.payment_method} 
                  onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                >
                  <SelectTrigger className="bg-[#181824] border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#181824] border-white/10">
                    <SelectItem value="bank_transfer" className="text-white hover:bg-white/10">Banküberweisung</SelectItem>
                    <SelectItem value="paypal" className="text-white hover:bg-white/10">PayPal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-white">
                  {formData.payment_method === 'bank_transfer' ? 'IBAN' : 'PayPal E-Mail'}
                </Label>
                <Input
                  type="text"
                  value={formData.payment_details}
                  onChange={(e) => setFormData({ ...formData, payment_details: e.target.value })}
                  required
                  placeholder={formData.payment_method === 'bank_transfer' ? 'DE89 3704 0044 0532 0130 00' : 'paypal@beispiel.de'}
                  className="bg-[#181824] border-white/10 text-white"
                />
              </div>
              <Button type="submit" disabled={registering} className="btn-primary w-full">
                {registering ? 'Wird registriert...' : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Jetzt Affiliate werden
                  </>
                )}
              </Button>
            </form>
          </div>
        )}

        {/* How it works */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-white text-center mb-8">So funktioniert's</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card p-6 rounded-xl text-center">
              <div className="w-12 h-12 rounded-full bg-[#7C3AED]/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-[#7C3AED]">1</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Registrieren</h3>
              <p className="text-[#94A3B8]">Melden Sie sich als Affiliate an und erhalten Sie Ihren persönlichen Empfehlungslink.</p>
            </div>
            <div className="glass-card p-6 rounded-xl text-center">
              <div className="w-12 h-12 rounded-full bg-[#FFD700]/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-[#FFD700]">2</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Teilen</h3>
              <p className="text-[#94A3B8]">Teilen Sie Ihren Link auf Social Media, Ihrer Website oder per E-Mail.</p>
            </div>
            <div className="glass-card p-6 rounded-xl text-center">
              <div className="w-12 h-12 rounded-full bg-[#10B981]/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-[#10B981]">3</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Verdienen</h3>
              <p className="text-[#94A3B8]">Erhalten Sie €8+ für jeden Lead, der ein Gebotspaket kauft!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
