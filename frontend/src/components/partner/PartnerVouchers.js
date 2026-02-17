/**
 * Partner Vouchers Component
 * Handles voucher listing and creation
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Ticket, Plus, Loader2, ChevronLeft } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

const API = process.env.REACT_APP_BACKEND_URL;

const PartnerVouchers = ({ token, partner, fetchDashboard, t }) => {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newVoucher, setNewVoucher] = useState({
    name: '',
    description: '',
    value: '',
    price: '',
    quantity: 1,
    valid_until: '',
    terms: ''
  });

  // Fetch vouchers
  useEffect(() => {
    fetchVouchers();
  }, [token]);

  const fetchVouchers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/api/partner-portal/vouchers?token=${token}`);
      setVouchers(response.data.vouchers || []);
    } catch (err) {
      console.error('Vouchers fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVoucher = async (e) => {
    e.preventDefault();
    if (!newVoucher.name || !newVoucher.value || !newVoucher.price) {
      toast.error(t('error') || 'Bitte füllen Sie alle Pflichtfelder aus');
      return;
    }

    try {
      setLoading(true);
      await axios.post(`${API}/api/partner-portal/vouchers?token=${token}`, {
        name: newVoucher.name,
        description: newVoucher.description,
        value: parseFloat(newVoucher.value),
        price: parseFloat(newVoucher.price),
        quantity: parseInt(newVoucher.quantity) || 1,
        valid_until: newVoucher.valid_until || null,
        terms: newVoucher.terms
      });

      toast.success(t('success') || 'Gutschein erstellt');
      setShowCreate(false);
      setNewVoucher({
        name: '',
        description: '',
        value: '',
        price: '',
        quantity: 1,
        valid_until: '',
        terms: ''
      });
      fetchVouchers();
      if (fetchDashboard) fetchDashboard();
    } catch (err) {
      toast.error(err.response?.data?.detail || t('error'));
    } finally {
      setLoading(false);
    }
  };

  // Create Voucher View
  if (showCreate) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6" data-testid="partner-create-voucher">
        <button
          onClick={() => setShowCreate(false)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          {t('cancel') || 'Zurück'}
        </button>
        
        <h2 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
          <Plus className="w-5 h-5 text-amber-500" />
          {t('createVoucher') || 'Neuen Gutschein erstellen'}
        </h2>
        
        <form onSubmit={handleCreateVoucher} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('voucherName') || 'Name'} *
              </label>
              <Input
                value={newVoucher.name}
                onChange={(e) => setNewVoucher({ ...newVoucher, name: e.target.value })}
                placeholder="z.B. 20€ Essensgutschein"
                required
                data-testid="voucher-name-input"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('value') || 'Wert'} (€) *
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={newVoucher.value}
                onChange={(e) => setNewVoucher({ ...newVoucher, value: e.target.value })}
                placeholder="20.00"
                required
                data-testid="voucher-value-input"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('price') || 'Verkaufspreis'} (€) *
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={newVoucher.price}
                onChange={(e) => setNewVoucher({ ...newVoucher, price: e.target.value })}
                placeholder="15.00"
                required
                data-testid="voucher-price-input"
              />
              <p className="text-xs text-gray-400 mt-1">
                {t('commission') || 'Ihre Auszahlung'}: €
                {newVoucher.price 
                  ? (parseFloat(newVoucher.price) * (1 - (partner?.commission_rate || 10) / 100)).toFixed(2) 
                  : '0.00'}
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('quantity') || 'Anzahl'}
              </label>
              <Input
                type="number"
                min="1"
                value={newVoucher.quantity}
                onChange={(e) => setNewVoucher({ ...newVoucher, quantity: e.target.value })}
                data-testid="voucher-quantity-input"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('validUntil') || 'Gültig bis'}
              </label>
              <Input
                type="date"
                value={newVoucher.valid_until}
                onChange={(e) => setNewVoucher({ ...newVoucher, valid_until: e.target.value })}
                data-testid="voucher-valid-until-input"
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('description') || 'Beschreibung'}
              </label>
              <textarea
                value={newVoucher.description}
                onChange={(e) => setNewVoucher({ ...newVoucher, description: e.target.value })}
                placeholder="Details zum Gutschein..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                data-testid="voucher-description-input"
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('terms') || 'Bedingungen'}
              </label>
              <Input
                value={newVoucher.terms}
                onChange={(e) => setNewVoucher({ ...newVoucher, terms: e.target.value })}
                placeholder="z.B. Nicht mit anderen Aktionen kombinierbar"
                data-testid="voucher-terms-input"
              />
            </div>
          </div>
          
          <div className="flex gap-3 mt-6">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setShowCreate(false)} 
              className="flex-1"
              data-testid="voucher-cancel-btn"
            >
              {t('cancel') || 'Abbrechen'}
            </Button>
            <Button 
              type="submit" 
              disabled={loading} 
              className="flex-1 bg-amber-500 hover:bg-amber-600"
              data-testid="voucher-submit-btn"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (t('save') || 'Erstellen')}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  // Vouchers List View
  return (
    <div className="space-y-6" data-testid="partner-vouchers">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-800">{t('myVouchers') || 'Ihre Gutscheine'}</h2>
        <Button 
          onClick={() => setShowCreate(true)} 
          className="bg-amber-500 hover:bg-amber-600"
          data-testid="create-voucher-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('createVoucher') || 'Neuer Gutschein'}
        </Button>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-amber-500" />
          </div>
        ) : vouchers.length > 0 ? (
          <div className="divide-y">
            {vouchers.map((v) => (
              <div 
                key={v.id || v._id || v.code} 
                className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                data-testid={`voucher-item-${v.code}`}
              >
                <div>
                  <p className="font-medium text-gray-800">{v.name}</p>
                  <p className="text-sm text-gray-500">{v.code}</p>
                  {v.description && (
                    <p className="text-xs text-gray-400 mt-1 line-clamp-1">{v.description}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-800">€{v.value?.toFixed(2) || '0.00'}</p>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    v.is_redeemed ? 'bg-gray-100 text-gray-600' :
                    v.is_sold ? 'bg-blue-100 text-blue-600' :
                    'bg-green-100 text-green-600'
                  }`}>
                    {v.is_redeemed 
                      ? (t('redeemed') || 'Eingelöst') 
                      : v.is_sold 
                        ? (t('sold') || 'Verkauft') 
                        : (t('available') || 'Verfügbar')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-400">
            <Ticket className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>{t('noVouchers') || 'Noch keine Gutscheine erstellt'}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PartnerVouchers;
