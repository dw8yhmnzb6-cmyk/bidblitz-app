/**
 * Partner Staff Management Component
 * Create, edit, and manage staff members with auto-generated Kundennummer
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Users, Plus, User, Store, Pencil, Trash2, Check, X, Loader2, AlertCircle, Copy, Eye, EyeOff, Hash, Printer, CreditCard, FileText } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

const API = process.env.REACT_APP_BACKEND_URL;

const PartnerStaff = ({ token, language, t }) => {
  const [staffList, setStaffList] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', password: '', role: 'counter' });
  const [editingStaff, setEditingStaff] = useState(null);
  const [editStaffData, setEditStaffData] = useState({ name: '', role: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [createdStaff, setCreatedStaff] = useState(null); // Stores newly created staff with Kundennummer
  const [selectedForPrint, setSelectedForPrint] = useState([]); // Staff IDs selected for printing

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
    if (!newStaff.name || !newStaff.password) {
      toast.error(language === 'en' ? 'Please enter name and password' : 'Bitte Name und Passwort eingeben');
      return;
    }

    try {
      const response = await axios.post(`${API}/api/partner-portal/staff/create?token=${token}`, {
        name: newStaff.name,
        password: newStaff.password,
        role: newStaff.role
      });
      
      // Show the created staff with Kundennummer
      setCreatedStaff({
        name: response.data.name,
        staff_number: response.data.staff_number,
        password: newStaff.password, // Show password once
        role: response.data.role
      });
      
      toast.success(language === 'en' ? 'Staff account created' : 'Mitarbeiter-Konto erstellt');
      setNewStaff({ name: '', password: '', role: 'counter' });
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

  // Copy to clipboard
  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(language === 'en' ? `${label} copied!` : `${label} kopiert!`);
  };

  // Print single staff card
  const printSingleCard = (staffId) => {
    window.open(`${API}/api/staff-cards/single/${staffId}?token=${token}`, '_blank');
  };

  // Print all selected cards as A4
  const printSelectedCardsA4 = async () => {
    if (selectedForPrint.length === 0) {
      toast.error(language === 'en' ? 'Please select staff members' : 'Bitte Mitarbeiter auswählen');
      return;
    }

    try {
      const response = await axios.post(
        `${API}/api/staff-cards/a4-sheet?token=${token}`,
        { staff_ids: selectedForPrint },
        { responseType: 'blob' }
      );
      
      // Open HTML in new window
      const blob = new Blob([response.data], { type: 'text/html' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler beim Erstellen der Karten');
    }
  };

  // Print all staff cards
  const printAllCards = () => {
    window.open(`${API}/api/staff-cards/all?token=${token}`, '_blank');
  };

  // Toggle staff selection for print
  const togglePrintSelection = (staffId) => {
    setSelectedForPrint(prev => 
      prev.includes(staffId) 
        ? prev.filter(id => id !== staffId)
        : [...prev, staffId]
    );
  };

  // Select all staff for print
  const selectAllForPrint = () => {
    if (selectedForPrint.length === staffList.length) {
      setSelectedForPrint([]);
    } else {
      setSelectedForPrint(staffList.map(s => s.id));
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
      
      {/* Success Modal - Shows newly created staff with Kundennummer */}
      {createdStaff && (
        <div className="bg-green-50 border-2 border-green-500 rounded-xl p-6 shadow-lg" data-testid="staff-created-modal">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-green-800 flex items-center gap-2">
              <Check className="w-5 h-5" />
              {language === 'en' ? 'Staff Account Created!' : 'Mitarbeiter-Konto erstellt!'}
            </h3>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setCreatedStaff(null)}
              className="text-green-700 hover:bg-green-100"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          
          <div className="bg-white rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
              <div>
                <p className="text-xs text-amber-600 font-medium">
                  {language === 'en' ? 'Staff Number (Login ID)' : 'Kundennummer (Login-ID)'}
                </p>
                <p className="text-xl font-bold text-amber-800 font-mono">{createdStaff.staff_number}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(createdStaff.staff_number, 'Kundennummer')}
                className="border-amber-400 text-amber-700 hover:bg-amber-100"
              >
                <Copy className="w-4 h-4 mr-1" />
                {language === 'en' ? 'Copy' : 'Kopieren'}
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">{t('name')}</p>
                <p className="font-medium text-gray-800">{createdStaff.name}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">{t('password')}</p>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-800 font-mono">
                    {showPassword ? createdStaff.password : '••••••••'}
                  </p>
                  <button onClick={() => setShowPassword(!showPassword)} className="text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {language === 'en' 
                  ? 'Staff can login using the Staff Number and Password above.' 
                  : 'Mitarbeiter kann sich mit der Kundennummer und dem Passwort oben anmelden.'}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Create Staff Form */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="font-bold text-gray-800 mb-4">{t('createStaff')}</h3>
        <form onSubmit={createStaff} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('name')}</label>
              <Input
                value={newStaff.name}
                onChange={(e) => setNewStaff({...newStaff, name: e.target.value})}
                placeholder={language === 'en' ? 'Staff name' : 'Mitarbeiter Name'}
                required
                data-testid="staff-name-input"
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
                data-testid="staff-password-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('role')}</label>
              <select
                value={newStaff.role}
                onChange={(e) => setNewStaff({...newStaff, role: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                data-testid="staff-role-select"
              >
                <option value="counter">{t('counter')} ({language === 'en' ? 'Scanner & Pay only' : 'Nur Scanner & Pay'})</option>
                <option value="admin">{t('admin')} ({language === 'en' ? 'Full access' : 'Voller Zugang'})</option>
              </select>
            </div>
          </div>
          
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-sm text-amber-800 flex items-center gap-2">
              <Hash className="w-4 h-4 flex-shrink-0" />
              {language === 'en' 
                ? 'A unique Staff Number (Kundennummer) will be automatically generated for login.' 
                : 'Eine eindeutige Kundennummer wird automatisch für die Anmeldung generiert.'}
            </p>
          </div>
          
          <Button type="submit" className="bg-amber-500 hover:bg-amber-600" data-testid="create-staff-btn">
            <Plus className="w-4 h-4 mr-2" />
            {t('createStaff')}
          </Button>
        </form>
      </div>
      
      {/* Staff List */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between flex-wrap gap-3">
          <h3 className="font-bold text-gray-800">{language === 'en' ? 'Staff Members' : 'Mitarbeiter-Liste'}</h3>
          
          {/* Print Actions */}
          {staffList.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAllForPrint}
                className="border-gray-300"
              >
                <Check className={`w-4 h-4 mr-1 ${selectedForPrint.length === staffList.length ? 'text-amber-500' : ''}`} />
                {selectedForPrint.length === staffList.length 
                  ? (language === 'en' ? 'Deselect All' : 'Alle abwählen')
                  : (language === 'en' ? 'Select All' : 'Alle auswählen')}
              </Button>
              
              {selectedForPrint.length > 0 && (
                <Button
                  size="sm"
                  onClick={printSelectedCardsA4}
                  className="bg-blue-500 hover:bg-blue-600"
                  data-testid="print-selected-cards"
                >
                  <FileText className="w-4 h-4 mr-1" />
                  {language === 'en' 
                    ? `Print ${selectedForPrint.length} Cards (A4)` 
                    : `${selectedForPrint.length} Karten drucken (A4)`}
                </Button>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={printAllCards}
                className="border-amber-400 text-amber-700 hover:bg-amber-50"
                data-testid="print-all-cards"
              >
                <Printer className="w-4 h-4 mr-1" />
                {language === 'en' ? 'Print All Cards' : 'Alle Karten drucken'}
              </Button>
            </div>
          )}
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
              <div key={staff.id} className="p-4" data-testid={`staff-item-${staff.id}`}>
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
                        <label className="block text-xs text-gray-500 mb-1">
                          {language === 'en' ? 'Staff Number' : 'Kundennummer'}
                        </label>
                        <Input
                          value={staff.staff_number || '-'}
                          disabled
                          className="h-9 bg-gray-50 font-mono"
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
                      {/* Selection Checkbox */}
                      <input
                        type="checkbox"
                        checked={selectedForPrint.includes(staff.id)}
                        onChange={() => togglePrintSelection(staff.id)}
                        className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                      />
                      
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
                        <div className="flex items-center gap-2">
                          {staff.staff_number && (
                            <span className="text-sm text-amber-600 font-mono bg-amber-50 px-2 py-0.5 rounded">
                              {staff.staff_number}
                            </span>
                          )}
                          {staff.email && (
                            <span className="text-sm text-gray-500">{staff.email}</span>
                          )}
                        </div>
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
                      {staff.staff_number && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(staff.staff_number, 'Kundennummer')}
                          className="text-amber-500 hover:text-amber-700 hover:bg-amber-50"
                          title={language === 'en' ? 'Copy Staff Number' : 'Kundennummer kopieren'}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingStaff(staff.id);
                          setEditStaffData({ name: staff.name, role: staff.role });
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
    </div>
  );
};

export default PartnerStaff;
