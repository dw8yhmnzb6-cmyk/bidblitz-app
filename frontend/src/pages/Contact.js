import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { usePageTranslations } from '../i18n/pageTranslations';
import { 
  Mail, 
  MessageSquare, 
  Send, 
  MapPin, 
  Phone,
  Clock,
  CheckCircle
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

export default function Contact() {
  const { t, language , mappedLanguage } = useLanguage();
  // Use mappedLanguage for regional variants (e.g., xk -> sq)
  const langKey = mappedLanguage || language;
  const { isDarkMode } = useTheme();
  const texts = usePageTranslations(language);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.message) {
      toast.error(language === 'en' ? 'Please fill all required fields' : 'Bitte füllen Sie alle Pflichtfelder aus');
      return;
    }

    setSubmitting(true);
    
    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setSubmitting(false);
    setSubmitted(true);
    toast.success(texts.messageSent);
  };

  // Multilingual contact info
  const contactInfo = language === 'en' ? [
    {
      icon: Mail,
      title: "Email",
      value: "support@bidblitz.de",
      description: "Response within 24h"
    },
    {
      icon: Phone,
      title: "Phone",
      value: "+49 30 12345678",
      description: "Mon-Fri 9:00-18:00"
    },
    {
      icon: MapPin,
      title: "Address",
      value: "Dubai Internet City",
      description: "Dubai, UAE"
    }
  ] : language === 'sq' ? [
    {
      icon: Mail,
      title: "Email",
      value: "support@bidblitz.de",
      description: "Përgjigje brenda 24 orëve"
    },
    {
      icon: Phone,
      title: "Telefoni",
      value: "+49 30 12345678",
      description: "E Hënë-E Premte 9:00-18:00"
    },
    {
      icon: MapPin,
      title: "Adresa",
      value: "Dubai Internet City",
      description: "Dubai, UAE"
    }
  ] : [
    {
      icon: Mail,
      title: "E-Mail",
      value: "support@bidblitz.de",
      description: "Antwort innerhalb von 24h"
    },
    {
      icon: Phone,
      title: "Telefon",
      value: "+49 30 12345678",
      description: "Mo-Fr 9:00-18:00 Uhr"
    },
    {
      icon: MapPin,
      title: "Adresse",
      value: "Dubai Internet City",
      description: "Dubai, UAE"
    }
  ];

  // Multilingual success messages
  const successMessages = {
    de: { title: "Nachricht gesendet!", desc: "Vielen Dank für Ihre Nachricht. Wir werden uns innerhalb von 24 Stunden bei Ihnen melden.", button: "Weitere Nachricht senden" },
    en: { title: "Message sent!", desc: "Thank you for your message. We will get back to you within 24 hours.", button: "Send another message" },
    sq: { title: "Mesazhi u dërgua!", desc: "Faleminderit për mesazhin tuaj. Do t'ju kontaktojmë brenda 24 orëve.", button: "Dërgo mesazh tjetër" },
    tr: { title: "Mesaj gönderildi!", desc: "Mesajınız için teşekkürler. 24 saat içinde size döneceğiz.", button: "Başka mesaj gönder" },
    fr: { title: "Message envoyé!", desc: "Merci pour votre message. Nous vous répondrons dans les 24 heures.", button: "Envoyer un autre message" }
  };
  const successText = successMessages[langKey] || successMessages.de;

  if (submitted) {
    return (
      <div className={`min-h-screen pt-20 pb-16 ${isDarkMode ? 'bg-[#050509]' : 'bg-gradient-to-b from-cyan-50 to-cyan-100'}`}>
        <div className="max-w-xl mx-auto px-4 text-center">
          <div className={`rounded-2xl p-12 border ${isDarkMode ? 'bg-[#181824] border-white/10' : 'bg-white border-gray-200 shadow-lg'}`}>
            <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <h2 className={`text-2xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
              {successText.title}
            </h2>
            <p className={`mb-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {successText.desc}
            </p>
            <Button 
              onClick={() => setSubmitted(false)}
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold"
            >
              {successText.button}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Multilingual page titles
  const pageTexts = {
    de: { title: "Kontakt", subtitle: "Haben Sie Fragen oder Anregungen? Wir freuen uns auf Ihre Nachricht!" },
    en: { title: "Contact", subtitle: "Have questions or suggestions? We look forward to hearing from you!" },
    sq: { title: "Kontakti", subtitle: "Keni pyetje ose sugjerime? Presim me padurim mesazhin tuaj!" },
    tr: { title: "İletişim", subtitle: "Sorularınız veya önerileriniz mi var? Mesajınızı bekliyoruz!" },
    fr: { title: "Contact", subtitle: "Des questions ou suggestions? Nous avons hâte de vous lire!" }
  };
  const pageText = pageTexts[langKey] || pageTexts.de;

  return (
    <div className={`min-h-screen pt-20 pb-16 ${isDarkMode ? 'bg-[#050509]' : 'bg-gradient-to-b from-cyan-50 to-cyan-100'}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className={`text-3xl sm:text-4xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
            {pageText.title}
          </h1>
          <p className={`max-w-lg mx-auto ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {pageText.subtitle}
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Contact Info */}
          <div className="lg:col-span-1 space-y-4">
            {contactInfo.map((info, index) => (
              <div 
                key={index}
                className={`rounded-xl p-5 border ${isDarkMode ? 'bg-[#181824] border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <info.icon className="w-6 h-6 text-amber-500" />
                  </div>
                  <div>
                    <h3 className={`font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{info.title}</h3>
                    <p className="text-amber-500 font-medium">{info.value}</p>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{info.description}</p>
                  </div>
                </div>
              </div>
            ))}

            {/* Support Hours */}
            <div className={`rounded-xl p-5 border ${isDarkMode ? 'bg-[#181824] border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-6 h-6 text-cyan-500" />
                </div>
                <div>
                  <h3 className={`font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                    {language === 'en' ? 'Opening Hours' : language === 'sq' ? 'Orari' : language === 'tr' ? 'Çalışma Saatleri' : language === 'fr' ? 'Horaires' : 'Öffnungszeiten'}
                  </h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>{language === 'en' ? 'Monday - Friday' : language === 'sq' ? 'E Hënë - E Premte' : language === 'tr' ? 'Pazartesi - Cuma' : language === 'fr' ? 'Lundi - Vendredi' : 'Montag - Freitag'}</span>
                      <span className={isDarkMode ? 'text-white' : 'text-gray-800'}>9:00 - 18:00</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>{language === 'en' ? 'Saturday' : language === 'sq' ? 'E Shtunë' : language === 'tr' ? 'Cumartesi' : language === 'fr' ? 'Samedi' : 'Samstag'}</span>
                      <span className={isDarkMode ? 'text-white' : 'text-gray-800'}>10:00 - 14:00</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>{language === 'en' ? 'Sunday' : language === 'sq' ? 'E Diel' : language === 'tr' ? 'Pazar' : language === 'fr' ? 'Dimanche' : 'Sonntag'}</span>
                      <span className="text-gray-500">{language === 'en' ? 'Closed' : language === 'sq' ? 'Mbyllur' : language === 'tr' ? 'Kapalı' : language === 'fr' ? 'Fermé' : 'Geschlossen'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className={`rounded-2xl p-6 sm:p-8 border ${isDarkMode ? 'bg-[#181824] border-white/10' : 'bg-white border-gray-200 shadow-lg'}`}>
              <h2 className={`text-xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                {texts.sendMessage}
              </h2>
              
              <div className="grid sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className={`block text-sm mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {texts.name} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 rounded-lg border focus:outline-none focus:border-amber-500 ${
                      isDarkMode 
                        ? 'bg-[#0F0F16] border-white/10 text-white placeholder-gray-500' 
                        : 'bg-gray-50 border-gray-300 text-gray-800 placeholder-gray-400'
                    }`}
                    placeholder={texts.enterName}
                    required
                  />
                </div>
                <div>
                  <label className={`block text-sm mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {texts.email} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 rounded-lg border focus:outline-none focus:border-amber-500 ${
                      isDarkMode 
                        ? 'bg-[#0F0F16] border-white/10 text-white placeholder-gray-500' 
                        : 'bg-gray-50 border-gray-300 text-gray-800 placeholder-gray-400'
                    }`}
                    placeholder={texts.enterEmail}
                    required
                  />
                </div>
              </div>
              
              <div className="mb-4">
                <label className={`block text-sm mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {texts.subject}
                </label>
                <select
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 rounded-lg border focus:outline-none focus:border-amber-500 ${
                    isDarkMode 
                      ? 'bg-[#0F0F16] border-white/10 text-white' 
                      : 'bg-gray-50 border-gray-300 text-gray-800'
                  }`}
                >
                  <option value="">{texts.selectSubject}</option>
                  <option value="general">{texts.generalInquiry}</option>
                  <option value="order">{language === 'en' ? 'Order / Shipping' : language === 'sq' ? 'Porosi / Dërgesë' : language === 'tr' ? 'Sipariş / Kargo' : language === 'fr' ? 'Commande / Livraison' : 'Bestellung / Versand'}</option>
                  <option value="payment">{language === 'en' ? 'Payment / Bids' : language === 'sq' ? 'Pagesa / Oferta' : language === 'tr' ? 'Ödeme / Teklifler' : language === 'fr' ? 'Paiement / Enchères' : 'Zahlung / Gebote'}</option>
                  <option value="technical">{texts.technicalSupport}</option>
                  <option value="feedback">{language === 'en' ? 'Feedback / Suggestion' : language === 'sq' ? 'Koment / Sugjerim' : language === 'tr' ? 'Geri Bildirim / Öneri' : language === 'fr' ? 'Commentaire / Suggestion' : 'Feedback / Vorschlag'}</option>
                  <option value="other">{texts.other}</option>
                </select>
              </div>
              
              <div className="mb-6">
                <label className={`block text-sm mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {texts.message} <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  rows={5}
                  className={`w-full px-4 py-3 rounded-lg border focus:outline-none focus:border-amber-500 resize-none ${
                    isDarkMode 
                      ? 'bg-[#0F0F16] border-white/10 text-white placeholder-gray-500' 
                      : 'bg-gray-50 border-gray-300 text-gray-800 placeholder-gray-400'
                  }`}
                  placeholder={texts.yourMessagePlaceholder}
                  required
                />
              </div>
              
              <Button 
                type="submit"
                disabled={submitting}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 text-lg"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                    {texts.sending}
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-2" />
                    {texts.sendMessage}
                  </>
                )}
              </Button>
              
              <p className="text-gray-500 text-xs mt-4 text-center">
                {language === 'en' ? 'By submitting, you agree to our Privacy Policy.' : language === 'sq' ? 'Duke dërguar, pranoni Politikën tonë të Privatësisë.' : language === 'tr' ? 'Göndererek Gizlilik Politikamızı kabul ediyorsunuz.' : language === 'fr' ? 'En soumettant, vous acceptez notre Politique de Confidentialité.' : 'Mit dem Absenden stimmen Sie unserer Datenschutzerklärung zu.'}
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
