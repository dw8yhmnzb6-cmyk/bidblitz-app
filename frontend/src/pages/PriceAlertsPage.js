import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { 
  Bell, BellOff, Trash2, Edit, Plus, Target, 
  CheckCircle, AlertTriangle, MessageSquare, Mail, Smartphone
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const PriceAlertsPage = () => {
  const { token, isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingAlert, setEditingAlert] = useState(null);

  const texts = {
    de: {
      title: 'Schnäppchen-Alarm',
      subtitle: 'Werde benachrichtigt wenn Auktionen deinen Wunschpreis erreichen',
      noAlerts: 'Keine Alarme eingerichtet',
      noAlertsDesc: 'Gehe zu einer Auktion und setze einen Preisalarm!',
      targetPrice: 'Zielpreis',
      product: 'Produkt',
      status: 'Status',
      active: 'Aktiv',
      triggered: 'Ausgelöst',
      notifications: 'Benachrichtigungen',
      telegram: 'Telegram',
      email: 'E-Mail',
      push: 'Push',
      delete: 'Löschen',
      edit: 'Bearbeiten',
      save: 'Speichern',
      triggeredAt: 'Ausgelöst am',
      atPrice: 'bei',
      howItWorks: 'So funktioniert es',
      step1: 'Setze einen Zielpreis für ein Produkt',
      step2: 'Wenn der Auktionspreis unter deinem Ziel liegt, wirst du benachrichtigt',
      step3: 'Schnapp dir das Schnäppchen bevor es weg ist!',
      goToAuctions: 'Zu den Auktionen'
    },
    en: {
      title: 'Price Alerts',
      subtitle: 'Get notified when auctions reach your target price',
      noAlerts: 'No alerts set up',
      noAlertsDesc: 'Go to an auction and set a price alert!',
      targetPrice: 'Target Price',
      product: 'Product',
      status: 'Status',
      active: 'Active',
      triggered: 'Triggered',
      notifications: 'Notifications',
      telegram: 'Telegram',
      email: 'Email',
      push: 'Push',
      delete: 'Delete',
      edit: 'Edit',
      save: 'Save',
      triggeredAt: 'Triggered at',
      atPrice: 'at',
      howItWorks: 'How it Works',
      step1: 'Set a target price for a product',
      step2: 'When the auction price drops below your target, you get notified',
      step3: 'Grab the deal before it\'s gone!',
      goToAuctions: 'Go to Auctions'
    }
  };
  const t = texts[language] || texts.de;

  useEffect(() => {
    if (isAuthenticated) {
      fetchAlerts();
    }
  }, [isAuthenticated]);

  const fetchAlerts = async () => {
    try {
      const res = await axios.get(`${API}/api/alerts/my-alerts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAlerts(res.data.alerts || []);
    } catch (err) {
      console.error('Error fetching alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (alertId) => {
    try {
      await axios.delete(`${API}/api/alerts/${alertId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAlerts(alerts.filter(a => a.id !== alertId));
      toast.success('Alarm gelöscht');
    } catch (err) {
      toast.error('Fehler beim Löschen');
    }
  };

  const handleUpdate = async (alertId, updates) => {
    try {
      await axios.put(`${API}/api/alerts/${alertId}`, updates, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchAlerts();
      setEditingAlert(null);
      toast.success('Alarm aktualisiert');
    } catch (err) {
      toast.error('Fehler beim Aktualisieren');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#050509] py-8 px-4 flex items-center justify-center">
        <div className="text-center">
          <Bell className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl text-white mb-2">Bitte anmelden</h2>
          <p className="text-gray-400">Du musst angemeldet sein um Preisalarme zu verwalten.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050509] py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-gray-800 rounded w-1/3"></div>
            <div className="h-32 bg-gray-800 rounded-xl"></div>
            <div className="h-32 bg-gray-800 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050509] py-8 px-4" data-testid="price-alerts-page">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/20 border border-yellow-500/30 mb-4">
            <Bell className="w-5 h-5 text-yellow-400" />
            <span className="text-yellow-400 font-bold">Alerts</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">{t.title}</h1>
          <p className="text-gray-400 text-lg">{t.subtitle}</p>
        </div>

        {/* How it Works */}
        <div className="glass-card rounded-xl p-6 mb-8 bg-gradient-to-r from-yellow-500/5 to-orange-500/5 border border-yellow-500/20">
          <h3 className="text-lg font-bold text-white mb-4">{t.howItWorks}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold">1</div>
              <p className="text-gray-300 text-sm">{t.step1}</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold">2</div>
              <p className="text-gray-300 text-sm">{t.step2}</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold">3</div>
              <p className="text-gray-300 text-sm">{t.step3}</p>
            </div>
          </div>
        </div>

        {/* Alerts List */}
        {alerts.length === 0 ? (
          <div className="glass-card rounded-xl p-12 text-center">
            <BellOff className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl text-white mb-2">{t.noAlerts}</h3>
            <p className="text-gray-400 mb-6">{t.noAlertsDesc}</p>
            <Button asChild>
              <a href="/auctions">{t.goToAuctions}</a>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map(alert => (
              <div 
                key={alert.id}
                className={`glass-card rounded-xl p-4 ${alert.triggered ? 'border-green-500/30' : 'border-yellow-500/30'}`}
                data-testid={`alert-${alert.id}`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Product Info */}
                  <div className="flex items-center gap-4">
                    {alert.product?.image_url ? (
                      <img 
                        src={alert.product.image_url} 
                        alt={alert.product_name}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-gray-800 flex items-center justify-center">
                        <Target className="w-8 h-8 text-gray-600" />
                      </div>
                    )}
                    <div>
                      <h4 className="text-white font-bold">{alert.product_name || 'Produkt'}</h4>
                      <p className="text-sm text-gray-400">
                        {t.targetPrice}: <span className="text-yellow-400 font-bold">€{alert.target_price?.toFixed(2)}</span>
                      </p>
                      {alert.triggered && (
                        <p className="text-xs text-green-400 mt-1">
                          {t.triggeredAt} {new Date(alert.triggered_at).toLocaleDateString()} {t.atPrice} €{alert.triggered_price?.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Status & Notifications */}
                  <div className="flex items-center gap-4">
                    {/* Status Badge */}
                    <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                      alert.triggered 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {alert.triggered ? (
                        <><CheckCircle className="w-3 h-3" /> {t.triggered}</>
                      ) : (
                        <><Bell className="w-3 h-3" /> {t.active}</>
                      )}
                    </div>

                    {/* Notification Icons */}
                    <div className="flex items-center gap-2">
                      {alert.notify_telegram && (
                        <MessageSquare className="w-4 h-4 text-blue-400" title={t.telegram} />
                      )}
                      {alert.notify_email && (
                        <Mail className="w-4 h-4 text-red-400" title={t.email} />
                      )}
                      {alert.notify_push && (
                        <Smartphone className="w-4 h-4 text-green-400" title={t.push} />
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(alert.id)}
                        className="text-red-400 border-red-400/30 hover:bg-red-400/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stats Summary */}
        {alerts.length > 0 && (
          <div className="glass-card rounded-xl p-4 mt-6">
            <div className="flex items-center justify-around text-center">
              <div>
                <p className="text-2xl font-bold text-white">{alerts.length}</p>
                <p className="text-xs text-gray-400">Alarme gesamt</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-400">
                  {alerts.filter(a => a.triggered).length}
                </p>
                <p className="text-xs text-gray-400">Ausgelöst</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-400">
                  {alerts.filter(a => !a.triggered).length}
                </p>
                <p className="text-xs text-gray-400">Aktiv</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PriceAlertsPage;
