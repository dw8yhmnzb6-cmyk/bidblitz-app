import { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Star, Send, ThumbsUp, Gift } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

// Translations
const translations = {
  de: {
    title: 'Herzlichen Glückwunsch!',
    subtitle: 'Du hast gewonnen',
    question: 'Wie wahrscheinlich würdest du bidblitz.ae weiterempfehlen?',
    notLikely: 'Unwahrscheinlich',
    veryLikely: 'Sehr wahrscheinlich',
    feedbackPlaceholder: 'Was hat dir gefallen oder was können wir verbessern? (optional)',
    submit: 'Absenden',
    skip: 'Überspringen',
    thankYou: 'Danke für dein Feedback!',
    bonusBids: 'Du erhältst 5 Gratis-Gebote als Dankeschön!'
  },
  en: {
    title: 'Congratulations!',
    subtitle: 'You won',
    question: 'How likely are you to recommend bidblitz.ae?',
    notLikely: 'Not likely',
    veryLikely: 'Very likely',
    feedbackPlaceholder: 'What did you like or what can we improve? (optional)',
    submit: 'Submit',
    skip: 'Skip',
    thankYou: 'Thank you for your feedback!',
    bonusBids: 'You receive 5 free bids as a thank you!'
  },
  sq: {
    title: 'Urime!',
    subtitle: 'Fitove',
    question: 'Sa gjasa ke që do ta rekomandoje bidblitz.ae?',
    notLikely: 'Jo të ngjarë',
    veryLikely: 'Shumë të ngjarë',
    feedbackPlaceholder: 'Çfarë të pëlqeu apo çfarë mund të përmirësojmë? (opsionale)',
    submit: 'Dërgo',
    skip: 'Kalo',
    thankYou: 'Faleminderit për mendimin tuaj!',
    bonusBids: 'Merrni 5 oferta falas si falënderim!'
  },
  xk: {
    title: 'Urime!',
    subtitle: 'Fitove',
    question: 'Sa gjasa ke që do ta rekomandoje bidblitz.ae?',
    notLikely: 'Jo të ngjarë',
    veryLikely: 'Shumë të ngjarë',
    feedbackPlaceholder: 'Çfarë të pëlqeu apo çfarë mund të përmirësojmë? (opsionale)',
    submit: 'Dërgo',
    skip: 'Kalo',
    thankYou: 'Faleminderit për mendimin tuaj!',
    bonusBids: 'Merrni 5 oferta falas si falënderim!'
  },
  tr: {
    title: 'Tebrikler!',
    subtitle: 'Kazandınız',
    question: 'bidblitz.ae\'i tavsiye etme olasılığınız nedir?',
    notLikely: 'Olası değil',
    veryLikely: 'Çok olası',
    feedbackPlaceholder: 'Neyi beğendiniz veya neyi geliştirebiliriz? (isteğe bağlı)',
    submit: 'Gönder',
    skip: 'Atla',
    thankYou: 'Geri bildiriminiz için teşekkürler!',
    bonusBids: 'Teşekkür olarak 5 ücretsiz teklif alıyorsunuz!'
  },
  fr: {
    title: 'Félicitations!',
    subtitle: 'Vous avez gagné',
    question: 'Quelle est la probabilité que vous recommandiez bidblitz.ae?',
    notLikely: 'Peu probable',
    veryLikely: 'Très probable',
    feedbackPlaceholder: 'Qu\'avez-vous aimé ou que pouvons-nous améliorer? (optionnel)',
    submit: 'Soumettre',
    skip: 'Passer',
    thankYou: 'Merci pour vos commentaires!',
    bonusBids: 'Vous recevez 5 enchères gratuites en remerciement!'
  }
};

// Language mapping for regional variants
const langMapping = {
  'us': 'en',  // US English -> English  
  'ae': 'ar', // UAE -> Arabic
  'xk': 'sq', // Kosovo -> Albanian
};
const getMappedLang = (lang) => langMapping[lang] || lang;

