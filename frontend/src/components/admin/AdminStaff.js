// Admin Staff Management Component
import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Plus, Edit, Trash2, Save, X, Shield, Users } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminStaff({ token, staff, roles, permissions, fetchData }) {
  const [newStaff, setNewStaff] = useState({ email: '', password: '', name: '', role: 'editor' });
  const [editingStaff, setEditingStaff] = useState(null);

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/admin/staff`, newStaff, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Mitarbeiter erstellt');
      setNewStaff({ email: '', password: '', name: '', role: 'editor' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Erstellen');
    }
  };

  const handleUpdateStaff = async (staffId) => {
    try {
      await axios.put(`${API}/admin/staff/${staffId}`, editingStaff, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Mitarbeiter aktualisiert');
      setEditingStaff(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Aktualisieren');
    }
  };

  const handleDeleteStaff = async (staffId) => {
    if (!window.confirm('Mitarbeiter wirklich löschen?')) return;
    try {
      await axios.delete(`${API}/admin/staff/${staffId}`, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Mitarbeiter gelöscht');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Löschen');
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-800">Mitarbeiter verwalten</h1>
      
      {/* Add Staff Form */}
      <div className="glass-card rounded-xl p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-[#7C3AED]" />
          Neuer Mitarbeiter
        </h3>
        <form onSubmit={handleCreateStaff} className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="space-y-2">
            <Label className="text-gray-800">Name</Label>
            <Input 
              value={newStaff.name} 
              onChange={(e) => setNewStaff({...newStaff, name: e.target.value})} 
              required 
              className="bg-white border-gray-200 text-gray-800" 
              placeholder="Max Mustermann" 
            />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-800">E-Mail</Label>
            <Input 
              type="email" 
              value={newStaff.email} 
              onChange={(e) => setNewStaff({...newStaff, email: e.target.value})} 
              required 
              className="bg-white border-gray-200 text-gray-800" 
              placeholder="mitarbeiter@bidblitz.de" 
            />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-800">Passwort</Label>
            <Input 
              type="password" 
              value={newStaff.password} 
              onChange={(e) => setNewStaff({...newStaff, password: e.target.value})} 
              required 
              className="bg-white border-gray-200 text-gray-800" 
              placeholder="••••••••" 
            />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-800">Rolle</Label>
            <Select value={newStaff.role} onValueChange={(v) => setNewStaff({...newStaff, role: v})}>
              <SelectTrigger className="bg-white border-gray-200 text-gray-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles && Object.entries(roles).map(([id, role]) => (
                  <SelectItem key={id} value={id}>{role.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white">
              <Plus className="w-4 h-4 mr-2" /> Erstellen
            </Button>
          </div>
        </form>
      </div>

      {/* Roles Overview */}
      <div className="glass-card rounded-xl p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#06B6D4]" />
          Verfügbare Rollen
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {roles && Object.entries(roles).map(([id, role]) => (
            <div key={id} className="bg-white rounded-lg p-4 border border-gray-200">
              <h4 className="font-bold text-gray-800 mb-1">{role.name}</h4>
              <p className="text-gray-500 text-xs mb-2">{role.description}</p>
              <div className="flex flex-wrap gap-1">
                {role.permissions?.map(perm => (
                  <span key={perm} className="px-2 py-0.5 bg-[#7C3AED]/20 text-[#7C3AED] text-[10px] rounded">
                    {permissions?.[perm]?.name || perm}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Staff List */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-[#10B981]" />
            Mitarbeiterliste ({staff?.length || 0})
          </h3>
        </div>
        
        {/* Mobile Card View */}
        <div className="md:hidden space-y-3 p-4">
          {(staff || []).map((member) => (
            <div key={member.id} className="bg-white rounded-lg p-4 border border-gray-100">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-medium text-gray-800">{member.name}</p>
                  <p className="text-gray-500 text-sm">{member.email}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                  member.role === 'super_admin' ? 'bg-[#7C3AED]/20 text-[#7C3AED]' : 'bg-[#10B981]/20 text-[#10B981]'
                }`}>
                  {roles?.[member.role]?.name || member.role}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  Letzte Anmeldung: {member.last_login ? new Date(member.last_login).toLocaleString('de-DE', {dateStyle: 'short', timeStyle: 'short'}) : 'Nie'}
                </p>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" className="text-[#7C3AED] hover:bg-[#7C3AED]/10" onClick={() => setEditingStaff({...member})}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-[#EF4444] hover:bg-[#EF4444]/10" onClick={() => handleDeleteStaff(member.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {(!staff || staff.length === 0) && (
            <p className="text-center text-gray-500 py-8">Keine Mitarbeiter vorhanden</p>
          )}
        </div>
        
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white">
              <tr>
                <th className="px-6 py-4 text-left text-gray-500 font-medium">Name</th>
                <th className="px-6 py-4 text-left text-gray-500 font-medium">E-Mail</th>
                <th className="px-6 py-4 text-left text-gray-500 font-medium">Rolle</th>
                <th className="px-6 py-4 text-left text-gray-500 font-medium">Letzte Anmeldung</th>
                <th className="px-6 py-4 text-left text-gray-500 font-medium">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {(staff || []).map((member) => (
                <tr key={member.id} className="hover:bg-white/5">
                  <td className="px-6 py-4">
                    {editingStaff?.id === member.id ? (
                      <Input 
                        value={editingStaff.name} 
                        onChange={(e) => setEditingStaff({...editingStaff, name: e.target.value})} 
                        className="bg-white border-gray-200 text-gray-800 h-8" 
                      />
                    ) : (
                      <span className="text-gray-800">{member.name}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {editingStaff?.id === member.id ? (
                      <Input 
                        value={editingStaff.email} 
                        onChange={(e) => setEditingStaff({...editingStaff, email: e.target.value})} 
                        className="bg-white border-gray-200 text-gray-800 h-8" 
                      />
                    ) : (
                      <span className="text-gray-500">{member.email}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {editingStaff?.id === member.id ? (
                      <Select value={editingStaff.role} onValueChange={(v) => setEditingStaff({...editingStaff, role: v})}>
                        <SelectTrigger className="bg-white border-gray-200 text-gray-800 h-8 w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roles && Object.entries(roles).map(([id, role]) => (
                            <SelectItem key={id} value={id}>{role.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        member.role === 'super_admin' ? 'bg-[#7C3AED]/20 text-[#7C3AED]' : 'bg-[#10B981]/20 text-[#10B981]'
                      }`}>
                        {roles?.[member.role]?.name || member.role}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {member.last_login ? new Date(member.last_login).toLocaleString('de-DE', {dateStyle: 'short', timeStyle: 'short'}) : 'Nie'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {editingStaff?.id === member.id ? (
                        <>
                          <Button size="sm" variant="ghost" className="text-[#10B981] hover:bg-[#10B981]/10" onClick={() => handleUpdateStaff(member.id)}>
                            <Save className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-gray-500 hover:bg-white/10" onClick={() => setEditingStaff(null)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="ghost" className="text-[#7C3AED] hover:bg-[#7C3AED]/10" onClick={() => setEditingStaff({...member})}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-[#EF4444] hover:bg-[#EF4444]/10" onClick={() => handleDeleteStaff(member.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!staff || staff.length === 0) && (
            <p className="text-center text-gray-500 py-12">Keine Mitarbeiter vorhanden</p>
          )}
        </div>
      </div>
    </div>
  );
}
