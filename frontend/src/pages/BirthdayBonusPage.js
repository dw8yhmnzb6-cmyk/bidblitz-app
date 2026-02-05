import { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { Gift, Cake, Calendar, Clock, Sparkles, PartyPopper } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function BirthdayBonusPage() {
  const { language } = useLanguage();
  const { token, isAuthenticated } = useAuth();
  const [status, setStatus] = useState(null);
  const [birthday, setBirthday] = useState('');
  const [loading, setLoading] = useState(true);

  const texts = {
    de: {
      title: 'Geburtstags-Bonus',
      subtitle: 'Erhalte Gratis-Gebote an deinem Geburtstag!',
      setBirthday: 'Geburtstag eingeben',
      save: 'Speichern',
      claim: 'Bonus abholen',
      yourBirthday: 'Dein Geburtstag',
      daysUntil: 'Tage bis zu deinem Geburtstag',
      bonusAmount: 'Dein Bonus',
      bids: 'Gebote',
      happyBirthday: 'Happy Birthday!',
      alreadyClaimed: 'Bonus bereits abgeholt',
      loginRequired: 'Bitte melde dich an',
      vipBonus: 'VIP-Mitglieder erhalten mehr!',
      bonusLevels: 'Bonus nach VIP-Level',
      standard: 'Standard',
      comingSoon: 'Kommt in',
      days: 'Tagen'
    },
    en: {
      title: 'Birthday Bonus',
      subtitle: 'Get free bids on your birthday!',
      setBirthday: 'Enter your birthday',
      save: 'Save',
      claim: 'Claim Bonus',
      yourBirthday: 'Your Birthday',
      daysUntil: 'days until your birthday',
      bonusAmount: 'Your Bonus',
      bids: 'bids',
      happyBirthday: 'Happy Birthday!',
      alreadyClaimed: 'Bonus already claimed',
      loginRequired: 'Please log in',
      vipBonus: 'VIP members get more!',
      bonusLevels: 'Bonus by VIP level',
      standard: 'Standard',
      comingSoon: 'Coming in',
      days: 'days'
    }
  };

  const t = texts[language] || texts.de;

  useEffect(() => {
    if (token) {
      fetchStatus();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/api/birthday/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setStatus(data);
      if (data.birthday) {
        setBirthday(data.birthday);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleSaveBirthday = async () => {
    if (!birthday) {
      toast.error('Bitte Geburtstag eingeben');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/birthday/set`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ birthday })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchStatus();
      } else {
        toast.error(data.detail || 'Fehler');
      }
    } catch (err) {
      toast.error('Fehler beim Speichern');
    }
  };

  const handleClaimBonus = async () => {
    try {
      const res = await fetch(`${API_URL}/api/birthday/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchStatus();
      } else {
        toast.error(data.detail || 'Fehler');
      }
    } catch (err) {
      toast.error('Fehler');
    }
  };

  const bonusLevels = [
    { level: 'Standard', bids: 10, color: '#94A3B8' },
    { level: 'VIP', bids: 15, color: '#7C3AED' },
    { level: 'VIP Gold', bids: 20, color: '#F59E0B' },
    { level: 'VIP Platinum', bids: 25, color: '#E5E7EB' },
    { level: 'VIP Diamond', bids: 30, color: '#60A5FA' }
  ];

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 flex items-center justify-center">
        <Card className="bg-[#1A1A2E] border-gray-200 p-8 text-center">
          <Cake className="w-16 h-16 text-[#EC4899] mx-auto mb-4" />
          <p className="text-gray-800 text-xl">{t.loginRequired}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4" data-testid="birthday-bonus-page">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#EC4899] to-[#F59E0B] mb-4">
            <Cake className="w-10 h-10 text-gray-800" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">{t.title}</h1>
          <p className="text-gray-500">{t.subtitle}</p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Laden...</div>
        ) : status?.is_birthday_today && !status?.already_claimed ? (
          /* Birthday is TODAY! */
          <Card className="bg-gradient-to-r from-[#EC4899]/30 to-[#F59E0B]/30 border-[#EC4899] mb-6">
            <CardContent className="p-8 text-center">
              <PartyPopper className="w-20 h-20 text-[#F59E0B] mx-auto mb-4 animate-bounce" />
              <h2 className="text-3xl font-bold text-gray-800 mb-2">{t.happyBirthday}</h2>
              <p className="text-gray-500 mb-6">
                Dein Geschenk: <span className="text-[#10B981] font-bold text-2xl">{status.bonus_amount}</span> {t.bids}!
              </p>
              <Button 
                onClick={handleClaimBonus}
                className="bg-gradient-to-r from-[#EC4899] to-[#F59E0B] text-lg px-8 py-6"
              >
                <Gift className="w-6 h-6 mr-2" />
                {t.claim}
              </Button>
            </CardContent>
          </Card>
        ) : status?.has_birthday ? (
          /* Has birthday set */
          <Card className="bg-[#1A1A2E] border-gray-200 mb-6">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Calendar className="w-8 h-8 text-[#EC4899]" />
                  <div>
                    <p className="text-gray-500 text-sm">{t.yourBirthday}</p>
                    <p className="text-gray-800 text-xl font-bold">
                      {new Date(status.birthday).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}
                    </p>
                  </div>
                </div>
                {status.already_claimed ? (
                  <Badge className="bg-[#10B981]/20 text-[#10B981]">{t.alreadyClaimed}</Badge>
                ) : (
                  <div className="text-right">
                    <p className="text-gray-500 text-sm">{t.comingSoon}</p>
                    <p className="text-[#F59E0B] text-2xl font-bold">{status.days_until_birthday} {t.days}</p>
                  </div>
                )}
              </div>

              {/* Bonus Amount */}
              <div className="bg-gradient-to-b from-cyan-50 to-cyan-100 rounded-lg p-4 text-center">
                <p className="text-gray-500 text-sm">{t.bonusAmount}</p>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <Gift className="w-8 h-8 text-[#10B981]" />
                  <span className="text-4xl font-bold text-[#10B981]">{status.bonus_amount}</span>
                  <span className="text-gray-500">{t.bids}</span>
                </div>
                <Badge className="mt-2 bg-[#7C3AED]/20 text-[#7C3AED]">
                  {status.vip_level || 'Standard'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* No birthday set */
          <Card className="bg-[#1A1A2E] border-gray-200 mb-6">
            <CardContent className="p-6">
              <h3 className="text-gray-800 font-bold mb-4">{t.setBirthday}</h3>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  className="bg-gradient-to-b from-cyan-50 to-cyan-100 border-gray-200 text-gray-800"
                />
                <Button onClick={handleSaveBirthday} className="bg-[#EC4899]">
                  {t.save}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bonus Levels */}
        <Card className="bg-[#1A1A2E] border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-800 flex items-center">
              <Sparkles className="w-5 h-5 mr-2 text-[#F59E0B]" />
              {t.bonusLevels}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {bonusLevels.map((level) => (
                <div key={level.level} className="flex items-center justify-between bg-gradient-to-b from-cyan-50 to-cyan-100 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: level.color }} />
                    <span className="text-gray-800">{level.level}</span>
                  </div>
                  <Badge style={{ backgroundColor: `${level.color}20`, color: level.color }}>
                    {level.bids} {t.bids}
                  </Badge>
                </div>
              ))}
            </div>
            <p className="text-gray-500 text-sm mt-4 text-center">{t.vipBonus}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
