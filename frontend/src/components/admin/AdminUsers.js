// Admin Users Tab Component
import { Edit, Save, X, Ban, CheckCircle, Crown, Trophy, Plus, Zap, DollarSign, Users, Mail } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useState, useEffect } from 'react';
import axios from 'axios';

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
  const [users, setUsers] = useState(propUsers || []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If propUsers is passed and has data, use it
    if (propUsers && propUsers.length > 0) {
      setUsers(propUsers);
    } else {
      // Otherwise, fetch users directly
      fetchUsers();
    }
  }, [propUsers]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      // Use native fetch instead of axios to avoid potential interceptor issues
      const response = await fetch(`${API}/admin/users`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      console.log('AdminUsers: Loaded', data?.length, 'users');
      setUsers(data || []);
    } catch (error) {
      console.error('AdminUsers: Error fetching users', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
        <span className="ml-3 text-slate-600">Lade Benutzer...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
          <Users className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('admin.manageUsers')}</h1>
          <p className="text-slate-500 text-sm">{users.length} Benutzer registriert</p>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {(users || []).map((user) => (
          <div key={user.id} className={`bg-white rounded-xl p-4 shadow-sm border border-slate-100 ${user.is_blocked ? 'opacity-60' : ''}`}>
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
                user.is_blocked ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
              }`}>
                {user.is_blocked ? t('admin.blocked') : t('admin.active')}
              </span>
            </div>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-slate-50 rounded-lg p-2 text-center">
                <p className="text-xs text-slate-400">Gebote</p>
                <p className="text-lg font-bold text-cyan-600 flex items-center justify-center gap-1">
                  <Zap className="w-4 h-4" />{user.bids_balance}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2 text-center">
                <p className="text-xs text-slate-400">Einzahlungen</p>
                <p className="text-lg font-bold text-emerald-600">€{(user.total_deposits || 0).toFixed(2)}</p>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-1 flex-wrap">
              <Button size="sm" onClick={() => setEditingUser({...user})} className="flex-1 bg-violet-500 hover:bg-violet-600 text-white">
                <Edit className="w-3 h-3 mr-1" />Bearbeiten
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleToggleBlock(user.id, user.is_blocked)} 
                className={user.is_blocked ? "border-emerald-300 text-emerald-600" : "border-red-300 text-red-600"}>
                {user.is_blocked ? <CheckCircle className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleToggleVIP(user.id, user.is_vip)}
                className={user.is_vip ? "border-amber-300 text-amber-600 bg-amber-50" : "border-slate-200 text-slate-400"}>
                <Crown className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleToggleGuaranteedWinner(user.id, user.is_guaranteed_winner)}
                className={user.is_guaranteed_winner ? "border-yellow-300 text-yellow-600 bg-yellow-50" : "border-slate-200 text-slate-400"}>
                <Trophy className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleAddBids(user.id)} className="border-cyan-300 text-cyan-600">
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}
        {(users || []).length === 0 && (
          <p className="text-center text-slate-400 py-12">Keine Benutzer gefunden</p>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-xl overflow-hidden shadow-sm border border-slate-100">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 text-left text-slate-600 font-medium">{t('dashboard.name')}</th>
                <th className="px-4 py-3 text-left text-slate-600 font-medium">{t('dashboard.email')}</th>
                <th className="px-4 py-3 text-left text-slate-600 font-medium">{t('admin.bids')}</th>
                <th className="px-4 py-3 text-left text-slate-600 font-medium">{t('admin.deposits')}</th>
                <th className="px-4 py-3 text-left text-slate-600 font-medium">{t('admin.status')}</th>
                <th className="px-4 py-3 text-left text-slate-600 font-medium">{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(users || []).map((user) => (
                <tr key={user.id} className={`hover:bg-slate-50 ${user.is_blocked ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    {editingUser?.id === user.id ? (
                      <Input value={editingUser.name} onChange={(e) => setEditingUser({...editingUser, name: e.target.value})} className="bg-slate-50 border-slate-200 text-slate-800 h-8 w-32" />
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-800 font-medium">{user.name}</span>
                        {user.is_vip && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-bold">VIP</span>
                        )}
                        {user.is_guaranteed_winner && (
                          <span className="px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 text-xs font-bold">🏆</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">{editingUser?.id === user.id ? <Input value={editingUser.email} onChange={(e) => setEditingUser({...editingUser, email: e.target.value})} className="bg-slate-50 border-slate-200 text-slate-800 h-8" /> : <span className="text-slate-500">{user.email}</span>}</td>
                  <td className="px-4 py-3">{editingUser?.id === user.id ? <Input type="number" value={editingUser.bids_balance} onChange={(e) => setEditingUser({...editingUser, bids_balance: parseInt(e.target.value)})} className="bg-slate-50 border-slate-200 text-slate-800 h-8 w-20" /> : <span className="flex items-center gap-1 text-cyan-600 font-medium"><Zap className="w-4 h-4" />{user.bids_balance}</span>}</td>
                  <td className="px-4 py-3"><span className="flex items-center gap-1 text-emerald-600 font-medium"><DollarSign className="w-4 h-4" />€{(user.total_deposits || 0).toFixed(2)}</span></td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-bold ${user.is_blocked ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{user.is_blocked ? t('admin.blocked') : t('admin.active')}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {editingUser?.id === user.id ? (
                        <>
                          <Button size="sm" variant="ghost" className="text-emerald-600 hover:bg-emerald-50" onClick={() => handleUpdateUser(user.id)}><Save className="w-4 h-4" /></Button>
                          <Button size="sm" variant="ghost" className="text-slate-400 hover:bg-slate-100" onClick={() => setEditingUser(null)}><X className="w-4 h-4" /></Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="ghost" className="text-violet-600 hover:bg-violet-50" onClick={() => setEditingUser({...user})} title="Bearbeiten"><Edit className="w-4 h-4" /></Button>
                          <Button size="sm" variant="ghost" className={user.is_blocked ? "text-emerald-600 hover:bg-emerald-50" : "text-red-500 hover:bg-red-50"} onClick={() => handleToggleBlock(user.id, user.is_blocked)} title={user.is_blocked ? 'Entsperren' : 'Sperren'}>{user.is_blocked ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}</Button>
                          <Button size="sm" variant="ghost" className={user.is_vip ? "text-amber-500 hover:bg-amber-50" : "text-slate-400 hover:bg-slate-100"} onClick={() => handleToggleVIP(user.id, user.is_vip)} title={user.is_vip ? 'VIP entfernen' : 'VIP aktivieren'}><Crown className="w-4 h-4" /></Button>
                          <Button size="sm" variant="ghost" className={user.is_guaranteed_winner ? "text-yellow-500 hover:bg-yellow-50" : "text-slate-400 hover:bg-slate-100"} onClick={() => handleToggleGuaranteedWinner(user.id, user.is_guaranteed_winner)} title={user.is_guaranteed_winner ? 'Garantierter Gewinner deaktivieren' : 'Als Garantierter Gewinner markieren'}><Trophy className="w-4 h-4" /></Button>
                          <Button size="sm" variant="ghost" className="text-cyan-600 hover:bg-cyan-50" onClick={() => handleAddBids(user.id)} title="Gebote hinzufügen"><Plus className="w-4 h-4" /></Button>
                        </>
                      )}
                    </div>
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
