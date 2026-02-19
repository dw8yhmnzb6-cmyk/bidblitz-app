/**
 * DepositOffers - Customer deposit bonus & interest offers
 * Shows available deposit offers with bonuses and interest rates
 */
import React, { useState, useEffect } from 'react';
import {
  Wallet, Gift, TrendingUp, Clock, CheckCircle, Star,
  Euro, Percent, Lock, ArrowRight, Sparkles, Crown,
  Calculator, Info, ChevronDown, ChevronUp
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL;

const translations = {
  de: {
    title: 'Einzahlungs-Angebote',
    subtitle: 'Mehr Guthaben durch Bonus & Zinsen',
    bonus: 'Bonus',
    interest: 'Zinsen p.a.',
    partnerBonus: 'Händler erhält',
    lockPeriod: 'Laufzeit',
    days: 'Tage',
    minDeposit: 'Ab',
    maxDeposit: 'Bis',
    unlimited: 'unbegrenzt',
    selectOffer: 'Angebot wählen',
    depositAmount: 'Einzahlungsbetrag',
    calculate: 'Berechnen',
    youGet: 'Sie erhalten',
    yourBonus: 'Ihr Bonus',
    estimatedInterest: 'Geschätzte Zinsen',
    totalAfter: 'Gesamt nach',
    deposit: 'Einzahlen',
    depositing: 'Wird eingezahlt...',
    myDeposits: 'Meine Einlagen',
    noDeposits: 'Noch keine Einlagen',
    active: 'Aktiv',
    completed: 'Abgeschlossen',
    daysRemaining: 'Tage verbleibend',
    unlocked: 'Entsperrt',
    withdraw: 'Zinsen abheben',
    accruedInterest: 'Aufgelaufene Zinsen',
    totalDeposited: 'Gesamt eingezahlt',
    totalBonus: 'Gesamt Bonus',
    totalInterest: 'Gesamt Zinsen',
    howItWorks: 'So funktioniert\'s',
    step1: '1. Angebot wählen',
    step1Desc: 'Je höher die Einzahlung, desto mehr Bonus & Zinsen',
    step2: '2. Bonus sofort',
    step2Desc: 'Bonus wird direkt Ihrem Guthaben gutgeschrieben',
    step3: '3. Zinsen sammeln',
    step3Desc: 'Täglich wachsende Zinsen bis zu 5% p.a.',
    step4: '4. Auszahlung',
    step4Desc: 'Nach der Laufzeit Zinsen abheben',
    popular: 'BELIEBT',
    recommended: 'EMPFOHLEN',
    top: 'TOP',
    vip: 'VIP',
    success: 'Einzahlung erfolgreich!',
    deposited: 'eingezahlt',
    freeBidsBonus: 'Gratis-Gebote als Bonus',
    insufficientFunds: 'Nicht genug Guthaben auf der Karte',
    loginRequired: 'Bitte einloggen',
    calculator: 'Zinsrechner',
    yourInvestment: 'Ihre Anlage'
  },
  en: {
    title: 'Deposit Offers',
    subtitle: 'More balance through bonus & interest',
    bonus: 'Bonus',
    interest: 'Interest p.a.',
    partnerBonus: 'Partner receives',
    lockPeriod: 'Lock Period',
    days: 'Days',
    minDeposit: 'From',
    maxDeposit: 'Up to',
    unlimited: 'unlimited',
    selectOffer: 'Select Offer',
    depositAmount: 'Deposit Amount',
    calculate: 'Calculate',
    youGet: 'You Get',
    yourBonus: 'Your Bonus',
    estimatedInterest: 'Estimated Interest',
    totalAfter: 'Total After',
    deposit: 'Deposit',
    depositing: 'Depositing...',
    myDeposits: 'My Deposits',
    noDeposits: 'No deposits yet',
    active: 'Active',
    completed: 'Completed',
    daysRemaining: 'Days remaining',
    unlocked: 'Unlocked',
    withdraw: 'Withdraw Interest',
    accruedInterest: 'Accrued Interest',
    totalDeposited: 'Total Deposited',
    totalBonus: 'Total Bonus',
    totalInterest: 'Total Interest',
    howItWorks: 'How It Works',
    step1: '1. Choose Offer',
    step1Desc: 'Higher deposits mean more bonus & interest',
    step2: '2. Instant Bonus',
    step2Desc: 'Bonus credited to your balance immediately',
    step3: '3. Earn Interest',
    step3Desc: 'Daily growing interest up to 5% p.a.',
    step4: '4. Withdraw',
    step4Desc: 'Withdraw interest after lock period',
    popular: 'POPULAR',
    recommended: 'RECOMMENDED',
    top: 'TOP',
    vip: 'VIP',
    success: 'Deposit successful!',
    deposited: 'deposited',
    freeBidsBonus: 'free bids as bonus',
    insufficientFunds: 'Insufficient card balance',
    loginRequired: 'Please login',
    calculator: 'Interest Calculator',
    yourInvestment: 'Your Investment'
  },
  sq: {
    title: 'Oferta Depozitimi',
    subtitle: 'Më shumë bilanc përmes bonusit & interesit',
    bonus: 'Bonus',
    interest: 'Interes vjetor',
    partnerBonus: 'Partneri merr',
    lockPeriod: 'Periudha e Bllokimit',
    days: 'Ditë',
    minDeposit: 'Nga',
    maxDeposit: 'Deri',
    unlimited: 'pa limit',
    selectOffer: 'Zgjidh Ofertën',
    depositAmount: 'Shuma e Depozitës',
    calculate: 'Llogarit',
    youGet: 'Ju Merrni',
    yourBonus: 'Bonusi Juaj',
    estimatedInterest: 'Interesi i Vlerësuar',
    totalAfter: 'Totali Pas',
    deposit: 'Depoziton',
    depositing: 'Duke depozituar...',
    myDeposits: 'Depozitat e Mia',
    noDeposits: 'Nuk ka depozita ende',
    active: 'Aktive',
    completed: 'Përfunduar',
    daysRemaining: 'Ditë të mbetura',
    unlocked: 'E zhbllokuar',
    withdraw: 'Tërhiq Interesin',
    accruedInterest: 'Interesi i Grumbulluar',
    totalDeposited: 'Totali i Depozituar',
    totalBonus: 'Totali Bonus',
    totalInterest: 'Totali Interes',
    howItWorks: 'Si Funksionon',
    step1: '1. Zgjidh Ofertën',
    step1Desc: 'Depozita më e lartë = më shumë bonus & interes',
    step2: '2. Bonus i Menjëhershëm',
    step2Desc: 'Bonusi kreditohet menjëherë në bilancin tuaj',
    step3: '3. Fito Interes',
    step3Desc: 'Interes ditor në rritje deri në 5% vjetor',
    step4: '4. Tërhiq',
    step4Desc: 'Tërhiq interesin pas periudhës së bllokimit',
    popular: 'POPULLOR',
    recommended: 'REKOMANDUAR',
    top: 'TOP',
    vip: 'VIP',
    success: 'Depozita e suksesshme!',
    insufficientFunds: 'Bilanc i pamjaftueshëm në kartë',
    loginRequired: 'Ju lutem hyni',
    calculator: 'Llogaritësi i Interesit',
    yourInvestment: 'Investimi Juaj'
  }
};

const badgeColors = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  orange: 'bg-orange-500',
  gold: 'bg-gradient-to-r from-yellow-400 to-amber-500'
};

