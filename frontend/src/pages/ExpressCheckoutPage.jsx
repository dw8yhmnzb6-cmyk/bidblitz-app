/**
 * Express Checkout Page — 1-Klick-Zahlung
 * Gespeicherte Karten & Adressen verwalten
 */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ChevronLeft, CreditCard, MapPin, Plus, Check, Trash2,
  Star, Loader2,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

async function api(path, opts = {}) {
  const r = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || "Fehler");
  return d;
}

export default function ExpressCheckoutPage({ onBack }) {
  const [tab, setTab] = useState("cards"); // cards | addresses
  const [cards, setCards] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddCard, setShowAddCard] = useState(false);
  const [showAddAddress, setShowAddAddress] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [c, a] = await Promise.all([
        api("/api/express-checkout/payment-methods"),
        api("/api/express-checkout/addresses"),
      ]);
      setCards(c.payment_methods || []);
      setAddresses(a.addresses || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteCard = async (id) => {
    try {
      await api(`/api/express-checkout/payment-methods/${id}`, { method: "DELETE" });
      toast.success("Karte gelöscht");
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const setDefaultCard = async (id) => {
    try {
      await api(`/api/express-checkout/payment-methods/${id}/set-default`, { method: "POST" });
      toast.success("Standard-Karte gesetzt");
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const deleteAddress = async (id) => {
    try {
      await api(`/api/express-checkout/addresses/${id}`, { method: "DELETE" });
      toast.success("Adresse gelöscht");
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const setDefaultAddress = async (id) => {
    try {
      await api(`/api/express-checkout/addresses/${id}/set-default`, { method: "POST" });
      toast.success("Standard-Adresse gesetzt");
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-gray-200">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
            <ChevronLeft size={24} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Express Checkout</h1>
            <p className="text-xs text-gray-600">Gespeicherte Zahlungsmethoden & Adressen</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-gray-200">
          <button
            onClick={() => setTab("cards")}
            className={`flex-1 py-3 text-sm font-medium transition ${
              tab === "cards"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600"
            }`}
          >
            <CreditCard size={16} className="inline mr-1" />
            Karten
          </button>
          <button
            onClick={() => setTab("addresses")}
            className={`flex-1 py-3 text-sm font-medium transition ${
              tab === "addresses"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600"
            }`}
          >
            <MapPin size={16} className="inline mr-1" />
            Adressen
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin text-blue-600" />
          </div>
        )}

        {!loading && tab === "cards" && (
          <div>
            <div className="mb-4 flex justify-between items-center">
              <h2 className="text-lg font-bold">Gespeicherte Karten</h2>
              <button
                onClick={() => setShowAddCard(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-1"
              >
                <Plus size={16} />
                Hinzufügen
              </button>
            </div>

            {cards.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <CreditCard size={48} className="mx-auto mb-2 opacity-50" />
                <p>Keine Karten gespeichert</p>
              </div>
            )}

            <div className="space-y-3">
              {cards.map((card) => (
                <motion.div
                  key={card.id}
                  className="bg-white rounded-xl p-4 shadow-sm border border-gray-200"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CreditCard size={20} className="text-blue-600" />
                      <span className="font-medium">{card.card_number_masked}</span>
                      {card.is_default && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full flex items-center gap-1">
                          <Star size={12} fill="currentColor" />
                          Standard
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => deleteCard(card.id)}
                      className="p-2 hover:bg-red-50 rounded-full text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <p className="text-sm text-gray-600">{card.card_holder}</p>
                  <p className="text-xs text-gray-500">Gültig bis: {card.expiry}</p>
                  {!card.is_default && (
                    <button
                      onClick={() => setDefaultCard(card.id)}
                      className="mt-2 text-xs text-blue-600 hover:underline"
                    >
                      Als Standard setzen
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {!loading && tab === "addresses" && (
          <div>
            <div className="mb-4 flex justify-between items-center">
              <h2 className="text-lg font-bold">Gespeicherte Adressen</h2>
              <button
                onClick={() => setShowAddAddress(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-1"
              >
                <Plus size={16} />
                Hinzufügen
              </button>
            </div>

            {addresses.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <MapPin size={48} className="mx-auto mb-2 opacity-50" />
                <p>Keine Adressen gespeichert</p>
              </div>
            )}

            <div className="space-y-3">
              {addresses.map((addr) => (
                <motion.div
                  key={addr.id}
                  className="bg-white rounded-xl p-4 shadow-sm border border-gray-200"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <MapPin size={20} className="text-green-600" />
                      <span className="font-medium">{addr.label}</span>
                      {addr.is_default && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full flex items-center gap-1">
                          <Check size={12} />
                          Standard
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => deleteAddress(addr.id)}
                      className="p-2 hover:bg-red-50 rounded-full text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <p className="text-sm text-gray-700">{addr.street}</p>
                  <p className="text-sm text-gray-600">
                    {addr.zip_code} {addr.city}, {addr.country}
                  </p>
                  {!addr.is_default && (
                    <button
                      onClick={() => setDefaultAddress(addr.id)}
                      className="mt-2 text-xs text-green-600 hover:underline"
                    >
                      Als Standard setzen
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Card Modal (Placeholder) */}
      {showAddCard && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Karte hinzufügen</h3>
            <p className="text-sm text-gray-600 mb-4">
              Integration mit Stripe/PayPal folgt
            </p>
            <button
              onClick={() => setShowAddCard(false)}
              className="w-full py-2 bg-gray-200 rounded-lg"
            >
              Schließen
            </button>
          </div>
        </div>
      )}

      {/* Add Address Modal (Placeholder) */}
      {showAddAddress && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Adresse hinzufügen</h3>
            <p className="text-sm text-gray-600 mb-4">Formular folgt</p>
            <button
              onClick={() => setShowAddAddress(false)}
              className="w-full py-2 bg-gray-200 rounded-lg"
            >
              Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
