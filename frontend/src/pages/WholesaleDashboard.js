import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { 
  Building2, Package, ShoppingCart, FileText, User, LogOut, 
  TrendingUp, CreditCard, Percent, Clock, CheckCircle, RefreshCw,
  ChevronRight, AlertCircle, Users, Send, Gift, Search, Plus, Trash2,
  History, UserPlus, Zap
} from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

export default function WholesaleDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // B2B Customer Management State
  const [b2bCustomers, setB2bCustomers] = useState([]);
  const [bidTransfers, setBidTransfers] = useState([]);
  const [newCustomerNumber, setNewCustomerNumber] = useState('');
  const [newCustomerNickname, setNewCustomerNickname] = useState('');
  const [sendBidsTarget, setSendBidsTarget] = useState(null);
  const [sendBidsAmount, setSendBidsAmount] = useState('');
  const [sendBidsMessage, setSendBidsMessage] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('wholesale_token');
    if (!token) {
      navigate('/b2b/login');
      return;
    }
    fetchData();
  }, [navigate]);

  const fetchData = async () => {
    const token = localStorage.getItem('wholesale_token');
    try {
      const [profileRes, pricingRes, ordersRes] = await Promise.all([
        fetch(`${API}/api/wholesale/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API}/api/wholesale/auth/pricing`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API}/api/wholesale/auth/orders`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (!profileRes.ok) {
        throw new Error('Nicht autorisiert');
      }

      const [profile, pricingData, ordersData] = await Promise.all([
        profileRes.json(),
        pricingRes.json(),
        ordersRes.json()
      ]);

      setCustomer(profile);
      setPricing(pricingData);
      setOrders(ordersData.orders || []);
      
      // Fetch B2B customer data
      try {
        const [customersRes, transfersRes] = await Promise.all([
          fetch(`${API}/api/wholesale/auth/my-customers`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`${API}/api/wholesale/auth/bid-transfers`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);
        
        if (customersRes.ok) {
          const customersData = await customersRes.json();
          setB2bCustomers(customersData.customers || []);
        }
        
        if (transfersRes.ok) {
          const transfersData = await transfersRes.json();
          setBidTransfers(transfersData.transfers || []);
        }
      } catch (e) {
        console.log('B2B data fetch error:', e);
      }
    } catch (error) {
      toast.error('Sitzung abgelaufen');
      localStorage.removeItem('wholesale_token');
      localStorage.removeItem('wholesale_customer');
      navigate('/b2b/login');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('wholesale_token');
    localStorage.removeItem('wholesale_customer');
    toast.success('Erfolgreich ausgeloggt');
    navigate('/b2b/login');
  };

  // B2B Customer Management Functions
  const handleAddCustomer = async () => {
    if (!newCustomerNumber || newCustomerNumber.length !== 8) {
      toast.error('Bitte geben Sie eine gültige 8-stellige Kundennummer ein');
      return;
    }
    
    const token = localStorage.getItem('wholesale_token');
    try {
      const res = await fetch(`${API}/api/wholesale/auth/add-customer`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customer_number: newCustomerNumber,
          nickname: newCustomerNickname || null
        })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || 'Fehler beim Hinzufügen');
      }
      
      toast.success(data.message);
      setNewCustomerNumber('');
      setNewCustomerNickname('');
      fetchData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleRemoveCustomer = async (customerNumber) => {
    if (!window.confirm('Möchten Sie diesen Kunden wirklich entfernen?')) return;
    
    const token = localStorage.getItem('wholesale_token');
    try {
      const res = await fetch(`${API}/api/wholesale/auth/remove-customer/${customerNumber}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Fehler beim Entfernen');
      }
      
      toast.success('Kunde entfernt');
      fetchData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleSendBids = async () => {
    if (!sendBidsTarget || !sendBidsAmount) {
      toast.error('Bitte wählen Sie einen Kunden und Betrag');
      return;
    }
    
    const amount = parseInt(sendBidsAmount);
    if (isNaN(amount) || amount < 1) {
      toast.error('Bitte geben Sie eine gültige Anzahl ein');
      return;
    }
    
    const token = localStorage.getItem('wholesale_token');
    try {
      const res = await fetch(`${API}/api/wholesale/auth/send-bids`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customer_number: sendBidsTarget.customer_number,
          amount: amount,
          message: sendBidsMessage || null
        })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || 'Fehler beim Senden');
      }
      
      toast.success(data.message);
      setSendBidsTarget(null);
      setSendBidsAmount('');
      setSendBidsMessage('');
      fetchData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleOrder = async (packageId) => {
    const token = localStorage.getItem('wholesale_token');
    try {
      const res = await fetch(`${API}/api/wholesale/auth/order?package_id=${packageId}&quantity=1`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || 'Bestellung fehlgeschlagen');
      }
      
      toast.success(`Bestellung erfolgreich! ${data.total_bids} Gebote für €${data.total_price}`);
      fetchData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900">
      {/* Header */}
      <div className="bg-slate-900/80 border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold text-white">BidBlitz</span>
              <span className="text-cyan-400 font-bold ml-1">B2B</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:block text-right">
              <p className="text-white font-medium">{customer?.company_name}</p>
              <p className="text-slate-400 text-sm">{customer?.contact_name}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Ausloggen
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-2xl p-6 border border-cyan-500/30 mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">
                Willkommen zurück, {customer?.company_name}!
              </h1>
              <p className="text-slate-300 mt-1">
                Ihr persönlicher Rabatt: <span className="text-cyan-400 font-bold">{customer?.discount_percent}%</span> auf alle Pakete
              </p>
            </div>
            <div className="flex gap-3">
              <div className="px-4 py-2 rounded-xl bg-slate-800/50 text-center">
                <p className="text-slate-400 text-xs">Kreditlimit</p>
                <p className="text-white font-bold">€{customer?.credit_limit?.toLocaleString() || 0}</p>
              </div>
              <div className="px-4 py-2 rounded-xl bg-slate-800/50 text-center">
                <p className="text-slate-400 text-xs">Verfügbar</p>
                <p className="text-emerald-400 font-bold">
                  €{((customer?.credit_limit || 0) - (customer?.credit_used || 0)).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {[
            { id: 'dashboard', label: 'Übersicht', icon: TrendingUp },
            { id: 'order', label: 'Gebote kaufen', icon: ShoppingCart },
            { id: 'orders', label: 'Bestellungen', icon: Package },
            { id: 'profile', label: 'Profil', icon: User }
          ].map(tab => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? 'default' : 'outline'}
              onClick={() => setActiveTab(tab.id)}
              className={activeTab === tab.id 
                ? 'bg-cyan-500 hover:bg-cyan-600 text-white' 
                : 'border-slate-600 text-slate-300 hover:bg-slate-800'
              }
            >
              <tab.icon className="w-4 h-4 mr-2" />
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <Percent className="w-5 h-5 text-emerald-400" />
                  </div>
                </div>
                <p className="text-slate-400 text-sm">Ihr Rabatt</p>
                <p className="text-3xl font-bold text-white">{customer?.discount_percent}%</p>
              </div>
              
              <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-cyan-400" />
                  </div>
                </div>
                <p className="text-slate-400 text-sm">Kredit verfügbar</p>
                <p className="text-3xl font-bold text-white">
                  €{((customer?.credit_limit || 0) - (customer?.credit_used || 0)).toLocaleString()}
                </p>
              </div>
              
              <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <Package className="w-5 h-5 text-amber-400" />
                  </div>
                </div>
                <p className="text-slate-400 text-sm">Bestellungen</p>
                <p className="text-3xl font-bold text-white">{customer?.total_orders || 0}</p>
              </div>
              
              <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-violet-400" />
                  </div>
                </div>
                <p className="text-slate-400 text-sm">Gesamtumsatz</p>
                <p className="text-3xl font-bold text-white">€{(customer?.total_spent || 0).toLocaleString()}</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
              <h3 className="text-lg font-bold text-white mb-4">Schnellaktionen</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Button
                  onClick={() => setActiveTab('order')}
                  className="h-auto py-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400"
                >
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  <div className="text-left">
                    <p className="font-semibold">Gebote kaufen</p>
                    <p className="text-xs opacity-80">Mit {customer?.discount_percent}% Rabatt</p>
                  </div>
                  <ChevronRight className="w-5 h-5 ml-auto" />
                </Button>
                
                <Button
                  onClick={() => setActiveTab('orders')}
                  variant="outline"
                  className="h-auto py-4 border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  <FileText className="w-5 h-5 mr-2" />
                  <div className="text-left">
                    <p className="font-semibold">Bestellungen</p>
                    <p className="text-xs opacity-80">{orders.length} Bestellungen</p>
                  </div>
                  <ChevronRight className="w-5 h-5 ml-auto" />
                </Button>
                
                <Link to="/" className="block">
                  <Button
                    variant="outline"
                    className="w-full h-auto py-4 border-slate-600 text-slate-300 hover:bg-slate-700"
                  >
                    <TrendingUp className="w-5 h-5 mr-2" />
                    <div className="text-left">
                      <p className="font-semibold">Zu den Auktionen</p>
                      <p className="text-xs opacity-80">Jetzt bieten</p>
                    </div>
                    <ChevronRight className="w-5 h-5 ml-auto" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Order Tab */}
        {activeTab === 'order' && pricing && (
          <div className="space-y-6">
            <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/30 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <p className="text-emerald-300">
                Ihr Rabatt von <span className="font-bold">{pricing.discount_percent}%</span> wurde bereits abgezogen!
              </p>
            </div>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pricing.packages?.map((pkg, idx) => (
                <div 
                  key={idx} 
                  className={`bg-slate-800/50 rounded-2xl p-6 border ${
                    pkg.popular ? 'border-cyan-500' : 'border-slate-700'
                  } relative`}
                >
                  {pkg.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-cyan-500 rounded-full text-xs font-bold text-white">
                      BELIEBT
                    </div>
                  )}
                  
                  <div className="text-center mb-4">
                    <p className="text-4xl font-bold text-white">{pkg.bids}</p>
                    <p className="text-slate-400">Gebote</p>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Originalpreis:</span>
                      <span className="text-slate-500 line-through">€{pkg.original_price?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-300 font-medium">Ihr Preis:</span>
                      <span className="text-emerald-400 font-bold text-xl">€{pkg.discounted_price?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Sie sparen:</span>
                      <span className="text-emerald-400">€{pkg.savings?.toFixed(2)}</span>
                    </div>
                  </div>
                  
                  <Button
                    onClick={() => handleOrder(String(pkg.bids))}
                    className={`w-full ${
                      pkg.popular 
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400' 
                        : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Bestellen
                  </Button>
                </div>
              ))}
            </div>
            
            {customer?.payment_terms !== 'prepaid' && (
              <div className="bg-cyan-500/10 rounded-xl p-4 border border-cyan-500/30 flex items-center gap-3">
                <Clock className="w-5 h-5 text-cyan-400" />
                <p className="text-cyan-300">
                  Zahlungsziel: <span className="font-bold">
                    {customer?.payment_terms === 'net15' ? 'Netto 15 Tage' : 
                     customer?.payment_terms === 'net30' ? 'Netto 30 Tage' : 'Vorkasse'}
                  </span>
                </p>
              </div>
            )}
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <div className="bg-slate-800/50 rounded-2xl p-12 border border-slate-700 text-center">
                <Package className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">Noch keine Bestellungen vorhanden</p>
                <Button
                  onClick={() => setActiveTab('order')}
                  className="mt-4 bg-cyan-500 hover:bg-cyan-600"
                >
                  Erste Bestellung aufgeben
                </Button>
              </div>
            ) : (
              orders.map(order => (
                <div key={order.id} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-white font-semibold">{order.package_name} × {order.quantity}</p>
                      <p className="text-slate-400 text-sm">
                        {new Date(order.created_at).toLocaleDateString('de-DE')}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-emerald-400 font-bold">€{order.total_price?.toFixed(2)}</p>
                        <p className="text-slate-400 text-sm">{order.total_bids} Gebote</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        order.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                        order.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>
                        {order.status === 'completed' ? 'Abgeschlossen' :
                         order.status === 'pending' ? 'Ausstehend' :
                         order.status === 'awaiting_payment' ? 'Zahlung ausstehend' : order.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
            <h3 className="text-lg font-bold text-white mb-6">Firmenprofil</h3>
            
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <p className="text-slate-400 text-sm">Firmenname</p>
                <p className="text-white font-medium">{customer?.company_name}</p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Ansprechpartner</p>
                <p className="text-white font-medium">{customer?.contact_name}</p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">E-Mail</p>
                <p className="text-white font-medium">{customer?.email}</p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Telefon</p>
                <p className="text-white font-medium">{customer?.phone || '-'}</p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Website</p>
                <p className="text-white font-medium">{customer?.website || '-'}</p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Steuernummer</p>
                <p className="text-white font-medium">{customer?.tax_id || '-'}</p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Zahlungsziel</p>
                <p className="text-white font-medium">
                  {customer?.payment_terms === 'prepaid' ? 'Vorkasse' :
                   customer?.payment_terms === 'net15' ? 'Netto 15 Tage' :
                   customer?.payment_terms === 'net30' ? 'Netto 30 Tage' : customer?.payment_terms}
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Mitglied seit</p>
                <p className="text-white font-medium">
                  {customer?.created_at ? new Date(customer.created_at).toLocaleDateString('de-DE') : '-'}
                </p>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-slate-700">
              <p className="text-slate-400 text-sm mb-2">Für Änderungen an Ihrem Profil kontaktieren Sie bitte:</p>
              <p className="text-cyan-400">b2b@bidblitz.de</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
