/**
 * Partner Marketing Components - New Features for Partner Portal
 * - Referral System
 * - QR Code Generator
 * - Flash Sales
 * - Social Sharing
 * - Ratings Overview
 */
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Users, Gift, QrCode, Share2, Star, Clock, Plus, Copy, 
  Download, Facebook, Twitter, Mail, MessageCircle, Loader2,
  TrendingUp, ExternalLink, Zap, MapPin, Printer
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

const API = process.env.REACT_APP_BACKEND_URL;

// ==================== INLINE PRINT TEMPLATES ====================

const PrintTemplatesInline = ({ qrBase64, partnerName, t }) => {
  const [selectedTemplate, setSelectedTemplate] = useState('table_tent');
  const printRef = useRef(null);

  const templates = [
    { id: 'table_tent', name: 'Tischaufsteller', size: '10x15cm', icon: '🪑' },
    { id: 'flyer', name: 'Flyer A6', size: '10.5x14.8cm', icon: '📄' },
    { id: 'window', name: 'Schaufenster', size: '15x15cm', icon: '🪟' },
    { id: 'receipt', name: 'Kassenbon', size: '8cm breit', icon: '🧾' }
  ];

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html><html><head><title>BidBlitz QR - ${partnerName}</title>
      <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui}
      @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>
      </head><body>${printContent.innerHTML}</body></html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
  };

  return (
    <div className="space-y-6">
      {/* Template Selection */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {templates.map((tmpl) => (
          <button
            key={tmpl.id}
            onClick={() => setSelectedTemplate(tmpl.id)}
            className={`p-3 rounded-xl border-2 text-center transition-all ${
              selectedTemplate === tmpl.id ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <span className="text-2xl block mb-1">{tmpl.icon}</span>
            <p className="font-medium text-gray-800 text-sm">{tmpl.name}</p>
            <p className="text-xs text-gray-500">{tmpl.size}</p>
          </button>
        ))}
      </div>

      {/* Preview */}
      <div className="bg-gray-100 rounded-xl p-6 flex justify-center">
        <div 
          ref={printRef}
          className={`bg-white shadow-xl flex flex-col items-center justify-center p-4 ${
            selectedTemplate === 'table_tent' ? 'w-56 h-80' :
            selectedTemplate === 'flyer' ? 'w-60 h-96' :
            selectedTemplate === 'window' ? 'w-64 h-64' : 'w-40 h-64'
          }`}
          style={{ border: '3px solid #F59E0B', borderRadius: selectedTemplate === 'window' ? 0 : 12 }}
        >
          <p className="text-xl font-bold text-gray-800 mb-1">🎯 BidBlitz</p>
          <p className="text-amber-600 font-medium text-sm mb-2">{partnerName}</p>
          <p className="text-xs text-gray-500 mb-3">Scannen für Angebote!</p>
          {qrBase64 && (
            <img 
              src={qrBase64} 
              alt="QR" 
              className={selectedTemplate === 'receipt' ? 'w-24 h-24' : selectedTemplate === 'window' ? 'w-36 h-36' : 'w-32 h-32'}
            />
          )}
          <p className="text-amber-600 font-bold text-xs mt-3">Gutscheine • Rabatte</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-center">
        <Button onClick={handlePrint} className="bg-amber-500 hover:bg-amber-600">
          <Printer className="w-4 h-4 mr-2" /> Drucken
        </Button>
      </div>

      {/* Tips */}
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
        <h4 className="font-medium text-blue-800 mb-2">💡 Drucktipps</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Dickes Papier (200g/m²) für Tischaufsteller</li>
          <li>• Laminieren für längere Haltbarkeit</li>
          <li>• QR-Codes auf Augenhöhe platzieren</li>
        </ul>
      </div>
    </div>
  );
};

// ==================== PARTNER REFERRAL ====================

export const PartnerReferral = ({ token, t }) => {
  const [loading, setLoading] = useState(true);
  const [referralData, setReferralData] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchReferralData();
  }, [token]);

  const fetchReferralData = async () => {
    try {
      setLoading(true);
      const [codeRes, statsRes] = await Promise.all([
        axios.get(`${API}/api/partner-referral/my-code?token=${token}`),
        axios.get(`${API}/api/partner-referral/stats?token=${token}`)
      ]);
      setReferralData(codeRes.data);
      setStats(statsRes.data);
    } catch (err) {
      console.error('Referral fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(referralData?.link || '');
    toast.success(t?.('copied') || 'Link kopiert!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="partner-referral">
      <h2 className="font-bold text-gray-800 text-xl flex items-center gap-2">
        <Users className="w-6 h-6 text-amber-500" />
        {t?.('referral') || 'Partner werben Partner'}
      </h2>

      {/* Referral Link Card */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl p-6 text-white">
        <h3 className="font-bold text-lg mb-2">
          {t?.('yourReferralCode') || 'Dein Empfehlungscode'}
        </h3>
        <div className="bg-white/20 rounded-lg p-4 flex items-center justify-between mb-4">
          <code className="text-2xl font-mono font-bold">{referralData?.code}</code>
          <Button 
            onClick={copyLink} 
            variant="ghost" 
            className="text-white hover:bg-white/20"
            data-testid="copy-referral-link"
          >
            <Copy className="w-5 h-5" />
          </Button>
        </div>
        <p className="text-sm opacity-90">
          {t?.('referralBonus') || 'Erhalte €10 für jeden geworbenen Partner!'}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-gray-500 text-sm">{t?.('totalReferrals') || 'Empfehlungen'}</p>
          <p className="text-2xl font-bold text-gray-800">{stats?.total_referrals || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-gray-500 text-sm">{t?.('successful') || 'Erfolgreich'}</p>
          <p className="text-2xl font-bold text-green-600">{stats?.successful_referrals || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-gray-500 text-sm">{t?.('pendingBonus') || 'Ausstehend'}</p>
          <p className="text-2xl font-bold text-amber-600">€{stats?.pending_bonus?.toFixed(2) || '0.00'}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-gray-500 text-sm">{t?.('totalEarned') || 'Verdient'}</p>
          <p className="text-2xl font-bold text-blue-600">€{stats?.total_earned?.toFixed(2) || '0.00'}</p>
        </div>
      </div>

      {/* Recent Referrals */}
      {stats?.referrals?.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-bold text-gray-800">{t?.('recentReferrals') || 'Letzte Empfehlungen'}</h3>
          </div>
          <div className="divide-y">
            {stats.referrals.slice(0, 5).map((ref, i) => (
              <div key={i} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">{ref.referred_name}</p>
                  <p className="text-xs text-gray-500">{ref.business_type}</p>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    ref.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'
                  }`}>
                    {ref.status === 'completed' ? (t?.('completed') || 'Abgeschlossen') : (t?.('pending') || 'Ausstehend')}
                  </span>
                  <p className="text-sm font-medium text-gray-800 mt-1">+€{ref.bonus}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== PARTNER QR CODES ====================

export const PartnerQRCodes = ({ token, partner, t }) => {
  const [loading, setLoading] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [selectedType, setSelectedType] = useState('profile');
  const [stats, setStats] = useState(null);
  const [showPrintTemplates, setShowPrintTemplates] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const generateQR = useCallback(async (type = 'profile') => {
    if (!token) {
      console.log('No token available for QR generation');
      return;
    }
    try {
      setLoading(true);
      setErrorMsg(null);
      setSelectedType(type);
      console.log('Generating QR for type:', type, 'with token:', token.substring(0, 10) + '...');
      const response = await axios.get(`${API}/api/partner-qr/generate?token=${token}&qr_type=${type}`);
      setQrData(response.data);
      console.log('QR generated successfully');
    } catch (err) {
      console.error('QR generate error:', err);
      setErrorMsg('Fehler beim Generieren');
      toast.error('Fehler beim Generieren');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchStats = useCallback(async () => {
    if (!token) return;
    try {
      const response = await axios.get(`${API}/api/partner-qr/stats?token=${token}`);
      setStats(response.data);
    } catch (err) {
      console.error('QR stats error:', err);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      generateQR('profile');
      fetchStats();
    }
  }, [token, generateQR, fetchStats]);

  const downloadQR = () => {
    window.open(`${API}/api/partner-qr/download?token=${token}&qr_type=${selectedType}&size=500`, '_blank');
  };

  // Print Templates View
  if (showPrintTemplates && qrData?.qr_base64) {
    return (
      <div className="space-y-6" data-testid="partner-qr-print">
        <button
          onClick={() => setShowPrintTemplates(false)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
        >
          <span>←</span> {t?.('backToQR') || 'Zurück zu QR-Codes'}
        </button>
        
        <h2 className="font-bold text-gray-800 text-xl flex items-center gap-2">
          <QrCode className="w-6 h-6 text-amber-500" />
          {t?.('printTemplates') || 'Druckvorlagen'}
        </h2>

        {/* Inline Print Templates */}
        <PrintTemplatesInline 
          qrBase64={qrData.qr_base64}
          partnerName={partner?.business_name || partner?.name}
          t={t}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="partner-qr-codes">
      <h2 className="font-bold text-gray-800 text-xl flex items-center gap-2">
        <QrCode className="w-6 h-6 text-amber-500" />
        {t?.('qrCodes') || 'QR-Codes für Marketing'}
      </h2>

      {/* QR Type Selection */}
      <div className="flex gap-2 flex-wrap">
        {['profile', 'vouchers', 'menu'].map((type) => (
          <Button
            key={type}
            variant={selectedType === type ? 'default' : 'outline'}
            onClick={() => generateQR(type)}
            className={selectedType === type ? 'bg-amber-500 hover:bg-amber-600' : ''}
            data-testid={`qr-type-${type}`}
          >
            {type === 'profile' ? (t?.('profile') || 'Profil') :
             type === 'vouchers' ? (t?.('vouchers') || 'Gutscheine') :
             (t?.('menu') || 'Speisekarte')}
          </Button>
        ))}
      </div>

      {/* QR Code Display */}
      <div className="bg-white rounded-xl p-6 shadow-sm text-center">
        {loading ? (
          <Loader2 className="w-12 h-12 animate-spin text-amber-500 mx-auto" />
        ) : qrData?.qr_base64 ? (
          <>
            <img 
              src={qrData.qr_base64} 
              alt="QR Code" 
              className="w-64 h-64 mx-auto mb-4"
            />
            <p className="text-sm text-gray-500 mb-4">{qrData.target_url}</p>
            <div className="flex gap-2 justify-center flex-wrap">
              <Button onClick={downloadQR} className="bg-amber-500 hover:bg-amber-600">
                <Download className="w-4 h-4 mr-2" />
                {t?.('download') || 'Herunterladen'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigator.clipboard.writeText(qrData.target_url).then(() => toast.success('Link kopiert!'))}
              >
                <Copy className="w-4 h-4 mr-2" />
                {t?.('copyLink') || 'Link kopieren'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowPrintTemplates(true)}
              >
                🖨️ {t?.('printTemplates') || 'Druckvorlagen'}
              </Button>
            </div>
          </>
        ) : null}
      </div>

      {/* Stats */}
      {stats && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4">{t?.('qrStats') || 'QR-Code Statistiken'}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-gray-500 text-sm">{t?.('totalScans') || 'Scans gesamt'}</p>
              <p className="text-2xl font-bold text-gray-800">{stats.total_scans || 0}</p>
            </div>
            <div>
              <p className="text-gray-500 text-sm">{t?.('qrCodesCreated') || 'QR-Codes erstellt'}</p>
              <p className="text-2xl font-bold text-gray-800">{stats.total_qr_codes || 0}</p>
            </div>
          </div>
        </div>
      )}

      {/* Print Templates Info */}
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
        <h4 className="font-medium text-blue-800 mb-2">{t?.('printTip') || 'Tipp: Druckvorlagen'}</h4>
        <p className="text-sm text-blue-700">
          {t?.('printTipDescription') || 'Nutzen Sie QR-Codes auf Tischaufstellern, Flyern oder Schaufenstern, um mehr Kunden zu erreichen!'}
        </p>
      </div>
    </div>
  );
};

// ==================== PARTNER FLASH SALES ====================

export const PartnerFlashSales = ({ token, t }) => {
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newSale, setNewSale] = useState({
    name: '',
    description: '',
    discount_percent: 20,
    start_time: '',
    end_time: '',
    notify_customers: true
  });

  useEffect(() => {
    fetchSales();
  }, [token]);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/api/partner-flash-sales/my-sales?token=${token}`);
      setSales(response.data.flash_sales || []);
    } catch (err) {
      console.error('Flash sales error:', err);
    } finally {
      setLoading(false);
    }
  };

  const createSale = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/api/partner-flash-sales/create?token=${token}`, newSale);
      toast.success(t?.('saleCreated') || 'Aktion erstellt!');
      setShowCreate(false);
      setNewSale({ name: '', description: '', discount_percent: 20, start_time: '', end_time: '', notify_customers: true });
      fetchSales();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler');
    }
  };

  const cancelSale = async (saleId) => {
    try {
      await axios.delete(`${API}/api/partner-flash-sales/${saleId}?token=${token}`);
      toast.success(t?.('saleCancelled') || 'Aktion abgebrochen');
      fetchSales();
    } catch (err) {
      toast.error('Fehler');
    }
  };

  return (
    <div className="space-y-6" data-testid="partner-flash-sales">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-800 text-xl flex items-center gap-2">
          <Zap className="w-6 h-6 text-amber-500" />
          {t?.('flashSales') || 'Flash Sales & Happy Hour'}
        </h2>
        <Button onClick={() => setShowCreate(true)} className="bg-amber-500 hover:bg-amber-600">
          <Plus className="w-4 h-4 mr-2" />
          {t?.('createSale') || 'Neue Aktion'}
        </Button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4">{t?.('newFlashSale') || 'Neue Flash Sale Aktion'}</h3>
          <form onSubmit={createSale} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t?.('name') || 'Name'}</label>
              <Input
                value={newSale.name}
                onChange={(e) => setNewSale({ ...newSale, name: e.target.value })}
                placeholder="z.B. Happy Hour Freitag"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t?.('discount') || 'Rabatt'} (%)</label>
                <Input
                  type="number"
                  min="5"
                  max="90"
                  value={newSale.discount_percent}
                  onChange={(e) => setNewSale({ ...newSale, discount_percent: parseInt(e.target.value) })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t?.('startTime') || 'Start'}</label>
                <Input
                  type="datetime-local"
                  value={newSale.start_time}
                  onChange={(e) => setNewSale({ ...newSale, start_time: e.target.value })}
                  required
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">{t?.('endTime') || 'Ende'}</label>
                <Input
                  type="datetime-local"
                  value={newSale.end_time}
                  onChange={(e) => setNewSale({ ...newSale, end_time: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={newSale.notify_customers}
                onChange={(e) => setNewSale({ ...newSale, notify_customers: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm text-gray-600">{t?.('notifyCustomers') || 'Kunden benachrichtigen'}</span>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)} className="flex-1">
                {t?.('cancel') || 'Abbrechen'}
              </Button>
              <Button type="submit" className="flex-1 bg-amber-500 hover:bg-amber-600">
                {t?.('create') || 'Erstellen'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Sales List */}
      {loading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      ) : sales.length > 0 ? (
        <div className="space-y-4">
          {sales.map((sale) => (
            <div 
              key={sale.id} 
              className={`bg-white rounded-xl p-4 shadow-sm border-l-4 ${
                sale.is_active ? 'border-green-500' : 
                sale.status === 'scheduled' ? 'border-blue-500' : 'border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-gray-800">{sale.name}</h4>
                  <p className="text-sm text-gray-500">
                    {new Date(sale.start_time).toLocaleString('de-DE')} - {new Date(sale.end_time).toLocaleString('de-DE')}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-amber-500">-{sale.discount_percent}%</span>
                  <p className={`text-xs ${sale.is_active ? 'text-green-600' : 'text-gray-500'}`}>
                    {sale.is_active ? (t?.('active') || 'Aktiv') : 
                     sale.status === 'scheduled' ? (t?.('scheduled') || 'Geplant') : 
                     (t?.('ended') || 'Beendet')}
                  </p>
                </div>
              </div>
              {sale.status === 'scheduled' && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="mt-2 text-red-500"
                  onClick={() => cancelSale(sale.id)}
                >
                  {t?.('cancel') || 'Abbrechen'}
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl p-8 text-center text-gray-400">
          <Zap className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>{t?.('noSales') || 'Noch keine Aktionen erstellt'}</p>
        </div>
      )}
    </div>
  );
};

// ==================== PARTNER SOCIAL SHARING ====================

export const PartnerSocialSharing = ({ token, t }) => {
  const [loading, setLoading] = useState(true);
  const [shareLinks, setShareLinks] = useState(null);
  const [stats, setStats] = useState(null);
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [linksRes, statsRes, suggestionsRes] = await Promise.all([
        axios.get(`${API}/api/partner-social/share-links?token=${token}`),
        axios.get(`${API}/api/partner-social/stats?token=${token}`),
        axios.get(`${API}/api/partner-social/suggested-posts?token=${token}`)
      ]);
      setShareLinks(linksRes.data);
      setStats(statsRes.data);
      setSuggestions(suggestionsRes.data.suggestions || []);
    } catch (err) {
      console.error('Social data error:', err);
    } finally {
      setLoading(false);
    }
  };

  const platformIcons = {
    facebook: <Facebook className="w-5 h-5" />,
    twitter: <Twitter className="w-5 h-5" />,
    whatsapp: <MessageCircle className="w-5 h-5" />,
    email: <Mail className="w-5 h-5" />,
    copy: <Copy className="w-5 h-5" />
  };

  const platformColors = {
    facebook: 'bg-blue-600 hover:bg-blue-700',
    twitter: 'bg-black hover:bg-gray-800',
    whatsapp: 'bg-green-500 hover:bg-green-600',
    telegram: 'bg-blue-500 hover:bg-blue-600',
    linkedin: 'bg-blue-700 hover:bg-blue-800',
    email: 'bg-gray-600 hover:bg-gray-700',
    copy: 'bg-gray-500 hover:bg-gray-600'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="partner-social">
      <h2 className="font-bold text-gray-800 text-xl flex items-center gap-2">
        <Share2 className="w-6 h-6 text-amber-500" />
        {t?.('socialSharing') || 'Social Media Sharing'}
      </h2>

      {/* Share Buttons */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="font-bold text-gray-800 mb-4">{t?.('shareNow') || 'Jetzt teilen'}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {shareLinks?.share_links && Object.entries(shareLinks.share_links).map(([platform, data]) => (
            <a
              key={platform}
              href={data.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center justify-center gap-2 p-3 rounded-lg text-white ${platformColors[platform] || 'bg-gray-500'}`}
            >
              {platformIcons[platform] || <ExternalLink className="w-5 h-5" />}
              <span className="text-sm font-medium">{data.name}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4">{t?.('shareStats') || 'Sharing-Statistiken'}</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-800">{stats.total_shares || 0}</p>
              <p className="text-sm text-gray-500">{t?.('shares') || 'Geteilt'}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-600">{stats.total_clicks || 0}</p>
              <p className="text-sm text-gray-500">{t?.('clicks') || 'Klicks'}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{stats.conversions || 0}</p>
              <p className="text-sm text-gray-500">{t?.('conversions') || 'Aktionen'}</p>
            </div>
          </div>
          {stats.top_platform && (
            <p className="text-sm text-gray-500 text-center">
              🏆 {t?.('topPlatform') || 'Beste Plattform'}: <span className="font-medium">{stats.top_platform}</span>
            </p>
          )}
        </div>
      )}

      {/* Post Suggestions */}
      {suggestions.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4">{t?.('postIdeas') || 'Post-Ideen'}</h3>
          <div className="space-y-4">
            {suggestions.map((suggestion, i) => (
              <div key={i} className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-800 mb-2">{suggestion.title}</h4>
                <p className="text-sm text-gray-600 mb-2">{suggestion.text}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">⏰ {suggestion.best_time}</span>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(suggestion.text);
                      toast.success('Text kopiert!');
                    }}
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Kopieren
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== PARTNER RATINGS OVERVIEW ====================

export const PartnerRatingsOverview = ({ token, partnerId, t }) => {
  const [loading, setLoading] = useState(true);
  const [ratings, setRatings] = useState(null);

  useEffect(() => {
    fetchRatings();
  }, [partnerId]);

  const fetchRatings = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/api/partner-ratings/partner/${partnerId}`);
      setRatings(response.data);
    } catch (err) {
      console.error('Ratings error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="partner-ratings-overview">
      <h2 className="font-bold text-gray-800 text-xl flex items-center gap-2">
        <Star className="w-6 h-6 text-amber-500" />
        {t?.('customerRatings') || 'Kundenbewertungen'}
      </h2>

      {/* Overall Rating */}
      <div className="bg-white rounded-xl p-6 shadow-sm text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star 
              key={star} 
              className={`w-8 h-8 ${star <= (ratings?.average_rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`}
            />
          ))}
        </div>
        <p className="text-3xl font-bold text-gray-800">{ratings?.average_rating?.toFixed(1) || '0.0'}</p>
        <p className="text-sm text-gray-500">{ratings?.total_ratings || 0} {t?.('reviews') || 'Bewertungen'}</p>
        {ratings?.recommend_rate > 0 && (
          <p className="text-sm text-green-600 mt-2">
            👍 {ratings.recommend_rate}% {t?.('recommend') || 'würden empfehlen'}
          </p>
        )}
      </div>

      {/* Rating Distribution */}
      {ratings?.distribution && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4">{t?.('distribution') || 'Verteilung'}</h3>
          {[5, 4, 3, 2, 1].map((star) => {
            const count = ratings.distribution[star] || 0;
            const percent = ratings.total_ratings > 0 ? (count / ratings.total_ratings * 100) : 0;
            return (
              <div key={star} className="flex items-center gap-2 mb-2">
                <span className="text-sm w-6">{star}★</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-amber-500 rounded-full h-2" 
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <span className="text-sm text-gray-500 w-8">{count}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent Reviews */}
      {ratings?.ratings?.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-bold text-gray-800">{t?.('recentReviews') || 'Aktuelle Bewertungen'}</h3>
          </div>
          <div className="divide-y">
            {ratings.ratings.slice(0, 5).map((review, i) => (
              <div key={i} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-800">{review.user_name}</span>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star 
                        key={star} 
                        className={`w-4 h-4 ${star <= review.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`}
                      />
                    ))}
                  </div>
                </div>
                {review.comment && (
                  <p className="text-sm text-gray-600">{review.comment}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(review.created_at).toLocaleDateString('de-DE')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default {
  PartnerReferral,
  PartnerQRCodes,
  PartnerFlashSales,
  PartnerSocialSharing,
  PartnerRatingsOverview
};
