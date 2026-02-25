import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { 
  Building2, Package, ShoppingCart, FileText, User, LogOut, 
  TrendingUp, CreditCard, Percent, Clock, CheckCircle, RefreshCw,
  ChevronRight, AlertCircle, Users, Send, Gift, Search, Plus, Trash2,
  History, UserPlus, Zap, Ticket
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
  
  // Voucher State
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherLoading, setVoucherLoading] = useState(false);
  
  // Products State (Merchant can create own products/auctions)
  const [merchantProducts, setMerchantProducts] = useState([]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    retail_price: '',
    category: 'Elektronik',
    image_url: ''
  });
  
  // Coupons State (Merchant can create discount coupons)
  const [merchantCoupons, setMerchantCoupons] = useState([]);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    discount_type: 'percent',
    discount_value: '',
    min_purchase: '',
    max_uses: '',
    expires_at: ''
  });

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
      
      // Fetch Merchant Products and Coupons
      try {
        const [productsRes, couponsRes] = await Promise.all([
          fetch(`${API}/api/merchant/products`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`${API}/api/merchant/coupons`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);
        
        if (productsRes.ok) {
          const productsData = await productsRes.json();
          setMerchantProducts(productsData.products || []);
        }
        
        if (couponsRes.ok) {
          const couponsData = await couponsRes.json();
          setMerchantCoupons(couponsData.coupons || []);
        }
      } catch (e) {
        console.log('Merchant data fetch error:', e);
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

  // Voucher Redemption Handler
  const handleRedeemVoucher = async () => {
    if (!voucherCode || voucherCode.length < 4) {
      toast.error('Bitte geben Sie einen gültigen Gutschein-Code ein');
      return;
    }
    
    setVoucherLoading(true);
    const token = localStorage.getItem('wholesale_token');
    
    try {
      const res = await fetch(`${API}/api/wholesale/auth/redeem-voucher`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ voucher_code: voucherCode })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || 'Gutschein konnte nicht eingelöst werden');
      }
      
      toast.success(`Gutschein eingelöst! ${data.bids_added} Gebote wurden gutgeschrieben`);
      setVoucherCode('');
      fetchData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setVoucherLoading(false);
    }
  };

  // Create new product
  const handleCreateProduct = async () => {
    const token = localStorage.getItem('wholesale_token');
    if (!newProduct.name || !newProduct.retail_price) {
      toast.error('Bitte Name und Preis eingeben');
      return;
    }
    
    try {
      const res = await fetch(`${API}/api/merchant/products`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...newProduct,
          retail_price: parseFloat(newProduct.retail_price)
        })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || 'Produkt konnte nicht erstellt werden');
      }
      
      toast.success('Produkt erstellt!');
      setShowProductModal(false);
      setNewProduct({ name: '', description: '', retail_price: '', category: 'Elektronik', image_url: '' });
      fetchData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Delete product
  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Produkt wirklich löschen?')) return;
    
    const token = localStorage.getItem('wholesale_token');
    try {
      const res = await fetch(`${API}/api/merchant/products/${productId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Fehler beim Löschen');
      }
      
      toast.success('Produkt gelöscht');
      fetchData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Create new coupon
  const handleCreateCoupon = async () => {
    const token = localStorage.getItem('wholesale_token');
    if (!newCoupon.code || !newCoupon.discount_value) {
      toast.error('Bitte Code und Rabattwert eingeben');
      return;
    }
    
    try {
      const res = await fetch(`${API}/api/merchant/coupons`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...newCoupon,
          discount_value: parseFloat(newCoupon.discount_value),
          min_purchase: newCoupon.min_purchase ? parseFloat(newCoupon.min_purchase) : 0,
          max_uses: newCoupon.max_uses ? parseInt(newCoupon.max_uses) : null
        })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || 'Gutschein konnte nicht erstellt werden');
      }
      
      toast.success('Gutschein erstellt!');
      setShowCouponModal(false);
      setNewCoupon({ code: '', discount_type: 'percent', discount_value: '', min_purchase: '', max_uses: '', expires_at: '' });
      fetchData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Delete coupon
  const handleDeleteCoupon = async (couponId) => {
    if (!window.confirm('Gutschein wirklich löschen?')) return;
    
    const token = localStorage.getItem('wholesale_token');
    try {
      const res = await fetch(`${API}/api/merchant/coupons/${couponId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Fehler beim Löschen');
      }
      
      toast.success('Gutschein gelöscht');
      fetchData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleOrder = async (packageId) => {
    const token = localStorage.getItem('wholesale_token');
    try {
      // For prepaid customers, redirect to Stripe checkout
      if (customer?.payment_terms === 'prepaid' || !customer?.payment_terms) {
        const res = await fetch(`${API}/api/wholesale/auth/checkout?package_id=${packageId}&quantity=1`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.detail || 'Checkout fehlgeschlagen');
        }
        
        // Redirect to Stripe checkout
        if (data.checkout_url) {
          window.location.href = data.checkout_url;
          return;
        }
      }
      
      // For credit customers, use direct order
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

  // Check for payment success/cancel from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const orderId = urlParams.get('order_id');
    
    if (paymentStatus === 'success') {
      toast.success('Zahlung erfolgreich! Ihre Gebote werden gutgeschrieben.');
      // Clean URL
      window.history.replaceState({}, '', '/b2b/dashboard');
      fetchData();
    } else if (paymentStatus === 'cancelled') {
      toast.info('Zahlung abgebrochen. Die Bestellung wurde nicht abgeschlossen.');
      window.history.replaceState({}, '', '/b2b/dashboard');
    }
  }, []);

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
              <span className="text-xl font-bold text-white">BidBlitz.ae</span>
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
            { id: 'products', label: 'Produkte', icon: Package },
            { id: 'coupons', label: 'Gutscheine', icon: Ticket },
            { id: 'customers', label: 'Meine Kunden', icon: Users },
            { id: 'order', label: 'Gebote kaufen', icon: ShoppingCart },
            { id: 'orders', label: 'Bestellungen', icon: FileText },
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

        {/* Customers Tab - B2B Customer Management */}
        {activeTab === 'customers' && (
          <div className="space-y-6">
            {/* Add Customer Form */}
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-cyan-400" />
                Kunden hinzufügen
              </h3>
              <p className="text-slate-400 text-sm mb-4">
                Fügen Sie Ihre Kunden über deren 8-stellige Kundennummer hinzu, um ihnen Gebote zu senden.
              </p>
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <Label className="text-slate-300 text-sm">Kundennummer</Label>
                  <Input
                    value={newCustomerNumber}
                    onChange={(e) => setNewCustomerNumber(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    placeholder="12345678"
                    className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                    maxLength={8}
                  />
                </div>
                <div>
                  <Label className="text-slate-300 text-sm">Spitzname (optional)</Label>
                  <Input
                    value={newCustomerNickname}
                    onChange={(e) => setNewCustomerNickname(e.target.value)}
                    placeholder="z.B. Filiale München"
                    className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={handleAddCustomer}
                    className="w-full bg-cyan-500 hover:bg-cyan-600"
                    disabled={newCustomerNumber.length !== 8}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Hinzufügen
                  </Button>
                </div>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <p className="text-slate-400 text-sm">Verknüpfte Kunden</p>
                <p className="text-2xl font-bold text-white">{b2bCustomers.length}</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <p className="text-slate-400 text-sm">Gesendete Gebote</p>
                <p className="text-2xl font-bold text-cyan-400">
                  {bidTransfers.reduce((sum, t) => sum + (t.amount || 0), 0)}
                </p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <p className="text-slate-400 text-sm">Transfers gesamt</p>
                <p className="text-2xl font-bold text-white">{bidTransfers.length}</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                <p className="text-slate-400 text-sm">Kosten gesamt</p>
                <p className="text-2xl font-bold text-emerald-400">
                  €{bidTransfers.reduce((sum, t) => sum + (t.cost || 0), 0).toFixed(2)}
                </p>
              </div>
            </div>

            {/* Customer List */}
            <div className="bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-700">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-cyan-400" />
                  Ihre Kunden ({b2bCustomers.length})
                </h3>
              </div>
              
              {b2bCustomers.length === 0 ? (
                <div className="p-12 text-center">
                  <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">Noch keine Kunden verknüpft</p>
                  <p className="text-slate-500 text-sm mt-1">
                    Fügen Sie Kunden über deren Kundennummer hinzu
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-700">
                  {b2bCustomers.map((c) => (
                    <div key={c.customer_number} className="p-4 hover:bg-slate-700/30 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white font-bold">
                            {c.user_name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <p className="text-white font-medium">
                              {c.nickname || c.user_name || 'Unbekannt'}
                            </p>
                            {c.nickname && (
                              <p className="text-slate-400 text-sm">{c.user_name}</p>
                            )}
                            <p className="text-slate-500 text-xs">
                              #{c.customer_number} • {c.total_bids_sent || 0} Gebote gesendet
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <div className="text-right mr-4 hidden sm:block">
                            <p className="text-slate-400 text-sm">Aktuelles Guthaben</p>
                            <p className="text-cyan-400 font-bold">{c.current_bids || 0} Gebote</p>
                          </div>
                          
                          <Button
                            onClick={() => setSendBidsTarget(c)}
                            className="bg-emerald-500 hover:bg-emerald-600"
                            size="sm"
                          >
                            <Send className="w-4 h-4 mr-1" />
                            Senden
                          </Button>
                          
                          <Button
                            onClick={() => handleRemoveCustomer(c.customer_number)}
                            variant="outline"
                            size="sm"
                            className="border-slate-600 text-slate-400 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Transfer History */}
            <div className="bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-700">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-cyan-400" />
                  Transfer-Historie
                </h3>
              </div>
              
              {bidTransfers.length === 0 ? (
                <div className="p-8 text-center">
                  <Gift className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">Noch keine Transfers</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-700 max-h-80 overflow-y-auto">
                  {bidTransfers.slice(0, 20).map((t) => (
                    <div key={t.id} className="p-4 hover:bg-slate-700/30">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium">
                            {t.amount} Gebote an {t.recipient_name}
                          </p>
                          {t.message && (
                            <p className="text-slate-400 text-sm">"{t.message}"</p>
                          )}
                          <p className="text-slate-500 text-xs">
                            {new Date(t.created_at).toLocaleString('de-DE')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-emerald-400 font-bold">€{t.cost?.toFixed(2)}</p>
                          <p className="text-slate-500 text-xs">#{t.customer_number}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Send Bids Modal */}
            {sendBidsTarget && (
              <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-700">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Send className="w-5 h-5 text-cyan-400" />
                    Gebote senden
                  </h3>
                  
                  <div className="bg-slate-900/50 rounded-xl p-4 mb-4">
                    <p className="text-slate-400 text-sm">Empfänger</p>
                    <p className="text-white font-medium">
                      {sendBidsTarget.nickname || sendBidsTarget.user_name}
                    </p>
                    <p className="text-slate-500 text-sm">#{sendBidsTarget.customer_number}</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <Label className="text-slate-300">Anzahl Gebote</Label>
                      <Input
                        type="number"
                        value={sendBidsAmount}
                        onChange={(e) => setSendBidsAmount(e.target.value)}
                        placeholder="z.B. 100"
                        className="bg-slate-900/50 border-slate-600 text-white"
                        min="1"
                        max="10000"
                      />
                      <p className="text-slate-500 text-xs mt-1">
                        Kosten: ca. €{((parseInt(sendBidsAmount) || 0) * 0.10 * (1 - (customer?.discount_percent || 0) / 100)).toFixed(2)}
                      </p>
                    </div>
                    
                    <div>
                      <Label className="text-slate-300">Nachricht (optional)</Label>
                      <Input
                        value={sendBidsMessage}
                        onChange={(e) => setSendBidsMessage(e.target.value)}
                        placeholder="z.B. Viel Erfolg beim Bieten!"
                        className="bg-slate-900/50 border-slate-600 text-white"
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-3 mt-6">
                    <Button
                      onClick={() => setSendBidsTarget(null)}
                      variant="outline"
                      className="flex-1 border-slate-600 text-slate-300"
                    >
                      Abbrechen
                    </Button>
                    <Button
                      onClick={handleSendBids}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                      disabled={!sendBidsAmount || parseInt(sendBidsAmount) < 1}
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      Senden
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Order Tab */}
        {activeTab === 'order' && pricing && (
          <div className="space-y-6">
            {/* Voucher Redemption Section */}
            <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-2xl p-4 md:p-6 border border-amber-500/30">
              <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                <Ticket className="w-5 h-5 text-amber-400" />
                Gutschein einlösen
              </h3>
              <p className="text-slate-300 text-sm mb-4">
                Haben Sie einen Gutschein-Code? Lösen Sie ihn hier ein und erhalten Sie sofort Gebote!
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                  placeholder="z.B. B2B-WELCOME-2024"
                  className="flex-1 bg-slate-900/50 border-amber-500/30 text-white placeholder:text-slate-500 uppercase"
                  onKeyDown={(e) => e.key === 'Enter' && handleRedeemVoucher()}
                />
                <Button
                  onClick={handleRedeemVoucher}
                  disabled={voucherLoading || !voucherCode}
                  className="bg-amber-500 hover:bg-amber-600 text-white min-w-[140px]"
                >
                  {voucherLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Gift className="w-4 h-4 mr-2" />
                      Einlösen
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            {/* Discount Info */}
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

        {/* Products Tab - Merchant can create own products */}
        {activeTab === 'products' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Meine Produkte</h3>
              <Button
                onClick={() => setShowProductModal(true)}
                className="bg-cyan-500 hover:bg-cyan-600"
              >
                <Plus className="w-4 h-4 mr-2" />
                Neues Produkt
              </Button>
            </div>
            
            {merchantProducts.length === 0 ? (
              <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700 text-center">
                <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">Noch keine Produkte erstellt</p>
                <p className="text-slate-500 text-sm mt-1">Erstellen Sie Produkte, die in Auktionen angeboten werden können</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {merchantProducts.map(product => (
                  <div key={product.id} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                    {product.image_url && (
                      <img src={product.image_url} alt={product.name} className="w-full h-32 object-cover rounded-lg mb-3" />
                    )}
                    <h4 className="text-white font-medium">{product.name}</h4>
                    <p className="text-slate-400 text-sm mt-1">{product.category}</p>
                    <p className="text-cyan-400 font-bold mt-2">€{product.retail_price?.toFixed(2)}</p>
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteProduct(product.id)}
                        className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Product Modal */}
            {showProductModal && (
              <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-slate-700">
                  <h3 className="text-lg font-bold text-white mb-4">Neues Produkt erstellen</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <Label className="text-slate-300">Produktname *</Label>
                      <Input
                        value={newProduct.name}
                        onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                        placeholder="z.B. iPhone 15 Pro"
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-slate-300">Beschreibung</Label>
                      <Input
                        value={newProduct.description}
                        onChange={e => setNewProduct({...newProduct, description: e.target.value})}
                        placeholder="Produktbeschreibung..."
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-slate-300">Preis (€) *</Label>
                      <Input
                        type="number"
                        value={newProduct.retail_price}
                        onChange={e => setNewProduct({...newProduct, retail_price: e.target.value})}
                        placeholder="0.00"
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-slate-300">Kategorie</Label>
                      <select
                        value={newProduct.category}
                        onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                        className="w-full bg-slate-700 border border-slate-600 text-white rounded-md p-2"
                      >
                        <option value="Elektronik">Elektronik</option>
                        <option value="Mode & Accessoires">Mode & Accessoires</option>
                        <option value="Haus & Garten">Haus & Garten</option>
                        <option value="Sport & Freizeit">Sport & Freizeit</option>
                        <option value="Kunst & Sammlerstücke">Kunst & Sammlerstücke</option>
                      </select>
                    </div>
                    
                    <div>
                      <Label className="text-slate-300">Bild-URL</Label>
                      <Input
                        value={newProduct.image_url}
                        onChange={e => setNewProduct({...newProduct, image_url: e.target.value})}
                        placeholder="https://..."
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-3 mt-6">
                    <Button
                      variant="outline"
                      onClick={() => setShowProductModal(false)}
                      className="flex-1 border-slate-600 text-slate-300"
                    >
                      Abbrechen
                    </Button>
                    <Button
                      onClick={handleCreateProduct}
                      className="flex-1 bg-cyan-500 hover:bg-cyan-600"
                    >
                      Erstellen
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Coupons Tab - Merchant can create discount coupons */}
        {activeTab === 'coupons' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Meine Gutscheine</h3>
              <Button
                onClick={() => setShowCouponModal(true)}
                className="bg-cyan-500 hover:bg-cyan-600"
              >
                <Plus className="w-4 h-4 mr-2" />
                Neuer Gutschein
              </Button>
            </div>
            
            {merchantCoupons.length === 0 ? (
              <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700 text-center">
                <Ticket className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">Noch keine Gutscheine erstellt</p>
                <p className="text-slate-500 text-sm mt-1">Erstellen Sie Rabatt-Gutscheine für Ihre Kunden</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {merchantCoupons.map(coupon => (
                  <div key={coupon.id} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                    <div className="flex justify-between items-start mb-3">
                      <code className="text-cyan-400 font-bold text-lg">{coupon.code}</code>
                      <span className={`px-2 py-1 rounded text-xs ${coupon.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                        {coupon.is_active ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </div>
                    <p className="text-white font-medium">
                      {coupon.discount_type === 'percent' 
                        ? `${coupon.discount_value}% Rabatt` 
                        : `€${coupon.discount_value?.toFixed(2)} Rabatt`}
                    </p>
                    {coupon.min_purchase > 0 && (
                      <p className="text-slate-400 text-sm">Ab €{coupon.min_purchase?.toFixed(2)}</p>
                    )}
                    <p className="text-slate-500 text-sm mt-2">
                      Verwendet: {coupon.times_used || 0}{coupon.max_uses ? `/${coupon.max_uses}` : ''}
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteCoupon(coupon.id)}
                        className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Coupon Modal */}
            {showCouponModal && (
              <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-slate-700">
                  <h3 className="text-lg font-bold text-white mb-4">Neuen Gutschein erstellen</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <Label className="text-slate-300">Gutschein-Code *</Label>
                      <Input
                        value={newCoupon.code}
                        onChange={e => setNewCoupon({...newCoupon, code: e.target.value.toUpperCase()})}
                        placeholder="z.B. SOMMER20"
                        className="bg-slate-700 border-slate-600 text-white uppercase"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-slate-300">Rabatt-Art</Label>
                      <select
                        value={newCoupon.discount_type}
                        onChange={e => setNewCoupon({...newCoupon, discount_type: e.target.value})}
                        className="w-full bg-slate-700 border border-slate-600 text-white rounded-md p-2"
                      >
                        <option value="percent">Prozent (%)</option>
                        <option value="fixed">Festbetrag (€)</option>
                      </select>
                    </div>
                    
                    <div>
                      <Label className="text-slate-300">
                        Rabattwert {newCoupon.discount_type === 'percent' ? '(%)' : '(€)'} *
                      </Label>
                      <Input
                        type="number"
                        value={newCoupon.discount_value}
                        onChange={e => setNewCoupon({...newCoupon, discount_value: e.target.value})}
                        placeholder="z.B. 10"
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-slate-300">Mindesteinkauf (€)</Label>
                      <Input
                        type="number"
                        value={newCoupon.min_purchase}
                        onChange={e => setNewCoupon({...newCoupon, min_purchase: e.target.value})}
                        placeholder="0"
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-slate-300">Max. Verwendungen (leer = unbegrenzt)</Label>
                      <Input
                        type="number"
                        value={newCoupon.max_uses}
                        onChange={e => setNewCoupon({...newCoupon, max_uses: e.target.value})}
                        placeholder="Unbegrenzt"
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-3 mt-6">
                    <Button
                      variant="outline"
                      onClick={() => setShowCouponModal(false)}
                      className="flex-1 border-slate-600 text-slate-300"
                    >
                      Abbrechen
                    </Button>
                    <Button
                      onClick={handleCreateCoupon}
                      className="flex-1 bg-cyan-500 hover:bg-cyan-600"
                    >
                      Erstellen
                    </Button>
                  </div>
                </div>
              </div>
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
              <p className="text-cyan-400">b2b@BidBlitz.ae</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
