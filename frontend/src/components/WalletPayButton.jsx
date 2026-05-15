/**
 * Apple Pay & Google Pay Integration
 * Quick Payment mit Wallet-Buttons
 */
import { useState } from "react";
import { PaymentRequestButtonElement, useStripe } from "@stripe/react-stripe-js";
import { toast } from "sonner";
import { Smartphone, Loader2 } from "lucide-react";

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

export default function WalletPayButton({ amount, currency = "eur", description, onSuccess }) {
  const stripe = useStripe();
  const [paymentRequest, setPaymentRequest] = useState(null);
  const [loading, setLoading] = useState(false);

  // Initialize Payment Request
  useState(() => {
    if (!stripe) return;

    const pr = stripe.paymentRequest({
      country: "DE",
      currency: currency.toLowerCase(),
      total: {
        label: description || "BidBlitz Payment",
        amount: Math.round(amount * 100), // Cent
      },
      requestPayerName: true,
      requestPayerEmail: true,
    });

    // Check if Apple Pay / Google Pay is available
    pr.canMakePayment().then((result) => {
      if (result) {
        setPaymentRequest(pr);
      }
    });

    // Handle payment
    pr.on("paymentmethod", async (ev) => {
      setLoading(true);
      try {
        // Create Payment Intent im Backend
        const res = await api("/api/express-checkout/wallet-payment", {
          method: "POST",
          body: JSON.stringify({
            amount,
            currency,
            description,
            payment_method_id: ev.paymentMethod.id,
          }),
        });

        if (res.status === "succeeded") {
          ev.complete("success");
          toast.success(`Zahlung erfolgreich: €${amount}`);
          onSuccess?.(res);
        } else {
          ev.complete("fail");
          toast.error("Zahlung fehlgeschlagen");
        }
      } catch (err) {
        ev.complete("fail");
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    });
  }, [stripe, amount, currency, description, onSuccess]);

  if (!paymentRequest) {
    return null; // Apple Pay / Google Pay nicht verfügbar
  }

  return (
    <div className="w-full">
      {loading && (
        <div className="mb-2 flex items-center justify-center gap-2 text-sm text-gray-600">
          <Loader2 size={16} className="animate-spin" />
          Zahlung wird verarbeitet...
        </div>
      )}
      <PaymentRequestButtonElement
        options={{
          paymentRequest,
          style: {
            paymentRequestButton: {
              type: "default",
              theme: "dark",
              height: "48px",
            },
          },
        }}
      />
    </div>
  );
}

/**
 * Fallback Manual Wallet-Button wenn Payment Request nicht verfügbar
 */
export function WalletPayFallback({ amount, description, onPay }) {
  return (
    <button
      onClick={onPay}
      className="w-full py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 flex items-center justify-center gap-2"
    >
      <Smartphone size={20} />
      Mit Wallet zahlen • €{amount.toFixed(2)}
    </button>
  );
}
