/**
 * AutoBid - Automatisches Bieten für Auktionen
 * Features: Max-Preis setzen, automatische Gebote, Budget-Management
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap, Settings, Play, Pause, Trash2, RefreshCw, AlertTriangle,
  ChevronRight, Euro, Target, Clock, TrendingUp, X, Check, Edit2
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const AutoBid = ({ token, language = 'de' }) => {
  const navigate = useNavigate();
  const [autoBids, setAutoBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});

  const t = (key) => {
    const translations = {
      de: {
        title: 'Auto-Bid Manager',
        subtitle: 'Automatisch bieten und gewinnen',
        empty: 'Keine Auto-Bids konfiguriert',
        emptyHint: 'Aktiviere Auto-Bid bei einer Auktion, um automatisch zu bieten',
        maxPrice: 'Max. Preis',
        maxBids: 'Max. Gebote',
        bidsPlaced: 'Gesetzte Gebote',
        status: 'Status',
        active: 'Aktiv',
        paused: 'Pausiert',
        completed: 'Abgeschlossen',
        deactivated: 'Deaktiviert',
        activate: 'Aktivieren',
        pause: 'Pausieren',
        delete: 'Löschen',
        save: 'Speichern',
        cancel: 'Abbrechen',
        edit: 'Bearbeiten',
        currentPrice: 'Aktueller Preis',
        remaining: 'Verbleibend',
        viewAuction: 'Zur Auktion',
        bidDelay: 'Verzögerung',
        seconds: 'Sekunden',
        reasons: {
          max_bids_reached: 'Max. Gebote erreicht',
          max_price_reached: 'Max. Preis erreicht',
          no_bids: 'Keine Gebote mehr',
          auction_ended: 'Auktion beendet'
        }
      },
      en: {
        title: 'Auto-Bid Manager',
        subtitle: 'Bid automatically and win',
        empty: 'No auto-bids configured',
        emptyHint: 'Enable auto-bid on an auction to bid automatically',
        maxPrice: 'Max. Price',
        maxBids: 'Max. Bids',
        bidsPlaced: 'Bids Placed',
        status: 'Status',
        active: 'Active',
        paused: 'Paused',
        completed: 'Completed',
        deactivated: 'Deactivated',
        activate: 'Activate',
        pause: 'Pause',
        delete: 'Delete',
        save: 'Save',
        cancel: 'Cancel',
        edit: 'Edit',
        currentPrice: 'Current Price',
        remaining: 'Remaining',
        viewAuction: 'View Auction',
        bidDelay: 'Delay',
        seconds: 'seconds',
        reasons: {
          max_bids_reached: 'Max bids reached',
          max_price_reached: 'Max price reached',
          no_bids: 'No bids left',
          auction_ended: 'Auction ended'
        }
      }
    };
    return translations[language]?.[key] || translations.de[key] || key;
  };

  const fetchAutoBids = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    
    try {
      const response = await fetch(`${API}/api/auto-bid/my-auto-bids`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setAutoBids(data.auto_bids || []);
    } catch (error) {
      console.error('Error fetching auto-bids:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAutoBids();
  }, [fetchAutoBids]);

  const toggleAutoBid = async (auctionId) => {
    try {
      const response = await fetch(`${API}/api/auto-bid/toggle/${auctionId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAutoBids(prev => prev.map(ab => 
          ab.auction_id === auctionId ? { ...ab, is_active: data.is_active } : ab
        ));
        toast.success(data.message);
      }
    } catch (error) {
      toast.error('Fehler beim Umschalten');
    }
  };

  const deleteAutoBid = async (autoBidId) => {
    if (!window.confirm('Auto-Bid wirklich löschen?')) return;
    
    try {
      const response = await fetch(`${API}/api/auto-bid/${autoBidId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        setAutoBids(prev => prev.filter(ab => ab.id !== autoBidId));
        toast.success('Auto-Bid gelöscht');
      }
    } catch (error) {
      toast.error('Fehler beim Löschen');
    }
  };

  const updateAutoBid = async (autoBidId) => {
    const values = editValues[autoBidId];
    if (!values) return;
    
    try {
      const response = await fetch(`${API}/api/auto-bid/${autoBidId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(values)
      });
      
      if (response.ok) {
        setAutoBids(prev => prev.map(ab => 
          ab.id === autoBidId ? { ...ab, ...values } : ab
        ));
        setEditingId(null);
        toast.success('Auto-Bid aktualisiert');
      }
    } catch (error) {
      toast.error('Fehler beim Aktualisieren');
    }
  };

  const startEditing = (ab) => {
    setEditingId(ab.id);
    setEditValues({
      [ab.id]: {
        max_price: ab.max_price,
        max_bids: ab.max_bids
      }
    });
  };

  const activeCount = autoBids.filter(ab => ab.is_active).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-4" data-testid="auto-bid-page">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Zap className="w-6 h-6 text-amber-500" />
              {t('title')}
            </h1>
            <p className="text-gray-400 text-sm">{t('subtitle')}</p>
          </div>
          
          <div className="flex items-center gap-2">
            {activeCount > 0 && (
              <div className="flex items-center gap-1 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-full text-sm">
                <Play className="w-4 h-4" />
                {activeCount} {t('active')}
              </div>
            )}
            <Button
              onClick={fetchAutoBids}
              variant="outline"
              size="sm"
              className="border-gray-600"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Auto-Bids List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
          </div>
        ) : autoBids.length === 0 ? (
          <div className="text-center py-12 bg-gray-800/50 rounded-xl">
            <Zap className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg mb-2">{t('empty')}</p>
            <p className="text-gray-500 text-sm mb-4">{t('emptyHint')}</p>
            <Button
              onClick={() => navigate('/auctions')}
              className="bg-amber-500 hover:bg-amber-600"
            >
              Zu den Auktionen
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {autoBids.map((ab) => (
              <AutoBidCard
                key={ab.id}
                autoBid={ab}
                isEditing={editingId === ab.id}
                editValues={editValues[ab.id] || {}}
                onEditChange={(field, value) => 
                  setEditValues(prev => ({
                    ...prev,
                    [ab.id]: { ...prev[ab.id], [field]: value }
                  }))
                }
                onToggle={() => toggleAutoBid(ab.auction_id)}
                onDelete={() => deleteAutoBid(ab.id)}
                onEdit={() => startEditing(ab)}
                onSave={() => updateAutoBid(ab.id)}
                onCancel={() => setEditingId(null)}
                onView={() => navigate(`/auctions/${ab.auction_id}`)}
                t={t}
              />
            ))}
          </div>
        )}

        {/* Info Box */}
        <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <h3 className="font-semibold text-amber-400 flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4" />
            Wie funktioniert Auto-Bid?
          </h3>
          <ul className="text-gray-300 text-sm space-y-1">
            <li>• Setze einen maximalen Preis, den du zahlen möchtest</li>
            <li>• Das System bietet automatisch für dich, wenn du überboten wirst</li>
            <li>• Deine Gebote werden nur eingesetzt, wenn der Preis unter deinem Maximum liegt</li>
            <li>• Du kannst jederzeit pausieren oder deine Limits anpassen</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

