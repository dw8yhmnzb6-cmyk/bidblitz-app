import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, X, Check, Copy, Send } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * GroupOrderModal — Lieferando/Uber-Eats-Style Group-Bestellung
 * Organizer lädt Freunde via E-Mail ein. Backend: /api/group/create + /join + /add-items + /my-groups
 *
 * Props:
 *  - isOpen
 *  - onClose
 *  - serviceType: 'food' | 'taxi'
 *  - details: dict mit pickup/destination ODER restaurant_id/items (je nach serviceType)
 *  - onCreated: callback({ group_id, join_url })
 */
export default function GroupOrderModal({ isOpen, onClose, serviceType = 'food', details = {}, onCreated }) {
  const [emails, setEmails] = useState(['']);
  const [groupId, setGroupId] = useState(null);
  const [joinUrl, setJoinUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [myGroups, setMyGroups] = useState([]);

  useEffect(() => {
    if (isOpen) fetchMyGroups();
  }, [isOpen]);

  const fetchMyGroups = async () => {
    try {
      const r = await fetch(`${API}/api/group/my-groups`, { credentials: 'include' });
      if (r.ok) {
        const d = await r.json();
        setMyGroups((d.groups || []).filter(g => g.service_type === serviceType));
      }
    } catch {}
  };

  const updateEmail = (i, v) => {
    const arr = [...emails];
    arr[i] = v;
    setEmails(arr);
  };

  const createGroup = async () => {
    const valid = emails.map(e => e.trim()).filter(e => e.includes('@'));
    if (valid.length === 0) {
      setError('Bitte mindestens eine gültige E-Mail eingeben');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`${API}/api/group/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          service_type: serviceType,
          participants: valid,
          details,
        }),
      });
      if (r.ok) {
        const d = await r.json();
        setGroupId(d.group_id);
        setJoinUrl(d.join_url || '');
        onCreated?.(d);
        await fetchMyGroups();
      } else {
        const e = await r.json().catch(() => ({}));
        setError(e.detail || 'Gruppe konnte nicht erstellt werden');
      }
    } catch (e) {
      setError('Netzwerkfehler');
    }
    setLoading(false);
  };

  const copyLink = () => {
    if (joinUrl) navigator.clipboard?.writeText(joinUrl);
  };

  const reset = () => {
    setEmails(['']);
    setGroupId(null);
    setJoinUrl('');
    setError('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={onClose}
          data-testid="group-order-modal"
        >
          <motion.div
            initial={{ y: 400 }} animate={{ y: 0 }} exit={{ y: 400 }}
            onClick={e => e.stopPropagation()}
            className="bg-[#0B0B0F] rounded-3xl p-6 max-w-md w-full space-y-5 max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center">
                  <Users size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {serviceType === 'taxi' ? 'Group Ride' : 'Group Order'}
                  </h3>
                  <p className="text-gray-400 text-sm">
                    {serviceType === 'taxi' ? 'Mit Freunden gemeinsam fahren' : 'Gemeinsam bestellen — alle zahlen ihren Anteil'}
                  </p>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-[#121218] flex items-center justify-center"
                data-testid="group-order-close"
              >
                <X size={16} className="text-gray-400" />
              </motion.button>
            </div>

            {groupId ? (
              /* Erfolg-Screen */
              <div className="space-y-4">
                <div className="text-center py-4">
                  <motion.div
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center mb-4"
                  >
                    <Check size={40} className="text-emerald-400" />
                  </motion.div>
                  <h4 className="text-2xl font-bold text-white mb-1">Gruppe erstellt!</h4>
                  <p className="text-gray-400 text-sm">
                    Deine Freunde wurden benachrichtigt
                  </p>
                </div>

                {joinUrl && (
                  <div className="bg-[#121218] p-3 rounded-xl">
                    <p className="text-gray-400 text-xs mb-2">Einladungslink:</p>
                    <div className="flex items-center gap-2">
                      <p className="text-[#00C2FF] text-xs break-all flex-1">{joinUrl}</p>
                      <button
                        onClick={copyLink}
                        className="px-3 py-2 bg-[#00C2FF] text-white rounded-lg text-xs font-bold flex items-center gap-1"
                        data-testid="group-order-copy-link"
                      >
                        <Copy size={12} /> Kopieren
                      </button>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => { reset(); onClose(); }}
                  className="w-full py-3 bg-gradient-to-r from-[#00C2FF] to-[#7B2CFF] text-white rounded-full font-bold"
                >
                  Fertig
                </button>
              </div>
            ) : (
              /* Erstell-Screen */
              <>
                <div className="space-y-2">
                  <label className="text-white text-sm font-medium">Freunde einladen (E-Mail):</label>
                  {emails.map((email, idx) => (
                    <input
                      key={idx}
                      type="email"
                      placeholder="freund@example.com"
                      value={email}
                      onChange={(e) => updateEmail(idx, e.target.value)}
                      data-testid={`group-order-email-${idx}`}
                      className="w-full bg-[#121218] text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00C2FF]/50"
                    />
                  ))}
                  <button
                    onClick={() => setEmails([...emails, ''])}
                    className="text-[#00C2FF] text-sm font-medium"
                    data-testid="group-order-add-email"
                  >
                    + Person hinzufügen
                  </button>
                </div>

                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={createGroup}
                  disabled={loading}
                  data-testid="group-order-submit"
                  className={`w-full py-4 rounded-full font-bold text-white flex items-center justify-center gap-2 ${
                    loading ? 'bg-gray-700 opacity-50' : 'bg-gradient-to-r from-emerald-500 to-cyan-600'
                  }`}
                >
                  <Send size={18} />
                  {loading ? 'Erstelle...' : 'Gruppe erstellen & einladen'}
                </motion.button>

                {/* Aktive Gruppen */}
                {myGroups.length > 0 && (
                  <div className="pt-4 border-t border-white/10 space-y-2">
                    <h4 className="text-white text-sm font-medium">Deine aktiven Gruppen</h4>
                    {myGroups.slice(0, 3).map((g) => (
                      <div
                        key={g.group_id}
                        className="bg-[#121218] p-3 rounded-xl"
                        data-testid={`group-order-existing-${g.group_id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-white text-sm font-medium capitalize">
                              {g.service_type} · {g.status}
                            </p>
                            <p className="text-gray-400 text-xs">
                              {g.confirmed_by?.length || 0} / {(g.participants?.length || 0) + 1} bestätigt
                            </p>
                          </div>
                          <span className="text-[#00C2FF] text-xs">
                            {new Date(g.created_at).toLocaleDateString('de-DE')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
