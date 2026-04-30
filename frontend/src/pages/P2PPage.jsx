import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AtSign, Send, Check, AlertCircle, Loader2, ArrowLeft, Copy, QrCode, History } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function P2PPage({ onNavigate }) {
  const [view, setView] = useState('home');
  const [myHandle, setMyHandle] = useState(null);
  const [claiming, setClaiming] = useState('');
  const [claimMsg, setClaimMsg] = useState(null);

  const [recipient, setRecipient] = useState('');
  const [lookup, setLookup] = useState(null);
  const [lookupErr, setLookupErr] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState(null);

  const [history, setHistory] = useState([]);

  useEffect(() => { loadMe(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { if (view === 'history') loadHistory(); /* eslint-disable-next-line */ }, [view]);

  const loadMe = async () => {
    try {
      const r = await fetch(`${API}/api/p2p/handle/me`, { credentials: 'include' });
      if (r.ok) setMyHandle(await r.json());
    } catch {}
  };

  const loadHistory = async () => {
    try {
      const r = await fetch(`${API}/api/p2p/history`, { credentials: 'include' });
      if (r.ok) setHistory((await r.json()).items || []);
    } catch {}
  };

  const claimHandle = async () => {
    setClaimMsg(null);
    try {
      const r = await fetch(`${API}/api/p2p/handle/claim`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: claiming.replace(/^@/, '').toLowerCase() }),
      });
      const d = await r.json();
      if (r.ok) { setMyHandle((p) => ({ ...p, handle: d.handle })); setClaimMsg({ ok: true, text: `@${d.handle} gesichert!` }); }
      else setClaimMsg({ ok: false, text: d.detail || 'Fehler' });
    } catch { setClaimMsg({ ok: false, text: 'Netzwerkfehler' }); }
  };

  const doLookup = async (h) => {
    setLookup(null); setLookupErr('');
    const handle = h.replace(/^@/, '').toLowerCase().trim();
    if (!handle || handle.length < 3) return;
    try {
      const r = await fetch(`${API}/api/p2p/handle/lookup/${encodeURIComponent(handle)}`, { credentials: 'include' });
      if (r.ok) setLookup(await r.json());
      else setLookupErr('Handle nicht gefunden');
    } catch { setLookupErr('Netzwerkfehler'); }
  };

  const doSend = async () => {
    if (!lookup || !amount || Number(amount) <= 0) return;
    setSending(true); setSendMsg(null);
    try {
      const r = await fetch(`${API}/api/p2p/send`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_handle: lookup.handle, amount: Number(amount), note }),
      });
      const d = await r.json();
      if (r.ok) {
        setSendMsg({ ok: true, text: `€${d.amount.toFixed(2)} an @${d.recipient_handle} gesendet!` });
        setAmount(''); setNote(''); setLookup(null); setRecipient('');
        setTimeout(() => setView('home'), 1800);
      } else setSendMsg({ ok: false, text: d.detail || 'Fehler' });
    } catch { setSendMsg({ ok: false, text: 'Netzwerkfehler' }); }
    setSending(false);
  };

  const copyHandle = () => {
    if (!myHandle?.handle) return;
    navigator.clipboard.writeText(`@${myHandle.handle}`);
    setClaimMsg({ ok: true, text: 'Handle kopiert!' });
    setTimeout(() => setClaimMsg(null), 1500);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24" data-testid="p2p-page">
      <div className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
          <button data-testid="p2p-back-btn" onClick={() => onNavigate && onNavigate('/more')} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center">
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-lg font-bold">Senden & Empfangen</h1>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div key="home" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-5">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20">
                <p className="text-xs text-white/40 mb-1 uppercase tracking-widest font-bold">Dein BidBlitz Handle</p>
                {myHandle?.handle ? (
                  <div className="flex items-center justify-between mt-2">
                    <div>
                      <div className="flex items-baseline gap-1">
                        <AtSign size={16} className="text-cyan-400" />
                        <span data-testid="p2p-my-handle" className="text-xl font-bold text-cyan-300 font-mono">{myHandle.handle}</span>
                      </div>
                      <p className="text-xs text-white/40 mt-1">{myHandle.received_count || 0} empfangen · {myHandle.sent_count || 0} gesendet</p>
                    </div>
                    <button data-testid="p2p-copy-handle" onClick={copyHandle} className="px-3 py-2 rounded-lg bg-white/5 text-xs font-bold flex items-center gap-1.5">
                      <Copy size={12} /> Kopieren
                    </button>
                  </div>
                ) : (
                  <div className="mt-3">
                    <p className="text-sm text-white/70 mb-3">Noch keinen Handle? Sichere dir einen — Freunde senden dir Geld einfach mit <span className="text-cyan-400 font-mono">@dein-name</span></p>
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <AtSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                        <input data-testid="p2p-claim-input" value={claiming} onChange={(e) => setClaiming(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
                          placeholder="dein-name" maxLength={20}
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-cyan-500/30 font-mono" />
                      </div>
                      <button data-testid="p2p-claim-btn" onClick={claimHandle} disabled={!claiming || claiming.length < 3}
                        className="px-4 py-2.5 rounded-xl bg-cyan-500 text-black font-bold text-sm disabled:opacity-30">
                        Sichern
                      </button>
                    </div>
                  </div>
                )}
                {claimMsg && (
                  <p className={`mt-2 text-xs font-medium ${claimMsg.ok ? 'text-green-400' : 'text-red-400'}`}>{claimMsg.text}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button data-testid="p2p-send-btn" onClick={() => { setView('send'); setLookup(null); setRecipient(''); }}
                  className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-green-500/10 border border-emerald-500/20 flex flex-col items-center gap-2">
                  <Send size={24} className="text-emerald-400" />
                  <span className="text-sm font-bold">Senden</span>
                </button>
                <button data-testid="p2p-receive-btn" onClick={() => setView('receive')}
                  className="p-5 rounded-2xl bg-gradient-to-br from-purple-500/10 to-fuchsia-500/10 border border-purple-500/20 flex flex-col items-center gap-2">
                  <QrCode size={24} className="text-purple-400" />
                  <span className="text-sm font-bold">Empfangen</span>
                </button>
              </div>

              <button data-testid="p2p-history-btn" onClick={() => setView('history')}
                className="w-full p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <History size={18} className="text-white/40" />
                  <span className="text-sm font-semibold">Transaktionen</span>
                </div>
                <span className="text-white/30">→</span>
              </button>
            </motion.div>
          )}

          {view === 'send' && (
            <motion.div key="send" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
              <button data-testid="p2p-send-back" onClick={() => setView('home')} className="text-sm text-white/50 flex items-center gap-1">
                <ArrowLeft size={14} /> Zurück
              </button>
              <h2 className="text-xl font-bold">Geld senden</h2>

              <div>
                <label className="text-xs text-white/40 uppercase tracking-widest font-bold">Empfänger-Handle</label>
                <div className="mt-2 relative">
                  <AtSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                  <input data-testid="p2p-recipient-input" value={recipient} onChange={(e) => {
                    const v = e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, '');
                    setRecipient(v);
                    if (v.length >= 3) doLookup(v); else { setLookup(null); setLookupErr(''); }
                  }} placeholder="bidblitz.admin" maxLength={20}
                    className="w-full pl-9 pr-3 py-3 rounded-xl bg-white/5 border border-white/10 font-mono text-sm outline-none focus:border-cyan-500/30" />
                </div>
                {lookup && (
                  <div data-testid="p2p-recipient-preview" className="mt-2 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
                      {(lookup.name || '?').charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{lookup.name}</p>
                      <p className="text-xs text-emerald-400 font-mono">@{lookup.handle}</p>
                    </div>
                    <Check size={18} className="ml-auto text-emerald-400" />
                  </div>
                )}
                {lookupErr && <p className="mt-2 text-xs text-red-400 flex items-center gap-1"><AlertCircle size={12} /> {lookupErr}</p>}
              </div>

              {lookup && (
                <>
                  <div>
                    <label className="text-xs text-white/40 uppercase tracking-widest font-bold">Betrag €</label>
                    <input data-testid="p2p-amount-input" type="number" step="0.01" min="0.01" max="5000" value={amount} onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="mt-2 w-full px-4 py-4 rounded-xl bg-white/5 border border-white/10 text-2xl font-bold text-center font-mono outline-none focus:border-cyan-500/30" />
                  </div>

                  <div>
                    <label className="text-xs text-white/40 uppercase tracking-widest font-bold">Notiz (optional)</label>
                    <input data-testid="p2p-note-input" value={note} onChange={(e) => setNote(e.target.value)}
                      placeholder="Kaffee, Miete, Geschenk..." maxLength={140}
                      className="mt-2 w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-cyan-500/30" />
                  </div>

                  {sendMsg && (
                    <div className={`p-3 rounded-xl border ${sendMsg.ok ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                      <p className="text-sm font-semibold">{sendMsg.text}</p>
                    </div>
                  )}

                  <button data-testid="p2p-confirm-send-btn" onClick={doSend} disabled={sending || !amount || Number(amount) <= 0}
                    className="w-full py-4 rounded-xl bg-emerald-500 text-black font-bold text-lg disabled:opacity-30 flex items-center justify-center gap-2">
                    {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    {sending ? 'Sende...' : `€${Number(amount || 0).toFixed(2)} senden`}
                  </button>
                </>
              )}
            </motion.div>
          )}

          {view === 'receive' && (
            <motion.div key="receive" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
              <button onClick={() => setView('home')} className="text-sm text-white/50 flex items-center gap-1">
                <ArrowLeft size={14} /> Zurück
              </button>
              <h2 className="text-xl font-bold">Geld empfangen</h2>

              {!myHandle?.handle ? (
                <div className="p-5 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                  <p className="text-sm text-yellow-300">Sichere zuerst deinen Handle auf dem Hauptbildschirm.</p>
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-500/10 to-fuchsia-500/10 border border-purple-500/20 text-center">
                  <p className="text-xs text-white/40 uppercase tracking-widest font-bold mb-3">Teile dein Handle</p>
                  <div className="inline-flex items-baseline gap-1 mb-4">
                    <AtSign size={24} className="text-purple-400" />
                    <span data-testid="p2p-receive-handle" className="text-3xl font-black text-purple-300 font-mono">{myHandle.handle}</span>
                  </div>
                  <p className="text-xs text-white/40 mb-6">Freunde senden dir Geld einfach mit dem Handle. Kein IBAN, keine App-Umwege.</p>
                  <button data-testid="p2p-receive-copy" onClick={copyHandle}
                    className="w-full py-3 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold flex items-center justify-center gap-2">
                    <Copy size={14} /> @{myHandle.handle} kopieren
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {view === 'history' && (
            <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
              <button onClick={() => setView('home')} className="text-sm text-white/50 flex items-center gap-1">
                <ArrowLeft size={14} /> Zurück
              </button>
              <h2 className="text-xl font-bold">Verlauf</h2>
              {history.length === 0 ? (
                <div className="py-12 text-center text-white/30">Noch keine Transaktionen</div>
              ) : history.map((t, i) => (
                <div key={`tx-${t.id || t._id || i}`} className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${t.direction === 'credit' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {t.direction === 'credit' ? '↓' : '↑'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{t.description || t.type}</p>
                    <p className="text-xs text-white/30">{new Date(t.created_at).toLocaleDateString('de-DE')}</p>
                  </div>
                  <span className={`font-bold font-mono ${t.direction === 'credit' ? 'text-green-400' : 'text-red-400'}`}>
                    {t.direction === 'credit' ? '+' : '-'}€{Math.abs(t.amount || 0).toFixed(2)}
                  </span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
