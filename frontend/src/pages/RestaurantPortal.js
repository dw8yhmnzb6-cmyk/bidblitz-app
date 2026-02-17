/**
 * Restaurant Portal - QR Code Scanner & Voucher Redemption
 * Allows restaurants to login, scan vouchers, and redeem them
 */
import { useState, useEffect, useRef } from 'react';
import { QrCode, Scan, Check, X, Euro, History, LogOut, Camera, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { Html5Qrcode } from 'html5-qrcode';

const API = process.env.REACT_APP_BACKEND_URL;

export default function RestaurantPortal() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState('');
  const [restaurant, setRestaurant] = useState(null);
  const [view, setView] = useState('login'); // login, register, scanner, history, dashboard
  
  // Login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Registration state
  const [regData, setRegData] = useState({
    restaurant_name: '',
    email: '',
    password: '',
    phone: '',
    address: '',
    iban: ''
  });
  
  // Scanner state
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [redeeming, setRedeeming] = useState(false);
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);
  
  // Dashboard state
  const [dashboardData, setDashboardData] = useState(null);
  const [history, setHistory] = useState([]);

  // Check for saved session
  useEffect(() => {
    const savedToken = localStorage.getItem('restaurant_token');
    const savedRestaurant = localStorage.getItem('restaurant_data');
    if (savedToken && savedRestaurant) {
      setToken(savedToken);
      setRestaurant(JSON.parse(savedRestaurant));
      setIsLoggedIn(true);
      setView('dashboard');
    }
  }, []);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // ==================== AUTH ====================
  
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await fetch(`${API}/api/restaurant-portal/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Login fehlgeschlagen');
      }
      
      setToken(data.token);
      setRestaurant(data.restaurant);
      setIsLoggedIn(true);
      setView('dashboard');
      
      localStorage.setItem('restaurant_token', data.token);
      localStorage.setItem('restaurant_data', JSON.stringify(data.restaurant));
      
      toast.success(`Willkommen, ${data.restaurant.name}!`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await fetch(`${API}/api/restaurant-portal/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regData)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Registrierung fehlgeschlagen');
      }
      
      toast.success('Registrierung erfolgreich! Warten Sie auf Admin-Freigabe.');
      setView('login');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setToken('');
    setRestaurant(null);
    setIsLoggedIn(false);
    setView('login');
    localStorage.removeItem('restaurant_token');
    localStorage.removeItem('restaurant_data');
    toast.success('Abgemeldet');
  };

  // ==================== SCANNER ====================
  
  const startScanner = async () => {
    try {
      setScanning(true);
      setScanResult(null);
      
      const html5QrCode = new Html5Qrcode("qr-reader");
      html5QrCodeRef.current = html5QrCode;
      
      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
          // QR code scanned!
          handleQRScan(decodedText);
          html5QrCode.stop().catch(() => {});
          setScanning(false);
        },
        () => {} // Ignore errors during scanning
      );
    } catch (err) {
      setScanning(false);
      toast.error('Kamera-Zugriff verweigert. Bitte erlauben Sie den Kamera-Zugriff.');
    }
  };

  const stopScanner = () => {
    if (html5QrCodeRef.current) {
      html5QrCodeRef.current.stop().catch(() => {});
    }
    setScanning(false);
  };

  const handleQRScan = async (qrData) => {
    // Parse QR: BIDBLITZ:CODE:VALUE:RESTAURANT
    const parts = qrData.split(':');
    let code = qrData;
    
    if (parts[0] === 'BIDBLITZ' && parts.length >= 2) {
      code = parts[1];
    }
    
    await validateVoucher(code);
  };

  const validateVoucher = async (code) => {
    setLoading(true);
    
    try {
      const response = await fetch(`${API}/api/restaurant-portal/validate/${code}?token=${token}`);
      const data = await response.json();
      
      setScanResult(data);
      
      if (data.valid) {
        toast.success(`Gültiger Gutschein: €${data.value}`);
      } else {
        toast.error(data.error || 'Ungültiger Gutschein');
      }
    } catch (err) {
      toast.error('Validierung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const handleManualValidate = async (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    await validateVoucher(manualCode.trim());
  };

  const handleRedeem = async () => {
    if (!scanResult?.valid) return;
    
    setRedeeming(true);
    
    try {
      const response = await fetch(`${API}/api/restaurant-portal/redeem?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voucher_code: scanResult.code })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Einlösung fehlgeschlagen');
      }
      
      toast.success(`✅ Gutschein eingelöst! €${scanResult.value} gutgeschrieben.`);
      setScanResult(null);
      setManualCode('');
      
      // Refresh dashboard
      fetchDashboard();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRedeeming(false);
    }
  };

  // ==================== DASHBOARD ====================
  
  const fetchDashboard = async () => {
    try {
      const response = await fetch(`${API}/api/restaurant-portal/dashboard?token=${token}`);
      const data = await response.json();
      setDashboardData(data);
    } catch (err) {
      console.error('Dashboard error:', err);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await fetch(`${API}/api/restaurant-portal/redemption-history?token=${token}`);
      const data = await response.json();
      setHistory(data.redemptions || []);
    } catch (err) {
      console.error('History error:', err);
    }
  };

  useEffect(() => {
    if (isLoggedIn && token) {
      fetchDashboard();
    }
  }, [isLoggedIn, token]);

  useEffect(() => {
    if (view === 'history' && token) {
      fetchHistory();
    }
  }, [view, token]);

  // ==================== RENDER ====================

  // Login View
  if (!isLoggedIn && view === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <QrCode className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Restaurant Portal</h1>
            <p className="text-gray-500">BidBlitz Gutschein-Scanner</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="restaurant@example.de"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Passwort</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            
            <Button type="submit" className="w-full bg-amber-500 hover:bg-amber-600" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Anmelden
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-gray-500 text-sm">
              Noch kein Konto?{' '}
              <button onClick={() => setView('register')} className="text-amber-500 font-medium hover:underline">
                Jetzt registrieren
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Register View
  if (!isLoggedIn && view === 'register') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Restaurant registrieren</h1>
            <p className="text-gray-500">Werden Sie BidBlitz-Partner</p>
          </div>
          
          <form onSubmit={handleRegister} className="space-y-4">
            <Input
              placeholder="Restaurant-Name"
              value={regData.restaurant_name}
              onChange={(e) => setRegData({...regData, restaurant_name: e.target.value})}
              required
            />
            <Input
              type="email"
              placeholder="E-Mail"
              value={regData.email}
              onChange={(e) => setRegData({...regData, email: e.target.value})}
              required
            />
            <Input
              type="password"
              placeholder="Passwort"
              value={regData.password}
              onChange={(e) => setRegData({...regData, password: e.target.value})}
              required
            />
            <Input
              placeholder="Telefon"
              value={regData.phone}
              onChange={(e) => setRegData({...regData, phone: e.target.value})}
              required
            />
            <Input
              placeholder="Adresse"
              value={regData.address}
              onChange={(e) => setRegData({...regData, address: e.target.value})}
              required
            />
            <Input
              placeholder="IBAN (für Auszahlungen)"
              value={regData.iban}
              onChange={(e) => setRegData({...regData, iban: e.target.value})}
            />
            
            <Button type="submit" className="w-full bg-amber-500 hover:bg-amber-600" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Registrieren
            </Button>
          </form>
          
          <div className="mt-4 text-center">
            <button onClick={() => setView('login')} className="text-amber-500 text-sm hover:underline">
              ← Zurück zum Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Logged In Views
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
              <QrCode className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-800">{restaurant?.name}</h1>
              <p className="text-xs text-gray-500">Restaurant Portal</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 flex gap-1">
          {['dashboard', 'scanner', 'history'].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                view === v 
                  ? 'border-amber-500 text-amber-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {v === 'dashboard' && '📊 Dashboard'}
              {v === 'scanner' && '📷 Scanner'}
              {v === 'history' && '📜 Verlauf'}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-4xl mx-auto p-4">
        
        {/* Dashboard View */}
        {view === 'dashboard' && dashboardData && (
          <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <p className="text-gray-500 text-sm">Eingelöst</p>
                <p className="text-2xl font-bold text-gray-800">{dashboardData.stats?.total_redeemed || 0}</p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-4 text-white">
                <p className="text-green-100 text-sm">Ausstehend</p>
                <p className="text-2xl font-bold">€{(dashboardData.stats?.pending_payout || 0).toFixed(2)}</p>
              </div>
            </div>
            
            {/* Quick Scan Button */}
            <Button 
              onClick={() => setView('scanner')} 
              className="w-full h-20 bg-amber-500 hover:bg-amber-600 text-lg"
            >
              <Camera className="w-6 h-6 mr-3" />
              Gutschein scannen
            </Button>
            
            {/* Recent Activity */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-3">Letzte Einlösungen</h3>
              {dashboardData.recent_redemptions?.length > 0 ? (
                <div className="space-y-2">
                  {dashboardData.recent_redemptions.slice(0, 5).map((r, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="font-medium text-gray-800">{r.voucher_code}</p>
                        <p className="text-xs text-gray-500">{new Date(r.redeemed_at).toLocaleString('de-DE')}</p>
                      </div>
                      <span className="text-green-600 font-bold">+€{r.voucher_value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">Noch keine Einlösungen</p>
              )}
            </div>
          </div>
        )}

        {/* Scanner View */}
        {view === 'scanner' && (
          <div className="space-y-4">
            {/* Camera Scanner */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Camera className="w-5 h-5" />
                QR-Code scannen
              </h3>
              
              <div 
                id="qr-reader" 
                ref={scannerRef}
                className="w-full aspect-square bg-gray-100 rounded-lg overflow-hidden mb-4"
                style={{ display: scanning ? 'block' : 'none' }}
              />
              
              {!scanning && !scanResult && (
                <Button onClick={startScanner} className="w-full bg-amber-500 hover:bg-amber-600">
                  <Camera className="w-4 h-4 mr-2" />
                  Kamera starten
                </Button>
              )}
              
              {scanning && (
                <Button onClick={stopScanner} variant="outline" className="w-full">
                  Scannen beenden
                </Button>
              )}
            </div>
            
            {/* Manual Input */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-4">Oder Code manuell eingeben</h3>
              <form onSubmit={handleManualValidate} className="flex gap-2">
                <Input
                  placeholder="Gutschein-Code (z.B. TEST-ABCD12)"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  className="flex-1"
                />
                <Button type="submit" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Prüfen'}
                </Button>
              </form>
            </div>
            
            {/* Scan Result */}
            {scanResult && (
              <div className={`rounded-xl p-6 shadow-sm ${scanResult.valid ? 'bg-green-50 border-2 border-green-500' : 'bg-red-50 border-2 border-red-500'}`}>
                <div className="flex items-center gap-4 mb-4">
                  {scanResult.valid ? (
                    <CheckCircle className="w-12 h-12 text-green-500" />
                  ) : (
                    <AlertCircle className="w-12 h-12 text-red-500" />
                  )}
                  <div>
                    <h3 className="text-xl font-bold">
                      {scanResult.valid ? 'Gültiger Gutschein!' : 'Ungültiger Gutschein'}
                    </h3>
                    <p className="text-gray-600">{scanResult.code}</p>
                  </div>
                </div>
                
                {scanResult.valid && (
                  <>
                    <div className="bg-white rounded-lg p-4 mb-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-gray-500 text-sm">Wert</p>
                          <p className="text-2xl font-bold text-green-600">€{scanResult.value}</p>
                        </div>
                        {scanResult.discount_percent > 0 && (
                          <div>
                            <p className="text-gray-500 text-sm">Rabatt</p>
                            <p className="text-2xl font-bold text-amber-600">{scanResult.discount_percent}%</p>
                          </div>
                        )}
                      </div>
                      {scanResult.description && (
                        <p className="text-gray-600 mt-2">{scanResult.description}</p>
                      )}
                    </div>
                    
                    <Button 
                      onClick={handleRedeem}
                      className="w-full h-14 bg-green-500 hover:bg-green-600 text-lg"
                      disabled={redeeming}
                    >
                      {redeeming ? (
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      ) : (
                        <Check className="w-5 h-5 mr-2" />
                      )}
                      Gutschein einlösen
                    </Button>
                  </>
                )}
                
                {!scanResult.valid && (
                  <p className="text-red-600">{scanResult.error}</p>
                )}
                
                <Button 
                  variant="ghost" 
                  onClick={() => { setScanResult(null); setManualCode(''); }}
                  className="w-full mt-2"
                >
                  Neuen Gutschein scannen
                </Button>
              </div>
            )}
          </div>
        )}

        {/* History View */}
        {view === 'history' && (
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-4 border-b">
              <h3 className="font-bold text-gray-800">Einlösungs-Verlauf</h3>
            </div>
            {history.length > 0 ? (
              <div className="divide-y">
                {history.map((r, i) => (
                  <div key={i} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800">{r.voucher_code}</p>
                      <p className="text-sm text-gray-500">{new Date(r.redeemed_at).toLocaleString('de-DE')}</p>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        r.payout_status === 'paid' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {r.payout_status === 'paid' ? 'Ausgezahlt' : 'Ausstehend'}
                      </span>
                    </div>
                    <span className="text-xl font-bold text-green-600">€{r.voucher_value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Noch keine Einlösungen</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
