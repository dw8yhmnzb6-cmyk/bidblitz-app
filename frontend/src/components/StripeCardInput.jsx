/**
 * Stripe Card Input Component
 * Sichere Karteneingabe mit Stripe Elements
 */
import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { toast } from "sonner";
import { Loader2, CreditCard, Check } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;
const STRIPE_PUBLISHABLE_KEY = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || "pk_test_placeholder";

const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

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

function CardInputForm({ onSuccess, onCancel }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [isDefault, setIsDefault] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);

    try {
      // Setup Intent vom Backend holen
      const { client_secret } = await api("/api/express-checkout/stripe/setup-intent");

      // Karte mit Stripe bestätigen
      const { error, setupIntent } = await stripe.confirmCardSetup(client_secret, {
        payment_method: {
          card: elements.getElement(CardElement),
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      // Payment Method im Backend speichern
      await api("/api/express-checkout/stripe/save-payment-method", {
        method: "POST",
        body: JSON.stringify({
          stripe_token: setupIntent.payment_method,
          is_default: isDefault,
        }),
      });

      toast.success("Karte erfolgreich gespeichert");
      onSuccess();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-300">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: "16px",
                color: "#424770",
                "::placeholder": {
                  color: "#aab7c4",
                },
              },
              invalid: {
                color: "#9e2146",
              },
            },
          }}
        />
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          className="w-4 h-4 text-blue-600 rounded"
        />
        <span className="text-sm text-gray-700">Als Standard-Karte setzen</span>
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="flex-1 py-3 bg-gray-200 rounded-lg font-medium hover:bg-gray-300 disabled:opacity-50"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={!stripe || loading}
          className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <CreditCard size={20} />
          )}
          Speichern
        </button>
      </div>
    </form>
  );
}

export default function StripeCardInput({ onSuccess, onCancel }) {
  return (
    <Elements stripe={stripePromise}>
      <CardInputForm onSuccess={onSuccess} onCancel={onCancel} />
    </Elements>
  );
}

/**
 * Quick Payment Component
 * Schnelle Zahlung mit gespeicherter Karte
 */
export function QuickPayment({ amount, description, paymentMethodId, onSuccess }) {
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    setLoading(true);
    try {
      const res = await api("/api/express-checkout/stripe/charge", {
        method: "POST",
        body: JSON.stringify({
          payment_method_id: paymentMethodId,
          amount,
          currency: "eur",
          description,
        }),
      });

      if (res.status === "succeeded") {
        toast.success(`Zahlung erfolgreich: €${amount}`);
        onSuccess?.(res);
      } else {
        toast.warning(`Zahlung Status: ${res.status}`);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handlePayment}
      disabled={loading}
      className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
    >
      {loading ? (
        <Loader2 size={20} className="animate-spin" />
      ) : (
        <Check size={20} />
      )}
      Jetzt zahlen: €{amount.toFixed(2)}
    </button>
  );
}
