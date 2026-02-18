import React, { useState, useEffect } from 'react';
import { 
  Building2, Check, X, Mail, Phone, Globe, MapPin, 
  FileText, Clock, User, Percent, Euro, Store,
  ChevronDown, ChevronUp, Trash2, RefreshCw, CreditCard,
  BarChart3, Wallet, Download, Edit3, Save, Lock, Unlock
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

// Business Types
const BUSINESS_TYPES = {
  restaurant: { name: 'Restaurant', icon: '🍕' },
  bar: { name: 'Bar & Club', icon: '🍺' },
  cafe: { name: 'Café', icon: '☕' },
  gas_station: { name: 'Tankstelle', icon: '⛽' },
  cinema: { name: 'Kino', icon: '🎬' },
  retail: { name: 'Einzelhandel', icon: '🛒' },
  wellness: { name: 'Wellness & Spa', icon: '💆' },
  fitness: { name: 'Fitness-Studio', icon: '🏋️' },
  beauty: { name: 'Friseur & Beauty', icon: '💇' },
  hotel: { name: 'Hotel & Unterkunft', icon: '🏨' },
  entertainment: { name: 'Unterhaltung', icon: '🎯' },
  supermarket: { name: 'Supermarkt', icon: '🛍️' },
  pharmacy: { name: 'Apotheke', icon: '💊' },
  other: { name: 'Sonstiges', icon: '🏪' },
};

const AdminPartnerApplications = () => {
  const [applications, setApplications] = useState([]);
  const [allPartners, setAllPartners] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('applications'); // 'applications' or 'partners'
  const [filter, setFilter] = useState('pending');
  const [expandedId, setExpandedId] = useState(null);
  const [processing, setProcessing] = useState(null);
  const [editingCommission, setEditingCommission] = useState(null);
  const [newCommissionRate, setNewCommissionRate] = useState('');

  const token = localStorage.getItem('token') || sessionStorage.getItem('token') || localStorage.getItem('bidblitz_token');

  useEffect(() => {
    if (view === 'applications') {
      fetchApplications();
    } else {
      fetchAllPartners();
    }
  }, [view, filter]);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/api/partner-portal/admin/pending-applications`);
      
      if (response.ok) {
        const data = await response.json();
        setApplications(data.applications || []);
        
        // Calculate stats
        const pending = data.applications?.filter(a => a.status === 'pending').length || 0;
        const approved = data.applications?.filter(a => a.status === 'approved').length || 0;
        const rejected = data.applications?.filter(a => a.status === 'rejected').length || 0;
        setStats({
          total: data.total || data.applications?.length || 0,
          pending,
          approved,
          rejected
        });
      }
    } catch (error) {
      console.error('Error fetching applications:', error);
      toast.error('Fehler beim Laden der Bewerbungen');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllPartners = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/api/partner-portal/admin/all-partners`);
      
      if (response.ok) {
        const data = await response.json();
        setAllPartners(data.partners || []);
      }
    } catch (error) {
      console.error('Error fetching partners:', error);
      toast.error('Fehler beim Laden der Partner');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (partnerId, commissionRate = null) => {
    setProcessing(partnerId);
    try {
      let url = `${API}/api/partner-portal/admin/approve/${partnerId}`;
      if (commissionRate !== null) {
        url += `?commission_rate=${commissionRate}`;
      }
      
      const response = await fetch(url, {
        method: 'POST'
      });

      if (response.ok) {
        toast.success('Partner genehmigt!');
        fetchApplications();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Fehler beim Genehmigen');
      }
    } catch (error) {
      console.error('Error approving:', error);
      toast.error('Fehler beim Genehmigen');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (partnerId) => {
    const reason = prompt('Ablehnungsgrund (optional):');
    setProcessing(partnerId);
    try {
      const response = await fetch(
        `${API}/api/partner-portal/admin/reject/${partnerId}?reason=${encodeURIComponent(reason || '')}`,
        { method: 'POST' }
      );

      if (response.ok) {
        toast.success('Partner abgelehnt');
        fetchApplications();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Fehler beim Ablehnen');
      }
    } catch (error) {
      console.error('Error rejecting:', error);
      toast.error('Fehler beim Ablehnen');
    } finally {
      setProcessing(null);
    }
  };

  const handleUpdateCommission = async (partnerId) => {
    if (!newCommissionRate || isNaN(parseFloat(newCommissionRate))) {
      toast.error('Bitte gültigen Prozentsatz eingeben');
      return;
    }
    
    const rate = parseFloat(newCommissionRate);
    if (rate < 0 || rate > 100) {
      toast.error('Provision muss zwischen 0 und 100% liegen');
      return;
    }
    
    setProcessing(partnerId);
    try {
      const response = await fetch(
        `${API}/api/partner-portal/admin/update-commission/${partnerId}?commission_rate=${rate}`,
        { method: 'PUT' }
      );

      if (response.ok) {
        toast.success(`Provision auf ${rate}% geändert`);
        setEditingCommission(null);
        setNewCommissionRate('');
        fetchAllPartners();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Fehler beim Ändern');
      }
    } catch (error) {
      console.error('Error updating commission:', error);
      toast.error('Fehler beim Ändern der Provision');
    } finally {
      setProcessing(null);
    }
  };

  const handleToggleLock = async (partnerId, isLocked, partnerName) => {
    const action = isLocked ? 'entsperren' : 'sperren';
    let reason = null;
    
    if (!isLocked) {
      reason = prompt(`Warum soll "${partnerName}" gesperrt werden?\n(Optional - leer lassen für Standard-Grund)`);
      if (reason === null) return; // User cancelled
    } else {
      if (!window.confirm(`Möchten Sie "${partnerName}" wirklich entsperren?`)) return;
    }
    
    setProcessing(partnerId);
    try {
      let url = `${API}/api/partner-portal/admin/lock/${partnerId}`;
      if (reason) {
        url += `?reason=${encodeURIComponent(reason)}`;
      }
      
      const response = await fetch(url, { method: 'POST' });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        fetchAllPartners();
      } else {
        const error = await response.json();
        toast.error(error.detail || `Fehler beim ${action}`);
      }
    } catch (error) {
      console.error('Error toggling lock:', error);
      toast.error(`Fehler beim ${action}`);
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status, isLocked = false) => {
    if (isLocked) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium border bg-red-100 text-red-700 border-red-300 flex items-center gap-1">
          <Lock className="w-3 h-3" />
          Gesperrt
        </span>
      );
    }
    const badges = {
      pending: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      approved: 'bg-green-100 text-green-700 border-green-300',
      rejected: 'bg-red-100 text-red-700 border-red-300'
    };
    const labels = {
      pending: 'Ausstehend',
      approved: 'Genehmigt',
      rejected: 'Abgelehnt'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${badges[status] || badges.pending}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getBusinessTypeInfo = (type) => {
    return BUSINESS_TYPES[type] || BUSINESS_TYPES.other;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2">
            <Store className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />
            Partner Verwaltung
          </h2>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">
            Bewerbungen prüfen und Partner verwalten
          </p>
        </div>
        <Button
          onClick={view === 'applications' ? fetchApplications : fetchAllPartners}
          variant="outline"
          size="sm"
          className="border-amber-300 text-amber-600 hover:bg-amber-50 w-full sm:w-auto"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Aktualisieren
        </Button>
      </div>

      {/* View Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setView('applications')}
          className={`px-3 sm:px-4 py-2 rounded-t-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
            view === 'applications'
              ? 'bg-amber-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          📋 Bewerbungen ({stats.pending})
        </button>
        <button
          onClick={() => setView('partners')}
          className={`px-3 sm:px-4 py-2 rounded-t-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
            view === 'partners'
              ? 'bg-amber-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          🏪 Alle Partner
        </button>
      </div>

      {/* Stats (only for applications view) */}
      {view === 'applications' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
          <div className="bg-gray-100 rounded-xl p-3 sm:p-4 border border-gray-200">
            <p className="text-gray-500 text-xs sm:text-sm">Gesamt</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-800">{stats.total}</p>
          </div>
          <div className="bg-yellow-50 rounded-xl p-3 sm:p-4 border border-yellow-200">
            <p className="text-yellow-600 text-xs sm:text-sm">Ausstehend</p>
            <p className="text-xl sm:text-2xl font-bold text-yellow-600">{stats.pending}</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 sm:p-4 border border-green-200">
            <p className="text-green-600 text-xs sm:text-sm">Genehmigt</p>
            <p className="text-xl sm:text-2xl font-bold text-green-600">{stats.approved}</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3 sm:p-4 border border-red-200">
            <p className="text-red-600 text-xs sm:text-sm">Abgelehnt</p>
            <p className="text-xl sm:text-2xl font-bold text-red-600">{stats.rejected}</p>
          </div>
        </div>
      )}

      {/* Applications View */}
      {view === 'applications' && (
        <>
          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-gray-500 mt-2">Lade Bewerbungen...</p>
            </div>
          ) : applications.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
              <Store className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Keine ausstehenden Bewerbungen</p>
            </div>
          ) : (
            <div className="space-y-4">
              {applications.map((app) => {
                const businessType = getBusinessTypeInfo(app.business_type);
                
                return (
                  <div
                    key={app.id}
                    className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm"
                  >
                    {/* Application Header */}
                    <div 
                      className="p-3 sm:p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => setExpandedId(expandedId === app.id ? null : app.id)}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-100 flex items-center justify-center text-xl sm:text-2xl flex-shrink-0">
                          {businessType.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-gray-800 font-semibold text-sm sm:text-base truncate">{app.business_name}</h3>
                          <p className="text-gray-500 text-xs sm:text-sm truncate">
                            {businessType.name} • {app.city || '-'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        {getStatusBadge(app.status)}
                        {expandedId === app.id ? (
                          <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expandedId === app.id && (
                      <div className="border-t border-gray-200 p-3 sm:p-4 space-y-3 sm:space-y-4 bg-gray-50">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                          <div className="flex items-start gap-2">
                            <User className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-gray-500 text-xs">Ansprechpartner</p>
                              <p className="text-gray-800 text-sm truncate">{app.contact_person || '-'}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <Mail className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-gray-500 text-xs">E-Mail</p>
                              <a href={`mailto:${app.email}`} className="text-amber-500 text-sm hover:underline truncate block">
                                {app.email}
                              </a>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <Phone className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-gray-500 text-xs">Telefon</p>
                              <p className="text-gray-800 text-sm truncate">{app.phone}</p>
                            </div>
                          </div>
                          {app.website && (
                            <div className="flex items-start gap-2">
                              <Globe className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-gray-500 text-xs">Website</p>
                                <a href={app.website} target="_blank" rel="noopener noreferrer" className="text-amber-500 text-sm hover:underline truncate block">
                                  {app.website}
                                </a>
                              </div>
                            </div>
                          )}
                          <div className="flex items-start gap-2 sm:col-span-2">
                            <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-gray-500 text-xs">Adresse</p>
                              <p className="text-gray-800 text-sm">
                                {app.address}, {app.postal_code} {app.city}
                              </p>
                            </div>
                          </div>
                          {app.tax_id && (
                            <div className="flex items-start gap-2">
                              <FileText className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-gray-500 text-xs">Steuernummer</p>
                                <p className="text-gray-800 text-sm truncate">{app.tax_id}</p>
                              </div>
                            </div>
                          )}
                          {app.iban && (
                            <div className="flex items-start gap-2">
                              <CreditCard className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-gray-500 text-xs">IBAN</p>
                                <p className="text-gray-800 text-sm font-mono text-xs truncate">{app.iban}</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {app.description && (
                          <div className="flex items-start gap-2">
                            <FileText className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-gray-500 text-xs">Beschreibung</p>
                              <p className="text-gray-800 text-sm">{app.description}</p>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-gray-500 text-xs">
                          <Clock className="w-3 h-3" />
                          <span>Eingereicht: {formatDate(app.created_at)}</span>
                        </div>

                        {/* Commission Rate Input for Approval */}
                        {app.status === 'pending' && (
                          <div className="pt-3 border-t border-gray-200">
                            <div className="flex items-center gap-2 mb-3">
                              <Percent className="w-4 h-4 text-amber-500" />
                              <span className="text-sm font-medium text-gray-700">Provision festlegen:</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                step="0.5"
                                placeholder={`${app.commission_rate || 10}`}
                                defaultValue={app.commission_rate || 10}
                                className="w-24 text-center"
                                id={`commission-${app.id}`}
                              />
                              <span className="text-gray-500">%</span>
                              <span className="text-xs text-gray-400">(Standard: {BUSINESS_TYPES[app.business_type]?.commission || 10}%)</span>
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        {app.status === 'pending' && (
                          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-3 border-t border-gray-200">
                            <Button
                              onClick={() => {
                                const input = document.getElementById(`commission-${app.id}`);
                                const rate = input ? parseFloat(input.value) : null;
                                handleApprove(app.id, rate);
                              }}
                              disabled={processing === app.id}
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                            >
                              {processing === app.id ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <>
                                  <Check className="w-4 h-4 mr-2" />
                                  Genehmigen
                                </>
                              )}
                            </Button>
                            <Button
                              onClick={() => handleReject(app.id)}
                              disabled={processing === app.id}
                              variant="outline"
                              className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                            >
                              <X className="w-4 h-4 mr-2" />
                              Ablehnen
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Partners View - Mobile Responsive Cards */}
      {view === 'partners' && (
        <>
          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-gray-500 mt-2">Lade Partner...</p>
            </div>
          ) : allPartners.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
              <Store className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Keine Partner vorhanden</p>
            </div>
          ) : (
            <div className="space-y-3">
              {allPartners.map((partner) => {
                const businessType = getBusinessTypeInfo(partner.business_type);
                const isEditing = editingCommission === partner.id;
                const isLocked = partner.is_locked || false;
                
                return (
                  <div 
                    key={partner.id} 
                    className={`bg-white rounded-xl border overflow-hidden shadow-sm ${
                      isLocked ? 'border-red-300 bg-red-50/30' : 'border-gray-200'
                    }`}
                  >
                    {/* Locked Banner */}
                    {isLocked && (
                      <div className="bg-red-100 border-b border-red-200 px-3 py-2 flex items-center gap-2">
                        <Lock className="w-4 h-4 text-red-600" />
                        <span className="text-red-700 text-xs font-medium">
                          Gesperrt: {partner.lock_reason || 'Administrativ gesperrt'}
                        </span>
                      </div>
                    )}
                    
                    <div className="p-3 sm:p-4">
                    {/* Partner Header */}
                    <div className="flex items-start gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${
                        isLocked ? 'bg-red-100 grayscale' : 'bg-amber-100'
                      }`}>
                        {businessType.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className={`font-semibold text-sm sm:text-base truncate ${
                              isLocked ? 'text-gray-500' : 'text-gray-800'
                            }`}>
                              {partner.business_name || partner.restaurant_name}
                            </h3>
                            <p className="text-gray-500 text-xs truncate">{partner.email}</p>
                          </div>
                          {getStatusBadge(partner.status || (partner.is_active ? 'approved' : 'pending'), isLocked)}
                        </div>
                        
                        {/* Partner Details Grid */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3 text-xs sm:text-sm">
                          <div>
                            <span className="text-gray-400">Typ:</span>
                            <span className="text-gray-700 ml-1">{businessType.name}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Stadt:</span>
                            <span className="text-gray-700 ml-1">{partner.city || '-'}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Eingelöst:</span>
                            <span className="text-gray-700 ml-1">{partner.total_redeemed || 0}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Ausstehend:</span>
                            <span className="text-green-600 font-medium ml-1">€{(partner.pending_payout || 0).toFixed(2)}</span>
                          </div>
                        </div>
                        
                        {/* Commission Row with Edit */}
                        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Percent className="w-4 h-4 text-amber-500" />
                            <span className="text-sm text-gray-600">Provision:</span>
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.5"
                                  value={newCommissionRate}
                                  onChange={(e) => setNewCommissionRate(e.target.value)}
                                  className="w-16 h-7 text-center text-sm"
                                  autoFocus
                                />
                                <span className="text-gray-500 text-sm">%</span>
                              </div>
                            ) : (
                              <span className="font-bold text-amber-600">{partner.commission_rate || 10}%</span>
                            )}
                          </div>
                          
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                onClick={() => handleUpdateCommission(partner.id)}
                                disabled={processing === partner.id}
                                className="h-7 px-2 bg-green-600 hover:bg-green-700"
                              >
                                {processing === partner.id ? (
                                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Save className="w-3 h-3" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingCommission(null);
                                  setNewCommissionRate('');
                                }}
                                className="h-7 px-2"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingCommission(partner.id);
                                setNewCommissionRate(String(partner.commission_rate || 10));
                              }}
                              className="h-7 px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            >
                              <Edit3 className="w-3 h-3 mr-1" />
                              <span className="text-xs">Ändern</span>
                            </Button>
                          )}
                        </div>
                        
                        {/* Lock/Unlock Button Row */}
                        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Clock className="w-3 h-3" />
                            <span>Seit: {formatDate(partner.created_at)}</span>
                          </div>
                          <Button
                            size="sm"
                            variant={isLocked ? "outline" : "ghost"}
                            onClick={() => handleToggleLock(
                              partner.id, 
                              isLocked,
                              partner.business_name || partner.restaurant_name
                            )}
                            disabled={processing === partner.id}
                            className={`h-7 px-2 ${
                              isLocked 
                                ? 'border-green-300 text-green-600 hover:bg-green-50' 
                                : 'text-red-600 hover:text-red-700 hover:bg-red-50'
                            }`}
                            data-testid={`lock-btn-${partner.id}`}
                          >
                            {processing === partner.id ? (
                              <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : isLocked ? (
                              <>
                                <Unlock className="w-3 h-3 mr-1" />
                                <span className="text-xs">Entsperren</span>
                              </>
                            ) : (
                              <>
                                <Lock className="w-3 h-3 mr-1" />
                                <span className="text-xs">Sperren</span>
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminPartnerApplications;
