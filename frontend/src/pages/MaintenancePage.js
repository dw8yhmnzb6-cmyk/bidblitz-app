import { useState, useEffect } from 'react';
import { Wrench, Clock, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useLanguage } from '../context/LanguageContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const pageTexts = {
  de: {
    title: 'Wartungsarbeiten',
    defaultMessage: 'Wir führen gerade Wartungsarbeiten durch, um bidblitz.ae noch besser zu machen. Bitte versuchen Sie es in Kürze erneut.',
    estimatedTime: 'Geschätzte Restzeit:',
    hours: 'Stunden',
    minutes: 'Minuten',
    seconds: 'Sekunden',
    retry: 'Erneut versuchen',
    backSoon: 'Wir sind bald zurück!'
  },
  sq: {
    title: 'Mirëmbajtje',
    defaultMessage: 'Po kryejmë mirëmbajtje për ta bërë bidblitz.ae edhe më të mirë. Ju lutemi provoni përsëri së shpejti.',
    estimatedTime: 'Koha e mbetur e vlerësuar:',
    hours: 'Orë',
    minutes: 'Minuta',
    seconds: 'Sekonda',
    retry: 'Provo përsëri',
    backSoon: 'Do të kthehemi së shpejti!'
  }
};

export default function MaintenancePage() {
  const { language } = useLanguage();
  const t = pageTexts[language] || pageTexts.de;
  const [maintenanceData, setMaintenanceData] = useState(null);
  const [countdown, setCountdown] = useState(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${API}/maintenance/status`);
        const data = await res.json();
        setMaintenanceData(data);
      } catch (error) {
        console.error('Error fetching maintenance status:', error);
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!maintenanceData?.estimated_end) return;
    
    const updateCountdown = () => {
      const end = new Date(maintenanceData.estimated_end);
      const now = new Date();
      const diff = end - now;
      
      if (diff <= 0) {
        setCountdown(null);
        window.location.reload();
        return;
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setCountdown({ hours, minutes, seconds });
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [maintenanceData?.estimated_end]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full text-center">
        {/* Animated Icon */}
        <div className="mb-8 relative">
          <div className="w-32 h-32 mx-auto bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-2xl animate-pulse">
            <Wrench className="w-16 h-16 text-white" />
          </div>
          <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-24 h-4 bg-black/10 rounded-full blur-sm"></div>
        </div>

        {/* Title */}
        <h1 className="text-4xl font-bold text-slate-800 mb-4">
          {t.title}
        </h1>
        
        {/* Message */}
        <p className="text-lg text-slate-600 mb-8 leading-relaxed">
          {maintenanceData?.message || t.defaultMessage}
        </p>

        {/* Countdown */}
        {countdown && (
          <div className="mb-8">
            <p className="text-sm text-slate-500 mb-3 flex items-center justify-center gap-2">
              <Clock className="w-4 h-4" />
              {t.estimatedTime}
            </p>
            <div className="flex justify-center gap-4">
              <div className="bg-white rounded-xl p-4 shadow-lg min-w-[80px]">
                <p className="text-3xl font-bold text-amber-600">{countdown.hours}</p>
                <p className="text-xs text-slate-500">{t.hours}</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-lg min-w-[80px]">
                <p className="text-3xl font-bold text-amber-600">{countdown.minutes}</p>
                <p className="text-xs text-slate-500">{t.minutes}</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-lg min-w-[80px]">
                <p className="text-3xl font-bold text-amber-600">{countdown.seconds}</p>
                <p className="text-xs text-slate-500">{t.seconds}</p>
              </div>
            </div>
          </div>
        )}

        {/* Refresh Button */}
        <Button
          onClick={() => window.location.reload()}
          className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-lg"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          {t.retry}
        </Button>

        {/* bidblitz.ae Logo */}
        <div className="mt-12 text-slate-400">
          <p className="font-bold text-lg">
            <span className="text-[#7C3AED]">Bid</span>
            <span className="text-amber-500">Blitz</span>
          </p>
          <p className="text-xs mt-1">{t.backSoon}</p>
        </div>
      </div>
    </div>
  );
}
