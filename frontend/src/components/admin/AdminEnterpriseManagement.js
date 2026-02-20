/**
 * Admin Enterprise Management
 * Manage enterprise accounts (Großhändler like Edeka, Rewe)
 */
import React, { useState, useEffect } from 'react';
import { 
  Building2, Store, Users, Key, CheckCircle, XCircle, Clock,
  RefreshCw, Eye, ToggleLeft, ToggleRight, TrendingUp, Euro
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const ADMIN_KEY = 'bidblitz-admin-2026';

export default function AdminEnterpriseManagement() {
  const [loading, setLoading] = useState(true);
  const [enterprises, setEnterprises] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    fetchEnterprises();
  }, []);

  const fetchEnterprises = async () => {
    setLoading(true);
    try {
      // Get all enterprises
      const res = await fetch(`${API_URL}/api/enterprise/admin/list`, {
        headers: { 'x-admin-key': ADMIN_KEY }
      });
      
      if (res.ok) {
        const data = await res.json();
        setEnterprises(data.enterprises || []);
        setPendingCount(data.enterprises?.filter(e => e.status === 'pending').length || 0);
      } else {
        // If endpoint doesn't exist, try getting pending
        const pendingRes = await fetch(`${API_URL}/api/enterprise/admin/pending`, {
          headers: { 'x-admin-key': ADMIN_KEY }
        });
        if (pendingRes.ok) {
          const pendingData = await pendingRes.json();
          setEnterprises(pendingData.pending || []);
          setPendingCount(pendingData.pending?.length || 0);
        }
      }
    } catch (err) {
      console.error('Error fetching enterprises:', err);
    } finally {
      setLoading(false);
    }
  };

  const approveEnterprise = async (enterpriseId) => {
    try {
      const res = await fetch(`${API_URL}/api/enterprise/admin/approve/${enterpriseId}`, {
        method: 'POST',
        headers: { 'x-admin-key': ADMIN_KEY }
      });
      
      if (res.ok) {
        toast.success('Unternehmen freigeschaltet!');
        fetchEnterprises();
      } else {
        const data = await res.json();
        toast.error(data.detail || 'Fehler');
      }
    } catch (err) {
      toast.error('Verbindungsfehler');
    }
  };

  const suspendEnterprise = async (enterpriseId) => {
    if (!window.confirm('Unternehmen wirklich sperren?')) return;
    
    try {
      const res = await fetch(`${API_URL}/api/enterprise/admin/suspend/${enterpriseId}`, {
        method: 'POST',
        headers: { 'x-admin-key': ADMIN_KEY }
      });
      
      if (res.ok) {
        toast.success('Unternehmen gesperrt');
        fetchEnterprises();
      } else {
        const data = await res.json();
        toast.error(data.detail || 'Fehler');
      }
    } catch (err) {
      toast.error('Verbindungsfehler');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Aktiv</span>;
      case 'pending':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium flex items-center gap-1"><Clock className="w-3 h-3" /> Ausstehend</span>;
      case 'suspended':
        return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium flex items-center gap-1"><XCircle className="w-3 h-3" /> Gesperrt</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">{status}</span>;
    }
  };

  const filteredEnterprises = activeTab === 'all' 
    ? enterprises 
    : enterprises.filter(e => e.status === activeTab);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-lg">Großhändler (Enterprise)</h2>
            <p className="text-sm text-gray-500">{enterprises.length} Unternehmen registriert</p>
          </div>
        </div>
        <button 
          onClick={fetchEnterprises}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <RefreshCw className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-600">
            {enterprises.filter(e => e.status === 'approved').length}
          </p>
          <p className="text-xs text-green-600">Aktiv</p>
        </div>
        <div className="bg-yellow-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
          <p className="text-xs text-yellow-600">Ausstehend</p>
        </div>
        <div className="bg-red-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-red-600">
            {enterprises.filter(e => e.status === 'suspended').length}
          </p>
          <p className="text-xs text-red-600">Gesperrt</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { id: 'all', label: 'Alle' },
          { id: 'pending', label: 'Ausstehend', count: pendingCount },
          { id: 'approved', label: 'Aktiv' },
          { id: 'suspended', label: 'Gesperrt' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-purple-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded-full text-xs">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Enterprise List */}
      <div className="space-y-3">
        {filteredEnterprises.length > 0 ? filteredEnterprises.map(enterprise => (
          <div key={enterprise.id} className="bg-white border rounded-xl p-4 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-amber-100 rounded-xl flex items-center justify-center">
                  <Store className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{enterprise.company_name}</h3>
                  <p className="text-sm text-gray-500">{enterprise.email}</p>
                </div>
              </div>
              {getStatusBadge(enterprise.status)}
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-gray-500 text-xs">Ansprechpartner</p>
                <p className="font-medium">{enterprise.contact_person || '-'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-gray-500 text-xs">Telefon</p>
                <p className="font-medium">{enterprise.phone || '-'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 col-span-2">
                <p className="text-gray-500 text-xs">Adresse</p>
                <p className="font-medium">{enterprise.address || '-'}</p>
              </div>
            </div>

            <div className="text-xs text-gray-400 mb-3">
              Registriert: {new Date(enterprise.created_at).toLocaleString('de-DE')}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {enterprise.status === 'pending' && (
                <button
                  onClick={() => approveEnterprise(enterprise.id)}
                  className="flex-1 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Freischalten
                </button>
              )}
              {enterprise.status === 'approved' && (
                <button
                  onClick={() => suspendEnterprise(enterprise.id)}
                  className="flex-1 py-2 bg-red-100 text-red-600 rounded-lg font-medium hover:bg-red-200 flex items-center justify-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Sperren
                </button>
              )}
              {enterprise.status === 'suspended' && (
                <button
                  onClick={() => approveEnterprise(enterprise.id)}
                  className="flex-1 py-2 bg-green-100 text-green-600 rounded-lg font-medium hover:bg-green-200 flex items-center justify-center gap-2"
                >
                  <ToggleRight className="w-4 h-4" />
                  Reaktivieren
                </button>
              )}
            </div>
          </div>
        )) : (
          <div className="text-center py-8 text-gray-500">
            <Building2 className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>Keine Unternehmen gefunden</p>
            <p className="text-sm">Unternehmen können sich unter /enterprise registrieren</p>
          </div>
        )}
      </div>
    </div>
  );
}