const DepositOffers = ({ partnerId = null, onBalanceChange = null }) => {
  const { language: contextLanguage, mappedLanguage } = useLanguage();
  const { isAuthenticated, user, refreshUser } = useAuth();
  
  // Get language - prefer localStorage for consistency, fallback to context
  const storedLang = typeof window !== 'undefined' ? localStorage.getItem('language') : null;
  const langKey = storedLang || mappedLanguage || contextLanguage || 'de';
  const t = translations[langKey] || translations[mappedLanguage] || translations.de;
  
  const [offers, setOffers] = useState([]);
  const [myDeposits, setMyDeposits] = useState([]);
  const [depositSummary, setDepositSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [amount, setAmount] = useState('');
  const [depositing, setDepositing] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showMyDeposits, setShowMyDeposits] = useState(false);

  const token = localStorage.getItem('token') || sessionStorage.getItem('token');

  // Fetch offers
  useEffect(() => {
    const fetchOffers = async () => {
      try {
        const response = await fetch(`${API}/api/deposit-offers/offers?language=${langKey}`);
        const data = await response.json();
        setOffers(data.offers || []);
      } catch (error) {
        console.error('Error fetching offers:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchOffers();
  }, [langKey]);

  // Fetch my deposits
  useEffect(() => {
    if (isAuthenticated && token) {
      const fetchMyDeposits = async () => {
        try {
          const response = await fetch(`${API}/api/deposit-offers/my-deposits`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await response.json();
          setMyDeposits(data.deposits || []);
          setDepositSummary(data.summary || {});
        } catch (error) {
          console.error('Error fetching deposits:', error);
        }
      };
      fetchMyDeposits();
    }
  }, [isAuthenticated, token]);

  // Calculate bonus and interest
  const calculateReturns = (offer, depositAmount) => {
    const amt = parseFloat(depositAmount) || 0;
    const bonus = offer.bonus_type === 'percentage' 
      ? amt * (offer.bonus_value / 100)
      : offer.bonus_value;
    const interest = amt * (offer.interest_rate / 100) * (offer.lock_days / 365);
    return { bonus, interest, total: amt + bonus + interest };
  };

  // Handle deposit
  const handleDeposit = async () => {
    if (!isAuthenticated) {
      toast.error(t.loginRequired);
      return;
    }

    if (!selectedOffer || !amount) return;

    const amountNum = parseFloat(amount);
    if (amountNum < selectedOffer.min_amount) {
      toast.error(`${t.minDeposit} €${selectedOffer.min_amount}`);
      return;
    }

    setDepositing(true);
    try {
      const response = await fetch(`${API}/api/deposit-offers/deposit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          offer_id: selectedOffer.id,
          amount: amountNum,
          partner_id: partnerId
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Show success message with bonus bids info
        const bonusBids = data.bonus_bids || Math.floor(data.bonus);
        toast.success(`€${data.amount.toFixed(2)} ${t.deposited || 'eingezahlt'}! +${bonusBids} ${t.freeBidsBonus || 'Gratis-Gebote als Bonus'}`);
        setSelectedOffer(null);
        setAmount('');
        // Refresh deposits
        const depositsRes = await fetch(`${API}/api/deposit-offers/my-deposits`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const depositsData = await depositsRes.json();
        setMyDeposits(depositsData.deposits || []);
        setDepositSummary(depositsData.summary || {});
        
        // Refresh user balance in navbar (this also updates bids_balance)
        if (refreshUser) {
          await refreshUser();
        }
        
        // Refresh wallet balance if callback provided
        if (onBalanceChange) {
          await onBalanceChange();
        }
      } else {
        toast.error(data.detail || 'Fehler bei der Einzahlung');
      }
    } catch (error) {
      console.error('Deposit error:', error);
      toast.error('Fehler bei der Einzahlung');
    } finally {
      setDepositing(false);
    }
  };

  // Withdraw interest
  const handleWithdraw = async (depositId) => {
    try {
      const response = await fetch(`${API}/api/deposit-offers/withdraw/${depositId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(`€${data.interest_earned.toFixed(2)} Zinsen gutgeschrieben!`);
        // Refresh deposits
        const depositsRes = await fetch(`${API}/api/deposit-offers/my-deposits`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const depositsData = await depositsRes.json();
        setMyDeposits(depositsData.deposits || []);
        
        // Refresh user balance in navbar
        if (refreshUser) {
          await refreshUser();
        }
        
        // Refresh wallet balance if callback provided
        if (onBalanceChange) {
          await onBalanceChange();
        }
      } else {
        toast.error(data.detail || 'Fehler');
      }
    } catch (error) {
      toast.error('Fehler beim Abheben');
    }
  };

  if (loading) {
    return <div className="animate-pulse h-64 bg-gray-100 rounded-xl" />;
  }

  return (
    <div className="space-y-6" data-testid="deposit-offers">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center justify-center gap-2">
          <Gift className="w-8 h-8 text-orange-500" />
          {t.title}
        </h2>
        <p className="text-gray-500 mt-1">{t.subtitle}</p>
      </div>

      {/* My Deposits Summary (if logged in) */}
      {isAuthenticated && depositSummary.active_deposits > 0 && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
          <button 
            onClick={() => setShowMyDeposits(!showMyDeposits)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Wallet className="w-6 h-6 text-green-600" />
              <div className="text-left">
                <p className="font-semibold text-green-800">{t.myDeposits}</p>
                <p className="text-sm text-green-600">
                  {depositSummary.active_deposits} {t.active} · €{(depositSummary.total_interest || 0).toFixed(2)} {t.accruedInterest}
                </p>
              </div>
            </div>
            {showMyDeposits ? <ChevronUp className="w-5 h-5 text-green-600" /> : <ChevronDown className="w-5 h-5 text-green-600" />}
          </button>
          
          {showMyDeposits && (
            <div className="mt-4 space-y-3">
              {myDeposits.filter(d => d.status === 'active').map((deposit) => (
                <div key={deposit.id} className="bg-white rounded-lg p-4 border">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{deposit.offer_name}</p>
                      <p className="text-sm text-gray-500">€{deposit.amount.toFixed(2)} · {deposit.interest_rate}% p.a.</p>
                      <p className="text-xs text-green-600 mt-1">
                        +€{(deposit.accrued_interest || 0).toFixed(2)} {t.accruedInterest}
                      </p>
                    </div>
                    <div className="text-right">
                      {deposit.is_unlocked ? (
                        <Button 
                          size="sm" 
                          className="bg-green-500 hover:bg-green-600"
                          onClick={() => handleWithdraw(deposit.id)}
                        >
                          {t.withdraw}
                        </Button>
                      ) : (
                        <div className="flex items-center gap-1 text-orange-600">
                          <Lock className="w-4 h-4" />
                          <span className="text-sm font-medium">{deposit.days_remaining} {t.days}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Offers Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {offers.map((offer) => {
          const returns = amount && selectedOffer?.id === offer.id 
            ? calculateReturns(offer, amount)
            : calculateReturns(offer, offer.min_amount);
          
          return (
            <div 
              key={offer.id}
              className={`relative bg-white rounded-2xl border-2 p-5 transition-all cursor-pointer ${
                selectedOffer?.id === offer.id 
                  ? 'border-orange-500 shadow-lg shadow-orange-100' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => {
                setSelectedOffer(offer);
                setAmount(offer.min_amount.toString());
              }}
            >
              {/* Badge */}
              {offer.badge && (
                <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-white text-xs font-bold ${badgeColors[offer.badge_color] || 'bg-gray-500'}`}>
                  {offer.badge}
                </div>
              )}

              {/* Offer Details */}
              <div className="text-center pt-2">
                {/* Bonus */}
                <div className="mb-4">
                  <div className="w-16 h-16 mx-auto bg-gradient-to-br from-orange-100 to-amber-100 rounded-2xl flex items-center justify-center mb-2">
                    <span className="text-2xl font-bold text-orange-600">
                      {offer.bonus_value}%
                    </span>
                  </div>
                  <p className="font-bold text-lg text-gray-800">{t.bonus}</p>
                </div>

                {/* Interest */}
                <div className="flex items-center justify-center gap-2 text-green-600 mb-4">
                  <TrendingUp className="w-5 h-5" />
                  <span className="font-bold">{offer.interest_rate}% {t.interest}</span>
                </div>

                {/* Amount Range */}
                <div className="bg-gray-50 rounded-xl p-3 mb-4">
                  <p className="text-sm text-gray-500">
                    {t.minDeposit} <span className="font-bold text-gray-800">€{offer.min_amount}</span>
                    {offer.max_amount ? (
                      <> - €{offer.max_amount}</>
                    ) : (
                      <> ({t.unlimited})</>
                    )}
                  </p>
                </div>

                {/* Lock Period */}
                <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
                  <Lock className="w-4 h-4" />
                  <span>{offer.lock_days} {t.days}</span>
                </div>

                {/* Partner Commission */}
                {offer.partner_commission > 0 && (
                  <div className="mt-3 pt-3 border-t text-sm text-purple-600">
                    <span className="flex items-center justify-center gap-1">
                      <Gift className="w-4 h-4" />
                      {t.partnerBonus}: {offer.partner_commission}%
                    </span>
                  </div>
                )}
              </div>

              {/* Selection indicator */}
              {selectedOffer?.id === offer.id && (
                <div className="absolute top-3 right-3">
                  <CheckCircle className="w-6 h-6 text-orange-500" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Deposit Form (when offer selected) */}
      {selectedOffer && (
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-6 border border-orange-200">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Calculator className="w-6 h-6 text-orange-500" />
            {t.calculator}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t.depositAmount}</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-xl">€</span>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min={selectedOffer.min_amount}
                  max={selectedOffer.max_amount || undefined}
                  className="pl-10 text-2xl font-bold h-14"
                  placeholder="0.00"
                />
              </div>
              <p className="text-sm text-gray-500 mt-2">
                {t.minDeposit}: €{selectedOffer.min_amount}
                {selectedOffer.max_amount && ` · ${t.maxDeposit}: €${selectedOffer.max_amount}`}
              </p>
            </div>

            {/* Results */}
            <div className="space-y-3">
              {(() => {
                const returns = calculateReturns(selectedOffer, amount);
                return (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">{t.yourInvestment}</span>
                      <span className="font-bold text-lg">€{(parseFloat(amount) || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-green-600">
                      <span>+ {t.yourBonus} ({selectedOffer.bonus_value}%)</span>
                      <span className="font-bold text-lg">€{returns.bonus.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-blue-600">
                      <span>+ {t.estimatedInterest} ({selectedOffer.interest_rate}%)</span>
                      <span className="font-bold">€{returns.interest.toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-3 flex justify-between items-center">
                      <span className="font-bold text-gray-800">{t.totalAfter} {selectedOffer.lock_days} {t.days}</span>
                      <span className="font-bold text-2xl text-orange-600">€{returns.total.toFixed(2)}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Deposit Button */}
          <Button
            onClick={handleDeposit}
            disabled={depositing || !amount || parseFloat(amount) < selectedOffer.min_amount}
            className="w-full mt-6 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 h-14 text-lg"
          >
            {depositing ? (
              <span className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t.depositing}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                {t.deposit} €{(parseFloat(amount) || 0).toFixed(2)} + {selectedOffer.bonus_value}% {t.bonus}
              </span>
            )}
          </Button>
        </div>
      )}

      {/* How It Works */}
      <div className="bg-white rounded-2xl border p-6">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Info className="w-5 h-5 text-orange-500" />
          {t.howItWorks}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Gift, title: t.step1, desc: t.step1Desc },
            { icon: Sparkles, title: t.step2, desc: t.step2Desc },
            { icon: TrendingUp, title: t.step3, desc: t.step3Desc },
            { icon: Wallet, title: t.step4, desc: t.step4Desc }
          ].map((step, i) => (
            <div key={i} className="text-center">
              <div className="w-12 h-12 mx-auto bg-orange-100 rounded-xl flex items-center justify-center mb-2">
                <step.icon className="w-6 h-6 text-orange-600" />
              </div>
              <p className="font-bold text-sm text-gray-800">{step.title}</p>
              <p className="text-xs text-gray-500 mt-1">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DepositOffers;
