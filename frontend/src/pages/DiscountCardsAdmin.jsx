import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Plus, Trash2, Edit, Tag, Percent, 
  Calendar, Users, Store, CheckCircle, XCircle,
  Gift, TrendingUp, Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Übersetzungen
const translations = {
  de: {
    title: 'Rabattkarten-Verwaltung',
    back: 'Zurück',
    createCard: 'Neue Rabattkarte',
    name: 'Name',
    description: 'Beschreibung',
    discountType: 'Rabatt-Typ',
    percentage: 'Prozent (%)',
    fixed: 'Fester Betrag (€)',
    discountValue: 'Rabatt-Wert',
    categories: 'Kategorien (kommagetrennt)',
    minPurchase: 'Mindestbestellwert (€)',
    maxDiscount: 'Max. Rabatt (€)',
    validFrom: 'Gültig ab',
    validUntil: 'Gültig bis',
    appliesToAll: 'Gilt für alle Kunden',
    active: 'Aktiv',
    inactive: 'Inaktiv',
    save: 'Speichern',
    cancel: 'Abbrechen',
    delete: 'Löschen',
    edit: 'Bearbeiten',
    noCards: 'Keine Rabattkarten vorhanden',
    usageCount: 'Nutzungen',
    totalSaved: 'Gesamt gespart',
    confirmDelete: 'Wirklich löschen?',
    created: 'Rabattkarte erstellt',
    updated: 'Rabattkarte aktualisiert',
    deleted: 'Rabattkarte gelöscht',
    error: 'Fehler aufgetreten'
  },
  en: {
    title: 'Discount Card Management',
    back: 'Back',
    createCard: 'New Discount Card',
    name: 'Name',
    description: 'Description',
    discountType: 'Discount Type',
    percentage: 'Percentage (%)',
    fixed: 'Fixed Amount (€)',
    discountValue: 'Discount Value',
    categories: 'Categories (comma-separated)',
    minPurchase: 'Minimum Purchase (€)',
    maxDiscount: 'Max. Discount (€)',
    validFrom: 'Valid From',
    validUntil: 'Valid Until',
    appliesToAll: 'Applies to All Customers',
    active: 'Active',
    inactive: 'Inactive',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    noCards: 'No discount cards available',
    usageCount: 'Usage Count',
    totalSaved: 'Total Saved',
    confirmDelete: 'Really delete?',
    created: 'Discount card created',
    updated: 'Discount card updated',
    deleted: 'Discount card deleted',
    error: 'Error occurred'
  }
};

