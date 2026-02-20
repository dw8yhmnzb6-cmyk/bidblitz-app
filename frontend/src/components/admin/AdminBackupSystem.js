import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Button } from '../ui/button';
import { 
  Database, Download, Upload, RefreshCw, CheckCircle, 
  AlertTriangle, HardDrive, Users, Building2, Package,
  ShoppingCart, BarChart3, Clock, Shield, FileJson
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function AdminBackupSystem({ token }) {
  const [status, setStatus] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, summaryRes] = await Promise.all([
        axios.get(`${API}/backup/status`),
        axios.get(`${API}/backup/summary`)
      ]);
      setStatus(statusRes.data);
      setSummary(summaryRes.data);
    } catch (err) {
      toast.error('Fehler beim Laden des Backup-Status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleDownloadBackup = async () => {
    setExporting(true);
    try {
      const response = await axios.get(`${API}/backup/download`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `bidblitz_backup_${new Date().toISOString().slice(0,10)}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Backup erfolgreich heruntergeladen!');
    } catch (err) {
      toast.error('Fehler beim Erstellen des Backups');
    } finally {
      setExporting(false);
    }
  };

  const handleExportCollection = async (collectionName) => {
    try {
      const response = await axios.get(`${API}/backup/export/${collectionName}`);
      
      const json = JSON.stringify(response.data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${collectionName}_${new Date().toISOString().slice(0,10)}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success(`${collectionName} exportiert!`);
    } catch (err) {
      toast.error('Export fehlgeschlagen');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Database className="w-6 h-6 text-blue-600" />
            Daten-Backup & Sicherung
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Alle Daten werden sicher in der Datenbank gespeichert. Neue Programmierungen löschen keine Daten.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchStatus} disabled={loading} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Aktualisieren
          </Button>
          <Button 
            onClick={handleDownloadBackup} 
            disabled={exporting}
            className="bg-green-600 hover:bg-green-700"
          >
            {exporting ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Vollständiges Backup
          </Button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Shield className="w-6 h-6 text-blue-600 mt-0.5" />
        <div>
          <h3 className="font-semibold text-blue-900">Ihre Daten sind sicher!</h3>
          <p className="text-blue-700 text-sm mt-1">
            Alle Daten (Kunden, Händler, Mitarbeiter, Transaktionen) werden in einer separaten MongoDB-Datenbank gespeichert. 
            Neue Programmierungen oder Updates ändern nur den Code, nicht die Daten. 
            Trotzdem empfehlen wir regelmäßige Backups zur zusätzlichen Sicherheit.
          </p>
        </div>
      </div>

      {/* Data Summary */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{summary.data_overview?.users?.total || 0}</div>
                <div className="text-xs text-gray-500">Benutzer</div>
              </div>
            </div>
            <div className="text-xs text-gray-400">
              {summary.data_overview?.users?.with_bids || 0} mit Geboten, {summary.data_overview?.users?.vip || 0} VIP
            </div>
          </div>

          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{summary.data_overview?.enterprises?.total || 0}</div>
                <div className="text-xs text-gray-500">Händler</div>
              </div>
            </div>
            <div className="text-xs text-gray-400">
              {summary.data_overview?.enterprises?.branches || 0} Filialen, {summary.data_overview?.enterprises?.employees || 0} Mitarbeiter
            </div>
          </div>

          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{summary.data_overview?.products?.total || 0}</div>
                <div className="text-xs text-gray-500">Produkte</div>
              </div>
            </div>
            <div className="text-xs text-gray-400">
              {summary.data_overview?.auctions?.active || 0} aktive Auktionen
            </div>
          </div>

          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{summary.data_overview?.transactions?.payments || 0}</div>
                <div className="text-xs text-gray-500">Transaktionen</div>
              </div>
            </div>
            <div className="text-xs text-gray-400">
              {summary.data_overview?.transactions?.digital || 0} Digital, {summary.data_overview?.transactions?.cashback || 0} Cashback
            </div>
          </div>
        </div>
      )}

      {/* Collections Status */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-gray-500" />
            Datenbank-Collections
          </h3>
          <div className="text-sm text-gray-500">
            {status?.total_collections || 0} Collections, {status?.total_documents?.toLocaleString() || 0} Dokumente
          </div>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            Lade Status...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-gray-200">
            {status?.collections && Object.entries(status.collections).map(([name, info]) => (
              <div key={name} className="bg-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {info.status === 'ok' ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                  )}
                  <div>
                    <div className="font-medium text-sm text-gray-900">{name}</div>
                    <div className="text-xs text-gray-500">{info.documents?.toLocaleString()} Einträge</div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleExportCollection(name)}
                  className="text-blue-600"
                >
                  <FileJson className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Backup Info */}
      <div className="bg-gray-50 rounded-xl p-6 border">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-500" />
          Backup-Empfehlungen
        </h3>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            Laden Sie regelmäßig ein vollständiges Backup herunter
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            Speichern Sie die JSON-Datei an einem sicheren Ort
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            Vor großen Updates immer ein Backup erstellen
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            Einzelne Collections können separat exportiert werden
          </li>
        </ul>
      </div>

      {/* Last Updated */}
      <div className="text-center text-xs text-gray-400">
        <Clock className="w-3 h-3 inline mr-1" />
        Status vom: {status?.timestamp ? new Date(status.timestamp).toLocaleString('de-DE') : '-'}
      </div>
    </div>
  );
}

export default AdminBackupSystem;
