import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../ui/button';
import { 
  Bug, AlertTriangle, AlertCircle, Info, XCircle, CheckCircle,
  Trash2, RefreshCw, FileText, Clock, User, Filter,
  ChevronDown, ChevronUp, Mic
} from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Severity configuration
const SEVERITY_CONFIG = {
  low: { 
    label: 'Niedrig', 
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: Info 
  },
  medium: { 
    label: 'Mittel', 
    color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    icon: AlertCircle 
  },
  high: { 
    label: 'Hoch', 
    color: 'bg-orange-100 text-orange-700 border-orange-200',
    icon: AlertTriangle 
  },
  critical: { 
    label: 'Kritisch', 
    color: 'bg-red-100 text-red-700 border-red-200',
    icon: XCircle 
  }
};

// Status configuration
const STATUS_CONFIG = {
  pending: { label: 'Ausstehend', color: 'bg-gray-100 text-gray-600' },
  analyzed: { label: 'Analysiert', color: 'bg-blue-100 text-blue-600' },
  in_progress: { label: 'In Bearbeitung', color: 'bg-yellow-100 text-yellow-600' },
  resolved: { label: 'Gelöst', color: 'bg-green-100 text-green-600' },
  wont_fix: { label: 'Nicht beheben', color: 'bg-gray-100 text-gray-500' }
};

export function AdminDebugReports({ token }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedReport, setExpandedReport] = useState(null);
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Fetch reports
  const fetchReports = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/admin/voice-debug/reports`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReports(response.data.reports || []);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
      toast.error('Fehler beim Laden der Reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [token]);

  // Update status
  const updateStatus = async (reportId, newStatus) => {
    try {
      await axios.patch(
        `${API}/admin/voice-debug/reports/${reportId}/status?status=${newStatus}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Status aktualisiert');
      fetchReports();
    } catch (error) {
      toast.error('Fehler beim Aktualisieren');
    }
  };

  // Delete report
  const deleteReport = async (reportId) => {
    if (!window.confirm('Report wirklich löschen?')) return;
    
    try {
      await axios.delete(`${API}/admin/voice-debug/reports/${reportId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Report gelöscht');
      fetchReports();
    } catch (error) {
      toast.error('Fehler beim Löschen');
    }
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filter reports
  const filteredReports = reports.filter(report => {
    if (filterSeverity !== 'all' && report.severity !== filterSeverity) return false;
    if (filterStatus !== 'all' && report.status !== filterStatus) return false;
    return true;
  });

  // Count by severity
  const severityCounts = reports.reduce((acc, r) => {
    acc[r.severity] = (acc[r.severity] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
            <Bug className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Debug Reports</h1>
            <p className="text-gray-500 text-sm">{reports.length} Reports insgesamt</p>
          </div>
        </div>
        <Button 
          onClick={fetchReports} 
          variant="outline"
          className="border-gray-200 hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Aktualisieren
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(SEVERITY_CONFIG).map(([key, config]) => {
          const Icon = config.icon;
          return (
            <div 
              key={key}
              className={`p-4 rounded-xl border ${config.color} cursor-pointer transition-all hover:scale-105`}
              onClick={() => setFilterSeverity(filterSeverity === key ? 'all' : key)}
            >
              <div className="flex items-center justify-between">
                <Icon className="w-5 h-5" />
                <span className="text-2xl font-bold">{severityCounts[key] || 0}</span>
              </div>
              <p className="text-sm mt-1 font-medium">{config.label}</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-xl">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600">Filter:</span>
        </div>
        <Select value={filterSeverity} onValueChange={setFilterSeverity}>
          <SelectTrigger className="w-40 bg-white border-gray-200">
            <SelectValue placeholder="Schweregrad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Schweregrade</SelectItem>
            {Object.entries(SEVERITY_CONFIG).map(([key, config]) => (
              <SelectItem key={key} value={key}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 bg-white border-gray-200">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <SelectItem key={key} value={key}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(filterSeverity !== 'all' || filterStatus !== 'all') && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => { setFilterSeverity('all'); setFilterStatus('all'); }}
            className="text-gray-500"
          >
            Filter zurücksetzen
          </Button>
        )}
      </div>

      {/* Reports List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Mic className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Keine Debug Reports</p>
          <p className="text-gray-400 text-sm mt-1">
            Verwende den Voice Debug Assistant um Fehler zu melden
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReports.map((report) => {
            const severityConfig = SEVERITY_CONFIG[report.severity] || SEVERITY_CONFIG.medium;
            const statusConfig = STATUS_CONFIG[report.status] || STATUS_CONFIG.pending;
            const SeverityIcon = severityConfig.icon;
            const isExpanded = expandedReport === report.id;

            return (
              <div 
                key={report.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Report Header */}
                <div 
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedReport(isExpanded ? null : report.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${severityConfig.color}`}>
                        <SeverityIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-gray-400">{report.id}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityConfig.color}`}>
                            {severityConfig.label}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusConfig.color}`}>
                            {statusConfig.label}
                          </span>
                        </div>
                        <p className="text-gray-800 font-medium mt-1 line-clamp-2">
                          {report.description}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(report.created_at)}
                          </span>
                          {report.created_by_name && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {report.created_by_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-4">
                    {/* Transcription */}
                    <div className="bg-white p-3 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                        <Mic className="w-3 h-3" /> Spracheingabe
                      </p>
                      <p className="text-gray-700 italic">"{report.transcription}"</p>
                    </div>

                    {/* Possible Causes */}
                    {report.possible_causes?.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Mögliche Ursachen
                        </p>
                        <ul className="space-y-1">
                          {report.possible_causes.map((cause, i) => (
                            <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                              <span className="text-orange-500 mt-1">•</span>
                              {cause}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Affected Files */}
                    {report.affected_files?.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                          <FileText className="w-3 h-3" /> Betroffene Dateien
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {report.affected_files.map((file, i) => (
                            <span key={i} className="font-mono text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                              {file}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recommendations */}
                    {report.recommendations?.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Empfehlungen
                        </p>
                        <ul className="space-y-1">
                          {report.recommendations.map((rec, i) => (
                            <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                              <CheckCircle className="w-3 h-3 text-green-500 mt-1 flex-shrink-0" />
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Status ändern:</span>
                        <Select 
                          value={report.status} 
                          onValueChange={(value) => updateStatus(report.id, value)}
                        >
                          <SelectTrigger className="w-36 h-8 text-xs bg-white border-gray-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                              <SelectItem key={key} value={key} className="text-xs">
                                {config.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteReport(report.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Löschen
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AdminDebugReports;
