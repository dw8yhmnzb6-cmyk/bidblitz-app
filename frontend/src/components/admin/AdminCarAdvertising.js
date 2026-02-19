/**
 * AdminCarAdvertising - Admin Panel for Car Advertising Management
 * Allows admins to view, approve, reject and manage car advertising applications
 */

import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { 
  Car, Check, X, Clock, Search, Filter, Euro, MapPin,
  Phone, Mail, Calendar, Eye, CheckCircle, XCircle, 
  RefreshCw, TrendingUp, Users, DollarSign
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const translations = {
  de: {
    title: 'Auto-Werbung Verwaltung',
    subtitle: 'Anmeldungen prüfen und verwalten',
    stats: {
      total: 'Gesamt',
      pending: 'Ausstehend',
      approved: 'Genehmigt',
      active: 'Aktiv',
      rejected: 'Abgelehnt',
      totalPaid: 'Ausgezahlt'
    },
    filters: {
      all: 'Alle',
      pending: 'Ausstehend',
      approved: 'Genehmigt',
      active: 'Aktiv',
      rejected: 'Abgelehnt'
    },
    table: {
      applicant: 'Bewerber',
      vehicle: 'Fahrzeug',
      city: 'Stadt',
      kmMonth: 'km/Monat',
      status: 'Status',
      date: 'Datum',
      actions: 'Aktionen'
    },
    actions: {
      approve: 'Genehmigen',
      reject: 'Ablehnen',
      activate: 'Aktivieren',
      viewDetails: 'Details',
      processPayouts: 'Monatszahlung ausführen'
    },
    messages: {
      statusUpdated: 'Status erfolgreich aktualisiert',
      payoutsProcessed: 'Monatszahlungen verarbeitet',
      error: 'Fehler beim Aktualisieren'
    },
    noApplications: 'Keine Anmeldungen gefunden',
    search: 'Suchen...',
    refresh: 'Aktualisieren'
  },
  en: {
    title: 'Car Advertising Management',
    subtitle: 'Review and manage applications',
    stats: {
      total: 'Total',
      pending: 'Pending',
      approved: 'Approved',
      active: 'Active',
      rejected: 'Rejected',
      totalPaid: 'Total Paid'
    },
    filters: {
      all: 'All',
      pending: 'Pending',
      approved: 'Approved',
      active: 'Active',
      rejected: 'Rejected'
    },
    table: {
      applicant: 'Applicant',
      vehicle: 'Vehicle',
      city: 'City',
      kmMonth: 'km/Month',
      status: 'Status',
      date: 'Date',
      actions: 'Actions'
    },
    actions: {
      approve: 'Approve',
      reject: 'Reject',
      activate: 'Activate',
      viewDetails: 'Details',
      processPayouts: 'Process Monthly Payouts'
    },
    messages: {
      statusUpdated: 'Status updated successfully',
      payoutsProcessed: 'Monthly payouts processed',
      error: 'Error updating status'
    },
    noApplications: 'No applications found',
    search: 'Search...',
    refresh: 'Refresh'
  },
  sq: {
    title: 'Menaxhimi i Reklamave në Makinë',
    subtitle: 'Shqyrto dhe menaxho aplikimet',
    stats: {
      total: 'Totali',
      pending: 'Në Pritje',
      approved: 'Aprovuar',
      active: 'Aktiv',
      rejected: 'Refuzuar',
      totalPaid: 'Paguar Totali'
    },
    filters: {
      all: 'Të Gjitha',
      pending: 'Në Pritje',
      approved: 'Aprovuar',
      active: 'Aktiv',
      rejected: 'Refuzuar'
    },
    table: {
      applicant: 'Aplikuesi',
      vehicle: 'Automjeti',
      city: 'Qyteti',
      kmMonth: 'km/Muaj',
      status: 'Statusi',
      date: 'Data',
      actions: 'Veprimet'
    },
    actions: {
      approve: 'Aprovo',
      reject: 'Refuzo',
      activate: 'Aktivizo',
      viewDetails: 'Detajet',
      processPayouts: 'Proceso Pagesat Mujore'
    },
    messages: {
      statusUpdated: 'Statusi u përditësua me sukses',
      payoutsProcessed: 'Pagesat mujore u procesuan',
      error: 'Gabim gjatë përditësimit'
    },
    noApplications: 'Nuk u gjetën aplikime',
    search: 'Kërko...',
    refresh: 'Rifresko'
  },
  tr: {
    title: 'Araç Reklamı Yönetimi',
    subtitle: 'Başvuruları incele ve yönet',
    stats: {
      total: 'Toplam',
      pending: 'Bekleyen',
      approved: 'Onaylanmış',
      active: 'Aktif',
      rejected: 'Reddedilmiş',
      totalPaid: 'Toplam Ödenen'
    },
    filters: {
      all: 'Tümü',
      pending: 'Bekleyen',
      approved: 'Onaylanmış',
      active: 'Aktif',
      rejected: 'Reddedilmiş'
    },
    table: {
      applicant: 'Başvuran',
      vehicle: 'Araç',
      city: 'Şehir',
      kmMonth: 'km/Ay',
      status: 'Durum',
      date: 'Tarih',
      actions: 'İşlemler'
    },
    actions: {
      approve: 'Onayla',
      reject: 'Reddet',
      activate: 'Etkinleştir',
      viewDetails: 'Detaylar',
      processPayouts: 'Aylık Ödemeleri İşle'
    },
    messages: {
      statusUpdated: 'Durum başarıyla güncellendi',
      payoutsProcessed: 'Aylık ödemeler işlendi',
      error: 'Güncelleme hatası'
    },
    noApplications: 'Başvuru bulunamadı',
    search: 'Ara...',
    refresh: 'Yenile'
  }
};

export default function AdminCarAdvertising({ language = 'de' }) {
  const t = translations[language] || translations.de;
  const [applications, setApplications] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedApp, setSelectedApp] = useState(null);

  useEffect(() => {
    fetchData();
  }, [filter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [appsRes, statsRes] = await Promise.all([
        fetch(`${API}/car-advertising/all${filter !== 'all' ? `?status=${filter}` : ''}`),
        fetch(`${API}/car-advertising/stats`)
      ]);
      
      const appsData = await appsRes.json();
      const statsData = await statsRes.json();
      
      setApplications(appsData.applications || []);
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error(t.messages.error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (email, newStatus) => {
    try {
      const response = await fetch(`${API}/car-advertising/update-status?email=${email}&status=${newStatus}`, {
        method: 'PUT'
      });
      
      if (response.ok) {
        toast.success(t.messages.statusUpdated);
        fetchData();
      } else {
        toast.error(t.messages.error);
      }
    } catch (error) {
      toast.error(t.messages.error);
    }
  };

  const processPayouts = async () => {
    try {
      const response = await fetch(`${API}/car-advertising/process-monthly-payouts`, {
        method: 'POST'
      });
      
      const data = await response.json();
      if (response.ok) {
        toast.success(`${t.messages.payoutsProcessed}: ${data.processed} Fahrer, €${data.total_amount}`);
        fetchData();
      }
    } catch (error) {
      toast.error(t.messages.error);
    }
  };

  const filteredApps = applications.filter(app => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      app.name?.toLowerCase().includes(searchLower) ||
      app.email?.toLowerCase().includes(searchLower) ||
      app.car_brand?.toLowerCase().includes(searchLower) ||
      app.license_plate?.toLowerCase().includes(searchLower) ||
      app.city?.toLowerCase().includes(searchLower)
    );
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'approved': return 'bg-blue-100 text-blue-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      default: return 'bg-amber-100 text-amber-700';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4" />;
      case 'approved': return <Check className="w-4 h-4" />;
      case 'rejected': return <XCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <Car className="w-8 h-8 text-orange-500" />
            {t.title}
          </h1>
          <p className="text-gray-500">{t.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchData} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            {t.refresh}
          </Button>
          <Button onClick={processPayouts} className="bg-green-500 hover:bg-green-600 gap-2">
            <Euro className="w-4 h-4" />
            {t.actions.processPayouts}
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {[
            { key: 'total', value: stats.total, icon: Users, color: 'bg-gray-100 text-gray-600' },
            { key: 'pending', value: stats.pending, icon: Clock, color: 'bg-amber-100 text-amber-600' },
            { key: 'approved', value: stats.approved, icon: Check, color: 'bg-blue-100 text-blue-600' },
            { key: 'active', value: stats.active, icon: CheckCircle, color: 'bg-green-100 text-green-600' },
            { key: 'rejected', value: stats.rejected, icon: XCircle, color: 'bg-red-100 text-red-600' },
            { key: 'totalPaid', value: `€${stats.total_paid_out}`, icon: Euro, color: 'bg-emerald-100 text-emerald-600' }
          ].map((stat) => (
            <div key={stat.key} className="bg-white rounded-xl p-4 shadow-sm">
              <div className={`w-10 h-10 rounded-lg ${stat.color} flex items-center justify-center mb-2`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
              <p className="text-sm text-gray-500">{t.stats[stat.key]}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex gap-2 flex-wrap">
          {['all', 'pending', 'approved', 'active', 'rejected'].map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f)}
              className={filter === f ? 'bg-orange-500 hover:bg-orange-600' : ''}
            >
              {t.filters[f]}
            </Button>
          ))}
        </div>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.search}
            className="pl-10"
          />
        </div>
      </div>

      {/* Applications Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">{t.table.applicant}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">{t.table.vehicle}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">{t.table.city}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">{t.table.kmMonth}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">{t.table.status}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">{t.table.date}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">{t.table.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredApps.map((app, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-800">{app.name}</p>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {app.email}
                      </p>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {app.phone}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{app.car_brand} {app.car_model}</p>
                    <p className="text-sm text-gray-500">{app.car_year} • {app.car_color}</p>
                    <p className="text-sm font-mono text-orange-600">{app.license_plate}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-gray-700">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      {app.city}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{app.km_per_month}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(app.status)}`}>
                      {getStatusIcon(app.status)}
                      {t.filters[app.status]}
                    </span>
                    {app.status === 'active' && app.total_earned > 0 && (
                      <p className="text-xs text-green-600 mt-1">€{app.total_earned} verdient</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-500">
                      {new Date(app.created_at).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {app.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => updateStatus(app.email, 'approved')}
                            className="bg-blue-500 hover:bg-blue-600 h-8 px-2"
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatus(app.email, 'rejected')}
                            className="text-red-500 border-red-200 hover:bg-red-50 h-8 px-2"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      {app.status === 'approved' && (
                        <Button
                          size="sm"
                          onClick={() => updateStatus(app.email, 'active')}
                          className="bg-green-500 hover:bg-green-600 h-8"
                        >
                          {t.actions.activate}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedApp(app)}
                        className="h-8 px-2"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredApps.length === 0 && !loading && (
          <div className="text-center py-12 text-gray-500">
            <Car className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{t.noApplications}</p>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedApp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedApp(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <Car className="w-6 h-6 text-orange-500" />
                  {selectedApp.car_brand} {selectedApp.car_model}
                </h2>
                <Button variant="ghost" size="sm" onClick={() => setSelectedApp(null)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Name</p>
                    <p className="font-medium">{selectedApp.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">E-Mail</p>
                    <p className="font-medium">{selectedApp.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Telefon</p>
                    <p className="font-medium">{selectedApp.phone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Stadt</p>
                    <p className="font-medium">{selectedApp.city}</p>
                  </div>
                </div>

                <hr />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Fahrzeug</p>
                    <p className="font-medium">{selectedApp.car_brand} {selectedApp.car_model}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Baujahr</p>
                    <p className="font-medium">{selectedApp.car_year}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Farbe</p>
                    <p className="font-medium">{selectedApp.car_color}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Kennzeichen</p>
                    <p className="font-medium font-mono text-orange-600">{selectedApp.license_plate}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">km/Monat</p>
                    <p className="font-medium">{selectedApp.km_per_month}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Parkort</p>
                    <p className="font-medium">{selectedApp.parking_location || '-'}</p>
                  </div>
                </div>

                {selectedApp.additional_info && (
                  <>
                    <hr />
                    <div>
                      <p className="text-sm text-gray-500">Zusätzliche Informationen</p>
                      <p className="text-gray-700">{selectedApp.additional_info}</p>
                    </div>
                  </>
                )}

                {selectedApp.status === 'active' && (
                  <>
                    <hr />
                    <div className="bg-green-50 rounded-xl p-4">
                      <p className="text-sm text-green-700 mb-2">Aktiver Vertrag</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-500">Verdient</p>
                          <p className="text-xl font-bold text-green-600">€{selectedApp.total_earned}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Monate aktiv</p>
                          <p className="text-xl font-bold text-green-600">{selectedApp.months_active}</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
