/**
 * Partner Budget Dashboard
 * Shows voucher budget, earnings, and payout settings
 */
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Wallet, Euro, Gift, CreditCard, Clock, CheckCircle, 
  AlertCircle, Settings, Download, Upload, RefreshCw,
  Building, Copy, ArrowUpRight, ArrowDownLeft, Calendar
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

export default function PartnerBudget({ token, language = 'de' }) {
  const [budget, setBudget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState({ payments: [], payouts: [] });
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    payout_frequency: 'weekly',
    min_payout_amount: 50,
    wise_email: '',
    bank_iban: '',
    bank_holder_name: ''
  });

  const t = {
    de: {
      title: 'Guthaben & Auszahlungen',
      voucherBudget: 'Gutschein-Budget',
      availableBudget: 'Verfügbares Budget',
      freibetrag: 'Freibetrag',
      paidCredit: 'Bezahltes Guthaben',
      used: 'Verwendet',
      earnings: 'Einnahmen',
      availableForPayout: 'Zur Auszahlung verfügbar',
      totalEarnings: 'Gesamteinnahmen',
      paidOut: 'Bereits ausgezahlt',
      topUp: 'Guthaben aufladen',
      requestPayout: 'Auszahlung beantragen',
      payoutSettings: 'Auszahlungseinstellungen',
      noVoucherBudget: 'Kein Gutschein-Budget verfügbar',
      contactAdmin: 'Bitte kontaktieren Sie den Admin für einen Freibetrag oder laden Sie Guthaben auf.',
      paymentInstructions: 'Überweisungsdaten',
      copyIban: 'IBAN kopieren',
      copyReference: 'Referenz kopieren',
      frequency: 'Auszahlungsrhythmus',
      daily: 'Täglich',
      weekly: 'Wöchentlich',
      monthly: 'Monatlich',
      manual: 'Manuell',
      minAmount: 'Mindestbetrag',
      wiseEmail: 'Wise E-Mail',
      bankIban: 'Bank IBAN',
      bankHolder: 'Kontoinhaber',
      saveSettings: 'Einstellungen speichern',
      paymentHistory: 'Zahlungsverlauf',
      paymentsToUs: 'Eingezahlt',
      payoutsFromUs: 'Ausgezahlt',
      pending: 'Ausstehend',
      confirmed: 'Bestätigt',
      completed: 'Abgeschlossen',
      budgetExhausted: 'Budget erschöpft',
      pleaseTopUp: 'Bitte aufladen'
    },
    en: {
      title: 'Balance & Payouts',
      voucherBudget: 'Voucher Budget',
      availableBudget: 'Available Budget',
      freibetrag: 'Free Credit',
      paidCredit: 'Paid Credit',
      used: 'Used',
      earnings: 'Earnings',
      availableForPayout: 'Available for Payout',
      totalEarnings: 'Total Earnings',
      paidOut: 'Already Paid Out',
      topUp: 'Top Up Credit',
      requestPayout: 'Request Payout',
      payoutSettings: 'Payout Settings',
      noVoucherBudget: 'No voucher budget available',
      contactAdmin: 'Please contact admin for free credit or top up your balance.',
      paymentInstructions: 'Payment Details',
      copyIban: 'Copy IBAN',
      copyReference: 'Copy Reference',
      frequency: 'Payout Frequency',
      daily: 'Daily',
      weekly: 'Weekly',
      monthly: 'Monthly',
      manual: 'Manual',
      minAmount: 'Minimum Amount',
      wiseEmail: 'Wise Email',
      bankIban: 'Bank IBAN',
      bankHolder: 'Account Holder',
      saveSettings: 'Save Settings',
      paymentHistory: 'Payment History',
      paymentsToUs: 'Deposits',
      payoutsFromUs: 'Withdrawals',
      pending: 'Pending',
      confirmed: 'Confirmed',
      completed: 'Completed',
      budgetExhausted: 'Budget exhausted',
      pleaseTopUp: 'Please top up'
    },
    sq: {
      title: 'Bilanci & Pagesat',
      voucherBudget: 'Buxheti i Kuponëve',
      availableBudget: 'Buxheti i Disponueshëm',
      freibetrag: 'Kredi Falas',
      paidCredit: 'Kredi e Paguar',
      used: 'Përdorur',
      earnings: 'Të Ardhurat',
      availableForPayout: 'E Disponueshme për Pagesë',
      totalEarnings: 'Të Ardhurat Totale',
      paidOut: 'Tashmë e Paguar',
      topUp: 'Ngarko Kredit',
      requestPayout: 'Kërko Pagesë',
      payoutSettings: 'Cilësimet e Pagesës',
      noVoucherBudget: 'Asnjë buxhet kuponësh i disponueshëm',
      contactAdmin: 'Ju lutem kontaktoni adminin për kredi falas ose ngarkoni bilancin tuaj.',
      paymentInstructions: 'Detajet e Pagesës',
      copyIban: 'Kopjo IBAN',
      copyReference: 'Kopjo Referencën',
      frequency: 'Frekuenca e Pagesës',
      daily: 'Ditore',
      weekly: 'Javore',
      monthly: 'Mujore',
      manual: 'Manuale',
      minAmount: 'Shuma Minimale',
      wiseEmail: 'Wise Email',
      bankIban: 'IBAN Bankare',
      bankHolder: 'Mbajtësi i Llogarisë',
      saveSettings: 'Ruaj Cilësimet',
      paymentHistory: 'Historia e Pagesave',
      paymentsToUs: 'Depozitat',
      payoutsFromUs: 'Tërheqjet',
      pending: 'Në Pritje',
      confirmed: 'Konfirmuar',
      completed: 'Përfunduar',
      budgetExhausted: 'Buxheti u shterua',
      pleaseTopUp: 'Ju lutem ngarkoni'
    },
    tr: {
      title: 'Bakiye & Ödemeler',
      voucherBudget: 'Kupon Bütçesi',
      availableBudget: 'Kullanılabilir Bütçe',
      freibetrag: 'Ücretsiz Kredi',
      paidCredit: 'Ödenmiş Kredi',
      used: 'Kullanılmış',
      earnings: 'Kazançlar',
      availableForPayout: 'Ödeme için Kullanılabilir',
      totalEarnings: 'Toplam Kazançlar',
      paidOut: 'Zaten Ödendi',
      topUp: 'Bakiye Yükle',
      requestPayout: 'Ödeme Talep Et',
      payoutSettings: 'Ödeme Ayarları',
      noVoucherBudget: 'Kupon bütçesi mevcut değil',
      contactAdmin: 'Ücretsiz kredi için admin ile iletişime geçin veya bakiyenizi yükleyin.',
      paymentInstructions: 'Ödeme Bilgileri',
      copyIban: 'IBAN Kopyala',
      copyReference: 'Referans Kopyala',
      frequency: 'Ödeme Sıklığı',
      daily: 'Günlük',
      weekly: 'Haftalık',
      monthly: 'Aylık',
      manual: 'Manuel',
      minAmount: 'Minimum Tutar',
      wiseEmail: 'Wise E-posta',
      bankIban: 'Banka IBAN',
      bankHolder: 'Hesap Sahibi',
      saveSettings: 'Ayarları Kaydet',
      paymentHistory: 'Ödeme Geçmişi',
      paymentsToUs: 'Yatırımlar',
      payoutsFromUs: 'Çekimler',
      pending: 'Bekleyen',
      confirmed: 'Onaylandı',
      completed: 'Tamamlandı',
      budgetExhausted: 'Bütçe tükendi',
      pleaseTopUp: 'Lütfen yükleyin'
    }
  }[language] || {

  const fetchBudget = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/api/partner-budget/my-budget?token=${token}`);
      setBudget(response.data);
      setSettings(prev => ({
        ...prev,
        payout_frequency: response.data.payout_settings?.frequency || 'weekly',
        min_payout_amount: response.data.payout_settings?.min_amount || 50,
        wise_email: response.data.payout_settings?.wise_email || '',
        bank_iban: response.data.payout_settings?.bank_iban || '',
        bank_holder_name: response.data.payout_settings?.bank_holder_name || ''
      }));
    } catch (error) {
      console.error('Error fetching budget:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchPaymentHistory = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/api/partner-budget/my-payment-history?token=${token}`);
      setPaymentHistory({
        payments: response.data.payments_to_bidblitz || [],
        payouts: response.data.payouts_from_bidblitz || []
      });
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchBudget();
      fetchPaymentHistory();
    }
  }, [token, fetchBudget, fetchPaymentHistory]);

  const handleGetPaymentDetails = async () => {
    const amount = parseFloat(topUpAmount);
    if (!amount || amount < 50) {
      toast.error(language === 'de' ? 'Mindestbetrag: €50' : 'Minimum: €50');
      return;
    }

    try {
      const response = await axios.get(
        `${API}/api/partner-budget/wise-payment-details?token=${token}&amount=${amount}`
      );
      setPaymentDetails(response.data);
      toast.success(language === 'de' ? 'Überweisungsdaten generiert' : 'Payment details generated');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error');
    }
  };

  const handleSaveSettings = async () => {
    try {
      await axios.post(
        `${API}/api/partner-budget/update-payout-settings?token=${token}`,
        settings
      );
      toast.success(language === 'de' ? 'Einstellungen gespeichert' : 'Settings saved');
      setShowSettings(false);
      fetchBudget();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error');
    }
  };

  const handleRequestPayout = async () => {
    try {
      const response = await axios.post(`${API}/api/partner-budget/request-payout?token=${token}`);
      toast.success(response.data.message);
      fetchBudget();
      fetchPaymentHistory();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error');
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} kopiert!`);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="partner-budget">
      <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
        <Wallet className="w-6 h-6 text-amber-500" />
        {t.title}
      </h2>

      {/* Budget Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Voucher Budget Card */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-5 border border-amber-200">
          <div className="flex items-center gap-2 mb-4">
            <Gift className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-amber-800">{t.voucherBudget}</h3>
          </div>
          
          <div className="text-3xl font-bold text-amber-700 mb-4">
            €{(budget?.voucher_budget?.total_available || 0).toFixed(2)}
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-amber-600">{t.freibetrag}:</span>
              <span className="font-medium">
                €{(budget?.voucher_budget?.freibetrag_remaining || 0).toFixed(2)} / 
                €{(budget?.voucher_budget?.freibetrag_total || 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-amber-600">{t.paidCredit}:</span>
              <span className="font-medium">€{(budget?.voucher_budget?.paid_credit || 0).toFixed(2)}</span>
            </div>
          </div>

          {!budget?.can_create_vouchers && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {t.noVoucherBudget}
              </p>
            </div>
          )}

          <Button 
            onClick={() => setShowTopUp(true)}
            className="w-full mt-4 bg-amber-500 hover:bg-amber-600"
          >
            <Upload className="w-4 h-4 mr-2" />
            {t.topUp}
          </Button>
        </div>

        {/* Earnings Card */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border border-green-200">
          <div className="flex items-center gap-2 mb-4">
            <Euro className="w-5 h-5 text-green-600" />
            <h3 className="font-bold text-green-800">{t.earnings}</h3>
          </div>
          
          <div className="text-3xl font-bold text-green-700 mb-4">
            €{(budget?.earnings?.available_for_payout || 0).toFixed(2)}
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-green-600">{t.totalEarnings}:</span>
              <span className="font-medium">€{(budget?.earnings?.total_earnings || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-600">{t.paidOut}:</span>
              <span className="font-medium">€{(budget?.earnings?.total_paid_out || 0).toFixed(2)}</span>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button 
              onClick={handleRequestPayout}
              disabled={(budget?.earnings?.available_for_payout || 0) < (budget?.payout_settings?.min_amount || 50)}
              className="flex-1 bg-green-500 hover:bg-green-600"
            >
              <Download className="w-4 h-4 mr-2" />
              {t.requestPayout}
            </Button>
            <Button 
              onClick={() => setShowSettings(true)}
              variant="outline"
              className="border-green-300"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Top-Up Modal */}
      {showTopUp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-amber-500" />
              {t.topUp}
            </h3>

            {!paymentDetails ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Betrag (min. €50)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                    <Input
                      type="number"
                      value={topUpAmount}
                      onChange={(e) => setTopUpAmount(e.target.value)}
                      placeholder="100.00"
                      className="pl-8"
                      min="50"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  {[100, 250, 500, 1000].map(amount => (
                    <button
                      key={amount}
                      onClick={() => setTopUpAmount(String(amount))}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium ${
                        parseFloat(topUpAmount) === amount
                          ? 'border-amber-500 bg-amber-50 text-amber-700'
                          : 'border-gray-200 hover:border-amber-300'
                      }`}
                    >
                      €{amount}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowTopUp(false)} className="flex-1">
                    Abbrechen
                  </Button>
                  <Button onClick={handleGetPaymentDetails} className="flex-1 bg-amber-500 hover:bg-amber-600">
                    Weiter
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-800 mb-3">{t.paymentInstructions}</h4>
                  
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-gray-500">Empfänger:</p>
                      <p className="font-medium">{paymentDetails.payment_details.account_holder}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">IBAN:</p>
                      <div className="flex items-center gap-2">
                        <p className="font-mono font-medium">{paymentDetails.payment_details.iban}</p>
                        <button 
                          onClick={() => copyToClipboard(paymentDetails.payment_details.iban, 'IBAN')}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <p className="text-gray-500">BIC:</p>
                      <p className="font-mono">{paymentDetails.payment_details.bic}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Betrag:</p>
                      <p className="font-bold text-lg text-blue-700">
                        €{paymentDetails.payment_details.amount.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Verwendungszweck (wichtig!):</p>
                      <div className="flex items-center gap-2">
                        <p className="font-mono font-bold text-blue-800 bg-blue-100 px-2 py-1 rounded">
                          {paymentDetails.payment_details.reference}
                        </p>
                        <button 
                          onClick={() => copyToClipboard(paymentDetails.payment_details.reference, 'Referenz')}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                  <AlertCircle className="w-4 h-4 inline mr-2" />
                  {paymentDetails.instructions.de}
                </div>

                <Button 
                  onClick={() => { setShowTopUp(false); setPaymentDetails(null); setTopUpAmount(''); }}
                  className="w-full"
                >
                  Verstanden
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-green-500" />
              {t.payoutSettings}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">{t.frequency}</label>
                <select
                  value={settings.payout_frequency}
                  onChange={(e) => setSettings({...settings, payout_frequency: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="daily">{t.daily}</option>
                  <option value="weekly">{t.weekly}</option>
                  <option value="monthly">{t.monthly}</option>
                  <option value="manual">{t.manual}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">{t.minAmount}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                  <Input
                    type="number"
                    value={settings.min_payout_amount}
                    onChange={(e) => setSettings({...settings, min_payout_amount: parseFloat(e.target.value)})}
                    className="pl-8"
                    min="10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">{t.wiseEmail}</label>
                <Input
                  type="email"
                  value={settings.wise_email}
                  onChange={(e) => setSettings({...settings, wise_email: e.target.value})}
                  placeholder="ihre-email@wise.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">{t.bankIban}</label>
                <Input
                  value={settings.bank_iban}
                  onChange={(e) => setSettings({...settings, bank_iban: e.target.value})}
                  placeholder="DE89 3704 0044 0532 0130 00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">{t.bankHolder}</label>
                <Input
                  value={settings.bank_holder_name}
                  onChange={(e) => setSettings({...settings, bank_holder_name: e.target.value})}
                  placeholder="Max Mustermann"
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowSettings(false)} className="flex-1">
                  Abbrechen
                </Button>
                <Button onClick={handleSaveSettings} className="flex-1 bg-green-500 hover:bg-green-600">
                  {t.saveSettings}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment History */}
      <div className="bg-white rounded-xl p-5 border border-gray-200">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-500" />
          {t.paymentHistory}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Payments to BidBlitz */}
          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
              <ArrowUpRight className="w-4 h-4 text-amber-500" />
              {t.paymentsToUs}
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {paymentHistory.payments.length > 0 ? (
                paymentHistory.payments.map((p, i) => (
                  <div key={i} className="flex justify-between items-center p-2 bg-amber-50 rounded-lg text-sm">
                    <div>
                      <p className="font-medium">€{p.amount?.toFixed(2)}</p>
                      <p className="text-xs text-gray-500">{new Date(p.created_at).toLocaleDateString('de-DE')}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      p.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {p.status === 'confirmed' ? t.confirmed : t.pending}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400">Keine Einzahlungen</p>
              )}
            </div>
          </div>

          {/* Payouts from BidBlitz */}
          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
              <ArrowDownLeft className="w-4 h-4 text-green-500" />
              {t.payoutsFromUs}
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {paymentHistory.payouts.length > 0 ? (
                paymentHistory.payouts.map((p, i) => (
                  <div key={i} className="flex justify-between items-center p-2 bg-green-50 rounded-lg text-sm">
                    <div>
                      <p className="font-medium">€{p.amount?.toFixed(2)}</p>
                      <p className="text-xs text-gray-500">{new Date(p.created_at).toLocaleDateString('de-DE')}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      p.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {p.status === 'completed' ? t.completed : t.pending}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400">Keine Auszahlungen</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
