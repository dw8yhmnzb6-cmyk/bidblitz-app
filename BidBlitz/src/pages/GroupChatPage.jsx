import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Users, Plus, Send, AtSign } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function GroupChatPage({ onNavigate }) {
  const [view, setView] = useState('list');
  const [groups, setGroups] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newMembers, setNewMembers] = useState('');

  useEffect(() => { loadGroups(); const iv = setInterval(() => { if (view === 'list') loadGroups(); if (view === 'chat' && active) loadMessages(active.group_id); }, 5000); return () => clearInterval(iv); /* eslint-disable-next-line */ }, [view, active]);

  const loadGroups = async () => {
    try { const r = await fetch(`${API}/api/groupchat/list`, { credentials: 'include' }); if (r.ok) setGroups((await r.json()).groups || []); } catch {}
  };
  const openGroup = async (g) => {
    setActive(g); setView('chat');
    await fetch(`${API}/api/groupchat/${g.group_id}/read`, { method: 'POST', credentials: 'include' });
    loadMessages(g.group_id);
  };
  const loadMessages = async (gid) => {
    try { const r = await fetch(`${API}/api/groupchat/${gid}/messages?limit=50`, { credentials: 'include' }); if (r.ok) setMessages((await r.json()).messages || []); } catch {}
  };
  const sendMsg = async () => {
    if (!text.trim() || !active) return;
    const t = text; setText('');
    try {
      const r = await fetch(`${API}/api/groupchat/${active.group_id}/message`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: t }),
      });
      if (r.ok) { const m = await r.json(); setMessages((p) => [...p, m]); }
    } catch {}
  };
  const createGroup = async () => {
    if (!newGroupName) return;
    const members = newMembers.split(/[\s,]+/).map((s) => s.replace(/^@/, '').toLowerCase()).filter(Boolean);
    try {
      const r = await fetch(`${API}/api/groupchat/create`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newGroupName, initial_members: members }),
      });
      if (r.ok) { setNewGroupName(''); setNewMembers(''); setView('list'); loadGroups(); }
    } catch {}
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24" data-testid="groupchat-page">
      <div className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
          <button data-testid="gc-back-btn" onClick={() => view === 'list' ? onNavigate && onNavigate('/more') : setView('list')} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center">
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-lg font-bold flex-1">{view === 'chat' && active ? active.name : 'Gruppen'}</h1>
          {view === 'list' && (
            <button data-testid="gc-new-btn" onClick={() => setView('create')} className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Plus size={16} className="text-emerald-400" />
            </button>
          )}
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {view === 'list' && (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
              {groups.length === 0 ? (
                <div className="py-16 text-center"><Users size={40} className="mx-auto mb-4 text-white/10" /><p className="text-sm text-white/40">Noch keine Gruppen</p></div>
              ) : groups.map((g) => (
                <button key={g.group_id} data-testid={`gc-group-${g.group_id}`} onClick={() => openGroup(g)} className="w-full p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center gap-3 text-left">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center font-bold text-emerald-400">{(g.name || '?').charAt(0)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{g.name}</p>
                    <p className="text-xs text-white/40 truncate">{g.last_message?.text || `${(g.members||[]).length} Mitglieder`}</p>
                  </div>
                  {g.unread_count > 0 && <span className="w-5 h-5 rounded-full bg-emerald-500 text-[10px] font-bold flex items-center justify-center">{g.unread_count}</span>}
                </button>
              ))}
            </motion.div>
          )}

          {view === 'chat' && active && (
            <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
              {messages.map((m) => (
                <div key={m.message_id} className={`flex ${m.sender_handle ? 'flex-row items-end gap-2' : ''}`}>
                  <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                    {(m.sender_name || '?').charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-[9px] text-white/30">@{m.sender_handle || m.sender_name}</p>
                    <div className="p-2 rounded-xl bg-white/5 inline-block">
                      <p className="text-sm">{m.text}</p>
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {view === 'create' && (
            <motion.div key="create" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <input data-testid="gc-name-input" placeholder="Gruppen-Name" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-emerald-500/30" />
              <div>
                <label className="text-xs text-white/40 uppercase tracking-widest font-bold">Mitglieder (@handles, Komma getrennt)</label>
                <div className="mt-2 relative">
                  <AtSign size={14} className="absolute left-3 top-3.5 text-white/30" />
                  <textarea data-testid="gc-members-input" value={newMembers} onChange={(e) => setNewMembers(e.target.value)}
                    placeholder="bidblitz.admin, ahmet, ..." rows={3}
                    className="w-full pl-9 pr-3 py-3 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-emerald-500/30 font-mono text-sm" />
                </div>
              </div>
              <button data-testid="gc-create-btn" onClick={createGroup} disabled={!newGroupName}
                className="w-full py-3 rounded-xl bg-emerald-500 text-black font-bold disabled:opacity-30">
                Gruppe erstellen
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {view === 'chat' && (
        <div className="fixed bottom-0 left-0 right-0 z-30 max-w-md mx-auto p-3 bg-[#0A0A0A]/95 backdrop-blur-xl border-t border-white/5 flex gap-2">
          <input data-testid="gc-msg-input" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMsg()}
            placeholder="Nachricht..." className="flex-1 px-4 py-3 rounded-full bg-white/5 border border-white/10 outline-none focus:border-emerald-500/30 text-sm" />
          <button data-testid="gc-send-btn" onClick={sendMsg} className="w-11 h-11 rounded-full bg-emerald-500 flex items-center justify-center">
            <Send size={16} className="text-black" />
          </button>
        </div>
      )}
    </div>
  );
}
