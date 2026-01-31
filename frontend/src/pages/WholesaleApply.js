import { useState } from 'react';
import { Building2, Phone, Mail, Globe, Package, MessageSquare, CheckCircle, ArrowRight, Percent, Users, CreditCard, HeadphonesIcon } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import { Link } from 'react-router-dom';

const API = process.env.REACT_APP_BACKEND_URL;

export default function WholesaleApply() {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    website: '',
    expected_volume: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Get translations with fallbacks for all languages
  const wholesaleTranslations = {
    de: {
      badge: "B2B Großkundenbereich",
      title: "Werden Sie Großkunde",
      subtitle: "Profitieren Sie von exklusiven Rabatten, persönlicher Betreuung und flexiblen Zahlungsbedingungen für Ihr Unternehmen.",
      benefits: "Ihre Vorteile als Großkunde",
      benefit1Title: "Exklusive Rabatte",
      benefit1Desc: "Bis zu 40% Rabatt auf alle Gebotspakete",
      benefit2Title: "Persönlicher Account Manager",
      benefit2Desc: "Direkter Ansprechpartner für alle Ihre Anliegen",
      benefit3Title: "Flexible Zahlung",
      benefit3Desc: "Kauf auf Rechnung mit 30 Tagen Zahlungsziel",
      benefit4Title: "Prioritäts-Support",
      benefit4Desc: "Bevorzugte Bearbeitung aller Anfragen",
      formTitle: "Bewerbungsformular",
      companyName: "Firmenname",
      contactPerson: "Ansprechpartner",
      email: "E-Mail",
      phone: "Telefon",
      website: "Website (optional)",
      expectedVolume: "Erwartetes monatliches Volumen",
      selectVolume: "Bitte wählen",
      volume1: "1.000 - 5.000 Gebote",
      volume2: "5.000 - 10.000 Gebote",
      volume3: "10.000 - 50.000 Gebote",
      volume4: "Über 50.000 Gebote",
      message: "Nachricht (optional)",
      messagePlaceholder: "Erzählen Sie uns mehr über Ihr Unternehmen...",
      submitApplication: "Bewerbung absenden",
      submitting: "Wird gesendet...",
      successTitle: "Bewerbung eingereicht!",
      successMessage: "Vielen Dank für Ihre Bewerbung. Unser Team wird Ihre Anfrage innerhalb von 24-48 Stunden prüfen.",
      backToHome: "Zurück zur Startseite",
      fillAllFields: "Bitte füllen Sie alle Pflichtfelder aus",
      submitError: "Fehler beim Einreichen"
    },
    en: {
      badge: "B2B Wholesale Area",
      title: "Become a Wholesale Customer",
      subtitle: "Benefit from exclusive discounts, personal support and flexible payment terms for your business.",
      benefits: "Your Benefits as a Wholesale Customer",
      benefit1Title: "Exclusive Discounts",
      benefit1Desc: "Up to 40% discount on all bid packages",
      benefit2Title: "Personal Account Manager",
      benefit2Desc: "Direct contact person for all your needs",
      benefit3Title: "Flexible Payment",
      benefit3Desc: "Purchase on invoice with 30 days payment terms",
      benefit4Title: "Priority Support",
      benefit4Desc: "Preferred handling of all requests",
      formTitle: "Application Form",
      companyName: "Company Name",
      contactPerson: "Contact Person",
      email: "Email",
      phone: "Phone",
      website: "Website (optional)",
      expectedVolume: "Expected Monthly Volume",
      selectVolume: "Please select",
      volume1: "1,000 - 5,000 bids",
      volume2: "5,000 - 10,000 bids",
      volume3: "10,000 - 50,000 bids",
      volume4: "Over 50,000 bids",
      message: "Message (optional)",
      messagePlaceholder: "Tell us more about your company...",
      submitApplication: "Submit Application",
      submitting: "Submitting...",
      successTitle: "Application Submitted!",
      successMessage: "Thank you for your application. Our team will review your request within 24-48 hours.",
      backToHome: "Back to Homepage",
      fillAllFields: "Please fill in all required fields",
      submitError: "Error submitting application"
    },
    sq: {
      badge: "Zonë B2B Shumicë",
      title: "Bëhuni Klient Shumice",
      subtitle: "Përfitoni nga zbritjet ekskluzive, mbështetja personale dhe kushtet fleksibël të pagesës për biznesin tuaj.",
      benefits: "Përfitimet Tuaja si Klient Shumice",
      benefit1Title: "Zbritje Ekskluzive",
      benefit1Desc: "Deri në 40% zbritje në të gjitha paketat e ofertave",
      benefit2Title: "Menaxher Personal i Llogarisë",
      benefit2Desc: "Person kontakti direkt për të gjitha nevojat tuaja",
      benefit3Title: "Pagesa Fleksibël",
      benefit3Desc: "Blerje me faturë me 30 ditë afat pagese",
      benefit4Title: "Mbështetje Prioritare",
      benefit4Desc: "Trajtim i preferuar i të gjitha kërkesave",
      formTitle: "Formulari i Aplikimit",
      companyName: "Emri i Kompanisë",
      contactPerson: "Personi i Kontaktit",
      email: "Email",
      phone: "Telefon",
      website: "Website (opsionale)",
      expectedVolume: "Vëllimi i Pritur Mujor",
      selectVolume: "Ju lutem zgjidhni",
      volume1: "1,000 - 5,000 oferta",
      volume2: "5,000 - 10,000 oferta",
      volume3: "10,000 - 50,000 oferta",
      volume4: "Mbi 50,000 oferta",
      message: "Mesazh (opsionale)",
      messagePlaceholder: "Na tregoni më shumë për kompaninë tuaj...",
      submitApplication: "Dërgo Aplikimin",
      submitting: "Duke dërguar...",
      successTitle: "Aplikimi u Dorëzua!",
      successMessage: "Faleminderit për aplikimin tuaj. Ekipi ynë do të shqyrtojë kërkesën tuaj brenda 24-48 orëve.",
      backToHome: "Kthehu në Faqen Kryesore",
      fillAllFields: "Ju lutem plotësoni të gjitha fushat e detyrueshme",
      submitError: "Gabim gjatë dorëzimit"
    }
  };
  
  const wt = t('wholesale') || wholesaleTranslations[language] || wholesaleTranslations.en;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.company_name || !formData.contact_name || !formData.email || !formData.phone || !formData.expected_volume) {
      toast.error(wt.fillAllFields || 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/api/wholesale/apply`, formData);
      setSubmitted(true);
      toast.success(wt.successTitle || 'Application submitted!');
    } catch (error) {
      toast.error(error.response?.data?.detail || wt.submitError || 'Error submitting');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#050509] py-20 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">{wt.successTitle || 'Application Submitted!'}</h1>
          <p className="text-gray-400 mb-8">
            {wt.successMessage || 'Thank you for your application. Our team will review your request within 24-48 hours and contact you.'}
          </p>
          <Link to="/">
            <Button className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white">
              {wt.backToHome || 'Back to Homepage'}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050509] py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 mb-6">
            <Building2 className="w-5 h-5 text-cyan-400" />
            <span className="text-cyan-400 font-medium">{wt.badge || 'B2B Wholesale Area'}</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">{wt.title || 'Become a Wholesale Customer'}</h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            {wt.subtitle || 'Benefit from exclusive discounts, personal support and flexible payment terms for your business.'}
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Benefits Section */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-6">{wt.benefits || 'Your Benefits'}</h2>
            
            <div className="grid gap-4">
              <div className="glass-card p-6 rounded-xl flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                  <Percent className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-bold mb-1">{wt.benefit1Title || 'Exclusive Discounts'}</h3>
                  <p className="text-gray-400">{wt.benefit1Desc || 'Up to 40% discount on all bid packages'}</p>
                </div>
              </div>

              <div className="glass-card p-6 rounded-xl flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center flex-shrink-0">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-bold mb-1">{wt.benefit2Title || 'Personal Account Manager'}</h3>
                  <p className="text-gray-400">{wt.benefit2Desc || 'Direct contact person for all your needs'}</p>
                </div>
              </div>

              <div className="glass-card p-6 rounded-xl flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-bold mb-1">{wt.benefit3Title || 'Flexible Payment'}</h3>
                  <p className="text-gray-400">{wt.benefit3Desc || 'Purchase on invoice with 30 days payment terms'}</p>
                </div>
              </div>

              <div className="glass-card p-6 rounded-xl flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center flex-shrink-0">
                  <HeadphonesIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-bold mb-1">{wt.benefit4Title || 'Priority Support'}</h3>
                  <p className="text-gray-400">{wt.benefit4Desc || 'Preferred handling of all requests'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Application Form */}
          <div className="glass-card p-8 rounded-xl">
            <h2 className="text-2xl font-bold text-white mb-6">{wt.formTitle || 'Application Form'}</h2>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-gray-300 text-sm font-medium">{wt.companyName || 'Company Name'} *</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <Input
                    type="text"
                    value={formData.company_name}
                    onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                    className="pl-10 bg-[#0F0F16] border-white/10 text-white"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-gray-300 text-sm font-medium">{wt.contactPerson || 'Contact Person'} *</label>
                <Input
                  type="text"
                  value={formData.contact_name}
                  onChange={(e) => setFormData({...formData, contact_name: e.target.value})}
                  className="bg-[#0F0F16] border-white/10 text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-gray-300 text-sm font-medium">{wt.email || 'Email'} *</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="pl-10 bg-[#0F0F16] border-white/10 text-white"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-gray-300 text-sm font-medium">{wt.phone || 'Phone'} *</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <Input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      className="pl-10 bg-[#0F0F16] border-white/10 text-white"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-gray-300 text-sm font-medium">{wt.website || 'Website (optional)'}</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <Input
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({...formData, website: e.target.value})}
                    className="pl-10 bg-[#0F0F16] border-white/10 text-white"
                    placeholder="https://"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-gray-300 text-sm font-medium">{wt.expectedVolume || 'Expected Monthly Volume'} *</label>
                <div className="relative">
                  <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <select
                    value={formData.expected_volume}
                    onChange={(e) => setFormData({...formData, expected_volume: e.target.value})}
                    className="w-full pl-10 pr-4 py-2 bg-[#0F0F16] border border-white/10 rounded-md text-white appearance-none"
                    required
                  >
                    <option value="">{wt.selectVolume || 'Please select'}</option>
                    <option value="1000-5000">{wt.volume1 || '1,000 - 5,000 bids'}</option>
                    <option value="5000-10000">{wt.volume2 || '5,000 - 10,000 bids'}</option>
                    <option value="10000-50000">{wt.volume3 || '10,000 - 50,000 bids'}</option>
                    <option value="50000+">{wt.volume4 || 'Over 50,000 bids'}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-gray-300 text-sm font-medium">{wt.message || 'Message (optional)'}</label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData({...formData, message: e.target.value})}
                    className="w-full pl-10 pr-4 py-2 bg-[#0F0F16] border border-white/10 rounded-md text-white min-h-[100px] resize-none"
                    placeholder={wt.messagePlaceholder || 'Tell us more about your company...'}
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white py-3"
              >
                {loading ? (
                  <span>{wt.submitting || 'Submitting...'}</span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    {wt.submitApplication || 'Submit Application'}
                    <ArrowRight className="w-5 h-5" />
                  </span>
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
