/**
 * Express Checkout Page — 1-Klick-Zahlung
 * Gespeicherte Karten & Adressen verwalten
 */
import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ChevronLeft, CreditCard, MapPin, Plus, Check, Trash2,
  Star, Loader2,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const createEmptyCardForm = (isDefault = false) => ({
  card_holder: "",
  card_number: "",
  expiry: "",
  is_default: isDefault,
});

const createEmptyAddressForm = (isDefault = false) => ({
  label: "",
  street: "",
  city: "",
  zip_code: "",
  country: "DE",
  is_default: isDefault,
});

const detectCardType = (digits) => {
  if (/^4/.test(digits)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "mastercard";
  if (/^3[47]/.test(digits)) return "amex";
  return "card";
};

const formatCardNumber = (value) => value.replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim();

const formatExpiry = (value) => {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
};

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
  const [savingCard, setSavingCard] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [cardForm, setCardForm] = useState(createEmptyCardForm(false));
  const [addressForm, setAddressForm] = useState(createEmptyAddressForm(false));

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

  const normalizedCardNumber = useMemo(() => cardForm.card_number.replace(/\D/g, ""), [cardForm.card_number]);
  const isCardFormValid = useMemo(() => (
    cardForm.card_holder.trim().length >= 3 &&
    normalizedCardNumber.length >= 12 &&
    /^\d{2}\/\d{2}$/.test(cardForm.expiry)
  ), [cardForm.card_holder, cardForm.expiry, normalizedCardNumber]);

  const isAddressFormValid = useMemo(() => (
    Boolean(
      addressForm.label.trim() &&
      addressForm.street.trim() &&
      addressForm.city.trim() &&
      addressForm.zip_code.trim() &&
      addressForm.country.trim()
    )
  ), [addressForm.label, addressForm.street, addressForm.city, addressForm.zip_code, addressForm.country]);

  const handleCreateCard = async () => {
    if (!isCardFormValid) {
      toast.error("Bitte alle Kartenfelder korrekt ausfüllen");
      return;
    }
    setSavingCard(true);
    try {
      await api("/api/express-checkout/payment-methods", {
        method: "POST",
        body: JSON.stringify({
          card_number: normalizedCardNumber,
          card_holder: cardForm.card_holder.trim(),
          expiry: cardForm.expiry,
          card_type: detectCardType(normalizedCardNumber),
          is_default: cardForm.is_default,
        }),
      });
      toast.success("Karte gespeichert");
      setShowAddCard(false);
      setCardForm(createEmptyCardForm(cards.length === 0));
      loadData();
    } catch (err) {
      toast.error(err.message || "Karte konnte nicht gespeichert werden");
    } finally {
      setSavingCard(false);
    }
  };

  const handleCreateAddress = async () => {
    if (!isAddressFormValid) {
      toast.error("Bitte alle Adressfelder ausfüllen");
      return;
    }
    setSavingAddress(true);
    try {
      await api("/api/express-checkout/addresses", {
        method: "POST",
        body: JSON.stringify({
          label: addressForm.label.trim(),
          street: addressForm.street.trim(),
          city: addressForm.city.trim(),
          zip_code: addressForm.zip_code.trim(),
          country: addressForm.country.trim().toUpperCase(),
          is_default: addressForm.is_default,
        }),
      });
      toast.success("Adresse gespeichert");
      setShowAddAddress(false);
      setAddressForm(createEmptyAddressForm(addresses.length === 0));
      loadData();
    } catch (err) {
      toast.error(err.message || "Adresse konnte nicht gespeichert werden");
    } finally {
      setSavingAddress(false);
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
                onClick={() => {
                  setCardForm(createEmptyCardForm(cards.length === 0));
                  setShowAddCard(true);
                }}
                data-testid="express-add-card-button"
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
                      data-testid={`express-delete-card-${card.id}`}
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
                      data-testid={`express-set-default-card-${card.id}`}
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
                onClick={() => {
                  setAddressForm(createEmptyAddressForm(addresses.length === 0));
                  setShowAddAddress(true);
                }}
                data-testid="express-add-address-button"
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
                      data-testid={`express-delete-address-${addr.id}`}
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
                      data-testid={`express-set-default-address-${addr.id}`}
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

      {/* Add Card Modal */}
      {showAddCard && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md" data-testid="express-add-card-modal">
            <h3 className="text-lg font-bold mb-4">Karte hinzufügen</h3>
            <div className="space-y-3">
              <input
                value={cardForm.card_holder}
                onChange={(e) => setCardForm((prev) => ({ ...prev, card_holder: e.target.value }))}
                placeholder="Name auf der Karte"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                data-testid="express-card-holder-input"
              />
              <input
                value={cardForm.card_number}
                onChange={(e) => setCardForm((prev) => ({ ...prev, card_number: formatCardNumber(e.target.value) }))}
                placeholder="Kartennummer"
                inputMode="numeric"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                data-testid="express-card-number-input"
              />
              <input
                value={cardForm.expiry}
                onChange={(e) => setCardForm((prev) => ({ ...prev, expiry: formatExpiry(e.target.value) }))}
                placeholder="MM/JJ"
                inputMode="numeric"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                data-testid="express-card-expiry-input"
              />
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={cardForm.is_default}
                  onChange={(e) => setCardForm((prev) => ({ ...prev, is_default: e.target.checked }))}
                  data-testid="express-card-default-checkbox"
                />
                Als Standard-Karte setzen
              </label>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowAddCard(false)}
                  className="flex-1 py-3 bg-gray-200 rounded-lg font-medium"
                  data-testid="express-card-cancel-button"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleCreateCard}
                  disabled={!isCardFormValid || savingCard}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                  data-testid="express-card-save-button"
                >
                  {savingCard ? <Loader2 size={18} className="animate-spin" /> : null}
                  Speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddAddress && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md" data-testid="express-add-address-modal">
            <h3 className="text-lg font-bold mb-4">Adresse hinzufügen</h3>
            <div className="space-y-3">
              <input
                value={addressForm.label}
                onChange={(e) => setAddressForm((prev) => ({ ...prev, label: e.target.value }))}
                placeholder="Zuhause, Büro, Hotel ..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                data-testid="express-address-label-input"
              />
              <input
                value={addressForm.street}
                onChange={(e) => setAddressForm((prev) => ({ ...prev, street: e.target.value }))}
                placeholder="Straße und Hausnummer"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                data-testid="express-address-street-input"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={addressForm.zip_code}
                  onChange={(e) => setAddressForm((prev) => ({ ...prev, zip_code: e.target.value }))}
                  placeholder="PLZ"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                  data-testid="express-address-zip-input"
                />
                <input
                  value={addressForm.city}
                  onChange={(e) => setAddressForm((prev) => ({ ...prev, city: e.target.value }))}
                  placeholder="Stadt"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                  data-testid="express-address-city-input"
                />
              </div>
              <input
                value={addressForm.country}
                onChange={(e) => setAddressForm((prev) => ({ ...prev, country: e.target.value }))}
                placeholder="Land (z. B. DE)"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                data-testid="express-address-country-input"
              />
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={addressForm.is_default}
                  onChange={(e) => setAddressForm((prev) => ({ ...prev, is_default: e.target.checked }))}
                  data-testid="express-address-default-checkbox"
                />
                Als Standard-Adresse setzen
              </label>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowAddAddress(false)}
                  className="flex-1 py-3 bg-gray-200 rounded-lg font-medium"
                  data-testid="express-address-cancel-button"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleCreateAddress}
                  disabled={!isAddressFormValid || savingAddress}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                  data-testid="express-address-save-button"
                >
                  {savingAddress ? <Loader2 size={18} className="animate-spin" /> : null}
                  Speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
