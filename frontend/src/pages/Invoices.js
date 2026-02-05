import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { FileText, Download, Trophy, CreditCard, Calendar } from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Invoices() {
  const { isAuthenticated, token } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      fetchInvoices();
    }
  }, [isAuthenticated]);

  const fetchInvoices = async () => {
    try {
      const res = await axios.get(`${API}/invoices/user/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInvoices(res.data.invoices || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast.error('Fehler beim Laden der Rechnungen');
    } finally {
      setLoading(false);
    }
  };

  const downloadInvoice = async (invoice) => {
    try {
      const endpoint = invoice.type === 'auction_win'
        ? `${API}/invoices/auction-win/${invoice.id}`
        : `${API}/invoices/${invoice.id}`;
      
      const response = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `rechnung_${invoice.invoice_number}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Rechnung heruntergeladen');
    } catch (error) {
      console.error('Error downloading invoice:', error);
      toast.error('Fehler beim Download');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4 flex items-center justify-center bg-gradient-to-b from-cyan-50 to-cyan-100">
        <div className="bg-white p-8 rounded-xl text-center max-w-md shadow-lg border border-gray-200">
          <FileText className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-4">Meine Rechnungen</h2>
          <p className="text-gray-600 mb-6">Melden Sie sich an, um Ihre Rechnungen zu sehen.</p>
          <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={() => window.location.href = '/login'}>
            Anmelden
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-12 px-4 bg-gradient-to-b from-cyan-50 to-cyan-100" data-testid="invoices-page">
      <div className="max-w-3xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Meine Rechnungen</h1>
            <p className="text-sm text-gray-500">{invoices.length} Rechnungen</p>
          </div>
        </div>

        {/* Invoice List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-800 font-medium">Keine Rechnungen</p>
            <p className="text-gray-500 text-sm mt-1">Ihre Rechnungen erscheinen hier nach dem Kauf</p>
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.map((invoice) => (
              <div 
                key={invoice.id}
                className="bg-white rounded-xl p-4 border border-gray-200 hover:border-gray-300 transition-all shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      invoice.type === 'auction_win' 
                        ? 'bg-green-100 text-green-600'
                        : 'bg-blue-100 text-blue-600'
                    }`}>
                      {invoice.type === 'auction_win' ? (
                        <Trophy className="w-5 h-5" />
                      ) : (
                        <CreditCard className="w-5 h-5" />
                      )}
                    </div>
                    
                    <div>
                      <p className="text-white font-medium">{invoice.invoice_number}</p>
                      <p className="text-gray-400 text-sm mt-0.5">{invoice.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {invoice.date ? new Date(invoice.date).toLocaleDateString('de-DE') : 'N/A'}
                        </span>
                        <span className={`px-2 py-0.5 rounded ${
                          invoice.type === 'auction_win'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {invoice.type === 'auction_win' ? 'Gewinn' : 'Kauf'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right flex flex-col items-end gap-2">
                    <p className="text-white font-bold text-lg">
                      €{invoice.amount?.toFixed(2).replace('.', ',')}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => downloadInvoice(invoice)}
                      className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-400/10"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      PDF
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info Note */}
        <div className="mt-6 p-4 bg-[#1a3a52]/50 rounded-xl border border-white/5">
          <p className="text-gray-400 text-xs text-center">
            Alle Rechnungen enthalten die gesetzlich vorgeschriebene Mehrwertsteuer (19%).
            Bei Fragen wenden Sie sich an support@bidblitz.de
          </p>
        </div>
      </div>
    </div>
  );
}
