import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { safeCopyToClipboard } from '../utils/clipboard';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Users, DollarSign, TrendingUp, Copy, CheckCircle, Gift, Zap, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Affiliate page translations
const affiliateTexts = {
  de: {
    title: "Affiliate",
    titleHighlight: "Partner-Programm",
    subtitle: "Verdienen Sie Geld, indem Sie BidBlitz empfehlen. Erhalten Sie bis zu €9 pro Lead!",
    leadsPerMonth: "Leads/Monat",
    perLead: "pro Lead",
    minPerLead: "Mindestens €8 pro Lead",
    minPerLeadDesc: "Wenn Ihr Lead ein Gebotspaket kauft (ab €10)",
    guaranteed: "garantiert",
    loginNow: "Jetzt anmelden",
    loginDesc: "Melden Sie sich an, um am Affiliate-Programm teilzunehmen.",
    login: "Anmelden",
    referrals: "Empfehlungen",
    converted: "Konvertiert",
    pending: "Ausstehend",
    paidOut: "Ausgezahlt",
    currentTier: "Aktuelle Stufe",
    leadsThisMonth: "Leads diesen Monat",
    yourRefLink: "Ihr Empfehlungslink",
    copyLink: "Link kopieren",
    copied: "Kopiert!",
    shareLinkDesc: "Teilen Sie diesen Link, um neue Nutzer zu werben und Provisionen zu verdienen.",
    registerAsAffiliate: "Als Affiliate registrieren",
    name: "Name",
    yourFullName: "Ihr vollständiger Name",
    emailForNotifications: "E-Mail für Benachrichtigungen",
    paymentMethod: "Auszahlungsmethode",
    bankTransfer: "Banküberweisung",
    iban: "IBAN",
    paypalEmail: "PayPal E-Mail",
    registering: "Wird registriert...",
    becomeAffiliate: "Jetzt Affiliate werden",
    howItWorks: "So funktioniert's",
    step1Title: "Registrieren",
    step1Desc: "Melden Sie sich als Affiliate an und erhalten Sie Ihren persönlichen Empfehlungslink.",
    step2Title: "Teilen",
    step2Desc: "Teilen Sie Ihren Link auf Social Media, Ihrer Website oder per E-Mail.",
    step3Title: "Verdienen",
    step3Desc: "Erhalten Sie €8+ für jeden Lead, der ein Gebotspaket kauft!",
    successRegistered: "Erfolgreich als Affiliate registriert!",
    registrationFailed: "Registrierung fehlgeschlagen",
    linkCopied: "Link kopiert!"
  },
  en: {
    title: "Affiliate",
    titleHighlight: "Partner Program",
    subtitle: "Earn money by recommending BidBlitz. Get up to €9 per lead!",
    leadsPerMonth: "Leads/Month",
    perLead: "per lead",
    minPerLead: "At least €8 per lead",
    minPerLeadDesc: "When your lead purchases a bid package (from €10)",
    guaranteed: "guaranteed",
    loginNow: "Login Now",
    loginDesc: "Log in to participate in the affiliate program.",
    login: "Login",
    referrals: "Referrals",
    converted: "Converted",
    pending: "Pending",
    paidOut: "Paid Out",
    currentTier: "Current Tier",
    leadsThisMonth: "Leads this month",
    yourRefLink: "Your Referral Link",
    copyLink: "Copy Link",
    copied: "Copied!",
    shareLinkDesc: "Share this link to recruit new users and earn commissions.",
    registerAsAffiliate: "Register as Affiliate",
    name: "Name",
    yourFullName: "Your full name",
    emailForNotifications: "Email for notifications",
    paymentMethod: "Payment Method",
    bankTransfer: "Bank Transfer",
    iban: "IBAN",
    paypalEmail: "PayPal Email",
    registering: "Registering...",
    becomeAffiliate: "Become an Affiliate",
    howItWorks: "How it works",
    step1Title: "Register",
    step1Desc: "Sign up as an affiliate and get your personal referral link.",
    step2Title: "Share",
    step2Desc: "Share your link on social media, your website or via email.",
    step3Title: "Earn",
    step3Desc: "Get €8+ for every lead that purchases a bid package!",
    successRegistered: "Successfully registered as affiliate!",
    registrationFailed: "Registration failed",
    linkCopied: "Link copied!"
  },
  sq: {
    title: "Filiale",
    titleHighlight: "Programi i Partneritetit",
    subtitle: "Fitoni para duke rekomanduar BidBlitz. Merrni deri në 9€ për çdo lead!",
    leadsPerMonth: "Lead/Muaj",
    perLead: "për lead",
    minPerLead: "Së paku 8€ për lead",
    minPerLeadDesc: "Kur lead-i juaj blen një paketë ofertash (nga 10€)",
    guaranteed: "i garantuar",
    loginNow: "Hyni Tani",
    loginDesc: "Hyni për të marrë pjesë në programin e partnerëve.",
    login: "Hyr",
    referrals: "Referime",
    converted: "Konvertuar",
    pending: "Në Pritje",
    paidOut: "Paguar",
    currentTier: "Niveli Aktual",
    leadsThisMonth: "Lead këtë muaj",
    yourRefLink: "Linku Juaj i Referimit",
    copyLink: "Kopjo Linkun",
    copied: "Kopjuar!",
    shareLinkDesc: "Ndani këtë link për të rekrutuar përdorues të rinj dhe fitoni komisione.",
    registerAsAffiliate: "Regjistrohu si Filial",
    name: "Emri",
    yourFullName: "Emri juaj i plotë",
    emailForNotifications: "Email për njoftime",
    paymentMethod: "Metoda e Pagesës",
    bankTransfer: "Transfertë Bankare",
    iban: "IBAN",
    paypalEmail: "Email PayPal",
    registering: "Duke u regjistruar...",
    becomeAffiliate: "Bëhu Filial",
    howItWorks: "Si funksionon",
    step1Title: "Regjistrohu",
    step1Desc: "Regjistrohu si filial dhe merr linkun tënd personal të referimit.",
    step2Title: "Ndaj",
    step2Desc: "Ndaj linkun tënd në rrjete sociale, faqen tënde ose me email.",
    step3Title: "Fito",
    step3Desc: "Merr 8€+ për çdo lead që blen një paketë ofertash!",
    successRegistered: "U regjistruat me sukses si filial!",
    registrationFailed: "Regjistrimi dështoi",
    linkCopied: "Linku u kopjua!"
  },
  tr: {
    title: "Ortaklık",
    titleHighlight: "Programı",
    subtitle: "BidBlitz'i tavsiye ederek para kazanın. Lead başına 9€'ya kadar kazanın!",
    leadsPerMonth: "Lead/Ay",
    perLead: "lead başına",
    minPerLead: "Lead başına en az 8€",
    minPerLeadDesc: "Lead'iniz bir teklif paketi satın aldığında (10€'dan)",
    guaranteed: "garantili",
    loginNow: "Şimdi Giriş Yapın",
    loginDesc: "Ortaklık programına katılmak için giriş yapın.",
    login: "Giriş",
    referrals: "Yönlendirmeler",
    converted: "Dönüştürülen",
    pending: "Beklemede",
    paidOut: "Ödenen",
    currentTier: "Mevcut Seviye",
    leadsThisMonth: "Bu ay lead",
    yourRefLink: "Yönlendirme Linkiniz",
    copyLink: "Linki Kopyala",
    copied: "Kopyalandı!",
    shareLinkDesc: "Yeni kullanıcılar kazanmak ve komisyon almak için bu linki paylaşın.",
    registerAsAffiliate: "Ortak Olarak Kaydol",
    name: "İsim",
    yourFullName: "Tam adınız",
    emailForNotifications: "Bildirim e-postası",
    paymentMethod: "Ödeme Yöntemi",
    bankTransfer: "Banka Transferi",
    iban: "IBAN",
    paypalEmail: "PayPal E-postası",
    registering: "Kaydediliyor...",
    becomeAffiliate: "Ortak Ol",
    howItWorks: "Nasıl Çalışır",
    step1Title: "Kayıt Ol",
    step1Desc: "Ortak olarak kaydolun ve kişisel yönlendirme linkinizi alın.",
    step2Title: "Paylaş",
    step2Desc: "Linkinizi sosyal medyada, web sitenizde veya e-posta ile paylaşın.",
    step3Title: "Kazan",
    step3Desc: "Teklif paketi satın alan her lead için 8€+ kazanın!",
    successRegistered: "Başarıyla ortak olarak kaydoldunuz!",
    registrationFailed: "Kayıt başarısız",
    linkCopied: "Link kopyalandı!"
  },
  fr: {
    title: "Programme",
    titleHighlight: "d'Affiliation",
    subtitle: "Gagnez de l'argent en recommandant BidBlitz. Obtenez jusqu'à 9€ par lead!",
    leadsPerMonth: "Leads/Mois",
    perLead: "par lead",
    minPerLead: "Au moins 8€ par lead",
    minPerLeadDesc: "Quand votre lead achète un forfait d'enchères (à partir de 10€)",
    guaranteed: "garanti",
    loginNow: "Connectez-vous",
    loginDesc: "Connectez-vous pour participer au programme d'affiliation.",
    login: "Connexion",
    referrals: "Références",
    converted: "Convertis",
    pending: "En Attente",
    paidOut: "Payé",
    currentTier: "Niveau Actuel",
    leadsThisMonth: "Leads ce mois",
    yourRefLink: "Votre Lien de Parrainage",
    copyLink: "Copier le Lien",
    copied: "Copié!",
    shareLinkDesc: "Partagez ce lien pour recruter de nouveaux utilisateurs et gagner des commissions.",
    registerAsAffiliate: "S'inscrire comme Affilié",
    name: "Nom",
    yourFullName: "Votre nom complet",
    emailForNotifications: "Email pour notifications",
    paymentMethod: "Méthode de Paiement",
    bankTransfer: "Virement Bancaire",
    iban: "IBAN",
    paypalEmail: "Email PayPal",
    registering: "Inscription...",
    becomeAffiliate: "Devenir Affilié",
    howItWorks: "Comment ça marche",
    step1Title: "S'inscrire",
    step1Desc: "Inscrivez-vous comme affilié et obtenez votre lien de parrainage personnel.",
    step2Title: "Partager",
    step2Desc: "Partagez votre lien sur les réseaux sociaux, votre site web ou par email.",
    step3Title: "Gagner",
    step3Desc: "Obtenez 8€+ pour chaque lead qui achète un forfait d'enchères!",
    successRegistered: "Inscription comme affilié réussie!",
    registrationFailed: "Échec de l'inscription",
    linkCopied: "Lien copié!"
  }
};