// Auto-Bid Card Component
const AutoBidCard = ({ 
  autoBid, 
  isEditing, 
  editValues, 
  onEditChange, 
  onToggle, 
  onDelete, 
  onEdit,
  onSave,
  onCancel,
  onView, 
  t 
}) => {
  const isActive = autoBid.is_active;
  const isCompleted = autoBid.auction_status === 'completed' || autoBid.auction_status === 'ended';
  const deactivationReason = autoBid.deactivation_reason;
  
  const progressPercent = autoBid.max_bids > 0 
    ? Math.min(100, (autoBid.bids_placed / autoBid.max_bids) * 100)
    : 0;

  return (
    <div 
      className={`bg-gray-800/50 rounded-xl p-4 border transition-all ${
        isActive ? 'border-green-500/50' : 'border-gray-700/50'
      }`}
      data-testid={`auto-bid-${autoBid.id}`}
    >
      <div className="flex items-start gap-4">
        {/* Auction Image */}
        <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-700 flex-shrink-0">
          {autoBid.auction_image ? (
            <img 
              src={autoBid.auction_image} 
              alt={autoBid.auction_title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500">
              <Target className="w-8 h-8" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="font-semibold text-white truncate">
              {autoBid.auction_title || 'Unbekannte Auktion'}
            </h3>
            <div className={`px-2 py-1 rounded text-xs font-medium ${
              isActive ? 'bg-green-500/20 text-green-400' : 
              isCompleted ? 'bg-gray-500/20 text-gray-400' :
              'bg-yellow-500/20 text-yellow-400'
            }`}>
              {isActive ? t('active') : isCompleted ? t('completed') : t('paused')}
            </div>
          </div>

          {/* Stats Grid */}
          {isEditing ? (
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-gray-400 text-xs block mb-1">{t('maxPrice')}</label>
                <Input
                  type="number"
                  step="0.50"
                  value={editValues.max_price || ''}
                  onChange={(e) => onEditChange('max_price', parseFloat(e.target.value))}
                  className="bg-gray-700 border-gray-600"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1">{t('maxBids')}</label>
                <Input
                  type="number"
                  value={editValues.max_bids || ''}
                  onChange={(e) => onEditChange('max_bids', parseInt(e.target.value))}
                  className="bg-gray-700 border-gray-600"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div>
                <span className="text-gray-400 text-xs block">{t('maxPrice')}</span>
                <span className="text-amber-400 font-bold">€{autoBid.max_price?.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-400 text-xs block">{t('currentPrice')}</span>
                <span className="text-white font-medium">€{autoBid.auction_current_price?.toFixed(2) || '0.00'}</span>
              </div>
              <div>
                <span className="text-gray-400 text-xs block">{t('bidsPlaced')}</span>
                <span className="text-white font-medium">{autoBid.bids_placed} / {autoBid.max_bids}</span>
              </div>
              <div>
                <span className="text-gray-400 text-xs block">{t('remaining')}</span>
                <span className="text-white font-medium">{autoBid.max_bids - autoBid.bids_placed}</span>
              </div>
            </div>
          )}

          {/* Progress Bar */}
          <div className="mb-3">
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all ${
                  progressPercent >= 80 ? 'bg-red-500' : 
                  progressPercent >= 50 ? 'bg-yellow-500' : 
                  'bg-green-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Deactivation Reason */}
          {deactivationReason && !isActive && (
            <div className="text-yellow-400 text-xs flex items-center gap-1 mb-2">
              <AlertTriangle className="w-3 h-3" />
              {t(`reasons.${deactivationReason}`) || deactivationReason}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          {isEditing ? (
            <>
              <Button onClick={onSave} size="sm" className="bg-green-500 hover:bg-green-600">
                <Check className="w-4 h-4" />
              </Button>
              <Button onClick={onCancel} size="sm" variant="outline" className="border-gray-600">
                <X className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <>
              <Button onClick={onView} size="sm" className="bg-amber-500 hover:bg-amber-600">
                <ChevronRight className="w-4 h-4" />
              </Button>
              {!isCompleted && (
                <>
                  <Button
                    onClick={onToggle}
                    size="sm"
                    variant="outline"
                    className={isActive ? 'border-yellow-500/50 text-yellow-400' : 'border-green-500/50 text-green-400'}
                  >
                    {isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </Button>
                  <Button onClick={onEdit} size="sm" variant="outline" className="border-gray-600">
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </>
              )}
              <Button
                onClick={onDelete}
                size="sm"
                variant="outline"
                className="border-red-500/50 text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AutoBid;
