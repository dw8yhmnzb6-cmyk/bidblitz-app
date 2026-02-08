import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Trophy, Users, Bot, UserCheck, X, RefreshCw, Clock, Euro } from 'lucide-react';

const AdminWinnerControl = () => {
  const { token } = useAuth();
  const [auctions, setAuctions] = useState([]);
  const [settings, setSettings] = useState({ bot_win_rate: 90 });
  const [loading, setLoading] = useState(true);
  const [selectedAuction, setSelectedAuction] = useState(null);
  const [showBidderModal, setShowBidderModal] = useState(false);

  const API = process.env.REACT_APP_BACKEND_URL;

  const fetchData = useCallback(async () => {
    try {
      const [auctionsRes, settingsRes] = await Promise.all([
        fetch(`${API}/api/admin/winner-control/auctions`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API}/api/admin/winner-control/settings`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (auctionsRes.ok) {
        const data = await auctionsRes.json();
        setAuctions(data);
      }
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Error fetching winner control data:', error);
    } finally {
      setLoading(false);
    }
  }, [API, token]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [fetchData]);

  const setWinner = async (auctionId, userId) => {
    try {
      const res = await fetch(`${API}/api/admin/winner-control/set-winner`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ auction_id: auctionId, user_id: userId })
      });

      if (res.ok) {
        fetchData();
        setShowBidderModal(false);
        setSelectedAuction(null);
      }
    } catch (error) {
      console.error('Error setting winner:', error);
    }
  };

  const clearWinner = async (auctionId) => {
    try {
      await fetch(`${API}/api/admin/winner-control/clear-winner/${auctionId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
    } catch (error) {
      console.error('Error clearing winner:', error);
    }
  };

  const updateBotWinRate = async (rate) => {
    try {
      await fetch(`${API}/api/admin/winner-control/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ bot_win_rate: rate })
      });
      setSettings({ ...settings, bot_win_rate: rate });
    } catch (error) {
      console.error('Error updating settings:', error);
    }
  };

  const getTimeLeft = (endTime) => {
    const end = new Date(endTime);
    const now = new Date();
    const diff = Math.max(0, (end - now) / 1000);
    const mins = Math.floor(diff / 60);
    const secs = Math.floor(diff % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <Trophy className="w-8 h-8" />
          <h2 className="text-2xl font-bold">Gewinner-Kontrolle</h2>
        </div>
        <p className="text-purple-100">
          Kontrollieren Sie, wer Auktionen gewinnt. Sie können manuell Kunden als Gewinner festlegen.
        </p>
      </div>

      {/* Bot Win Rate Setting */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <Bot className="w-6 h-6 text-gray-600 dark:text-gray-300" />
          <h3 className="text-lg font-semibold dark:text-white">Bot-Gewinnrate</h3>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex-1">
            <input
              type="range"
              min="0"
              max="100"
              value={settings.bot_win_rate}
              onChange={(e) => updateBotWinRate(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
            />
          </div>
          <div className="text-center min-w-[120px]">
            <div className="text-3xl font-bold text-purple-600">{settings.bot_win_rate}%</div>
            <div className="text-sm text-gray-500">Bots gewinnen</div>
          </div>
          <div className="text-center min-w-[120px]">
            <div className="text-3xl font-bold text-green-600">{100 - settings.bot_win_rate}%</div>
            <div className="text-sm text-gray-500">Kunden gewinnen</div>
          </div>
        </div>
      </div>

      {/* Active Auctions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5" />
            Aktive Auktionen ({auctions.length})
          </h3>
          <button
            onClick={fetchData}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <RefreshCw className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {auctions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Keine aktiven Auktionen
            </div>
          ) : (
            auctions.map((auction) => (
              <div
                key={auction.id}
                className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium dark:text-white">{auction.title}</h4>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Euro className="w-4 h-4" />
                        {auction.current_price?.toFixed(2)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {getTimeLeft(auction.end_time)}
                      </span>
                      <span>
                        Führt: <span className="font-medium">{auction.last_bidder_name || 'Niemand'}</span>
                      </span>
                    </div>
                  </div>

                  {/* Winner Status */}
                  <div className="flex items-center gap-3">
                    {auction.guaranteed_winner_bidding ? (
                      <div className="flex items-center gap-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-3 py-2 rounded-lg">
                        <UserCheck className="w-4 h-4" />
                        <span className="font-medium">
                          {auction.guaranteed_winner_info?.name || 'Kunde gewinnt'}
                        </span>
                        <button
                          onClick={() => clearWinner(auction.id)}
                          className="ml-2 p-1 hover:bg-green-200 dark:hover:bg-green-800 rounded"
                          title="Gewinner zurücksetzen"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-3 py-2 rounded-lg">
                        <Bot className="w-4 h-4" />
                        <span>Bots gewinnen</span>
                      </div>
                    )}

                    {/* Set Winner Button */}
                    <button
                      onClick={() => {
                        setSelectedAuction(auction);
                        setShowBidderModal(true);
                      }}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Trophy className="w-4 h-4" />
                      Gewinner wählen
                    </button>
                  </div>
                </div>

                {/* Real Bidders Preview */}
                {auction.real_bidders?.length > 0 && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                    <span>Echte Bieter:</span>
                    {auction.real_bidders.slice(0, 3).map((bidder, i) => (
                      <span
                        key={bidder.id}
                        className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded"
                      >
                        {bidder.name}
                      </span>
                    ))}
                    {auction.real_bidders.length > 3 && (
                      <span className="text-gray-400">
                        +{auction.real_bidders.length - 3} weitere
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Bidder Selection Modal */}
      {showBidderModal && selectedAuction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold dark:text-white">
                Gewinner wählen: {selectedAuction.title}
              </h3>
              <button
                onClick={() => {
                  setShowBidderModal(false);
                  setSelectedAuction(null);
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {/* Let Bots Win Option */}
              <button
                onClick={() => setWinner(selectedAuction.id, null)}
                className="w-full p-4 mb-4 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-purple-500 dark:hover:border-purple-500 transition-colors flex items-center gap-3"
              >
                <Bot className="w-8 h-8 text-gray-500" />
                <div className="text-left">
                  <div className="font-medium dark:text-white">Bots gewinnen lassen</div>
                  <div className="text-sm text-gray-500">Kein bestimmter Gewinner - Bots übernehmen</div>
                </div>
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                <span className="text-sm text-gray-500">oder Kunde wählen</span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
              </div>

              {/* Real Bidders */}
              {selectedAuction.real_bidders?.length > 0 ? (
                <div className="space-y-2">
                  {selectedAuction.real_bidders.map((bidder) => (
                    <button
                      key={bidder.id}
                      onClick={() => setWinner(selectedAuction.id, bidder.id)}
                      className="w-full p-4 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-green-500 dark:hover:border-green-500 transition-colors flex items-center gap-3"
                    >
                      <UserCheck className="w-8 h-8 text-green-500" />
                      <div className="text-left">
                        <div className="font-medium dark:text-white">{bidder.name}</div>
                        <div className="text-sm text-gray-500">Dieser Kunde gewinnt</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  Keine echten Bieter auf dieser Auktion
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminWinnerControl;
