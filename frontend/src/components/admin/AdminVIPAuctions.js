import { useState } from 'react';
import axios from 'axios';
import { Button } from '../ui/button';
import { 
  Crown, Star, Bot, Target, Edit, RefreshCw, Square, Play, 
  Plus, X, Repeat
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function AdminVIPAuctions({ token, vipAuctions, auctions, fetchData }) {
  
  const handleUpdateBotTarget = async (auctionId, currentTarget) => {
    const newTarget = prompt(`Bot-Mindestpreis ändern (€):`, currentTarget || '0');
    if (newTarget === null) return;
    
    try {
      const res = await axios.put(
        `${API}/admin/bots/target-price/${auctionId}?target_price=${parseFloat(newTarget) || 0}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(res.data.message);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler');
    }
  };

  const handleSetAutoRestart = async (auctionId, currentDuration) => {
    const duration = prompt('Auto-Neustart Dauer (Minuten):', currentDuration || '10');
    if (!duration) return;
    
    try {
      await axios.put(
        `${API}/admin/auctions/${auctionId}/auto-restart?duration_minutes=${parseInt(duration)}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Auto-Neustart konfiguriert');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler');
    }
  };

  const handleExtendAuction = async (auctionId) => {
    const seconds = prompt('Zeit verlängern um (Sekunden):', '300');
    if (!seconds) return;
    try {
      await axios.put(`${API}/admin/auctions/${auctionId}`, {
        duration_seconds: parseInt(seconds)
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Auktion verlängert');
      fetchData();
    } catch (error) {
      toast.error('Fehler');
    }
  };

  const handleEndAuction = async (auctionId) => {
    try {
      await axios.post(`${API}/admin/auctions/${auctionId}/end`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Auktion beendet');
      fetchData();
    } catch (error) {
      toast.error('Fehler');
    }
  };

  const handleRestartAuction = async (auctionId) => {
    const duration = prompt('Dauer in Minuten:', '10');
    if (!duration) return;
    
    try {
      await axios.post(
        `${API}/admin/auctions/${auctionId}/restart?duration_seconds=${parseInt(duration) * 60}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Auktion neu gestartet!');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler');
    }
  };

  const handleSetVipOnly = async (auctionId, isVipOnly) => {
    try {
      await axios.put(
        `${API}/admin/auctions/${auctionId}/vip-only?is_vip_only=${!isVipOnly}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(isVipOnly ? 'VIP-Only Status entfernt' : 'Als VIP-Only markiert');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Crown className="w-8 h-8 text-yellow-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">VIP Auktionen verwalten</h1>
            <p className="text-gray-400 text-sm">Exklusive Auktionen nur für VIP-Mitglieder</p>
          </div>
        </div>
      </div>
      
      {/* Info Box */}
      <div className="glass-card rounded-xl p-4 border-l-4 border-yellow-500">
        <div className="flex items-start gap-3">
          <Crown className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-1" />
          <div>
            <h4 className="text-white font-semibold mb-1">VIP-Only Auktionen</h4>
            <p className="text-[#94A3B8] text-sm">
              VIP-Only Auktionen sind nur für zahlende VIP-Mitglieder sichtbar. 
              <span className="text-[#FFD700]"> Bots können auch in VIP-Auktionen bieten!</span>
            </p>
          </div>
        </div>
      </div>

      {/* Current VIP Auctions */}
      <div className="glass-card rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-400" />
          Aktuelle VIP-Auktionen ({vipAuctions?.length || 0})
        </h3>
        
        {vipAuctions?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#181824]">
                <tr>
                  <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">Produkt</th>
                  <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">Preis</th>
                  <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">
                    <div className="flex items-center gap-1">
                      <Bot className="w-4 h-4 text-[#FFD700]" /><span>Bot-Ziel</span>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">Gebote</th>
                  <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">Status</th>
                  <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {vipAuctions.map((auction) => {
                  const botTarget = auction.bot_target_price || 0;
                  const currentPrice = auction.current_price || 0;
                  const botActive = botTarget > 0 && currentPrice < botTarget && auction.status === 'active';
                  const targetReached = botTarget > 0 && currentPrice >= botTarget;
                  
                  return (
                    <tr key={auction.id} className="hover:bg-white/5">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <img src={auction.product?.image_url || '/placeholder.png'} 
                              alt={auction.product?.name}
                              className="w-12 h-12 object-contain bg-white/5 rounded" />
                            <div className="absolute -top-1 -left-1 bg-gradient-to-r from-yellow-500 to-amber-400 rounded-full p-0.5">
                              <Crown className="w-3 h-3 text-black" />
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gradient-to-r from-yellow-500 to-amber-400 text-black">VIP</span>
                              <p className="text-white font-medium">{auction.product?.name || 'N/A'}</p>
                            </div>
                            <p className="text-gray-400 text-xs">UVP: €{auction.product?.retail_price?.toFixed(2)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#06B6D4] font-mono">€{currentPrice.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleUpdateBotTarget(auction.id, botTarget)} className="flex items-center gap-2 group">
                          {botTarget > 0 ? (
                            <div className="flex items-center gap-1">
                              <span className={`font-mono ${targetReached ? 'text-[#10B981]' : 'text-[#FFD700]'}`}>
                                €{botTarget.toFixed(2)}
                              </span>
                              {botActive && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#FFD700]/20 text-[#FFD700] animate-pulse">AKTIV</span>}
                              {targetReached && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#10B981]/20 text-[#10B981]">ERREICHT</span>}
                            </div>
                          ) : <span className="text-[#94A3B8]">-</span>}
                          <Edit className="w-3 h-3 text-[#94A3B8] opacity-0 group-hover:opacity-100" />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-white">{auction.total_bids}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          auction.status === 'active' ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#EF4444]/20 text-[#EF4444]'
                        }`}>
                          {auction.status === 'active' ? 'Aktiv' : 'Beendet'}
                        </span>
                        {auction.auto_restart?.enabled && (
                          <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#7C3AED]/20 text-[#7C3AED]">AUTO</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="ghost" className="text-[#FFD700] hover:bg-[#FFD700]/10"
                            onClick={() => handleUpdateBotTarget(auction.id, botTarget)} title="Bot-Ziel">
                            <Target className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" 
                            className={`${auction.auto_restart?.enabled ? 'text-[#7C3AED] bg-[#7C3AED]/20' : 'text-gray-400'} hover:bg-[#7C3AED]/10`}
                            onClick={() => handleSetAutoRestart(auction.id, auction.auto_restart?.duration_minutes || 10)} title="Auto-Neustart">
                            <Repeat className="w-4 h-4" />
                          </Button>
                          {auction.status === 'active' && (
                            <>
                              <Button size="sm" variant="ghost" className="text-[#06B6D4] hover:bg-[#06B6D4]/10" 
                                onClick={() => handleExtendAuction(auction.id)} title="Verlängern">
                                <RefreshCw className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className="text-[#F59E0B] hover:bg-[#F59E0B]/10" 
                                onClick={() => handleEndAuction(auction.id)} title="Beenden">
                                <Square className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          {auction.status === 'ended' && (
                            <Button size="sm" variant="ghost" className="text-[#10B981] hover:bg-[#10B981]/10" 
                              onClick={() => handleRestartAuction(auction.id)} title="Neu starten">
                              <Play className="w-4 h-4" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-400/10"
                            onClick={() => handleSetVipOnly(auction.id, true)} title="VIP-Status entfernen">
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-400 text-center py-8">Keine VIP-Auktionen vorhanden</p>
        )}
      </div>

      {/* Add Auction to VIP */}
      <div className="glass-card rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-green-400" />
          Auktion zu VIP hinzufügen
        </h3>
        <p className="text-gray-400 text-sm mb-4">Wählen Sie eine normale Auktion aus:</p>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#181824]">
              <tr>
                <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">Produkt</th>
                <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">Preis</th>
                <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">Bot-Ziel</th>
                <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">Status</th>
                <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {(auctions || []).filter(a => !a.is_vip_only && a.status === 'active').slice(0, 10).map((auction) => (
                <tr key={auction.id} className="hover:bg-white/5">
                  <td className="px-4 py-3 text-white">{auction.product?.name || 'N/A'}</td>
                  <td className="px-4 py-3 text-[#06B6D4] font-mono">€{auction.current_price?.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    {auction.bot_target_price > 0 ? (
                      <span className="text-[#FFD700] font-mono">€{auction.bot_target_price.toFixed(2)}</span>
                    ) : <span className="text-[#94A3B8]">-</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded-full text-xs font-bold bg-[#10B981]/20 text-[#10B981]">Aktiv</span>
                  </td>
                  <td className="px-4 py-3">
                    <Button size="sm" className="bg-yellow-500 hover:bg-yellow-400 text-black"
                      onClick={() => handleSetVipOnly(auction.id, false)}>
                      <Crown className="w-4 h-4 mr-1" />Als VIP markieren
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
