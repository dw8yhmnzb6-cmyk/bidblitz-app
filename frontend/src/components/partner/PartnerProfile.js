/**
 * Partner Profile Component
 * Handles partner settings, logo upload, and bank details
 */
import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Upload, CreditCard, User, Building2, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

const API = process.env.REACT_APP_BACKEND_URL;

// Business Types for display
const BUSINESS_TYPES = [
  { id: 'restaurant', name: 'Restaurant', icon: '🍕' },
  { id: 'bar', name: 'Bar & Club', icon: '🍺' },
  { id: 'cafe', name: 'Café', icon: '☕' },
  { id: 'gas_station', name: 'Tankstelle', icon: '⛽' },
  { id: 'cinema', name: 'Kino', icon: '🎬' },
  { id: 'retail', name: 'Einzelhandel', icon: '🛒' },
  { id: 'wellness', name: 'Wellness & Spa', icon: '💆' },
  { id: 'fitness', name: 'Fitness-Studio', icon: '🏋️' },
  { id: 'beauty', name: 'Friseur & Beauty', icon: '💇' },
  { id: 'hotel', name: 'Hotel & Unterkunft', icon: '🏨' },
  { id: 'entertainment', name: 'Unterhaltung', icon: '🎯' },
  { id: 'supermarket', name: 'Supermarkt', icon: '🛍️' },
  { id: 'pharmacy', name: 'Apotheke', icon: '💊' },
  { id: 'other', name: 'Sonstiges', icon: '🏪' },
];

const PartnerProfile = ({ token, partner, setPartner, t }) => {
  const [loading, setLoading] = useState(false);
  const [iban, setIban] = useState(partner?.iban || '');
  const [taxId, setTaxId] = useState(partner?.tax_id || '');

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('error') || 'Datei zu groß (max. 2MB)');
      return;
    }

    const formData = new FormData();
    formData.append('logo', file);

    try {
      setLoading(true);
      const response = await axios.post(
        `${API}/api/partner-portal/upload-logo?token=${token}`, 
        formData
      );
      toast.success(response.data.message || t('success'));
      
      // Update partner state
      const updatedPartner = { ...partner, logo_url: response.data.logo_url };
      setPartner(updatedPartner);
      localStorage.setItem('partner_data', JSON.stringify(updatedPartner));
    } catch (err) {
      toast.error(err.response?.data?.detail || t('error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBankDetails = async () => {
    try {
      setLoading(true);
      const response = await axios.put(
        `${API}/api/partner-portal/update-iban?token=${token}&iban=${encodeURIComponent(iban)}&tax_id=${encodeURIComponent(taxId || '')}`
      );
      toast.success(response.data.message || t('success'));
    } catch (err) {
      toast.error(err.response?.data?.detail || t('error'));
    } finally {
      setLoading(false);
    }
  };

  const businessType = BUSINESS_TYPES.find(bt => bt.id === partner?.business_type);

  return (
    <div className="space-y-6" data-testid="partner-profile">
      <h2 className="font-bold text-gray-800 text-xl">
        {t('profile') || 'Profil'} & {t('settings') || 'Einstellungen'}
      </h2>
      
      {/* Logo Upload */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Upload className="w-5 h-5 text-amber-500" />
          Logo
        </h3>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden">
            {partner?.logo_url ? (
              <img 
                src={partner.logo_url} 
                alt="Logo" 
                className="w-full h-full object-cover" 
              />
            ) : (
              <span className="text-3xl">{businessType?.icon || '🏪'}</span>
            )}
          </div>
          <div>
            <input
              type="file"
              id="logo-upload"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
              data-testid="logo-upload-input"
            />
            <label htmlFor="logo-upload" className="cursor-pointer">
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                asChild
                disabled={loading}
              >
                <span>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {t('uploadLogo') || 'Logo hochladen'}
                </span>
              </Button>
            </label>
            <p className="text-xs text-gray-400 mt-1">Max. 2MB (JPG, PNG, WebP)</p>
          </div>
        </div>
      </div>
      
      {/* Bank Details */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-amber-500" />
          {t('bankDetails') || 'Bankdaten'}
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('iban') || 'IBAN'}
            </label>
            <Input
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              placeholder="DE89 3704 0044 0532 0130 00"
              data-testid="profile-iban-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('taxId') || 'Steuernummer'}
            </label>
            <Input
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              placeholder="DE123456789"
              data-testid="profile-tax-input"
            />
          </div>
          <Button 
            onClick={handleSaveBankDetails}
            disabled={loading}
            className="bg-amber-500 hover:bg-amber-600"
            data-testid="save-bank-details-btn"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {t('saveBankDetails') || 'Bankdaten speichern'}
          </Button>
        </div>
      </div>
      
      {/* Account Info */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-amber-500" />
          {t('accountInfo') || 'Kontoinformationen'}
        </h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-gray-500 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              {t('businessName') || 'Firmenname'}:
            </span>
            <span className="font-medium text-gray-800">{partner?.name || partner?.business_name || '-'}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-gray-500">{t('email') || 'E-Mail'}:</span>
            <span className="font-medium text-gray-800">{partner?.email || '-'}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-gray-500">{t('businessType') || 'Geschäftstyp'}:</span>
            <span className="font-medium text-gray-800">
              {businessType?.icon} {businessType?.name || t('other') || 'Unbekannt'}
            </span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-500">{t('commission') || 'Provision'}:</span>
            <span className="font-medium text-gray-800">{partner?.commission_rate || 10}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PartnerProfile;
