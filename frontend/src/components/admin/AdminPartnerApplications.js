import React, { useState, useEffect } from 'react';
import { 
  Building2, Check, X, Mail, Phone, Globe, MapPin, 
  FileText, Clock, User, Percent, Euro, Store,
  ChevronDown, ChevronUp, Trash2, RefreshCw, CreditCard,
  BarChart3, Wallet, Download
} from 'lucide-react';
import { Button } from '../ui/button';
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

  const handleApprove = async (partnerId) => {
    setProcessing(partnerId);
    try {
      const response = await fetch(`${API}/api/partner-portal/admin/approve/${partnerId}`, {
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

  const getStatusBadge = (status) => {
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Store className="w-6 h-6 text-amber-500" />
            Partner Portal Verwaltung
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Bewerbungen prüfen und Partner verwalten
          </p>
        </div>
        <Button
          onClick={view === 'applications' ? fetchApplications : fetchAllPartners}
          variant="outline"
          size="sm"
          className="border-amber-300 text-amber-600 hover:bg-amber-50"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Aktualisieren
        </Button>
      </div>

      {/* View Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-2">
        <button
          onClick={() => setView('applications')}
          className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-all ${
            view === 'applications'
              ? 'bg-amber-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          📋 Bewerbungen ({stats.pending})
        </button>
        <button
          onClick={() => setView('partners')}
          className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-all ${
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-gray-100 rounded-xl p-4 border border-gray-200">
            <p className="text-gray-500 text-sm">Gesamt</p>
            <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
          </div>
          <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
            <p className="text-yellow-600 text-sm">Ausstehend</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          </div>
          <div className="bg-green-50 rounded-xl p-4 border border-green-200">
            <p className="text-green-600 text-sm">Genehmigt</p>
            <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
          </div>
          <div className="bg-red-50 rounded-xl p-4 border border-red-200">
            <p className="text-red-600 text-sm">Abgelehnt</p>
            <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
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
                      className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => setExpandedId(expandedId === app.id ? null : app.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-2xl">
                          {businessType.icon}
                        </div>
                        <div>
                          <h3 className="text-gray-800 font-semibold">{app.business_name}</h3>
                          <p className="text-gray-500 text-sm">
                            {businessType.name} • {app.city} • {app.commission_rate}% Provision
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getStatusBadge(app.status)}
                        {expandedId === app.id ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expandedId === app.id && (
                      <div className="border-t border-gray-200 p-4 space-y-4 bg-gray-50">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="flex items-start gap-2">
                            <User className="w-4 h-4 text-gray-400 mt-0.5" />
                            <div>
                              <p className="text-gray-500 text-xs">Ansprechpartner</p>
                              <p className="text-gray-800 text-sm">{app.contact_person || '-'}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <Mail className="w-4 h-4 text-gray-400 mt-0.5" />
                            <div>
                              <p className="text-gray-500 text-xs">E-Mail</p>
                              <a href={`mailto:${app.email}`} className="text-amber-500 text-sm hover:underline">
                                {app.email}
                              </a>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <Phone className="w-4 h-4 text-gray-400 mt-0.5" />
                            <div>
                              <p className="text-gray-500 text-xs">Telefon</p>
                              <p className="text-gray-800 text-sm">{app.phone}</p>
                            </div>
                          </div>
                          {app.website && (
                            <div className="flex items-start gap-2">
                              <Globe className="w-4 h-4 text-gray-400 mt-0.5" />
                              <div>
                                <p className="text-gray-500 text-xs">Website</p>
                                <a href={app.website} target="_blank" rel="noopener noreferrer" className="text-amber-500 text-sm hover:underline">
                                  {app.website}
                                </a>
                              </div>
                            </div>
                          )}
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                            <div>
                              <p className="text-gray-500 text-xs">Adresse</p>
                              <p className="text-gray-800 text-sm">
                                {app.address}, {app.postal_code} {app.city}
                              </p>
                            </div>
                          </div>
                          {app.tax_id && (
                            <div className="flex items-start gap-2">
                              <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
                              <div>
                                <p className="text-gray-500 text-xs">Steuernummer</p>
                                <p className="text-gray-800 text-sm">{app.tax_id}</p>
                              </div>
                            </div>
                          )}
                          {app.iban && (
                            <div className="flex items-start gap-2">
                              <CreditCard className="w-4 h-4 text-gray-400 mt-0.5" />
                              <div>
                                <p className="text-gray-500 text-xs">IBAN</p>
                                <p className="text-gray-800 text-sm font-mono text-xs">{app.iban}</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {app.description && (
                          <div className="flex items-start gap-2">
                            <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
                            <div>
                              <p className="text-gray-500 text-xs">Beschreibung</p>
                              <p className="text-gray-800 text-sm">{app.description}</p>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-gray-500 text-xs">
                          <Clock className="w-3 h-3" />
                          <span>Eingereicht: {formatDate(app.created_at)}</span>
                        </div>

                        {/* Action Buttons */}
                        {app.status === 'pending' && (
                          <div className="flex gap-3 pt-4 border-t border-gray-200">
                            <Button
                              onClick={() => handleApprove(app.id)}
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

      {/* Partners View */}
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-200">
                    <th className="text-left p-3 font-medium text-gray-700">Partner</th>
                    <th className="text-left p-3 font-medium text-gray-700">Typ</th>
                    <th className="text-left p-3 font-medium text-gray-700">Stadt</th>
                    <th className="text-center p-3 font-medium text-gray-700">Provision</th>
                    <th className="text-center p-3 font-medium text-gray-700">Eingelöst</th>
                    <th className="text-right p-3 font-medium text-gray-700">Ausstehend</th>
                    <th className="text-center p-3 font-medium text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {allPartners.map((partner) => {
                    const businessType = getBusinessTypeInfo(partner.business_type);
                    
                    return (
                      <tr key={partner.id} className="hover:bg-gray-50">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{businessType.icon}</span>
                            <div>
                              <p className="font-medium text-gray-800">
                                {partner.business_name || partner.restaurant_name}
                              </p>
                              <p className="text-gray-500 text-xs">{partner.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-gray-600">{businessType.name}</td>
                        <td className="p-3 text-gray-600">{partner.city || '-'}</td>
                        <td className="p-3 text-center text-gray-600">{partner.commission_rate || 10}%</td>
                        <td className="p-3 text-center text-gray-600">{partner.total_redeemed || 0}</td>
                        <td className="p-3 text-right font-medium text-green-600">
                          €{(partner.pending_payout || 0).toFixed(2)}
                        </td>
                        <td className="p-3 text-center">
                          {getStatusBadge(partner.status || (partner.is_active ? 'approved' : 'pending'))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminPartnerApplications;
