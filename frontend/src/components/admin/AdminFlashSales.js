/**
 * AdminFlashSales - Flash Sale Management (Wochenend-Special, Erstkäufer-Bonus, etc.)
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { 
  Zap, Plus, Edit, Trash2, Clock, Gift, Calendar, 
  Euro, Users, RefreshCw, Eye, EyeOff, Percent, Package
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const AdminFlashSales = () => {
  const [sales, setSales] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  const [saleType, setSaleType] = useState('weekend_special');
  
  // Form state
  const [formData, setFormData] = useState({
    title: 'Wochenend-Special',
    bids: 300,
    bonus_bids: 150,
    price: 79,
    original_price: 119,
    duration_hours: 48,
    start_time: '',
    max_per_user: 3
  });

  useEffect(() => {
    fetchSales();
    fetchStats();
  }, []);

  const fetchSales = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/flash-sales/admin/list`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSales(response.data.sales || []);
    } catch (error) {
      toast.error('Fehler beim Laden der Flash Sales');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/flash-sales/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data);
    } catch (error) {
      console.error('Stats error:', error);
    }
  };

  const handleCreateSale = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      
      let endpoint = '/flash-sales/admin/create';
      let params = `?title=${encodeURIComponent(formData.title)}&duration_hours=${formData.duration_hours}&max_per_user=${formData.max_per_user}`;
      
      if (saleType === 'weekend_special') {
        endpoint = '/flash-sales/admin/create-weekend-special';
        params = `?bids=${formData.bids}&bonus_bids=${formData.bonus_bids}&price=${formData.price}&original_price=${formData.original_price}&duration_hours=${formData.duration_hours}`;
        if (formData.start_time) {
          params += `&start_time=${encodeURIComponent(formData.start_time)}`;
        }
      } else if (saleType === 'first_buyer_bonus') {
        endpoint = '/flash-sales/admin/create-first-buyer-bonus';
        params = `?bids=${formData.bids}&bonus_bids=${formData.bonus_bids}&price=${formData.price}&original_price=${formData.original_price}&duration_hours=${formData.duration_hours}`;
        if (formData.start_time) {
          params += `&start_time=${encodeURIComponent(formData.start_time)}`;
        }
      }
      
      await axios.post(`${API}${endpoint}${params}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Flash Sale erstellt!');
      setShowCreateForm(false);
      fetchSales();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Erstellen');
    }
  };

  const handleUpdateSale = async (saleId, updates) => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams(updates).toString();
      
      await axios.put(`${API}/flash-sales/admin/${saleId}?${params}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Flash Sale aktualisiert!');
      setEditingSale(null);
      fetchSales();
    } catch (error) {
      toast.error('Fehler beim Aktualisieren');
    }
  };

  const handleDeleteSale = async (saleId) => {
    if (!window.confirm('Flash Sale wirklich deaktivieren?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/flash-sales/admin/${saleId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Flash Sale deaktiviert');
      fetchSales();
      fetchStats();
    } catch (error) {
      toast.error('Fehler beim Deaktivieren');
    }
  };

  const toggleSaleActive = async (sale) => {
    await handleUpdateSale(sale.id, { is_active: !sale.is_active });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('de-DE', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeRemaining = (endTime) => {
    const end = new Date(endTime);
    const now = new Date();
    const diff = end - now;
    
    if (diff <= 0) return 'Abgelaufen';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-500" />
            Flash Sales Verwaltung
          </h2>
          <p className="text-gray-500 mt-1">Wochenend-Specials, Erstkäufer-Bonus und mehr</p>
        </div>
        
        <Button 
          onClick={() => setShowCreateForm(true)}
          className="bg-amber-500 hover:bg-amber-600"
        >
          <Plus className="w-4 h-4 mr-2" />
          Neuer Flash Sale
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Zap className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{stats.active_sales}</p>
                <p className="text-xs text-gray-500">Aktive Sales</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{stats.upcoming_sales}</p>
                <p className="text-xs text-gray-500">Geplante Sales</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Euro className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">€{stats.total_revenue?.toFixed(0) || 0}</p>
                <p className="text-xs text-gray-500">Umsatz</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Package className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{stats.total_bids_sold || 0}</p>
                <p className="text-xs text-gray-500">Gebote verkauft</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-800">Neuer Flash Sale</h3>
            </div>
            
            <form onSubmit={handleCreateSale} className="p-6 space-y-4">
              {/* Sale Type */}
              <div>
                <Label>Typ</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSaleType('weekend_special');
                      setFormData({
                        ...formData,
                        title: 'Wochenend-Special',
                        bids: 300,
                        bonus_bids: 150,
                        price: 79,
                        original_price: 119,
                        duration_hours: 48,
                        max_per_user: 3
                      });
                    }}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      saleType === 'weekend_special'
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Calendar className="w-5 h-5 mx-auto mb-1 text-amber-500" />
                    <span className="text-sm font-medium">Wochenend-Special</span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setSaleType('first_buyer_bonus');
                      setFormData({
                        ...formData,
                        title: 'Erstkäufer-Bonus',
                        bids: 150,
                        bonus_bids: 100,
                        price: 49,
                        original_price: 89,
                        duration_hours: 24,
                        max_per_user: 1
                      });
                    }}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      saleType === 'first_buyer_bonus'
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Gift className="w-5 h-5 mx-auto mb-1 text-green-500" />
                    <span className="text-sm font-medium">Erstkäufer-Bonus</span>
                  </button>
                </div>
              </div>

              {/* Bids */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Gebote</Label>
                  <Input
                    type="number"
                    value={formData.bids}
                    onChange={(e) => setFormData({...formData, bids: parseInt(e.target.value)})}
                    min={10}
                    max={1000}
                  />
                </div>
                <div>
                  <Label>Bonus-Gebote</Label>
                  <Input
                    type="number"
                    value={formData.bonus_bids}
                    onChange={(e) => setFormData({...formData, bonus_bids: parseInt(e.target.value)})}
                    min={0}
                    max={500}
                  />
                </div>
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Preis (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value)})}
                    min={1}
                  />
                </div>
                <div>
                  <Label>Original-Preis (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.original_price}
                    onChange={(e) => setFormData({...formData, original_price: parseFloat(e.target.value)})}
                    min={1}
                  />
                </div>
              </div>

              {/* Duration */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Dauer (Stunden)</Label>
                  <Input
                    type="number"
                    value={formData.duration_hours}
                    onChange={(e) => setFormData({...formData, duration_hours: parseInt(e.target.value)})}
                    min={1}
                    max={168}
                  />
                </div>
                <div>
                  <Label>Max. pro Nutzer</Label>
                  <Input
                    type="number"
                    value={formData.max_per_user}
                    onChange={(e) => setFormData({...formData, max_per_user: parseInt(e.target.value)})}
                    min={1}
                    max={10}
                  />
                </div>
              </div>

              {/* Start Time */}
              <div>
                <Label>Startzeit (optional - leer = sofort)</Label>
                <Input
                  type="datetime-local"
                  value={formData.start_time}
                  onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                />
              </div>

              {/* Preview */}
              <div className="bg-gray-50 rounded-xl p-4 mt-4">
                <p className="text-sm font-medium text-gray-600 mb-2">Vorschau:</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-gray-800">{formData.title}</p>
                    <p className="text-sm text-gray-600">
                      {formData.bids} + {formData.bonus_bids} = {formData.bids + formData.bonus_bids} Gebote
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-600">€{formData.price}</p>
                    <p className="text-sm text-gray-400 line-through">€{formData.original_price}</p>
                    <p className="text-xs text-amber-600 font-medium">
                      SPARE {Math.round((1 - formData.price / formData.original_price) * 100)}%
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1"
                >
                  Abbrechen
                </Button>
                <Button type="submit" className="flex-1 bg-amber-500 hover:bg-amber-600">
                  Erstellen
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sales List */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left p-4 font-medium text-gray-600">Sale</th>
                <th className="text-left p-4 font-medium text-gray-600">Gebote</th>
                <th className="text-left p-4 font-medium text-gray-600">Preis</th>
                <th className="text-left p-4 font-medium text-gray-600">Zeitraum</th>
                <th className="text-left p-4 font-medium text-gray-600">Status</th>
                <th className="text-right p-4 font-medium text-gray-600">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    Keine Flash Sales vorhanden
                  </td>
                </tr>
              ) : (
                sales.map((sale) => {
                  const pkg = sale.packages?.[0] || {};
                  const isActive = sale.is_active && new Date(sale.end_time) > new Date();
                  
                  return (
                    <tr key={sale.id} className="hover:bg-gray-50">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            sale.sale_type === 'weekend_special' 
                              ? 'bg-amber-100' 
                              : sale.sale_type === 'first_buyer_bonus'
                              ? 'bg-green-100'
                              : 'bg-purple-100'
                          }`}>
                            {sale.sale_type === 'weekend_special' ? (
                              <Calendar className="w-5 h-5 text-amber-600" />
                            ) : sale.sale_type === 'first_buyer_bonus' ? (
                              <Gift className="w-5 h-5 text-green-600" />
                            ) : (
                              <Zap className="w-5 h-5 text-purple-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">{sale.title}</p>
                            <p className="text-xs text-gray-500">{sale.sale_type || 'custom'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="font-medium">{pkg.bids || 0}</span>
                        {pkg.bonus_bids > 0 && (
                          <span className="text-green-600 ml-1">+{pkg.bonus_bids}</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div>
                          <span className="font-bold text-green-600">€{pkg.flash_price || 0}</span>
                          <span className="text-gray-400 line-through ml-2 text-sm">
                            €{pkg.original_price || 0}
                          </span>
                        </div>
                        <span className="text-xs text-amber-600">
                          -{pkg.discount_percent || 0}%
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="text-sm">
                          <p className="text-gray-600">{formatDate(sale.start_time)}</p>
                          <p className="text-gray-400">bis {formatDate(sale.end_time)}</p>
                          {isActive && (
                            <p className="text-amber-600 font-medium mt-1">
                              ⏰ {getTimeRemaining(sale.end_time)}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          isActive
                            ? 'bg-green-100 text-green-700'
                            : sale.is_active
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {isActive ? 'Aktiv' : sale.is_active ? 'Geplant' : 'Inaktiv'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleSaleActive(sale)}
                            className="text-gray-500 hover:text-gray-700"
                          >
                            {sale.is_active ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingSale(sale)}
                            className="text-blue-500 hover:text-blue-700"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteSale(sale.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingSale && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-800">Flash Sale bearbeiten</h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <Label>Titel</Label>
                <Input
                  value={editingSale.title}
                  onChange={(e) => setEditingSale({...editingSale, title: e.target.value})}
                />
              </div>
              
              <div>
                <Label>Endzeit</Label>
                <Input
                  type="datetime-local"
                  value={editingSale.end_time?.slice(0, 16)}
                  onChange={(e) => setEditingSale({...editingSale, end_time: e.target.value + ':00Z'})}
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setEditingSale(null)}
                  className="flex-1"
                >
                  Abbrechen
                </Button>
                <Button
                  onClick={() => handleUpdateSale(editingSale.id, {
                    title: editingSale.title,
                    end_time: editingSale.end_time
                  })}
                  className="flex-1 bg-blue-500 hover:bg-blue-600"
                >
                  Speichern
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminFlashSales;
