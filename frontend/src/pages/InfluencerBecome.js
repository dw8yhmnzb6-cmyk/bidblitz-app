import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { 
  Star, TrendingUp, Users, DollarSign, Gift, Check, 
  Instagram, Youtube, Zap, Award, Target, ArrowRight,
  Sparkles, Crown, Heart, Camera, MessageCircle
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Translations
const translations = {
  de: {
    badge: "Influencer-Programm",
    heroTitle: "Werden Sie",
    heroTitleHighlight: "BidBlitz Partner",
    heroDesc: "Verdienen Sie Geld mit Ihrer Reichweite! Werden Sie Teil unseres Influencer-Programms und erhalten Sie bis zu",
    commission: "15% Provision",
    heroDescEnd: "auf alle Käufe Ihrer Follower.",
    applyNow: "Jetzt bewerben",
    alreadyPartner: "Bereits Partner? Einloggen",
    maxCommission: "Max. Provision",
    activePartners: "Aktive Partner",
    paidOut: "Ausgezahlt",
    activation: "Freischaltung",
    benefitsTitle: "Ihre Vorteile als Partner",
    benefit1Title: "Bis zu 15% Provision",
    benefit1Desc: "Verdienen Sie an jedem Kauf Ihrer Follower",
    benefit2Title: "Exklusive Rabatte",
    benefit2Desc: "Bieten Sie Ihren Followern 5-10% Rabatt",
    benefit3Title: "Gratis Gebote",
    benefit3Desc: "Monatliche Gratis-Gebote zum Testen",
    benefit4Title: "VIP-Status",
    benefit4Desc: "Zugang zu exklusiven VIP-Auktionen",
    benefit5Title: "Eigenes Dashboard",
    benefit5Desc: "Echtzeit-Tracking Ihrer Einnahmen",
    benefit6Title: "Bonus-Programm",
    benefit6Desc: "Extra Boni bei Erreichen von Zielen",
    howItWorks: "So funktioniert's",
    step1Title: "Bewerben",
    step1Desc: "Füllen Sie das Formular aus",
    step2Title: "Freischaltung",
    step2Desc: "Wir prüfen und aktivieren Ihren Account",
    step3Title: "Teilen",
    step3Desc: "Promoten Sie BidBlitz bei Ihren Followern",
    step4Title: "Verdienen",
    step4Desc: "Erhalten Sie Provision für jeden Kauf",
    becomePartner: "Partner werden",
    name: "Name",
    email: "E-Mail",
    instagram: "Instagram",
    youtube: "YouTube",
    tiktok: "TikTok",
    followers: "Follower-Anzahl (gesamt)",
    followersPlaceholder: "z.B. 10.000",
    message: "Nachricht (optional)",
    messagePlaceholder: "Erzählen Sie uns mehr über sich...",
    submit: "Bewerbung absenden",
    submitting: "Wird gesendet...",
    successTitle: "Bewerbung erhalten!",
    successDesc: "Vielen Dank für Ihr Interesse! Wir werden Ihre Bewerbung prüfen und uns innerhalb von 24-48 Stunden bei Ihnen melden.",
    backToHome: "Zur Startseite",
    yourName: "Ihr Name",
    yourEmail: "ihre@email.de",
    username: "@username",
    channel: "Channel",
    applicationSuccess: "Bewerbung erfolgreich gesendet!",
    applicationError: "Fehler beim Senden"
  },
  en: {
    badge: "Influencer Program",
    heroTitle: "Become a",
    heroTitleHighlight: "BidBlitz Partner",
    heroDesc: "Earn money with your reach! Join our influencer program and receive up to",
    commission: "15% Commission",
    heroDescEnd: "on all purchases from your followers.",
    applyNow: "Apply Now",
    alreadyPartner: "Already a partner? Login",
    maxCommission: "Max. Commission",
    activePartners: "Active Partners",
    paidOut: "Paid Out",
    activation: "Activation",
    benefitsTitle: "Your Benefits as Partner",
    benefit1Title: "Up to 15% Commission",
    benefit1Desc: "Earn on every purchase from your followers",
    benefit2Title: "Exclusive Discounts",
    benefit2Desc: "Offer your followers 5-10% discount",
    benefit3Title: "Free Bids",
    benefit3Desc: "Monthly free bids for testing",
    benefit4Title: "VIP Status",
    benefit4Desc: "Access to exclusive VIP auctions",
    benefit5Title: "Personal Dashboard",
    benefit5Desc: "Real-time tracking of your earnings",
    benefit6Title: "Bonus Program",
    benefit6Desc: "Extra bonuses when reaching goals",
    howItWorks: "How it Works",
    step1Title: "Apply",
    step1Desc: "Fill out the form",
    step2Title: "Activation",
    step2Desc: "We review and activate your account",
    step3Title: "Share",
    step3Desc: "Promote BidBlitz to your followers",
    step4Title: "Earn",
    step4Desc: "Receive commission for every purchase",
    becomePartner: "Become Partner",
    name: "Name",
    email: "Email",
    instagram: "Instagram",
    youtube: "YouTube",
    tiktok: "TikTok",
    followers: "Total Followers",
    followersPlaceholder: "e.g. 10,000",
    message: "Message (optional)",
    messagePlaceholder: "Tell us more about yourself...",
    submit: "Submit Application",
    submitting: "Submitting...",
    successTitle: "Application Received!",
    successDesc: "Thank you for your interest! We will review your application and contact you within 24-48 hours.",
    backToHome: "Back to Home",
    yourName: "Your name",
    yourEmail: "your@email.com",
    username: "@username",
    channel: "Channel",
    applicationSuccess: "Application sent successfully!",
    applicationError: "Error submitting"
  },
  tr: {
    badge: "Influencer Programı",
    heroTitle: "Olun",
    heroTitleHighlight: "BidBlitz Ortağı",
    heroDesc: "Erişiminizle para kazanın! Influencer programımıza katılın ve takipçilerinizin tüm alışverişlerinden",
    commission: "%15 Komisyon",
    heroDescEnd: "alın.",
    applyNow: "Şimdi Başvur",
    alreadyPartner: "Zaten ortak mısınız? Giriş yapın",
    maxCommission: "Maks. Komisyon",
    activePartners: "Aktif Ortaklar",
    paidOut: "Ödenen",
    activation: "Aktivasyon",
    benefitsTitle: "Ortak Olarak Avantajlarınız",
    benefit1Title: "%15'e Kadar Komisyon",
    benefit1Desc: "Takipçilerinizin her alışverişinden kazanın",
    benefit2Title: "Özel İndirimler",
    benefit2Desc: "Takipçilerinize %5-10 indirim sunun",
    benefit3Title: "Ücretsiz Teklifler",
    benefit3Desc: "Test için aylık ücretsiz teklifler",
    benefit4Title: "VIP Statüsü",
    benefit4Desc: "Özel VIP müzayedelerine erişim",
    benefit5Title: "Kişisel Panel",
    benefit5Desc: "Kazançlarınızın gerçek zamanlı takibi",
    benefit6Title: "Bonus Programı",
    benefit6Desc: "Hedeflere ulaşınca ekstra bonuslar",
    howItWorks: "Nasıl Çalışır",
    step1Title: "Başvur",
    step1Desc: "Formu doldurun",
    step2Title: "Aktivasyon",
    step2Desc: "Başvurunuzu inceleyip hesabınızı aktif ediyoruz",
    step3Title: "Paylaş",
    step3Desc: "BidBlitz'i takipçilerinize tanıtın",
    step4Title: "Kazan",
    step4Desc: "Her alışverişten komisyon alın",
    becomePartner: "Ortak Ol",
    name: "İsim",
    email: "E-posta",
    instagram: "Instagram",
    youtube: "YouTube",
    tiktok: "TikTok",
    followers: "Toplam Takipçi",
    followersPlaceholder: "örn. 10.000",
    message: "Mesaj (isteğe bağlı)",
    messagePlaceholder: "Kendinizden bahsedin...",
    submit: "Başvuruyu Gönder",
    submitting: "Gönderiliyor...",
    successTitle: "Başvuru Alındı!",
    successDesc: "İlginiz için teşekkürler! Başvurunuzu inceleyip 24-48 saat içinde sizinle iletişime geçeceğiz.",
    backToHome: "Ana Sayfaya Dön",
    yourName: "Adınız",
    yourEmail: "email@adresiniz.com",
    username: "@kullanıcıadı",
    channel: "Kanal",
    applicationSuccess: "Başvuru başarıyla gönderildi!",
    applicationError: "Gönderme hatası"
  },
  fr: {
    badge: "Programme Influenceur",
    heroTitle: "Devenez",
    heroTitleHighlight: "Partenaire BidBlitz",
    heroDesc: "Gagnez de l'argent avec votre portée! Rejoignez notre programme influenceur et recevez jusqu'à",
    commission: "15% de Commission",
    heroDescEnd: "sur tous les achats de vos abonnés.",
    applyNow: "Postuler Maintenant",
    alreadyPartner: "Déjà partenaire? Connexion",
    maxCommission: "Commission Max.",
    activePartners: "Partenaires Actifs",
    paidOut: "Payé",
    activation: "Activation",
    benefitsTitle: "Vos Avantages en tant que Partenaire",
    benefit1Title: "Jusqu'à 15% de Commission",
    benefit1Desc: "Gagnez sur chaque achat de vos abonnés",
    benefit2Title: "Réductions Exclusives",
    benefit2Desc: "Offrez 5-10% de réduction à vos abonnés",
    benefit3Title: "Enchères Gratuites",
    benefit3Desc: "Enchères gratuites mensuelles pour tester",
    benefit4Title: "Statut VIP",
    benefit4Desc: "Accès aux enchères VIP exclusives",
    benefit5Title: "Tableau de Bord Personnel",
    benefit5Desc: "Suivi en temps réel de vos gains",
    benefit6Title: "Programme de Bonus",
    benefit6Desc: "Bonus supplémentaires en atteignant les objectifs",
    howItWorks: "Comment ça Marche",
    step1Title: "Postuler",
    step1Desc: "Remplissez le formulaire",
    step2Title: "Activation",
    step2Desc: "Nous examinons et activons votre compte",
    step3Title: "Partager",
    step3Desc: "Promouvez BidBlitz auprès de vos abonnés",
    step4Title: "Gagner",
    step4Desc: "Recevez une commission pour chaque achat",
    becomePartner: "Devenir Partenaire",
    name: "Nom",
    email: "Email",
    instagram: "Instagram",
    youtube: "YouTube",
    tiktok: "TikTok",
    followers: "Nombre Total d'Abonnés",
    followersPlaceholder: "ex. 10 000",
    message: "Message (optionnel)",
    messagePlaceholder: "Parlez-nous de vous...",
    submit: "Envoyer la Candidature",
    submitting: "Envoi en cours...",
    successTitle: "Candidature Reçue!",
    successDesc: "Merci pour votre intérêt! Nous examinerons votre candidature et vous contacterons dans les 24-48 heures.",
    backToHome: "Retour à l'Accueil",
    yourName: "Votre nom",
    yourEmail: "votre@email.com",
    username: "@utilisateur",
    channel: "Chaîne",
    applicationSuccess: "Candidature envoyée avec succès!",
    applicationError: "Erreur lors de l'envoi"
  },
  sq: {
    badge: "Programi i Influencerëve",
    heroTitle: "Bëhuni",
    heroTitleHighlight: "Partner i BidBlitz",
    heroDesc: "Fitoni para me shtrirjen tuaj! Bashkohuni me programin tonë të influencerëve dhe merrni deri në",
    commission: "15% Komision",
    heroDescEnd: "për të gjitha blerjet e ndjekësve tuaj.",
    applyNow: "Apliko Tani",
    alreadyPartner: "Tashmë partner? Hyni",
    maxCommission: "Komisioni Maks.",
    activePartners: "Partnerë Aktivë",
    paidOut: "E Paguar",
    activation: "Aktivizimi",
    benefitsTitle: "Përfitimet Tuaja si Partner",
    benefit1Title: "Deri në 15% Komision",
    benefit1Desc: "Fitoni nga çdo blerje e ndjekësve tuaj",
    benefit2Title: "Zbritje Ekskluzive",
    benefit2Desc: "Ofroni ndjekësve tuaj 5-10% zbritje",
    benefit3Title: "Oferta Falas",
    benefit3Desc: "Oferta mujore falas për testim",
    benefit4Title: "Statusi VIP",
    benefit4Desc: "Qasje në ankandet ekskluzive VIP",
    benefit5Title: "Paneli Personal",
    benefit5Desc: "Ndjekje në kohë reale e fitimeve",
    benefit6Title: "Programi i Bonusit",
    benefit6Desc: "Bonuse shtesë kur arrini objektivat",
    howItWorks: "Si Funksionon",
    step1Title: "Apliko",
    step1Desc: "Plotësoni formularin",
    step2Title: "Aktivizimi",
    step2Desc: "Ne shqyrtojmë dhe aktivizojmë llogarinë tuaj",
    step3Title: "Ndaj",
    step3Desc: "Promovoni BidBlitz tek ndjekësit tuaj",
    step4Title: "Fito",
    step4Desc: "Merrni komision për çdo blerje",
    becomePartner: "Bëhu Partner",
    name: "Emri",
    email: "Email",
    instagram: "Instagram",
    youtube: "YouTube",
    tiktok: "TikTok",
    followers: "Numri Total i Ndjekësve",
    followersPlaceholder: "p.sh. 10,000",
    message: "Mesazh (opsional)",
    messagePlaceholder: "Na tregoni më shumë për veten...",
    submit: "Dërgo Aplikimin",
    submitting: "Duke dërguar...",
    successTitle: "Aplikimi u Mor!",
    successDesc: "Faleminderit për interesin tuaj! Ne do të shqyrtojmë aplikimin tuaj dhe do t'ju kontaktojmë brenda 24-48 orëve.",
    backToHome: "Kthehu në Ballina",
    yourName: "Emri juaj",
    yourEmail: "email@juaj.com",
    username: "@përdoruesi",
    channel: "Kanali",
    applicationSuccess: "Aplikimi u dërgua me sukses!",
    applicationError: "Gabim gjatë dërgimit"
  }
};

export default function InfluencerBecome() {
  const { language } = useLanguage();
  const t = translations[language] || translations.de;
  
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  const [form, setForm] = useState({
    name: '',
    email: '',
    instagram: '',
    youtube: '',
    tiktok: '',
    followers: '',
    message: ''
  });
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await axios.post(`${API}/influencer/apply`, form);
      setSubmitted(true);
      toast.success(t.applicationSuccess);
    } catch (error) {
      toast.error(error.response?.data?.detail || t.applicationError);
    } finally {
      setLoading(false);
    }
  };
  
  const benefits = [
    { icon: <DollarSign className="w-6 h-6" />, title: t.benefit1Title, desc: t.benefit1Desc },
    { icon: <Gift className="w-6 h-6" />, title: t.benefit2Title, desc: t.benefit2Desc },
    { icon: <Zap className="w-6 h-6" />, title: t.benefit3Title, desc: t.benefit3Desc },
    { icon: <Crown className="w-6 h-6" />, title: t.benefit4Title, desc: t.benefit4Desc },
    { icon: <Target className="w-6 h-6" />, title: t.benefit5Title, desc: t.benefit5Desc },
    { icon: <Award className="w-6 h-6" />, title: t.benefit6Title, desc: t.benefit6Desc }
  ];
  
  const steps = [
    { num: '1', title: t.step1Title, desc: t.step1Desc },
    { num: '2', title: t.step2Title, desc: t.step2Desc },
    { num: '3', title: t.step3Title, desc: t.step3Desc },
    { num: '4', title: t.step4Title, desc: t.step4Desc }
  ];
  
  if (submitted) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mx-auto mb-6">
            <Check className="w-12 h-12 text-gray-800" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-4">{t.successTitle}</h1>
          <p className="text-gray-500 mb-6">{t.successDesc}</p>
          <Link to="/">
            <Button className="bg-gradient-to-r from-cyan-500 to-cyan-600">
              {t.backToHome}
            </Button>
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen pt-20 pb-12" data-testid="influencer-become">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 px-4">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/20 via-amber-500/10 to-transparent" />
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-yellow-400/20 text-yellow-400 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Star className="w-4 h-4" />
            {t.badge}
          </div>
          
          <h1 className="text-4xl md:text-5xl font-black text-gray-800 mb-6">
            {t.heroTitle} <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-500">{t.heroTitleHighlight}</span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            {t.heroDesc} <span className="text-yellow-400 font-bold">{t.commission}</span> {t.heroDescEnd}
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={() => setShowForm(true)}
              className="bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-black font-bold px-8 py-3"
            >
              <Star className="w-5 h-5 mr-2" />
              {t.applyNow}
            </Button>
            <Link to="/influencer-login">
              <Button variant="outline" className="border-white/30 text-gray-800 hover:bg-white/10 px-8 py-3">
                {t.alreadyPartner}
              </Button>
            </Link>
          </div>
        </div>
      </section>
      
      {/* Stats */}
      <section className="py-12 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card rounded-xl p-5 text-center">
            <p className="text-3xl font-black text-yellow-400">15%</p>
            <p className="text-gray-500 text-sm">{t.maxCommission}</p>
          </div>
          <div className="glass-card rounded-xl p-5 text-center">
            <p className="text-3xl font-black text-cyan-400">50+</p>
            <p className="text-gray-500 text-sm">{t.activePartners}</p>
          </div>
          <div className="glass-card rounded-xl p-5 text-center">
            <p className="text-3xl font-black text-green-400">€10K+</p>
            <p className="text-gray-500 text-sm">{t.paidOut}</p>
          </div>
          <div className="glass-card rounded-xl p-5 text-center">
            <p className="text-3xl font-black text-purple-400">24h</p>
            <p className="text-gray-500 text-sm">{t.activation}</p>
          </div>
        </div>
      </section>
      
      {/* Benefits */}
      <section className="py-16 px-4 bg-gradient-to-b from-cyan-50 to-cyan-100/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-800 text-center mb-12">
            {t.benefitsTitle}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((benefit, index) => (
              <div key={index} className="glass-card rounded-xl p-6 hover:border-yellow-400/30 transition-colors">
                <div className="w-12 h-12 rounded-lg bg-yellow-400/20 flex items-center justify-center text-yellow-400 mb-4">
                  {benefit.icon}
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">{benefit.title}</h3>
                <p className="text-gray-500">{benefit.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* How it works */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-800 text-center mb-12">
            {t.howItWorks}
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {steps.map((step, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-2xl font-black text-black mx-auto mb-4">
                  {step.num}
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-1">{step.title}</h3>
                <p className="text-gray-500 text-sm">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Application Form */}
      {showForm && (
        <section id="apply" className="py-16 px-4">
          <div className="max-w-xl mx-auto">
            <div className="glass-card rounded-2xl p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <Star className="w-6 h-6 text-yellow-400" />
                {t.becomePartner}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-800">{t.name} *</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({...form, name: e.target.value})}
                      placeholder={t.yourName}
                      className="bg-white border-gray-200 text-gray-800"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-gray-800">{t.email} *</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({...form, email: e.target.value})}
                      placeholder={t.yourEmail}
                      className="bg-white border-gray-200 text-gray-800"
                      required
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-gray-800 flex items-center gap-1">
                      <Instagram className="w-4 h-4" /> {t.instagram}
                    </Label>
                    <Input
                      value={form.instagram}
                      onChange={(e) => setForm({...form, instagram: e.target.value})}
                      placeholder={t.username}
                      className="bg-white border-gray-200 text-gray-800"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-800 flex items-center gap-1">
                      <Youtube className="w-4 h-4" /> {t.youtube}
                    </Label>
                    <Input
                      value={form.youtube}
                      onChange={(e) => setForm({...form, youtube: e.target.value})}
                      placeholder={t.channel}
                      className="bg-white border-gray-200 text-gray-800"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-800">{t.tiktok}</Label>
                    <Input
                      value={form.tiktok}
                      onChange={(e) => setForm({...form, tiktok: e.target.value})}
                      placeholder={t.username}
                      className="bg-white border-gray-200 text-gray-800"
                    />
                  </div>
                </div>
                
                <div>
                  <Label className="text-gray-800">{t.followers} *</Label>
                  <Input
                    value={form.followers}
                    onChange={(e) => setForm({...form, followers: e.target.value})}
                    placeholder={t.followersPlaceholder}
                    className="bg-white border-gray-200 text-gray-800"
                    required
                  />
                </div>
                
                <div>
                  <Label className="text-gray-800">{t.message}</Label>
                  <textarea
                    value={form.message}
                    onChange={(e) => setForm({...form, message: e.target.value})}
                    placeholder={t.messagePlaceholder}
                    className="w-full bg-white border border-gray-200 text-gray-800 rounded-md p-3 h-24 resize-none"
                  />
                </div>
                
                <Button
                  type="submit"
                  disabled={loading || !form.name || !form.email || !form.followers}
                  className="w-full py-3 bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-black font-bold"
                >
                  {loading ? t.submitting : t.submit}
                </Button>
              </form>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
