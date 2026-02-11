import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { 
  Gift, Package, Plus, Trash2, RefreshCw, Clock, 
  DollarSign, Users, Eye, EyeOff, Sparkles, AlertCircle
} from 'lucide-react';
import { Button } from '../ui/button';

const API = process.env.REACT_APP_BACKEND_URL;

const tierColors = {
  bronze: 'from-amber-600 to-orange-700',
  silver: 'from-gray-400 to-gray-600',
  gold: 'from-yellow-400 to-amber-500',
  diamond: 'from-cyan-400 to-blue-500'
};

const tierEmojis = {
  bronze: '🥉',
  silver: '🥈',
  gold: '🥇',
  diamond: '💎'
};

const AdminMysteryBox = () => {
  const { token } = useAuth();
  const [boxes, setBoxes] = useState([]);
  const [products, setProducts] = useState([]);
  const [productsByTier, setProductsByTier] = useState({});
  const [tiers, setTiers] = useState({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newBox, setNewBox] = useState({
    tier: 'bronze',
    product_id: '',
    duration_hours: 24,
    hint: '',
    start_immediately: true
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [boxesRes, productsRes] = await Promise.all([
        fetch(`${API}/api/mystery-box/admin/all`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API}/api/mystery-box/admin/products`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);
      
      if (boxesRes.ok) {
        const boxData = await boxesRes.json();
        setBoxes(boxData.boxes || []);
      }
      
      if (productsRes.ok) {
        const prodData = await productsRes.json();
        setProducts(prodData.products || []);
        setProductsByTier(prodData.by_tier || {});
        setTiers(prodData.tiers || {});
      }
    } catch (err) {
      console.error('Error fetching mystery box data:', err);
      toast.error('Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBox = async () => {
    if (!newBox.product_id) {
      toast.error('Bitte wähle ein Produkt aus');
      return;
    }
    
    try {
      const response = await fetch(`${API}/api/mystery-box/admin/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newBox)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success(`Mystery Box erstellt! ${tierEmojis[newBox.tier]}`);
        setShowCreate(false);
        setNewBox({
          tier: 'bronze',
          product_id: '',
          duration_hours: 24,
          hint: '',
          start_immediately: true
        });
        fetchData();
      } else {
        toast.error(data.detail || 'Fehler beim Erstellen');
      }
    } catch (err) {
      toast.error('Netzwerkfehler');
    }
  };

  const handleDeleteBox = async (boxId) => {
    if (!window.confirm('Mystery Box wirklich löschen?')) return;
    
    try {
      const response = await fetch(`${API}/api/mystery-box/admin/${boxId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        toast.success('Mystery Box gelöscht');
        fetchData();
      }
    } catch (err) {
      toast.error('Fehler beim Löschen');
    }
  };

  const handleEndBox = async (boxId) => {
    if (!window.confirm('Mystery Box jetzt beenden?')) return;
    
    try {
      const response = await fetch(`${API}/api/mystery-box/admin/${boxId}/end`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        toast.success('Mystery Box beendet');
        fetchData();
      }
    } catch (err) {
      toast.error('Fehler beim Beenden');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Aktiv</span>;
      case 'ended':
        return <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">Beendet</span>;
      case 'scheduled':
        return <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">Geplant</span>;
      default:
        return <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">{status}</span>;
    }
  };

  // Filter products by selected tier
  const availableProducts = productsByTier[newBox.tier] || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Gift className="w-8 h-8 text-purple-600" />
          <div>
            <h2 className="text-xl font-bold text-gray-800">Mystery Boxes</h2>
            <p className="text-sm text-gray-500">Überraschungs-Auktionen verwalten</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Aktualisieren
          </Button>
          <Button onClick={() => setShowCreate(!showCreate)} className="bg-purple-600 hover:bg-purple-700">
            <Plus className="w-4 h-4 mr-2" />
            Neue Mystery Box
          </Button>
        </div>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            Neue Mystery Box erstellen
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tier Selection */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Stufe wählen</label>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(tiers).map(([key, tier]) => (
                  <button
                    key={key}
                    onClick={() => setNewBox({...newBox, tier: key, product_id: ''})}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      newBox.tier === key 
                        ? 'border-purple-500 bg-purple-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-2xl mb-1">{tier.emoji}</div>
                    <div className="text-xs font-medium">{tier.name?.replace(' Box', '')}</div>
                    <div className="text-xs text-gray-500">€{tier.min_value}-{tier.max_value}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Product Selection */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Produkt wählen ({availableProducts.length} verfügbar)
              </label>
              {availableProducts.length === 0 ? (
                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200 text-yellow-700 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Keine Produkte für diese Stufe verfügbar
                </div>
              ) : (
                <select
                  value={newBox.product_id}
                  onChange={(e) => setNewBox({...newBox, product_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Produkt auswählen...</option>
                  {availableProducts.map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      {prod.name} (€{prod.value})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Duration */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Dauer (Stunden)</label>
              <select
                value={newBox.duration_hours}
                onChange={(e) => setNewBox({...newBox, duration_hours: parseInt(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value={6}>6 Stunden</option>
                <option value={12}>12 Stunden</option>
                <option value={24}>24 Stunden</option>
                <option value={48}>48 Stunden</option>
                <option value={72}>72 Stunden</option>
              </select>
            </div>

            {/* Hint */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Hinweis (optional)</label>
              <input
                type="text"
                value={newBox.hint}
                onChange={(e) => setNewBox({...newBox, hint: e.target.value})}
                placeholder="z.B. 'Perfekt für Technik-Fans'"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          {/* Start Option */}
          <div className="mt-4 flex items-center gap-2">
            <input
              type="checkbox"
              id="start_immediately"
              checked={newBox.start_immediately}
              onChange={(e) => setNewBox({...newBox, start_immediately: e.target.checked})}
              className="rounded border-gray-300"
            />
            <label htmlFor="start_immediately" className="text-sm text-gray-700">
              Sofort starten
            </label>
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={handleCreateBox} className="bg-purple-600 hover:bg-purple-700">
              <Gift className="w-4 h-4 mr-2" />
              Mystery Box erstellen
            </Button>
            <Button onClick={() => setShowCreate(false)} variant="outline">
              Abbrechen
            </Button>
          </div>
        </div>
      )}

      {/* Tier Overview */}
      <div className="grid grid-cols-4 gap-4">
        {Object.entries(tiers).map(([key, tier]) => (
          <div key={key} className={`bg-gradient-to-br ${tierColors[key]} rounded-xl p-4 text-white`}>
            <div className="text-3xl mb-2">{tier.emoji}</div>
            <div className="font-bold">{tier.name}</div>
            <div className="text-sm opacity-80">€{tier.min_value} - €{tier.max_value}</div>
            <div className="text-xs mt-2 opacity-70">
              {productsByTier[key]?.length || 0} Produkte
            </div>
          </div>
        ))}
      </div>

      {/* Active Boxes */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Package className="w-5 h-5 text-purple-600" />
          Mystery Boxes ({boxes.length})
        </h3>

        {boxes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Gift className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Noch keine Mystery Boxes erstellt</p>
            <p className="text-sm">Klicke oben auf "Neue Mystery Box"</p>
          </div>
        ) : (
          <div className="space-y-3">
            {boxes.map((box) => (
              <div key={box.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                {/* Tier Badge */}
                <div className={`w-14 h-14 bg-gradient-to-br ${tierColors[box.tier]} rounded-lg flex items-center justify-center text-2xl`}>
                  {box.tier_emoji}
                </div>
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-800">{box.tier_name}</span>
                    {getStatusBadge(box.status)}
                    {box.revealed && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full flex items-center gap-1">
                        <Eye className="w-3 h-3" /> Enthüllt
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Package className="w-4 h-4" />
                      {box.product_name}
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      €{box.retail_value}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {box.total_bids} Gebote
                    </span>
                  </div>
                  {box.hint && (
                    <div className="text-xs text-purple-600 mt-1 italic">💡 {box.hint}</div>
                  )}
                </div>

                {/* Current Price */}
                <div className="text-right">
                  <div className="text-lg font-bold text-green-600">€{box.current_price?.toFixed(2)}</div>
                  {box.last_bidder && (
                    <div className="text-xs text-gray-500">von {box.last_bidder}</div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {box.status === 'active' && (
                    <Button 
                      onClick={() => handleEndBox(box.id)} 
                      variant="outline" 
                      size="sm"
                      className="text-orange-600 hover:bg-orange-50"
                    >
                      <Clock className="w-4 h-4" />
                    </Button>
                  )}
                  <Button 
                    onClick={() => handleDeleteBox(box.id)} 
                    variant="ghost" 
                    size="sm"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
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
};

export default AdminMysteryBox;
