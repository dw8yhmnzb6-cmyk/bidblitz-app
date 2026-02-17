/**
 * Partner Staff Management Component
 * Create, edit, and manage staff members
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Users, Plus, User, Store, Pencil, Trash2, Check, X, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

const API = process.env.REACT_APP_BACKEND_URL;

const PartnerStaff = ({ token, language, t }) => {
  const [staffList, setStaffList] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', email: '', password: '', role: 'counter' });
  const [editingStaff, setEditingStaff] = useState(null);
  const [editStaffData, setEditStaffData] = useState({ name: '', email: '', role: '' });

  // Fetch staff list
  const fetchStaffList = async () => {
    setLoadingStaff(true);
    try {
      const response = await axios.get(`${API}/api/partner-portal/staff?token=${token}`);
      setStaffList(response.data.staff || []);
    } catch (err) {
      console.error('Staff fetch error:', err);
    } finally {
      setLoadingStaff(false);
    }
  };

  // Create new staff member
  const createStaff = async (e) => {
    e.preventDefault();
    if (!newStaff.name || !newStaff.email || !newStaff.password) {
      toast.error(t('error'));
      return;
    }

    try {
      await axios.post(`${API}/api/partner-portal/staff/create?token=${token}`, newStaff);
      toast.success(t('success'));
      setNewStaff({ name: '', email: '', password: '', role: 'counter' });
      fetchStaffList();
    } catch (err) {
      toast.error(err.response?.data?.detail || t('error'));
    }
  };

  // Update staff member
  const updateStaff = async (staffId) => {
    try {
      await axios.put(`${API}/api/partner-portal/staff/${staffId}?token=${token}`, {
        name: editStaffData.name,
        role: editStaffData.role
      });
      toast.success(t('success'));
      setEditingStaff(null);
      fetchStaffList();
    } catch (err) {
      toast.error(err.response?.data?.detail || t('error'));
    }
  };

  // Delete staff member
  const deleteStaff = async (staffId) => {
    if (!window.confirm(language === 'en' ? 'Delete this staff member?' : 'Mitarbeiter löschen?')) return;
    
    try {
      await axios.delete(`${API}/api/partner-portal/staff/${staffId}?token=${token}`);
      toast.success(t('success'));
      fetchStaffList();
    } catch (err) {
      toast.error(err.response?.data?.detail || t('error'));
    }
  };

  useEffect(() => {
    if (token) {
      fetchStaffList();
    }
  }, [token]);

  return (
    <div className="space-y-6">
      <h2 className="font-bold text-gray-800 text-xl flex items-center gap-2">
        <Users className="w-6 h-6 text-amber-500" />
        {t('staff')}
      </h2>
      
      {/* Create Staff Form */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="font-bold text-gray-800 mb-4">{t('createStaff')}</h3>
        <form onSubmit={createStaff} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('name')}</label>
              <Input
                value={newStaff.name}
                onChange={(e) => setNewStaff({...newStaff, name: e.target.value})}
                placeholder={language === 'en' ? 'Staff name' : 'Mitarbeiter Name'}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('email')}</label>
              <Input
                type="email"
                value={newStaff.email}
                onChange={(e) => setNewStaff({...newStaff, email: e.target.value})}
                placeholder="staff@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('password')}</label>
              <Input
                type="password"
                value={newStaff.password}
                onChange={(e) => setNewStaff({...newStaff, password: e.target.value})}
                placeholder="••••••••"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('role')}</label>
              <select
                value={newStaff.role}
                onChange={(e) => setNewStaff({...newStaff, role: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              >
                <option value="counter">{t('counter')} ({language === 'en' ? 'Scanner & Pay only' : 'Nur Scanner & Pay'})</option>
                <option value="admin">{t('admin')} ({language === 'en' ? 'Full access' : 'Voller Zugang'})</option>
              </select>
            </div>
          </div>
          <Button type="submit" className="bg-amber-500 hover:bg-amber-600">
            <Plus className="w-4 h-4 mr-2" />
            {t('createStaff')}
          </Button>
        </form>
      </div>
      
      {/* Staff List */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-bold text-gray-800">{language === 'en' ? 'Staff Members' : 'Mitarbeiter-Liste'}</h3>
        </div>
        
        {loadingStaff ? (
          <div className="p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500 mx-auto" />
          </div>
        ) : staffList.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>{language === 'en' ? 'No staff members yet' : 'Noch keine Mitarbeiter'}</p>
          </div>
        ) : (
          <div className="divide-y">
            {staffList.map((staff) => (
              <div key={staff.id} className="p-4">
                {editingStaff === staff.id ? (
                  // Edit Mode
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">{t('name')}</label>
                        <Input
                          value={editStaffData.name}
                          onChange={(e) => setEditStaffData({...editStaffData, name: e.target.value})}
                          className="h-9"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">{t('email')}</label>
                        <Input
                          value={editStaffData.email}
                          disabled
                          className="h-9 bg-gray-50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">{t('role')}</label>
                        <select
                          value={editStaffData.role}
                          onChange={(e) => setEditStaffData({...editStaffData, role: e.target.value})}
                          className="w-full px-3 py-2 h-9 border border-gray-300 rounded-lg text-sm"
                        >
                          <option value="counter">{t('counter')}</option>
                          <option value="admin">{t('admin')}</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        onClick={() => updateStaff(staff.id)}
                        className="bg-green-500 hover:bg-green-600"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        {t('save')}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setEditingStaff(null)}
                      >
                        <X className="w-4 h-4 mr-1" />
                        {t('cancel')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        staff.role === 'admin' ? 'bg-purple-100' : 'bg-amber-100'
                      }`}>
                        {staff.role === 'admin' ? (
                          <User className="w-5 h-5 text-purple-600" />
                        ) : (
                          <Store className="w-5 h-5 text-amber-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{staff.name}</p>
                        <p className="text-sm text-gray-500">{staff.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        staff.role === 'admin' 
                          ? 'bg-purple-100 text-purple-700' 
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {staff.role === 'admin' ? t('admin') : t('counter')}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        staff.is_active !== false
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {staff.is_active !== false ? t('active') : t('inactive')}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingStaff(staff.id);
                          setEditStaffData({ name: staff.name, email: staff.email, role: staff.role });
                        }}
                        className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteStaff(staff.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Info Box */}
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">{language === 'en' ? 'Staff Roles:' : 'Mitarbeiter-Rollen:'}</p>
            <ul className="space-y-1 text-blue-700">
              <li><strong>{t('counter')}:</strong> {language === 'en' ? 'Only Scanner and Pay - perfect for counter employees' : 'Nur Scanner und Pay - perfekt für Thekenmitarbeiter'}</li>
              <li><strong>{t('admin')}:</strong> {language === 'en' ? 'Full access to statistics, payouts, and settings' : 'Voller Zugang zu Statistiken, Auszahlungen und Einstellungen'}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PartnerStaff;
