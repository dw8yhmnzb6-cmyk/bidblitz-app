/**
 * Watchlist - Auktionen beobachten und Benachrichtigungen
 * Features: Watchlist hinzufügen/entfernen, Benachrichtigungen, Timer
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart, Bell, Clock, Trash2, RefreshCw, Eye, AlertTriangle,
  ChevronRight, Settings, X, Check, Timer
} from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const Watchlist = ({ token, language = 'de' }) => {
  const navigate = useNavigate();
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active'); // active, ended, all

  const t = (key) => {
    const translations = {
      de: {
        title: 'Meine Watchlist',
        subtitle: 'Beobachtete Auktionen',
        empty: 'Keine Auktionen auf der Watchlist',
        emptyHint: 'Klicke auf das Herz-Symbol bei einer Auktion, um sie hinzuzufügen',
        endingSoon: 'Endet bald',
        active: 'Aktiv',
        ended: 'Beendet',
        all: 'Alle',
        remove: 'Entfernen',
        viewAuction: 'Zur Auktion',
        notifyBefore: 'Benachrichtigen vor',
        minutes: 'Minuten',
        clearAll: 'Alle löschen',
        confirmClear: 'Wirklich alle löschen?',
        priceAtAdd: 'Preis beim Hinzufügen',
        currentPrice: 'Aktueller Preis',
        bids: 'Gebote',
        timeLeft: 'Verbleibend',
        settings: 'Einstellungen'
      },
      en: {
        title: 'My Watchlist',
        subtitle: 'Watched auctions',
        empty: 'No auctions on watchlist',
        emptyHint: 'Click the heart icon on an auction to add it',
        endingSoon: 'Ending soon',
        active: 'Active',
        ended: 'Ended',
        all: 'All',
        remove: 'Remove',
        viewAuction: 'View Auction',
        notifyBefore: 'Notify before',
        minutes: 'minutes',
        clearAll: 'Clear all',
        confirmClear: 'Really clear all?',
        priceAtAdd: 'Price when added',
        currentPrice: 'Current price',
        bids: 'Bids',
        timeLeft: 'Time left',
        settings: 'Settings'
      }
    };
    return translations[language]?.[key] || translations.de[key] || key;
  };

  const fetchWatchlist = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    
    try {
      const response = await fetch(`${API}/api/watchlist/my-watchlist?status=${filter}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setWatchlist(data.watchlist || []);
    } catch (error) {
      console.error('Error fetching watchlist:', error);
    } finally {
      setLoading(false);
    }
  }, [token, filter]);

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  const removeFromWatchlist = async (auctionId) => {
    try {
      const response = await fetch(`${API}/api/watchlist/remove/${auctionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        setWatchlist(prev => prev.filter(w => w.auction_id !== auctionId));
        toast.success('Von Watchlist entfernt');
      }
    } catch (error) {
      toast.error('Fehler beim Entfernen');
    }
  };

  const clearAll = async () => {
    if (!window.confirm(t('confirmClear'))) return;
    
    try {
      const response = await fetch(`${API}/api/watchlist/clear`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        setWatchlist([]);
        toast.success('Watchlist geleert');
      }
    } catch (error) {
      toast.error('Fehler beim Löschen');
    }
  };

  const formatTime = (seconds) => {
    if (!seconds || seconds <= 0) return '--:--:--';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const endingSoonCount = watchlist.filter(w => w.auction?.ending_soon).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-4" data-testid="watchlist-page">
      {/* Header */}
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Heart className="w-6 h-6 text-red-500" />
              {t('title')}
            </h1>
            <p className="text-gray-400 text-sm">{t('subtitle')}</p>
          </div>
          
          <div className="flex items-center gap-2">
            {endingSoonCount > 0 && (
              <div className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 text-red-400 rounded-full text-sm">
                <AlertTriangle className="w-4 h-4" />
                {endingSoonCount} {t('endingSoon')}
              </div>
            )}
            <Button
              onClick={fetchWatchlist}
              variant="outline"
              size="sm"
              className="border-gray-600"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 mb-6">
          {['active', 'ended', 'all'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === f
                  ? 'bg-amber-500 text-white'
                  : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {t(f)}
            </button>
          ))}
          
          {watchlist.length > 0 && (
            <button
              onClick={clearAll}
              className="ml-auto px-3 py-2 text-sm text-red-400 hover:text-red-300 flex items-center gap-1"
            >
              <Trash2 className="w-4 h-4" />
              {t('clearAll')}
            </button>
          )}
        </div>

        {/* Watchlist Items */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
          </div>
        ) : watchlist.length === 0 ? (
          <div className="text-center py-12 bg-gray-800/50 rounded-xl">
            <Heart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
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
            {watchlist.map((item) => (
              <WatchlistItem
                key={item.id}
                item={item}
                onRemove={() => removeFromWatchlist(item.auction_id)}
                onView={() => navigate(`/auctions/${item.auction_id}`)}
                t={t}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Watchlist Item Component
const WatchlistItem = ({ item, onRemove, onView, t }) => {
  const auction = item.auction || {};
  const isEndingSoon = auction.ending_soon;
  const isEnded = auction.status !== 'active';
  
  return (
    <div 
      className={`bg-gray-800/50 rounded-xl p-4 border transition-all ${
        isEndingSoon ? 'border-red-500/50 bg-red-500/10' : 'border-gray-700/50'
      }`}
      data-testid={`watchlist-item-${item.auction_id}`}
    >
      <div className="flex items-center gap-4">
        {/* Image */}
        <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-700 flex-shrink-0">
          {auction.image_url ? (
            <img 
              src={auction.image_url} 
              alt={auction.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500">
              <Eye className="w-8 h-8" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate">{auction.title || 'Unbekannt'}</h3>
          
          <div className="flex items-center gap-4 mt-2 text-sm">
            <div>
              <span className="text-gray-400">{t('currentPrice')}:</span>
              <span className="text-amber-400 font-bold ml-1">€{auction.current_price?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="text-gray-500">
              {auction.bid_count || 0} {t('bids')}
            </div>
          </div>
          
          {/* Time Remaining */}
          {!isEnded && auction.time_remaining && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${
              isEndingSoon ? 'text-red-400' : 'text-gray-400'
            }`}>
              <Timer className="w-4 h-4" />
              <span>{t('timeLeft')}: </span>
              <span className="font-mono font-medium">
                {Math.floor(auction.time_remaining / 3600)}h {Math.floor((auction.time_remaining % 3600) / 60)}m
              </span>
              {isEndingSoon && (
                <span className="ml-2 px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs">
                  {t('endingSoon')}!
                </span>
              )}
            </div>
          )}
          
          {isEnded && (
            <div className="mt-2 px-2 py-1 bg-gray-600/50 text-gray-400 rounded text-sm inline-block">
              {t('ended')}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Button
            onClick={onView}
            size="sm"
            className="bg-amber-500 hover:bg-amber-600"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            onClick={onRemove}
            size="sm"
            variant="outline"
            className="border-red-500/50 text-red-400 hover:bg-red-500/10"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {/* Added Info */}
      <div className="mt-3 pt-3 border-t border-gray-700/50 flex justify-between text-xs text-gray-500">
        <span>Hinzugefügt: {new Date(item.added_at).toLocaleDateString('de-DE')}</span>
        <span>{t('priceAtAdd')}: €{item.price_at_add?.toFixed(2) || '0.00'}</span>
      </div>
    </div>
  );
};

export default Watchlist;
