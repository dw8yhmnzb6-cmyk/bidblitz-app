import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, Package, CreditCard, FileText, TrendingUp, 
  Euro, ShoppingBag, Percent, Clock, Download, ArrowRight 
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL;

export default function WholesaleDashboard() {
  const { token, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    checkStatus();
  }, [isAuthenticated, navigate]);

  const checkStatus = async () => {
    try {
      const response = await axios.get(`${API}/api/wholesale/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatus(response.data);
      
      if (response.data.is_wholesale) {
        fetchDashboard();
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error checking wholesale status:', error);
      setLoading(false);
    }
  };

  const fetchDashboard = async () => {
    try {
      const response = await axios.get(`${API}/api/wholesale/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(response.data);
    } catch (error) {
      toast.error('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFD700]"></div>
      </div>
    );
  }

  // Not a wholesale customer
  if (!status?.is_wholesale) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-20 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-[#FFD700]/20 to-[#FF4D4D]/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Building2 className="w-10 h-10 text-[#FFD700]" />
          </div>
          
          {status?.application_status === 'pending' ? (
            <>
              <h1 className="text-3xl font-bold text-gray-800 mb-4">Bewerbung in Prüfung</h1>
              <p className="text-gray-500 mb-8">
                Ihre Großkunden-Bewerbung wird derzeit geprüft. 
                Wir melden uns innerhalb von 24-48 Stunden bei Ihnen.
              </p>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 text-yellow-500">
                <Clock className="w-4 h-4" />
                Status: Ausstehend
              </div>
            </>
          ) : status?.application_status === 'rejected' ? (
            <>
              <h1 className="text-3xl font-bold text-gray-800 mb-4">Bewerbung abgelehnt</h1>
              <p className="text-gray-500 mb-8">
                Leider können wir Ihre Bewerbung derzeit nicht genehmigen. 
                Bei Fragen kontaktieren Sie uns bitte.
              </p>
              <Button 
                onClick={() => navigate('/contact')}
                className="bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black"
              >
                Kontakt aufnehmen
              </Button>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-gray-800 mb-4">Großkundenbereich</h1>
              <p className="text-gray-500 mb-8">
                Sie sind noch kein Großkunde. Bewerben Sie sich jetzt und profitieren Sie 
                von exklusiven Rabatten und Vorteilen!
              </p>
              <Button 
                onClick={() => navigate('/wholesale/apply')}
                className="bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black"
              >
                Jetzt bewerben
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  // Wholesale customer dashboard
  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-cyan-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center">
              <Building2 className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{data?.company_name}</h1>
              <p className="text-gray-500 text-sm">Großkunden-Dashboard</p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Euro className="w-5 h-5 text-green-500" />
              </div>
              <span className="text-gray-500 text-sm">Gesamtumsatz</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">€{data?.stats?.total_spent?.toLocaleString()}</p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Package className="w-5 h-5 text-blue-500" />
              </div>
              <span className="text-gray-500 text-sm">Gebote gekauft</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{data?.stats?.total_bids_bought?.toLocaleString()}</p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-[#FFD700]/20 flex items-center justify-center">
                <Percent className="w-5 h-5 text-[#FFD700]" />
              </div>
              <span className="text-gray-500 text-sm">Ihr Rabatt</span>
            </div>
            <p className="text-2xl font-bold text-[#FFD700]">{data?.discount_percent}%</p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-500" />
              </div>
              <span className="text-gray-500 text-sm">Ersparnis</span>
            </div>
            <p className="text-2xl font-bold text-green-500">€{data?.stats?.savings_from_discount?.toLocaleString()}</p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Account Info */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#FFD700]" />
              Konditionen
            </h2>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-gray-200">
                <span className="text-gray-500">Rabatt</span>
                <span className="text-[#FFD700] font-semibold">{data?.discount_percent}%</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-gray-200">
                <span className="text-gray-500">Zahlungsziel</span>
                <span className="text-gray-800 font-semibold">
                  {data?.payment_terms === 'prepaid' ? 'Vorkasse' : 
                   data?.payment_terms === 'net15' ? '15 Tage' : 
                   data?.payment_terms === 'net30' ? '30 Tage' : data?.payment_terms}
                </span>
              </div>
              {data?.credit_limit > 0 && (
                <>
                  <div className="flex justify-between items-center py-3 border-b border-gray-200">
                    <span className="text-gray-500">Kreditlimit</span>
                    <span className="text-gray-800 font-semibold">€{data?.credit_limit?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-gray-200">
                    <span className="text-gray-500">Verfügbar</span>
                    <span className="text-green-500 font-semibold">€{data?.credit_available?.toLocaleString()}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between items-center py-3">
                <span className="text-gray-500">Transaktionen</span>
                <span className="text-gray-800 font-semibold">{data?.stats?.total_transactions}</span>
              </div>
            </div>

            {data?.special_conditions && (
              <div className="mt-4 p-4 bg-[#FFD700]/10 rounded-xl">
                <p className="text-sm text-[#FFD700]">
                  <strong>Sonderkonditionen:</strong> {data?.special_conditions}
                </p>
              </div>
            )}
          </div>

          {/* Recent Transactions */}
          <div className="lg:col-span-2 bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-[#FFD700]" />
              Letzte Transaktionen
            </h2>
            
            {data?.recent_transactions?.length > 0 ? (
              <div className="space-y-3">
                {data.recent_transactions.map((tx, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        tx.status === 'completed' ? 'bg-green-500/20' : 'bg-yellow-500/20'
                      }`}>
                        <Package className={`w-5 h-5 ${
                          tx.status === 'completed' ? 'text-green-500' : 'text-yellow-500'
                        }`} />
                      </div>
                      <div>
                        <p className="text-gray-800 font-medium">{tx.bids} Gebote</p>
                        <p className="text-gray-500 text-sm">
                          {new Date(tx.created_at).toLocaleDateString('de-DE')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-800 font-semibold">€{tx.amount?.toFixed(2)}</p>
                      <p className={`text-sm ${
                        tx.status === 'completed' ? 'text-green-500' : 'text-yellow-500'
                      }`}>
                        {tx.status === 'completed' ? 'Abgeschlossen' : 'Ausstehend'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Noch keine Transaktionen
              </div>
            )}
          </div>
        </div>

        {/* Invoices Section */}
        {data?.invoices?.length > 0 && (
          <div className="mt-6 bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#FFD700]" />
              Rechnungen
            </h2>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-gray-500 text-sm border-b border-gray-200">
                    <th className="pb-3">Rechnung</th>
                    <th className="pb-3">Datum</th>
                    <th className="pb-3">Betrag</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.invoices.map((invoice, i) => (
                    <tr key={i} className="border-b border-white/5">
                      <td className="py-4 text-gray-800">{invoice.invoice_number}</td>
                      <td className="py-4 text-gray-500">
                        {new Date(invoice.created_at).toLocaleDateString('de-DE')}
                      </td>
                      <td className="py-4 text-gray-800">€{invoice.amount?.toFixed(2)}</td>
                      <td className="py-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          invoice.status === 'paid' 
                            ? 'bg-green-500/20 text-green-500' 
                            : 'bg-yellow-500/20 text-yellow-500'
                        }`}>
                          {invoice.status === 'paid' ? 'Bezahlt' : 'Offen'}
                        </span>
                      </td>
                      <td className="py-4">
                        <Button variant="ghost" size="sm" className="text-[#FFD700]">
                          <Download className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Quick Action */}
        <div className="mt-6 flex justify-center">
          <Button 
            onClick={() => navigate('/buy-bids')}
            className="bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black px-8 py-6 text-lg"
          >
            <Package className="w-5 h-5 mr-2" />
            Gebote kaufen (mit {data?.discount_percent}% Rabatt)
          </Button>
        </div>
      </div>
    </div>
  );
}
