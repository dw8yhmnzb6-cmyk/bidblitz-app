// Admin Users Tab Component
import { Edit, Save, X, Ban, CheckCircle, Crown, Trophy, Plus, Zap, DollarSign } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

export default function AdminUsers({ 
  users, 
  editingUser, 
  setEditingUser,
  handleUpdateUser, 
  handleToggleBlock, 
  handleToggleVIP,
  handleToggleGuaranteedWinner,
  handleAddBids,
  t 
}) {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">{t('admin.manageUsers')}</h1>
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#181824]">
              <tr>
                <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">{t('dashboard.name')}</th>
                <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">{t('dashboard.email')}</th>
                <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">{t('admin.bids')}</th>
                <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">{t('admin.deposits')}</th>
                <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">{t('admin.status')}</th>
                <th className="px-4 py-3 text-left text-[#94A3B8] font-medium">{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {(users || []).map((user) => (
                <tr key={user.id} className={`hover:bg-white/5 ${user.is_blocked ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    {editingUser?.id === user.id ? (
                      <Input value={editingUser.name} onChange={(e) => setEditingUser({...editingUser, name: e.target.value})} className="bg-[#181824] border-white/10 text-white h-8 w-32" />
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-white">{user.name}</span>
                        {user.is_vip && (
                          <span className="px-1.5 py-0.5 rounded bg-[#F59E0B]/20 text-[#F59E0B] text-xs font-bold">VIP</span>
                        )}
                        {user.is_guaranteed_winner && (
                          <span className="px-1.5 py-0.5 rounded bg-[#FFD700]/20 text-[#FFD700] text-xs font-bold">🏆</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">{editingUser?.id === user.id ? <Input value={editingUser.email} onChange={(e) => setEditingUser({...editingUser, email: e.target.value})} className="bg-[#181824] border-white/10 text-white h-8" /> : <span className="text-[#94A3B8]">{user.email}</span>}</td>
                  <td className="px-4 py-3">{editingUser?.id === user.id ? <Input type="number" value={editingUser.bids_balance} onChange={(e) => setEditingUser({...editingUser, bids_balance: parseInt(e.target.value)})} className="bg-[#181824] border-white/10 text-white h-8 w-20" /> : <span className="flex items-center gap-1 text-[#06B6D4]"><Zap className="w-4 h-4" />{user.bids_balance}</span>}</td>
                  <td className="px-4 py-3"><span className="flex items-center gap-1 text-[#10B981]"><DollarSign className="w-4 h-4" />€{(user.total_deposits || 0).toFixed(2)}</span></td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-bold ${user.is_blocked ? 'bg-[#EF4444]/20 text-[#EF4444]' : 'bg-[#10B981]/20 text-[#10B981]'}`}>{user.is_blocked ? t('admin.blocked') : t('admin.active')}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {editingUser?.id === user.id ? (
                        <>
                          <Button size="sm" variant="ghost" className="text-[#10B981] hover:bg-[#10B981]/10" onClick={() => handleUpdateUser(user.id)}><Save className="w-4 h-4" /></Button>
                          <Button size="sm" variant="ghost" className="text-[#94A3B8] hover:bg-white/10" onClick={() => setEditingUser(null)}><X className="w-4 h-4" /></Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="ghost" className="text-[#7C3AED] hover:bg-[#7C3AED]/10" onClick={() => setEditingUser({...user})} title="Bearbeiten"><Edit className="w-4 h-4" /></Button>
                          <Button size="sm" variant="ghost" className={user.is_blocked ? "text-[#10B981] hover:bg-[#10B981]/10" : "text-[#EF4444] hover:bg-[#EF4444]/10"} onClick={() => handleToggleBlock(user.id, user.is_blocked)} title={user.is_blocked ? 'Entsperren' : 'Sperren'}>{user.is_blocked ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}</Button>
                          <Button size="sm" variant="ghost" className={user.is_vip ? "text-[#F59E0B] hover:bg-[#F59E0B]/10" : "text-[#94A3B8] hover:bg-white/10"} onClick={() => handleToggleVIP(user.id, user.is_vip)} title={user.is_vip ? 'VIP entfernen' : 'VIP aktivieren'}><Crown className="w-4 h-4" /></Button>
                          <Button size="sm" variant="ghost" className={user.is_guaranteed_winner ? "text-[#FFD700] hover:bg-[#FFD700]/10" : "text-[#94A3B8] hover:bg-white/10"} onClick={() => handleToggleGuaranteedWinner(user.id, user.is_guaranteed_winner)} title={user.is_guaranteed_winner ? 'Garantierter Gewinner deaktivieren' : 'Als Garantierter Gewinner markieren'}><Trophy className="w-4 h-4" /></Button>
                          <Button size="sm" variant="ghost" className="text-[#06B6D4] hover:bg-[#06B6D4]/10" onClick={() => handleAddBids(user.id)} title="Gebote hinzufügen"><Plus className="w-4 h-4" /></Button>
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