export default function DiscountCardsAdmin() {
  const navigate = useNavigate();
  const [language] = useState(localStorage.getItem('language') || 'de');
  const t = translations[language] || translations.de;
  
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    discount_type: 'percentage',
    discount_value: 10,
    buy_quantity: 2,
    free_quantity: 1,
    pay_quantity: 2,
    categories: '',
    specific_articles: '',
    article_name: '',
    min_purchase: 0,
    max_discount: '',
    valid_from: '',
    valid_until: '',
    applies_to_all: true,
    is_active: true
  });

  const token = localStorage.getItem('bidblitz_token');

  const fetchCards = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/discount-cards/admin/list`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCards(data.cards || []);
      }
    } catch (err) {
      console.error('Error fetching cards:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const payload = {
      ...formData,
      discount_value: parseFloat(formData.discount_value) || 0,
      buy_quantity: formData.discount_type === 'buy_x_get_y' ? parseInt(formData.buy_quantity) || 2 : null,
      free_quantity: formData.discount_type === 'buy_x_get_y' ? parseInt(formData.free_quantity) || 1 : null,
      pay_quantity: formData.discount_type === 'buy_x_pay_y' ? parseInt(formData.pay_quantity) || 2 : null,
      min_purchase: parseFloat(formData.min_purchase) || 0,
      max_discount: formData.max_discount ? parseFloat(formData.max_discount) : null,
      categories: formData.categories ? formData.categories.split(',').map(c => c.trim()).filter(c => c) : [],
      specific_articles: formData.specific_articles ? formData.specific_articles.split(',').map(a => a.trim()).filter(a => a) : [],
      article_name: formData.article_name || null
    };

    try {
      let res;
      if (editingCard) {
        res = await fetch(`${API_URL}/api/discount-cards/admin/${editingCard.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(`${API_URL}/api/discount-cards/admin/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        toast.success(editingCard ? t.updated : t.created);
        setShowForm(false);
        setEditingCard(null);
        resetForm();
        fetchCards();
      } else {
        const error = await res.json();
        toast.error(error.detail || t.error);
      }
    } catch (err) {
      toast.error(t.error);
    }
  };

  const handleDelete = async (cardId) => {
    if (!window.confirm(t.confirmDelete)) return;

    try {
      const res = await fetch(`${API_URL}/api/discount-cards/admin/${cardId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        toast.success(t.deleted);
        fetchCards();
      } else {
        toast.error(t.error);
      }
    } catch (err) {
      toast.error(t.error);
    }
  };

  const handleEdit = (card) => {
    setEditingCard(card);
    setFormData({
      name: card.name || '',
      description: card.description || '',
      discount_type: card.discount_type || 'percentage',
      discount_value: card.discount_value || 10,
      categories: (card.categories || []).join(', '),
      min_purchase: card.min_purchase || 0,
      max_discount: card.max_discount || '',
      valid_from: card.valid_from || '',
      valid_until: card.valid_until || '',
      applies_to_all: card.applies_to_all !== false,
      is_active: card.is_active !== false
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      discount_type: 'percentage',
      discount_value: 10,
      categories: '',
      min_purchase: 0,
      max_discount: '',
      valid_from: '',
      valid_until: '',
      applies_to_all: true,
      is_active: true
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4 md:p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin')}
              className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                <Tag className="w-8 h-8 text-amber-500" />
                {t.title}
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                {cards.length} Rabattkarten
              </p>
            </div>
          </div>
          
          <Button
            onClick={() => { setShowForm(true); setEditingCard(null); resetForm(); }}
            className="bg-amber-500 hover:bg-amber-600 text-white"
          >
            <Plus className="w-5 h-5 mr-2" />
            {t.createCard}
          </Button>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Gift className="w-6 h-6 text-amber-500" />
              {editingCard ? t.edit : t.createCard}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">{t.name} *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                  placeholder="z.B. EDEKA VIP Rabatt"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">{t.description}</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Beschreibung der Rabattkarte..."
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500"
                  rows={2}
                />
              </div>

              {/* Discount Type & Value */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">{t.discountType}</label>
                  <select
                    value={formData.discount_type}
                    onChange={(e) => setFormData({...formData, discount_type: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="percentage">{t.percentage}</option>
                    <option value="fixed">{t.fixed}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">
                    {t.discountValue} {formData.discount_type === 'percentage' ? '(%)' : '(€)'}
                  </label>
                  <input
                    type="number"
                    value={formData.discount_value}
                    onChange={(e) => setFormData({...formData, discount_value: e.target.value})}
                    min="0"
                    step="0.01"
                    required
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Categories */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">{t.categories}</label>
                <input
                  type="text"
                  value={formData.categories}
                  onChange={(e) => setFormData({...formData, categories: e.target.value})}
                  placeholder="Lebensmittel, Getränke, Elektronik"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Min/Max */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">{t.minPurchase}</label>
                  <input
                    type="number"
                    value={formData.min_purchase}
                    onChange={(e) => setFormData({...formData, min_purchase: e.target.value})}
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">{t.maxDiscount}</label>
                  <input
                    type="number"
                    value={formData.max_discount}
                    onChange={(e) => setFormData({...formData, max_discount: e.target.value})}
                    min="0"
                    step="0.01"
                    placeholder="Optional"
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Validity */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">{t.validFrom}</label>
                  <input
                    type="date"
                    value={formData.valid_from}
                    onChange={(e) => setFormData({...formData, valid_from: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">{t.validUntil}</label>
                  <input
                    type="date"
                    value={formData.valid_until}
                    onChange={(e) => setFormData({...formData, valid_until: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.applies_to_all}
                    onChange={(e) => setFormData({...formData, applies_to_all: e.target.checked})}
                    className="w-5 h-5 rounded text-amber-500"
                  />
                  <span className="text-sm">{t.appliesToAll}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                    className="w-5 h-5 rounded text-green-500"
                  />
                  <span className="text-sm">{t.active}</span>
                </label>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingCard(null); }}
                  variant="outline"
                  className="flex-1"
                >
                  {t.cancel}
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-amber-500 hover:bg-amber-600"
                >
                  {t.save}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cards List */}
      <div className="max-w-6xl mx-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : cards.length === 0 ? (
          <div className="text-center py-12 bg-slate-800/50 rounded-2xl">
            <Tag className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">{t.noCards}</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <div
                key={card.id}
                className={`bg-slate-800/80 backdrop-blur-sm rounded-xl p-5 border transition-all ${
                  card.is_active ? 'border-amber-500/30' : 'border-slate-700 opacity-60'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      {card.discount_type === 'percentage' ? (
                        <Percent className="w-5 h-5 text-amber-500" />
                      ) : (
                        <Tag className="w-5 h-5 text-green-500" />
                      )}
                      {card.name}
                    </h3>
                    {card.description && (
                      <p className="text-sm text-slate-400 mt-1">{card.description}</p>
                    )}
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    card.is_active 
                      ? 'bg-green-500/20 text-green-400' 
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {card.is_active ? t.active : t.inactive}
                  </span>
                </div>

                {/* Discount Info */}
                <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-lg p-4 mb-4">
                  <p className="text-3xl font-bold text-amber-400">
                    {card.discount_type === 'percentage' 
                      ? `${card.discount_value}%`
                      : `€${card.discount_value.toFixed(2)}`
                    }
                  </p>
                  <p className="text-sm text-amber-300/70">
                    {card.discount_type === 'percentage' ? 'Rabatt' : 'Fester Rabatt'}
                  </p>
                </div>

                {/* Details */}
                <div className="space-y-2 text-sm mb-4">
                  {card.min_purchase > 0 && (
                    <p className="text-slate-400">
                      <Store className="w-4 h-4 inline mr-2" />
                      Min. Bestellwert: €{card.min_purchase.toFixed(2)}
                    </p>
                  )}
                  {card.max_discount && (
                    <p className="text-slate-400">
                      <TrendingUp className="w-4 h-4 inline mr-2" />
                      Max. Rabatt: €{card.max_discount.toFixed(2)}
                    </p>
                  )}
                  {card.categories?.length > 0 && (
                    <p className="text-slate-400">
                      <Tag className="w-4 h-4 inline mr-2" />
                      {card.categories.join(', ')}
                    </p>
                  )}
                  {card.valid_until && (
                    <p className="text-slate-400">
                      <Calendar className="w-4 h-4 inline mr-2" />
                      Gültig bis: {new Date(card.valid_until).toLocaleDateString('de-DE')}
                    </p>
                  )}
                  <p className="text-slate-400">
                    <Users className="w-4 h-4 inline mr-2" />
                    {card.applies_to_all ? 'Alle Kunden' : 'Ausgewählte Kunden'}
                  </p>
                </div>

                {/* Stats */}
                <div className="flex gap-4 text-xs text-slate-500 mb-4 pt-3 border-t border-slate-700">
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {card.usage_count || 0} {t.usageCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    €{(card.total_discount_given || 0).toFixed(2)} {t.totalSaved}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleEdit(card)}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    {t.edit}
                  </Button>
                  <Button
                    onClick={() => handleDelete(card.id)}
                    variant="outline"
                    size="sm"
                    className="text-red-400 hover:bg-red-500/20"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
