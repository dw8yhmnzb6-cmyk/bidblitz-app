/**
 * BidBlitz V2 - NFT Generator Page
 * Generate AI NFT images with Wallet or Mining balance
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Sparkles, Wallet, Bitcoin, Image, Loader2,
  Star, Gem, Crown, Zap, ShoppingBag, Grid, Trophy,
  ChevronRight, X, Check, AlertCircle
} from "lucide-react";
import { api } from "../services/api";
import { useI18n } from "../store";

const panelBg = "rgba(12, 14, 26, 0.95)";
const panelBorder = "1px solid rgba(255,255,255,0.04)";

const RARITY_COLORS = {
  common: { bg: "#9CA3AF", text: "Common" },
  rare: { bg: "#3B82F6", text: "Rare" },
  epic: { bg: "#A855F7", text: "Epic" },
  legendary: { bg: "#F59E0B", text: "Legendary" },
};

const NFTGeneratorPage = ({ onNavigate }) => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [config, setConfig] = useState(null);
  const [balances, setBalances] = useState({ wallet_eur: 0, mining_btc: 0 });
  const [collection, setCollection] = useState([]);
  
  // Generation form
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [selectedTier, setSelectedTier] = useState("basic");
  const [paymentMethod, setPaymentMethod] = useState("wallet");
  
  // UI state
  const [activeTab, setActiveTab] = useState("generate"); // generate | collection | marketplace
  const [generatedNFT, setGeneratedNFT] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [marketplace, setMarketplace] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [configRes, balanceRes, collectionRes] = await Promise.all([
        api("/api/nft/config"),
        api("/api/nft/my-balance"),
        api("/api/nft/collection"),
      ]);
      setConfig(configRes);
      setBalances(balanceRes);
      setCollection(collectionRes.nfts || []);
      if (configRes.styles?.length > 0) {
        setSelectedStyle(configRes.styles[0].id);
      }
    } catch (err) {
      setError("Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  };

  const loadMarketplace = async () => {
    try {
      const res = await api("/api/nft/marketplace");
      setMarketplace(res.nfts || []);
    } catch (err) {
      console.error(err);
    }
  };

  const generateNFT = async () => {
    if (!selectedStyle || generating) return;
    
    setGenerating(true);
    setError(null);
    
    try {
      const res = await api("/api/nft/generate", {
        method: "POST",
        body: JSON.stringify({
          style_id: selectedStyle,
          tier: selectedTier,
          payment_method: paymentMethod,
        }),
      });
      
      setGeneratedNFT(res.nft);
      setBalances({
        wallet_eur: res.new_wallet_balance,
        mining_btc: res.new_mining_balance,
      });
      setSuccess(res.message);
      
      // Reload collection
      const collectionRes = await api("/api/nft/collection");
      setCollection(collectionRes.nfts || []);
    } catch (err) {
      setError(err.message || "Generierung fehlgeschlagen");
    } finally {
      setGenerating(false);
    }
  };

  const buyNFT = async (nftId, price) => {
    try {
      const res = await api(`/api/nft/buy/${nftId}`, { method: "POST" });
      setSuccess(res.message);
      setBalances(prev => ({ ...prev, wallet_eur: res.new_balance }));
      loadMarketplace();
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060810] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-purple-500" />
      </div>
    );
  }

  const currentPrice = config?.prices?.[selectedTier];

  return (
    <motion.div className="min-h-screen bg-[#060810] pb-24"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      
      {/* Header */}
      <div className="sticky top-0 z-40 px-4 pt-[max(env(safe-area-inset-top,0px),16px)] pb-3"
        style={{ background: "linear-gradient(to bottom, #060810 60%, transparent)" }}>
        <div className="flex items-center gap-3">
          <motion.button
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.03)", border: panelBorder }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onNavigate("/mining")}>
            <ArrowLeft size={18} className="text-white/50" />
          </motion.button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">NFT Generator</h1>
            <p className="text-[11px] text-white/40">KI-generierte Sammlerstücke</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-lg" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <p className="text-[10px] text-green-400/60">Wallet</p>
              <p className="text-[12px] font-bold text-green-400">€{balances.wallet_eur.toFixed(2)}</p>
            </div>
            <div className="px-3 py-1.5 rounded-lg" style={{ background: "rgba(247,147,26,0.1)", border: "1px solid rgba(247,147,26,0.2)" }}>
              <p className="text-[10px] text-orange-400/60">Mining</p>
              <p className="text-[12px] font-bold text-orange-400">{balances.mining_btc.toFixed(5)} BTC</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-4">
          {[
            { id: "generate", label: "Generieren", icon: Sparkles },
            { id: "collection", label: "Sammlung", icon: Grid },
            { id: "marketplace", label: "Marktplatz", icon: ShoppingBag },
          ].map(tab => (
            <motion.button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === "marketplace") loadMarketplace();
              }}
              className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-[12px] font-semibold transition-all`}
              style={{
                background: activeTab === tab.id ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.02)",
                border: activeTab === tab.id ? "1px solid rgba(168,85,247,0.3)" : panelBorder,
                color: activeTab === tab.id ? "#A855F7" : "rgba(255,255,255,0.4)",
              }}
              whileTap={{ scale: 0.97 }}>
              <tab.icon size={14} />
              {tab.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 space-y-4">
        
        {/* Alerts */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="p-3 rounded-xl flex items-center gap-2"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <AlertCircle size={16} className="text-red-400" />
              <span className="text-[12px] text-red-400 flex-1">{error}</span>
              <button onClick={() => setError(null)}><X size={14} className="text-red-400/50" /></button>
            </motion.div>
          )}
          {success && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="p-3 rounded-xl flex items-center gap-2"
              style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <Check size={16} className="text-green-400" />
              <span className="text-[12px] text-green-400 flex-1">{success}</span>
              <button onClick={() => setSuccess(null)}><X size={14} className="text-green-400/50" /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* === GENERATE TAB === */}
        {activeTab === "generate" && (
          <>
            {/* Generated NFT Result */}
            <AnimatePresence>
              {generatedNFT && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="rounded-2xl overflow-hidden"
                  style={{ background: panelBg, border: `2px solid ${RARITY_COLORS[generatedNFT.rarity]?.bg || "#9CA3AF"}` }}>
                  <div className="relative">
                    <img src={generatedNFT.image_url} alt={generatedNFT.name} className="w-full aspect-square object-cover" />
                    <div className="absolute top-3 right-3 px-3 py-1.5 rounded-lg"
                      style={{ background: RARITY_COLORS[generatedNFT.rarity]?.bg }}>
                      <span className="text-[11px] font-bold text-white">{generatedNFT.rarity_name}</span>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="text-[15px] font-bold text-white mb-1">{generatedNFT.name}</h3>
                    <p className="text-[11px] text-white/40 mb-3">{generatedNFT.style_name} • Token: {generatedNFT.token_id}</p>
                    <button onClick={() => setGeneratedNFT(null)}
                      className="w-full py-2.5 rounded-xl text-[12px] font-semibold text-purple-400"
                      style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.2)" }}>
                      Weiteres NFT generieren
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!generatedNFT && (
              <>
                {/* Style Selection */}
                <div className="rounded-2xl p-4" style={{ background: panelBg, border: panelBorder }}>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-3">Style wählen</p>
                  <div className="grid grid-cols-4 gap-2">
                    {config?.styles?.map(style => (
                      <motion.button
                        key={style.id}
                        onClick={() => setSelectedStyle(style.id)}
                        className="p-3 rounded-xl text-center transition-all"
                        style={{
                          background: selectedStyle === style.id ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.02)",
                          border: selectedStyle === style.id ? "1px solid rgba(168,85,247,0.4)" : panelBorder,
                        }}
                        whileTap={{ scale: 0.95 }}>
                        <span className="text-xl block mb-1">{style.icon}</span>
                        <span className={`text-[10px] font-medium ${selectedStyle === style.id ? "text-purple-400" : "text-white/40"}`}>
                          {style.name}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Tier Selection */}
                <div className="rounded-2xl p-4" style={{ background: panelBg, border: panelBorder }}>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-3">Paket wählen</p>
                  <div className="space-y-2">
                    {Object.entries(config?.prices || {}).map(([tierId, tier]) => (
                      <motion.button
                        key={tierId}
                        onClick={() => setSelectedTier(tierId)}
                        className="w-full p-4 rounded-xl flex items-center justify-between transition-all"
                        style={{
                          background: selectedTier === tierId 
                            ? tierId === "ultimate" ? "rgba(245,158,11,0.15)" 
                            : tierId === "premium" ? "rgba(168,85,247,0.15)" 
                            : "rgba(59,130,246,0.15)"
                            : "rgba(255,255,255,0.02)",
                          border: selectedTier === tierId 
                            ? tierId === "ultimate" ? "1px solid rgba(245,158,11,0.4)"
                            : tierId === "premium" ? "1px solid rgba(168,85,247,0.4)"
                            : "1px solid rgba(59,130,246,0.4)"
                            : panelBorder,
                        }}
                        whileTap={{ scale: 0.98 }}>
                        <div className="flex items-center gap-3">
                          {tierId === "ultimate" ? <Crown size={20} className="text-yellow-400" /> :
                           tierId === "premium" ? <Gem size={20} className="text-purple-400" /> :
                           <Star size={20} className="text-blue-400" />}
                          <div className="text-left">
                            <p className={`text-[13px] font-semibold ${
                              tierId === "ultimate" ? "text-yellow-400" :
                              tierId === "premium" ? "text-purple-400" : "text-blue-400"
                            }`}>{tier.name}</p>
                            <p className="text-[10px] text-white/40">{tier.description}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[13px] font-bold text-white">€{tier.eur.toFixed(2)}</p>
                          <p className="text-[10px] text-orange-400">{tier.btc} BTC</p>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Payment Method */}
                <div className="rounded-2xl p-4" style={{ background: panelBg, border: panelBorder }}>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-3">Zahlungsmethode</p>
                  <div className="grid grid-cols-2 gap-3">
                    <motion.button
                      onClick={() => setPaymentMethod("wallet")}
                      className="p-4 rounded-xl flex flex-col items-center gap-2 transition-all"
                      style={{
                        background: paymentMethod === "wallet" ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.02)",
                        border: paymentMethod === "wallet" ? "1px solid rgba(34,197,94,0.4)" : panelBorder,
                      }}
                      whileTap={{ scale: 0.97 }}>
                      <Wallet size={24} className={paymentMethod === "wallet" ? "text-green-400" : "text-white/30"} />
                      <div className="text-center">
                        <p className={`text-[12px] font-semibold ${paymentMethod === "wallet" ? "text-green-400" : "text-white/50"}`}>Wallet</p>
                        <p className="text-[10px] text-white/30">€{balances.wallet_eur.toFixed(2)}</p>
                      </div>
                    </motion.button>
                    <motion.button
                      onClick={() => setPaymentMethod("mining")}
                      className="p-4 rounded-xl flex flex-col items-center gap-2 transition-all"
                      style={{
                        background: paymentMethod === "mining" ? "rgba(247,147,26,0.15)" : "rgba(255,255,255,0.02)",
                        border: paymentMethod === "mining" ? "1px solid rgba(247,147,26,0.4)" : panelBorder,
                      }}
                      whileTap={{ scale: 0.97 }}>
                      <Bitcoin size={24} className={paymentMethod === "mining" ? "text-orange-400" : "text-white/30"} />
                      <div className="text-center">
                        <p className={`text-[12px] font-semibold ${paymentMethod === "mining" ? "text-orange-400" : "text-white/50"}`}>Mining</p>
                        <p className="text-[10px] text-white/30">{balances.mining_btc.toFixed(5)} BTC</p>
                      </div>
                    </motion.button>
                  </div>
                </div>

                {/* Generate Button */}
                <motion.button
                  onClick={generateNFT}
                  disabled={generating || !selectedStyle}
                  className="w-full py-4 rounded-2xl flex items-center justify-center gap-3"
                  style={{
                    background: "linear-gradient(135deg, #A855F7 0%, #7C3AED 100%)",
                    boxShadow: "0 8px 32px rgba(168,85,247,0.3)",
                    opacity: generating ? 0.7 : 1,
                  }}
                  whileTap={{ scale: 0.98 }}>
                  {generating ? (
                    <>
                      <Loader2 size={20} className="animate-spin text-white" />
                      <span className="text-[14px] font-bold text-white">Generiere NFT...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={20} className="text-white" />
                      <span className="text-[14px] font-bold text-white">
                        NFT Generieren • {paymentMethod === "wallet" 
                          ? `€${currentPrice?.eur?.toFixed(2) || "0.00"}` 
                          : `${currentPrice?.btc || "0.00000"} BTC`}
                      </span>
                    </>
                  )}
                </motion.button>

                {/* Rarity Info */}
                <div className="rounded-2xl p-4" style={{ background: panelBg, border: panelBorder }}>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-3">Seltenheits-Chancen</p>
                  <div className="space-y-2">
                    {Object.entries(RARITY_COLORS).reverse().map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ background: val.bg }} />
                          <span className="text-[12px] text-white/60">{val.text}</span>
                        </div>
                        <span className="text-[11px] text-white/40">
                          {key === "legendary" ? "5%" : key === "epic" ? "15%" : key === "rare" ? "30%" : "50%"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* === COLLECTION TAB === */}
        {activeTab === "collection" && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-[12px] text-white/40">{collection.length} NFTs in deiner Sammlung</p>
            </div>
            
            {collection.length === 0 ? (
              <div className="py-16 text-center">
                <Image size={48} className="text-white/10 mx-auto mb-3" />
                <p className="text-[13px] text-white/30">Noch keine NFTs</p>
                <p className="text-[11px] text-white/20 mt-1">Generiere dein erstes NFT!</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {collection.map(nft => (
                  <motion.div
                    key={nft.nft_id}
                    className="rounded-2xl overflow-hidden"
                    style={{ background: panelBg, border: `1px solid ${RARITY_COLORS[nft.rarity]?.bg}30` }}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}>
                    <div className="relative">
                      <img src={nft.image_url} alt={nft.name} className="w-full aspect-square object-cover" />
                      <div className="absolute top-2 right-2 px-2 py-1 rounded-md text-[9px] font-bold text-white"
                        style={{ background: RARITY_COLORS[nft.rarity]?.bg }}>
                        {nft.rarity_name}
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="text-[11px] font-semibold text-white truncate">{nft.name}</p>
                      <p className="text-[9px] text-white/30">{nft.style_name}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}

        {/* === MARKETPLACE TAB === */}
        {activeTab === "marketplace" && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-[12px] text-white/40">{marketplace.length} NFTs zum Verkauf</p>
            </div>
            
            {marketplace.length === 0 ? (
              <div className="py-16 text-center">
                <ShoppingBag size={48} className="text-white/10 mx-auto mb-3" />
                <p className="text-[13px] text-white/30">Keine NFTs zum Verkauf</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {marketplace.map(nft => (
                  <motion.div
                    key={nft.nft_id}
                    className="rounded-2xl overflow-hidden"
                    style={{ background: panelBg, border: `1px solid ${RARITY_COLORS[nft.rarity]?.bg}30` }}>
                    <div className="relative">
                      <img src={nft.image_url} alt={nft.name} className="w-full aspect-square object-cover" />
                      <div className="absolute top-2 right-2 px-2 py-1 rounded-md text-[9px] font-bold text-white"
                        style={{ background: RARITY_COLORS[nft.rarity]?.bg }}>
                        {nft.rarity_name}
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="text-[11px] font-semibold text-white truncate">{nft.name}</p>
                      <p className="text-[9px] text-white/30 mb-2">von {nft.seller_name}</p>
                      <button
                        onClick={() => buyNFT(nft.nft_id, nft.list_price)}
                        className="w-full py-2 rounded-lg text-[11px] font-bold text-white"
                        style={{ background: "linear-gradient(135deg, #22C55E 0%, #16A34A 100%)" }}>
                        Kaufen • €{nft.list_price?.toFixed(2)}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
};

export default NFTGeneratorPage;