export default function Affiliate() {
  const { isAuthenticated, token } = useAuth();
  const { language , mappedLanguage } = useLanguage();
  // Use mappedLanguage for regional variants (e.g., xk -> sq)
  const langKey = mappedLanguage || language;
  const texts = affiliateTexts[langKey] || affiliateTexts.de;
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
      toast.success(texts.successRegistered);
      setAffiliateData(response.data.affiliate);
      fetchAffiliateData();
    } catch (error) {
      toast.error(error.response?.data?.detail || texts.registrationFailed);
    } finally {
      setRegistering(false);
    }
  };

  const copyLink = async () => {
    const link = `https://bidblitz.de/register?ref=${affiliateData?.affiliate?.referral_code}`;
    const success = await safeCopyToClipboard(link);
    if (success) {
      setCopied(true);
      toast.success(texts.linkCopied);
      setTimeout(() => setCopied(false), 2000);
    }
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
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
            {texts.title} <span className="text-[#FFD700]">{texts.titleHighlight}</span>
          </h1>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            {texts.subtitle}
          </p>
        </div>

        {/* Commission Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {commissionTiers.map((tier, index) => (
            <div key={index} className="glass-card p-6 rounded-xl text-center">
              <p className="text-gray-500 text-sm mb-2">{tier.leads} {texts.leadsPerMonth}</p>
              <p className="text-3xl font-bold text-[#FFD700]">{tier.commission}</p>
              <p className="text-gray-800 text-sm mt-1">{texts.perLead}</p>
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
                <h3 className="text-xl font-bold text-gray-800">{texts.minPerLead}</h3>
                <p className="text-gray-500">{texts.minPerLeadDesc}</p>
              </div>
            </div>
            <div className="text-center md:text-right">
              <p className="text-4xl font-bold text-[#10B981]">€8+</p>
              <p className="text-gray-500 text-sm">{texts.guaranteed}</p>
            </div>
          </div>
        </div>

        {!isAuthenticated ? (
          // Not logged in
          <div className="glass-card p-8 rounded-xl text-center">
            <h2 className="text-xl font-bold text-gray-800 mb-4">{texts.loginNow}</h2>
            <p className="text-gray-500 mb-6">{texts.loginDesc}</p>
            <Button className="btn-primary" onClick={() => window.location.href = '/login'}>
              {texts.login} <ArrowRight className="w-4 h-4 ml-2" />
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
                    <p className="text-gray-500 text-sm">{texts.referrals}</p>
                    <p className="text-2xl font-bold text-gray-800">{affiliateData.affiliate.total_referrals}</p>
                  </div>
                </div>
              </div>
              <div className="glass-card p-6 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#10B981]/20 flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-[#10B981]" />
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">{texts.converted}</p>
                    <p className="text-2xl font-bold text-gray-800">{affiliateData.affiliate.converted_leads}</p>
                  </div>
                </div>
              </div>
              <div className="glass-card p-6 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#FFD700]/20 flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-[#FFD700]" />
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">{texts.pending}</p>
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
                    <p className="text-gray-500 text-sm">{texts.paidOut}</p>
                    <p className="text-2xl font-bold text-gray-800">€{affiliateData.affiliate.paid_commission.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Current Tier */}
            <div className="glass-card p-6 rounded-xl">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-800">{texts.currentTier}</h3>
                  <p className="text-gray-500">{affiliateData.leads_this_month} {texts.leadsThisMonth}</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-[#FFD700]">€{affiliateData.commission_rate.toFixed(2)}</p>
                  <p className="text-gray-500 text-sm">{texts.perLead}</p>
                </div>
              </div>
            </div>

            {/* Referral Link */}
            <div className="glass-card p-6 rounded-xl">
              <h3 className="text-lg font-bold text-gray-800 mb-4">{texts.yourRefLink}</h3>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 p-4 rounded-lg bg-white border border-gray-200">
                  <code className="text-[#06B6D4] text-sm break-all">
                    https://bidblitz.de/register?ref={affiliateData.affiliate.referral_code}
                  </code>
                </div>
                <Button onClick={copyLink} className="btn-primary whitespace-nowrap">
                  {copied ? <CheckCircle className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                  {copied ? texts.copied : texts.copyLink}
                </Button>
              </div>
              <p className="text-gray-500 text-sm mt-4">
                {texts.shareLinkDesc}
              </p>
            </div>
          </div>
        ) : (
          // Registration Form
          <div className="glass-card p-8 rounded-xl max-w-xl mx-auto">
            <h2 className="text-xl font-bold text-gray-800 mb-6">{texts.registerAsAffiliate}</h2>
            <form onSubmit={handleRegister} className="space-y-6">
              <div className="space-y-2">
                <Label className="text-gray-800">{texts.name}</Label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder={texts.yourFullName}
                  className="bg-white border-gray-200 text-gray-800"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-800">{texts.emailForNotifications}</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  placeholder="affiliate@example.com"
                  className="bg-white border-gray-200 text-gray-800"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-800">{texts.paymentMethod}</Label>
                <Select 
                  value={formData.payment_method} 
                  onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                >
                  <SelectTrigger className="bg-white border-gray-200 text-gray-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200">
                    <SelectItem value="bank_transfer" className="text-gray-800 hover:bg-white/10">{texts.bankTransfer}</SelectItem>
                    <SelectItem value="paypal" className="text-gray-800 hover:bg-white/10">PayPal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-800">
                  {formData.payment_method === 'bank_transfer' ? texts.iban : texts.paypalEmail}
                </Label>
                <Input
                  type="text"
                  value={formData.payment_details}
                  onChange={(e) => setFormData({ ...formData, payment_details: e.target.value })}
                  required
                  placeholder={formData.payment_method === 'bank_transfer' ? 'DE89 3704 0044 0532 0130 00' : 'paypal@example.com'}
                  className="bg-white border-gray-200 text-gray-800"
                />
              </div>
              <Button type="submit" disabled={registering} className="btn-primary w-full">
                {registering ? texts.registering : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    {texts.becomeAffiliate}
                  </>
                )}
              </Button>
            </form>
          </div>
        )}

        {/* How it works */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-gray-800 text-center mb-8">{texts.howItWorks}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card p-6 rounded-xl text-center">
              <div className="w-12 h-12 rounded-full bg-[#7C3AED]/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-[#7C3AED]">1</span>
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">{texts.step1Title}</h3>
              <p className="text-gray-500">{texts.step1Desc}</p>
            </div>
            <div className="glass-card p-6 rounded-xl text-center">
              <div className="w-12 h-12 rounded-full bg-[#FFD700]/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-[#FFD700]">2</span>
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">{texts.step2Title}</h3>
              <p className="text-gray-500">{texts.step2Desc}</p>
            </div>
            <div className="glass-card p-6 rounded-xl text-center">
              <div className="w-12 h-12 rounded-full bg-[#10B981]/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-[#10B981]">3</span>
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">{texts.step3Title}</h3>
              <p className="text-gray-500">{texts.step3Desc}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
