/**
 * Admin Devices Management - Mobile-Responsive Card Layout
 */
import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Bike, MapPin, Plus, Power, RefreshCw, Search,
  CheckCircle, Activity, Wrench, Ban
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

const API = process.env.REACT_APP_BACKEND_URL;

const statusConfig = {
  available: { label: 'Verfügbar', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  in_use: { label: 'In Benutzung', color: 'bg-blue-100 text-blue-700', icon: Activity },
  maintenance: { label: 'Wartung', color: 'bg-yellow-100 text-yellow-700', icon: Wrench },
  disabled: { label: 'Deaktiviert', color: 'bg-red-100 text-red-700', icon: Ban }
};

const typeConfig = {
  scooter: { label: 'E-Scooter', icon: '🛴' },
  bike: { label: 'E-Bike', icon: '🚲' },
  locker: { label: 'Schließfach', icon: '🔐' },
  gate: { label: 'Tor', icon: '🚪' }
};

export default function AdminDevices({ token }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDevice, setNewDevice] = useState({ serial: '', type: 'scooter', name: '', location: '' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API}/api/devices/admin/list`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDevices(res.data.devices || []);
    } catch (error) {
      console.error('Error fetching devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDevice = async () => {
    try {
      await axios.post(`${API}/api/devices/admin/create`, newDevice, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowAddModal(false);
      setNewDevice({ serial: '', type: 'scooter', name: '', location: '' });
      fetchData();
    } catch (error) {
      alert(error.response?.data?.detail || 'Fehler beim Erstellen');
    }
  };

  const handleUpdateStatus = async (deviceId, newStatus) => {
    try {
      await axios.patch(`${API}/api/devices/admin/${deviceId}`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
    } catch (error) {
      alert(error.response?.data?.detail || 'Fehler beim Aktualisieren');
    }
  };

  const filteredDevices = devices.filter(d => 
    d.serial?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.location?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: devices.length,
    available: devices.filter(d => d.status === 'available').length,
    in_use: devices.filter(d => d.status === 'in_use').length,
    maintenance: devices.filter(d => d.status === 'maintenance').length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6" data-testid="admin-devices">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg flex-shrink-0">
            <Bike className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-slate-800">Geräte</h1>
            <p className="text-slate-500 text-xs sm:text-sm">Scooter, E-Bikes & mehr</p>
          </div>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="bg-cyan-500 hover:bg-cyan-600 w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" /> Gerät hinzufügen
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-slate-100">
          <p className="text-slate-500 text-xs sm:text-sm">Gesamt</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-800">{stats.total}</p>
        </div>
        <div className="bg-emerald-50 rounded-xl p-3 sm:p-4 shadow-sm border border-emerald-100">
          <p className="text-emerald-600 text-xs sm:text-sm">Verfügbar</p>
          <p className="text-xl sm:text-2xl font-bold text-emerald-700">{stats.available}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-3 sm:p-4 shadow-sm border border-blue-100">
          <p className="text-blue-600 text-xs sm:text-sm">In Benutzung</p>
          <p className="text-xl sm:text-2xl font-bold text-blue-700">{stats.in_use}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl p-3 sm:p-4 shadow-sm border border-yellow-100">
          <p className="text-yellow-600 text-xs sm:text-sm">Wartung</p>
          <p className="text-xl sm:text-2xl font-bold text-yellow-700">{stats.maintenance}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
        <Input
          placeholder="Suche nach Seriennummer, Name oder Standort..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 sm:pl-10 text-sm"
        />
      </div>

      {/* Mobile: Card Layout / Desktop: Table */}
      <div className="space-y-3 sm:hidden">
        {filteredDevices.map((device) => {
          const status = statusConfig[device.status] || statusConfig.available;
          const type = typeConfig[device.type] || typeConfig.scooter;
          const StatusIcon = status.icon;
          return (
            <div key={device.id} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100" data-testid={`device-card-${device.id}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{type.icon}</span>
                  <div>
                    <p className="font-medium text-slate-800 text-sm">{device.name || device.serial}</p>
                    <p className="text-[10px] text-slate-400">{device.serial}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1 ${status.color}`}>
                  <StatusIcon className="w-3 h-3" />
                  {status.label}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {device.location || '-'}
                </span>
                <span className="text-emerald-600 font-medium">
                  €{((device.total_revenue_cents || 0) / 100).toFixed(2)}
                </span>
              </div>
              <select
                value={device.status}
                onChange={(e) => handleUpdateStatus(device.id, e.target.value)}
                className="w-full text-xs border rounded-lg px-2 py-1.5 bg-slate-50"
              >
                <option value="available">Verfügbar</option>
                <option value="maintenance">Wartung</option>
                <option value="disabled">Deaktiviert</option>
              </select>
            </div>
          );
        })}
        {filteredDevices.length === 0 && (
          <p className="text-center text-slate-400 py-8 text-sm">Keine Geräte gefunden</p>
        )}
      </div>

      {/* Desktop: Table */}
      <div className="hidden sm:block bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 text-left text-slate-600 font-medium text-sm">Gerät</th>
                <th className="px-4 py-3 text-left text-slate-600 font-medium text-sm">Typ</th>
                <th className="px-4 py-3 text-left text-slate-600 font-medium text-sm">Standort</th>
                <th className="px-4 py-3 text-left text-slate-600 font-medium text-sm">Status</th>
                <th className="px-4 py-3 text-left text-slate-600 font-medium text-sm">Umsatz</th>
                <th className="px-4 py-3 text-left text-slate-600 font-medium text-sm">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDevices.map((device) => {
                const status = statusConfig[device.status] || statusConfig.available;
                const type = typeConfig[device.type] || typeConfig.scooter;
                const StatusIcon = status.icon;
                return (
                  <tr key={device.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{device.name || device.serial}</p>
                      <p className="text-xs text-slate-400">{device.serial}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1">
                        <span>{type.icon}</span>
                        <span className="text-slate-600">{type.label}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-slate-500">
                        <MapPin className="w-4 h-4" />
                        {device.location || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${status.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-emerald-600 font-medium">
                        €{((device.total_revenue_cents || 0) / 100).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={device.status}
                        onChange={(e) => handleUpdateStatus(device.id, e.target.value)}
                        className="text-xs border rounded px-2 py-1"
                      >
                        <option value="available">Verfügbar</option>
                        <option value="maintenance">Wartung</option>
                        <option value="disabled">Deaktiviert</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
              {filteredDevices.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-4 py-12 text-center text-slate-400">
                    Keine Geräte gefunden
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Device Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-md sm:mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 mb-4">Neues Gerät</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-600">Seriennummer *</label>
                <Input
                  value={newDevice.serial}
                  onChange={(e) => setNewDevice({...newDevice, serial: e.target.value})}
                  placeholder="z.B. SCOOTER-001"
                />
              </div>
              <div>
                <label className="text-sm text-slate-600">Typ *</label>
                <select
                  value={newDevice.type}
                  onChange={(e) => setNewDevice({...newDevice, type: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="scooter">🛴 E-Scooter</option>
                  <option value="bike">🚲 E-Bike</option>
                  <option value="locker">🔐 Schließfach</option>
                  <option value="gate">🚪 Tor</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-600">Name</label>
                <Input
                  value={newDevice.name}
                  onChange={(e) => setNewDevice({...newDevice, name: e.target.value})}
                  placeholder="z.B. E-Scooter Dubai Marina"
                />
              </div>
              <div>
                <label className="text-sm text-slate-600">Standort</label>
                <Input
                  value={newDevice.location}
                  onChange={(e) => setNewDevice({...newDevice, location: e.target.value})}
                  placeholder="z.B. Dubai Marina"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowAddModal(false)} className="flex-1">
                Abbrechen
              </Button>
              <Button onClick={handleAddDevice} className="flex-1 bg-cyan-500 hover:bg-cyan-600">
                Hinzufügen
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
