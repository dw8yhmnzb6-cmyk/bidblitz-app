// Admin Users Tab Component - Standalone version with self-loading
import { Edit, Save, X, Ban, CheckCircle, Crown, Trophy, Plus, Zap, DollarSign, Users, Mail, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useState, useEffect, useRef } from 'react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function AdminUsers({ 
  users: propUsers, 
  editingUser, 
  setEditingUser,
  handleUpdateUser, 
  handleToggleBlock, 
  handleToggleVIP,
  handleToggleGuaranteedWinner,
  handleAddBids,
  t 
}) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    loadUsers();
    
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadUsers = async () => {
    console.log('AdminUsers: Starting to load users...');
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No token found');
      }
      
      console.log('AdminUsers: Fetching from', `${API}/admin/users`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(`${API}/admin/users`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      console.log('AdminUsers: Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('AdminUsers: Loaded', data?.length, 'users');
      
      if (mounted.current) {
        setUsers(data || []);
        setLoading(false);
      }
    } catch (err) {
      console.error('AdminUsers: Error loading users:', err.name, err.message);
      if (mounted.current) {
        setError(err.message);
        setLoading(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-600"></div>
        <span className="text-slate-600">Lade Benutzer...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="text-red-500 text-center">
          <p className="font-semibold">Fehler beim Laden</p>
          <p className="text-sm">{error}</p>
        </div>
        <Button onClick={loadUsers} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Erneut versuchen
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{t?.('admin.manageUsers') || 'Benutzer verwalten'}</h1>
            <p className="text-slate-500 text-sm">{users.length} Benutzer registriert</p>
          </div>
        </div>
        <Button onClick={loadUsers} variant="outline" size="sm" className="gap-2">
          <RefreshCw className="w-4 h-4" /> Aktualisieren
        </Button>
      </div>

      {/* Users list */}
      {users.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Keine Benutzer gefunden</p>
        </div>
      ) : (
        <div className="md:hidden space-y-3">
          {users.map((user) => (
            <div key={user.id || user._id} className={`bg-white rounded-xl p-4 shadow-sm border border-slate-100 ${user.is_blocked ? 'opacity-60' : ''}`}>
              {/* Header with name and status */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-800 truncate">{user.name}</p>
                    {user.is_vip && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-bold">VIP</span>
                    )}
                    {user.is_guaranteed_winner && (
                      <span className="px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 text-xs font-bold">🏆</span>
                    )}
                  </div>
                  <p className="text-slate-400 text-xs truncate flex items-center gap-1 mt-0.5">
                    <Mail className="w-3 h-3" />{user.email}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-bold flex-shrink-0 ${
                  user.is_blocked 
                    ? 'bg-red-100 text-red-600' 
                    : 'bg-green-100 text-green-600'
                }`}>
                  {user.is_blocked ? 'Gesperrt' : 'Aktiv'}
                </span>
              </div>
              
              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                <div className="bg-slate-50 rounded-lg p-2">
                  <p className="text-xs text-slate-400">Gebote</p>
                  <p className="font-bold text-violet-600">{user.bids || 0}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <p className="text-xs text-slate-400">Gewonnen</p>
                  <p className="font-bold text-emerald-600">{user.won || 0}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <p className="text-xs text-slate-400">Ausgaben</p>
                  <p className="font-bold text-amber-600">€{(user.spent || 0).toFixed(0)}</p>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant={user.is_vip ? "default" : "outline"}
                  onClick={() => handleToggleVIP?.(user.id || user._id)}
                  className="flex-1 text-xs gap-1"
                >
                  <Crown className="w-3 h-3" />
                  VIP
                </Button>
                <Button
                  size="sm"
                  variant={user.is_blocked ? "destructive" : "outline"}
                  onClick={() => handleToggleBlock?.(user.id || user._id)}
                  className="flex-1 text-xs gap-1"
                >
                  <Ban className="w-3 h-3" />
                  {user.is_blocked ? 'Entsperren' : 'Sperren'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddBids?.(user.id || user._id)}
                  className="flex-1 text-xs gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Gebote
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Name</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Email</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-slate-600">Gebote</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-slate-600">Status</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-slate-600">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id || user._id} className={`border-b ${user.is_blocked ? 'opacity-60' : ''}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800">{user.name}</span>
                    {user.is_vip && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-bold">VIP</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-500">{user.email}</td>
                <td className="px-4 py-3 text-center font-medium text-violet-600">{user.bids || 0}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                    user.is_blocked ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                  }`}>
                    {user.is_blocked ? 'Gesperrt' : 'Aktiv'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex justify-center gap-1">
                    <Button size="sm" variant="outline" onClick={() => handleToggleVIP?.(user.id || user._id)}>
                      <Crown className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleToggleBlock?.(user.id || user._id)}>
                      <Ban className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleAddBids?.(user.id || user._id)}>
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
