/**
 * Ad Campaign Manager - Self-Service Werbeplattform
 * Businesses können Werbekampagnen erstellen und verwalten
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, Plus, Eye, MousePointer, Euro, Play, Pause,
  BarChart3, Target, Calendar, MapPin, Users, ArrowLeft, DollarSign
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const AD_TYPES = {
  banner: { name: 'Banner-Anzeige', price: 10, unit: 'Tag', icon: '🎯' },
  sponsored_listing: { name: 'Sponsored Listing', price: 5, unit: 'Tag', icon: '⭐' },
  push_notification: { name: 'Push-Benachrichtigung', price: 0.05, unit: 'Send', icon: '🔔' },
  featured_placement: { name: 'Featured Placement', price: 99, unit: 'Monat', icon: '👑' },
};

const PLACEMENTS = [
  { id: 'home', name: 'Homepage', icon: '🏠' },
  { id: 'auctions', name: 'Auktionen', icon: '🔨' },
  { id: 'directory', name: 'Verzeichnis', icon: '📋' },
  { id: 'taxi', name: 'Taxi/Mobility', icon: '🚕' },
];

export default function AdCampaignManagerPage({ onNavigate }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  
  // Create form
  const [form, setForm] = useState({
    campaign_name: '',
    ad_type: 'banner',
    title: '',
    description: '',
    cta_text: 'Mehr erfahren',
    cta_url: '',
    budget_total: 50,
    budget_daily: 10,
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    placements: ['home'],
    targeting: {
      countries: [],
      cities: [],
      categories: [],
    },
  });

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/ads/campaigns`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createCampaign = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/api/ads/campaigns`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setShowCreate(false);
        loadCampaigns();
      } else {
        alert(data.detail || 'Fehler');
      }
    } catch (err) {
      alert('Netzwerkfehler');
    }
  };

  const toggleCampaignStatus = async (campaignId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    try {
      const res = await fetch(`${API}/api/ads/campaigns/${campaignId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        loadCampaigns();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const viewCampaignDetails = async (campaignId) => {
    try {
      const res = await fetch(`${API}/api/ads/campaigns/${campaignId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSelectedCampaign(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (selectedCampaign) {
    return (
      <div className="min-h-screen bg-[#050505] text-white pb-24">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedCampaign(null)} className="p-2 hover:bg-white/5 rounded-xl">
                <ArrowLeft size={20} className="text-gray-400" />
              </button>
              <div className="flex-1">
                <h1 className="text-lg font-bold">{selectedCampaign.campaign_name}</h1>
                <p className="text-xs text-gray-400">{AD_TYPES[selectedCampaign.ad_type]?.name}</p>
              </div>
              <span className={`px-3 py-1 rounded-lg text-xs font-medium ${
                selectedCampaign.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
              }`}>
                {selectedCampaign.status === 'active' ? 'Aktiv' : 'Pausiert'}
              </span>
            </div>
          </div>
        </div>

        {/* Campaign Stats */}
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={Eye} label="Impressions" value={selectedCampaign.impressions || 0} />
            <StatCard icon={MousePointer} label="Clicks" value={selectedCampaign.clicks || 0} />
            <StatCard icon={TrendingUp} label="CTR" value={`${selectedCampaign.ctr || 0}%`} />
            <StatCard icon={Euro} label="Ausgegeben" value={`€${selectedCampaign.budget_spent?.toFixed(2) || '0.00'}`} />
          </div>

          {/* Budget Progress */}
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Budget-Verbrauch</span>
              <span className="text-sm font-bold">
                €{selectedCampaign.budget_spent?.toFixed(2) || '0.00'} / €{selectedCampaign.budget_total?.toFixed(2)}
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${(selectedCampaign.budget_spent / selectedCampaign.budget_total) * 100}%` }}
              />
            </div>
          </div>

          {/* Campaign Details */}
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <h3 className="font-bold mb-3">Kampagnen-Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Titel:</span>
                <span className="font-medium">{selectedCampaign.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">CTA:</span>
                <span className="font-medium">{selectedCampaign.cta_text}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Laufzeit:</span>
                <span className="font-medium">
                  {new Date(selectedCampaign.start_date).toLocaleDateString('de-DE')} - {new Date(selectedCampaign.end_date).toLocaleDateString('de-DE')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Placements:</span>
                <span className="font-medium">{selectedCampaign.placements?.length || 0} Platzierungen</span>
              </div>
            </div>
          </div>

          {/* Analytics Chart Placeholder */}
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <h3 className="font-bold mb-3">Performance (letzte 7 Tage)</h3>
            <div className="h-40 flex items-center justify-center text-gray-500">
              <BarChart3 size={48} className="opacity-30" />
              <span className="ml-3">Analytics-Chart coming soon</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => onNavigate('/')} className="p-2 hover:bg-white/5 rounded-xl">
              <ArrowLeft size={20} className="text-gray-400" />
            </button>
            <div className="flex-1 ml-3">
              <h1 className="text-xl font-bold">Werbeplattform</h1>
              <p className="text-xs text-gray-400">{campaigns.length} Kampagnen</p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl font-medium text-black hover:shadow-lg transition-all"
            >
              <Plus size={18} />
              Neue Kampagne
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Create Campaign Modal */}
        <AnimatePresence>
          {showCreate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
              onClick={() => setShowCreate(false)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-[#0A0A0A] rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-xl font-bold mb-4">Neue Werbekampagne</h2>
                
                <form onSubmit={createCampaign} className="space-y-4">
                  {/* Campaign Name */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Kampagnenname</label>
                    <input
                      required
                      value={form.campaign_name}
                      onChange={(e) => setForm({ ...form, campaign_name: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500"
                      placeholder="z.B. Sommer-Aktion 2026"
                    />
                  </div>

                  {/* Ad Type */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Anzeigentyp</label>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(AD_TYPES).map(([key, type]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setForm({ ...form, ad_type: key })}
                          className={`p-3 rounded-xl text-left transition-all ${
                            form.ad_type === key
                              ? 'bg-cyan-500/20 border-cyan-500/30 border'
                              : 'bg-white/5 border border-white/10 hover:bg-white/10'
                          }`}
                        >
                          <div className="text-2xl mb-1">{type.icon}</div>
                          <div className="text-sm font-medium">{type.name}</div>
                          <div className="text-xs text-gray-400">€{type.price}/{type.unit}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-2">Anzeigen-Titel</label>
                      <input
                        required
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500"
                        placeholder="Kurzer Titel"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">CTA Text</label>
                      <input
                        value={form.cta_text}
                        onChange={(e) => setForm({ ...form, cta_text: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500"
                        placeholder="Mehr erfahren"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Beschreibung</label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 resize-none"
                      placeholder="Kurze Beschreibung der Anzeige..."
                    />
                  </div>

                  {/* Budget */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-2">Gesamt-Budget (€)</label>
                      <input
                        required
                        type="number"
                        min="10"
                        value={form.budget_total}
                        onChange={(e) => setForm({ ...form, budget_total: parseFloat(e.target.value) })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Tages-Budget (€)</label>
                      <input
                        required
                        type="number"
                        min="5"
                        value={form.budget_daily}
                        onChange={(e) => setForm({ ...form, budget_daily: parseFloat(e.target.value) })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
                      />
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-2">Start-Datum</label>
                      <input
                        required
                        type="date"
                        value={form.start_date}
                        onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">End-Datum</label>
                      <input
                        required
                        type="date"
                        value={form.end_date}
                        onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
                      />
                    </div>
                  </div>

                  {/* Placements */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Platzierungen</label>
                    <div className="grid grid-cols-2 gap-2">
                      {PLACEMENTS.map((placement) => (
                        <label key={placement.id} className="flex items-center gap-2 p-3 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10">
                          <input
                            type="checkbox"
                            checked={form.placements.includes(placement.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setForm({ ...form, placements: [...form.placements, placement.id] });
                              } else {
                                setForm({ ...form, placements: form.placements.filter(p => p !== placement.id) });
                              }
                            }}
                            className="rounded"
                          />
                          <span className="text-xl">{placement.icon}</span>
                          <span className="text-sm">{placement.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowCreate(false)}
                      className="flex-1 py-3 bg-white/5 rounded-xl font-medium hover:bg-white/10"
                    >
                      Abbrechen
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl font-bold text-black hover:shadow-lg"
                    >
                      Kampagne erstellen
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Campaigns List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Lade Kampagnen...</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-12">
            <TrendingUp size={48} className="text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 mb-4">Noch keine Kampagnen erstellt</p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-6 py-3 bg-cyan-500 text-black rounded-xl font-bold hover:bg-cyan-400"
            >
              Erste Kampagne erstellen
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((campaign) => (
              <div
                key={campaign.campaign_id}
                className="bg-white/5 rounded-2xl p-4 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                onClick={() => viewCampaignDetails(campaign.campaign_id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-white mb-1">{campaign.campaign_name}</h3>
                    <p className="text-sm text-gray-400">{AD_TYPES[campaign.ad_type]?.name}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCampaignStatus(campaign.campaign_id, campaign.status);
                    }}
                    className={`p-2 rounded-lg transition-colors ${
                      campaign.status === 'active'
                        ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                        : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                    }`}
                  >
                    {campaign.status === 'active' ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Impressions</p>
                    <p className="font-bold">{campaign.impressions || 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Clicks</p>
                    <p className="font-bold">{campaign.clicks || 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs mb-1">CTR</p>
                    <p className="font-bold text-cyan-400">{campaign.ctr || 0}%</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Budget</p>
                    <p className="font-bold text-green-400">€{campaign.budget_spent?.toFixed(0) || 0}/€{campaign.budget_total?.toFixed(0)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
      <Icon size={18} className="text-cyan-400 mb-2" />
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
