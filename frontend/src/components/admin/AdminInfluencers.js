import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Star, Plus, CheckCircle, Trash2, Edit, X, Save, MapPin, Building2, Users, DollarSign, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function AdminInfluencers({ token, influencers, setInfluencers, fetchData }) {
  const [showInfluencerModal, setShowInfluencerModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedInfluencer, setSelectedInfluencer] = useState(null);
  const [managers, setManagers] = useState([]);
  const [influencerForm, setInfluencerForm] = useState({
    name: '', code: '', commission_percent: 10, email: '', instagram: '', youtube: '', tiktok: '', city: ''
  });
  const [editForm, setEditForm] = useState({
    name: '', commission_percent: 10, email: '', instagram: '', youtube: '', tiktok: '', city: '', manager_id: '', is_active: true
  });

  // Fetch managers for dropdown
  useEffect(() => {
    const fetchManagers = async () => {
      try {
        const res = await axios.get(`${API}/manager/admin/list`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setManagers(res.data.managers || []);
      } catch (error) {
        console.error('Error fetching managers:', error);
      }
    };
    fetchManagers();
  }, [token]);

  const handleCreateInfluencer = async () => {
    try {
      const res = await axios.post(`${API}/influencer/admin/create`, influencerForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Influencer erstellt');
      setInfluencers([...influencers, res.data]);
      setShowInfluencerModal(false);
      setInfluencerForm({ name: '', code: '', commission_percent: 10, email: '', instagram: '', youtube: '', tiktok: '', city: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Erstellen');
    }
  };

  const handleEditInfluencer = (influencer) => {
    setSelectedInfluencer(influencer);
    setEditForm({
      name: influencer.name || '',
      commission_percent: influencer.commission_percent || 10,
      email: influencer.email || '',
      instagram: influencer.instagram || '',
      youtube: influencer.youtube || '',
      tiktok: influencer.tiktok || '',
      city: influencer.city || '',
      manager_id: influencer.manager_id || '',
      is_active: influencer.is_active !== false
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedInfluencer) return;
    try {
      await axios.put(`${API}/influencer/admin/${selectedInfluencer.id}`, editForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Influencer aktualisiert');
      setInfluencers(influencers.map(i => 
        i.id === selectedInfluencer.id ? { ...i, ...editForm } : i
      ));
      setShowEditModal(false);
      setSelectedInfluencer(null);
      if (fetchData) fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Speichern');
    }
  };

  const handleToggleInfluencer = async (influencerId, isActive) => {
    try {
      await axios.put(`${API}/influencer/admin/${influencerId}`, { is_active: !isActive }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(isActive ? 'Influencer deaktiviert' : 'Influencer aktiviert');
      setInfluencers(influencers.map(i => 
        i.id === influencerId ? { ...i, is_active: !isActive } : i
      ));
    } catch (error) {
      toast.error('Fehler');
    }
  };

  const handleDeleteInfluencer = async (influencerId) => {
    if (!window.confirm('Influencer wirklich löschen?')) return;
    try {
      await axios.delete(`${API}/influencer/admin/${influencerId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Influencer gelöscht');
      setInfluencers(influencers.filter(i => i.id !== influencerId));
    } catch (error) {
      toast.error('Fehler beim Löschen');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <Star className="w-5 h-5 text-white" fill="white" />
          </div>
          Influencer verwalten
        </h1>
        <Button
          onClick={() => setShowInfluencerModal(true)}
          className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-white shadow-lg"
          data-testid="new-influencer-btn"
        >
          <Plus className="w-4 h-4 mr-1" />
          Neuer Influencer
        </Button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-lg border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
              <Users className="w-6 h-6 text-violet-600" />
            </div>
            <div>
              <p className="text-slate-500 text-sm">Gesamt Influencer</p>
              <p className="text-2xl font-bold text-slate-800">{influencers.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-lg border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-100 to-blue-100 flex items-center justify-center">
              <Users className="w-6 h-6 text-cyan-600" />
            </div>
            <div>
              <p className="text-slate-500 text-sm">Gesamt Kunden</p>
              <p className="text-2xl font-bold text-cyan-600">
                {influencers.reduce((sum, i) => sum + (i.total_customers || 0), 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-lg border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-slate-500 text-sm">Gesamt Umsatz</p>
              <p className="text-2xl font-bold text-emerald-600">
                €{influencers.reduce((sum, i) => sum + (i.total_revenue || 0), 0).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-lg border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-slate-500 text-sm">Ausstehende Provision</p>
              <p className="text-2xl font-bold text-amber-600">
                €{influencers.reduce((sum, i) => sum + (i.total_commission || 0), 0).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Commission Tiers Info */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-5 border border-amber-200">
        <h3 className="text-slate-800 font-bold mb-3 flex items-center gap-2">
          <Star className="w-5 h-5 text-amber-500" fill="currentColor" />
          Staffelprovisionen - Je mehr Kunden, desto mehr Provision!
        </h3>
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="px-4 py-2 rounded-full bg-amber-700/10 text-amber-700 font-medium">🥉 Bronze: 0-10 Kunden (Basis)</span>
          <span className="px-4 py-2 rounded-full bg-slate-400/20 text-slate-600 font-medium">🥈 Silber: 11-50 (+2%)</span>
          <span className="px-4 py-2 rounded-full bg-amber-400/20 text-amber-600 font-medium">🥇 Gold: 51-100 (+3%)</span>
          <span className="px-4 py-2 rounded-full bg-violet-400/20 text-violet-600 font-medium">💎 Platin: 100+ (+5%)</span>
        </div>
      </div>

      {/* Influencer List - Mobile-friendly cards */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
        <div className="p-4 md:p-6 space-y-4">
          {influencers.map((influencer) => (
            <div key={influencer.id} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              {/* Header with name, status, and actions */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-slate-800 font-semibold">{influencer.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      influencer.is_active 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-red-100 text-red-600'
                    }`}>
                      {influencer.is_active ? '✓ Aktiv' : '✗ Inaktiv'}
                    </span>
                  </div>
                  {influencer.instagram && (
                    <p className="text-slate-400 text-xs">@{influencer.instagram}</p>
                  )}
                  {influencer.city && (
                    <span className="flex items-center gap-1 text-violet-600 text-xs font-medium mt-1">
                      <MapPin className="w-3 h-3" />
                      {influencer.city}
                    </span>
                  )}
                </div>
                {/* Tier Badge */}
                <span className={`px-3 py-1.5 rounded-lg text-xs font-bold flex-shrink-0 ${
                  influencer.commission_tier === 'Platin' ? 'bg-violet-100 text-violet-700 border border-violet-200' :
                  influencer.commission_tier === 'Gold' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                  influencer.commission_tier === 'Silber' ? 'bg-slate-200 text-slate-600 border border-slate-300' :
                  'bg-amber-700/10 text-amber-700 border border-amber-700/20'
                }`}>
                  {influencer.commission_tier === 'Platin' ? '💎' : 
                   influencer.commission_tier === 'Gold' ? '🥇' :
                   influencer.commission_tier === 'Silber' ? '🥈' : '🥉'} {influencer.commission_tier || 'Bronze'}
                </span>
              </div>
              
              {/* Code Badge */}
              <div className="mb-3">
                <code className="bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 px-3 py-1.5 rounded-lg text-sm font-bold border border-amber-200">
                  {influencer.code}
                </code>
              </div>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-white rounded-lg p-2 text-center">
                  <p className="text-xs text-slate-400">Provision</p>
                  <p className="text-lg font-bold text-slate-800">{influencer.effective_commission || influencer.commission_percent}%</p>
                  {influencer.tier_bonus > 0 && (
                    <p className="text-emerald-500 text-xs font-medium">+{influencer.tier_bonus}%</p>
                  )}
                </div>
                <div className="bg-white rounded-lg p-2 text-center">
                  <p className="text-xs text-slate-400">Kunden</p>
                  <p className="text-lg font-bold text-cyan-600">{influencer.total_customers || 0}</p>
                </div>
                <div className="bg-white rounded-lg p-2 text-center">
                  <p className="text-xs text-slate-400">Umsatz</p>
                  <p className="text-sm font-bold text-emerald-600">€{(influencer.total_revenue || 0).toFixed(0)}</p>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleEditInfluencer(influencer)}
                  className="flex-1 bg-violet-500 hover:bg-violet-600 text-white"
                  data-testid={`edit-influencer-${influencer.id}`}
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Bearbeiten
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleToggleInfluencer(influencer.id, influencer.is_active)}
                  className={`px-3 ${influencer.is_active ? 'border-emerald-200 text-emerald-600' : 'border-slate-200 text-slate-400'}`}
                  title={influencer.is_active ? 'Deaktivieren' : 'Aktivieren'}
                >
                  <CheckCircle className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDeleteInfluencer(influencer.id)}
                  className="px-3"
                  title="Löschen"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        
        {influencers.length === 0 && (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center mx-auto mb-4">
              <Star className="w-8 h-8 text-amber-500" />
            </div>
            <p className="text-slate-500 font-medium">Noch keine Influencer vorhanden</p>
            <p className="text-slate-400 text-sm mt-1">Klicke auf "Neuer Influencer" um zu starten</p>
          </div>
        )}
      </div>

      {/* New Influencer Modal */}
      {showInfluencerModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-slate-800 mb-5 flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <Star className="w-5 h-5 text-white" fill="white" />
              </div>
              Neuer Influencer
            </h3>
            <div className="space-y-4">
              <div>
                <Label className="text-slate-700 font-medium">Name *</Label>
                <Input
                  value={influencerForm.name}
                  onChange={(e) => setInfluencerForm({...influencerForm, name: e.target.value})}
                  placeholder="z.B. Max Mustermann"
                  className="bg-slate-50 border-slate-200 text-slate-800 focus:border-amber-400 focus:ring-amber-400"
                />
              </div>
              <div>
                <Label className="text-slate-700 font-medium">Code * (erscheint als Gutscheincode)</Label>
                <Input
                  value={influencerForm.code}
                  onChange={(e) => setInfluencerForm({...influencerForm, code: e.target.value.toLowerCase()})}
                  placeholder="z.B. maxpower"
                  className="bg-slate-50 border-slate-200 text-slate-800 focus:border-amber-400 focus:ring-amber-400"
                />
                <p className="text-slate-400 text-xs mt-1">Kunden geben diesen Code ein um Rabatt zu bekommen</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-700 font-medium">Provision (%)</Label>
                  <Input
                    type="number"
                    value={influencerForm.commission_percent}
                    onChange={(e) => setInfluencerForm({...influencerForm, commission_percent: parseFloat(e.target.value) || 0})}
                    placeholder="10"
                    className="bg-slate-50 border-slate-200 text-slate-800 focus:border-amber-400"
                  />
                </div>
                <div>
                  <Label className="text-slate-700 font-medium">Stadt</Label>
                  <Input
                    value={influencerForm.city}
                    onChange={(e) => setInfluencerForm({...influencerForm, city: e.target.value})}
                    placeholder="z.B. Berlin"
                    className="bg-slate-50 border-slate-200 text-slate-800 focus:border-amber-400"
                  />
                </div>
              </div>
              <div>
                <Label className="text-slate-700 font-medium">E-Mail</Label>
                <Input
                  type="email"
                  value={influencerForm.email}
                  onChange={(e) => setInfluencerForm({...influencerForm, email: e.target.value})}
                  placeholder="influencer@email.com"
                  className="bg-slate-50 border-slate-200 text-slate-800 focus:border-amber-400"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-slate-700 text-xs font-medium">Instagram</Label>
                  <Input
                    value={influencerForm.instagram}
                    onChange={(e) => setInfluencerForm({...influencerForm, instagram: e.target.value})}
                    placeholder="@username"
                    className="bg-slate-50 border-slate-200 text-slate-800 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-slate-700 text-xs font-medium">YouTube</Label>
                  <Input
                    value={influencerForm.youtube}
                    onChange={(e) => setInfluencerForm({...influencerForm, youtube: e.target.value})}
                    placeholder="Channel"
                    className="bg-slate-50 border-slate-200 text-slate-800 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-slate-700 text-xs font-medium">TikTok</Label>
                  <Input
                    value={influencerForm.tiktok}
                    onChange={(e) => setInfluencerForm({...influencerForm, tiktok: e.target.value})}
                    placeholder="@username"
                    className="bg-slate-50 border-slate-200 text-slate-800 text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowInfluencerModal(false);
                  setInfluencerForm({ name: '', code: '', commission_percent: 10, email: '', instagram: '', youtube: '', tiktok: '', city: '' });
                }}
                className="border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Abbrechen
              </Button>
              <Button
                onClick={handleCreateInfluencer}
                disabled={!influencerForm.name || !influencerForm.code}
                className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-white"
              >
                <Plus className="w-4 h-4 mr-1" />
                Erstellen
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Influencer Modal */}
      {showEditModal && selectedInfluencer && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center">
                  <Edit className="w-5 h-5 text-white" />
                </div>
                Influencer bearbeiten
              </h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedInfluencer(null);
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Influencer Code (read-only) */}
            <div className="mb-5 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
              <p className="text-slate-500 text-xs mb-2">Influencer-Code (nicht änderbar)</p>
              <code className="bg-white text-amber-700 px-4 py-2 rounded-lg text-lg font-bold border border-amber-200 inline-block">
                {selectedInfluencer.code}
              </code>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-700 font-medium">Name</Label>
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                    className="bg-slate-50 border-slate-200 text-slate-800 focus:border-violet-400"
                  />
                </div>
                <div>
                  <Label className="text-slate-700 font-medium">Provision (%)</Label>
                  <Input
                    type="number"
                    value={editForm.commission_percent}
                    onChange={(e) => setEditForm({...editForm, commission_percent: parseFloat(e.target.value) || 0})}
                    className="bg-slate-50 border-slate-200 text-slate-800 focus:border-violet-400"
                  />
                </div>
              </div>
              
              <div>
                <Label className="text-slate-700 font-medium">E-Mail</Label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                  className="bg-slate-50 border-slate-200 text-slate-800 focus:border-violet-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-700 font-medium flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Stadt
                  </Label>
                  <Input
                    value={editForm.city}
                    onChange={(e) => setEditForm({...editForm, city: e.target.value})}
                    placeholder="z.B. Berlin"
                    className="bg-slate-50 border-slate-200 text-slate-800 focus:border-violet-400"
                  />
                </div>
                <div>
                  <Label className="text-slate-700 font-medium flex items-center gap-1">
                    <Building2 className="w-3 h-3" /> Manager
                  </Label>
                  <Select
                    value={editForm.manager_id || "none"}
                    onValueChange={(value) => setEditForm({...editForm, manager_id: value === "none" ? "" : value})}
                  >
                    <SelectTrigger className="bg-slate-50 border-slate-200 text-slate-800">
                      <SelectValue placeholder="Kein Manager" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200">
                      <SelectItem value="none" className="text-slate-600">Kein Manager</SelectItem>
                      {managers.map((manager) => (
                        <SelectItem key={manager.id} value={manager.id} className="text-slate-800">
                          {manager.name} ({manager.cities?.join(', ') || 'Keine Stadt'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-slate-700 text-xs font-medium">Instagram</Label>
                  <Input
                    value={editForm.instagram}
                    onChange={(e) => setEditForm({...editForm, instagram: e.target.value})}
                    placeholder="@username"
                    className="bg-slate-50 border-slate-200 text-slate-800 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-slate-700 text-xs font-medium">YouTube</Label>
                  <Input
                    value={editForm.youtube}
                    onChange={(e) => setEditForm({...editForm, youtube: e.target.value})}
                    placeholder="Channel"
                    className="bg-slate-50 border-slate-200 text-slate-800 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-slate-700 text-xs font-medium">TikTok</Label>
                  <Input
                    value={editForm.tiktok}
                    onChange={(e) => setEditForm({...editForm, tiktok: e.target.value})}
                    placeholder="@username"
                    className="bg-slate-50 border-slate-200 text-slate-800 text-sm"
                  />
                </div>
              </div>

              {/* Status Toggle */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <Label className="text-slate-700 font-medium mb-3 block">Status</Label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditForm({...editForm, is_active: true})}
                    className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${
                      editForm.is_active 
                        ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg' 
                        : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4 inline mr-1" />
                    Aktiv
                  </button>
                  <button
                    onClick={() => setEditForm({...editForm, is_active: false})}
                    className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${
                      !editForm.is_active 
                        ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg' 
                        : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <X className="w-4 h-4 inline mr-1" />
                    Inaktiv
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedInfluencer(null);
                }}
                className="border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Abbrechen
              </Button>
              <Button
                onClick={handleSaveEdit}
                className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400 text-white shadow-lg"
              >
                <Save className="w-4 h-4 mr-1" />
                Speichern
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