const WinSurveyPopup = ({ isOpen, onClose, auctionId, productName, productImage, language = 'de', token }) => {
  const [score, setScore] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const langKey = getMappedLang(language);
  const t = translations[langKey] || translations.de;

  // Reset state when popup opens
  useEffect(() => {
    if (isOpen) {
      setScore(null);
      setFeedback('');
      setSubmitted(false);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    const ratingErrorTexts = {
      de: 'Bitte wähle eine Bewertung',
      en: 'Please select a rating',
      sq: 'Ju lutem zgjidhni një vlerësim',
      xk: 'Ju lutem zgjidhni një vlerësim',
      tr: 'Lütfen bir puan seçin',
      fr: 'Veuillez sélectionner une note'
    };
    
    if (score === null) {
      toast.error(ratingErrorTexts[language] || ratingErrorTexts.de);
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(`${API}/api/surveys/nps`, {
        score,
        feedback: feedback.trim() || null,
        source: 'post_win',
        auction_id: auctionId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSubmitted(true);
      toast.success(t.thankYou);
      
      // Close after 3 seconds
      setTimeout(() => {
        onClose();
      }, 3000);
    } catch (error) {
      console.error('Survey submission error:', error);
      // Still mark as submitted to avoid frustrating the user
      setSubmitted(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleSkip}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Confetti Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-4 -left-4 w-24 h-24 bg-yellow-400/20 rounded-full blur-2xl" />
          <div className="absolute -top-4 -right-4 w-32 h-32 bg-green-400/20 rounded-full blur-2xl" />
          <div className="absolute -bottom-4 -left-4 w-28 h-28 bg-cyan-400/20 rounded-full blur-2xl" />
        </div>
        
        {/* Close Button */}
        <button 
          onClick={handleSkip}
          className="absolute top-3 right-3 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors z-10"
        >
          <X className="w-4 h-4 text-gray-600" />
        </button>
        
        {submitted ? (
          /* Thank You State */
          <div className="p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ThumbsUp className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">{t.thankYou}</h2>
            <div className="flex items-center justify-center gap-2 text-amber-600 font-medium">
              <Gift className="w-5 h-5" />
              <span>{t.bonusBids}</span>
            </div>
          </div>
        ) : (
          /* Survey Form */
          <div className="p-6">
            {/* Header with Product */}
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">🎉</div>
              <h2 className="text-2xl font-bold text-gray-800">{t.title}</h2>
              <p className="text-gray-500">{t.subtitle}</p>
              
              {productImage && (
                <div className="mt-4 flex items-center justify-center gap-3 bg-gray-50 rounded-xl p-3">
                  <img 
                    src={productImage} 
                    alt={productName}
                    className="w-16 h-16 object-contain rounded-lg"
                  />
                  <p className="font-medium text-gray-800 text-sm text-left">{productName}</p>
                </div>
              )}
            </div>
            
            {/* NPS Question */}
            <div className="mb-6">
              <p className="text-center text-gray-700 font-medium mb-4">{t.question}</p>
              
              {/* NPS Scale */}
              <div className="flex justify-between gap-1 mb-2">
                {[0,1,2,3,4,5,6,7,8,9,10].map((num) => (
                  <button
                    key={num}
                    onClick={() => setScore(num)}
                    className={`w-8 h-10 rounded-lg font-bold text-sm transition-all ${
                      score === num
                        ? num <= 6 
                          ? 'bg-red-500 text-white scale-110 shadow-lg' 
                          : num <= 8 
                            ? 'bg-amber-500 text-white scale-110 shadow-lg'
                            : 'bg-green-500 text-white scale-110 shadow-lg'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-xs text-gray-500 px-1">
                <span>{t.notLikely}</span>
                <span>{t.veryLikely}</span>
              </div>
            </div>
            
            {/* Feedback Textarea */}
            <div className="mb-6">
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder={t.feedbackPlaceholder}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                rows={3}
              />
            </div>
            
            {/* Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleSkip}
                variant="outline"
                className="flex-1"
              >
                {t.skip}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={score === null || submitting}
                className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white"
              >
                {submitting ? (
                  <span className="animate-spin mr-2">⏳</span>
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                {t.submit}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WinSurveyPopup;
