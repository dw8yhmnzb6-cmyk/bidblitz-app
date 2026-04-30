import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { loadStripe } from '@stripe/stripe-js';
import { toast } from 'sonner';

/**
 * AppleGooglePayButton — Stripe Payment Request API
 * Zeigt Apple Pay / Google Pay / Browser Payment Button
 */
export default function AppleGooglePayButton({ amount, currency = 'eur', description, metadata = {}, onSuccess, onError }) {
  const [paymentRequest, setPaymentRequest] = useState(null);
  const [canMakePayment, setCanMakePayment] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    initializePaymentRequest();
  }, [amount]);

  const initializePaymentRequest = async () => {
    try {
      // Load Stripe (use your publishable key)
      const stripe = await loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || 'pk_test_51QdVlDE4hEPqvF5m9w8u0JLH6YxQcGa5qUJJh0123');

      if (!stripe) {
        console.error('Stripe failed to load');
        return;
      }

      // Create Payment Request
      const pr = stripe.paymentRequest({
        country: 'DE',
        currency: currency.toLowerCase(),
        total: {
          label: description || 'BidBlitz Payment',
          amount: Math.round(amount * 100), // Convert to cents
        },
        requestPayerName: true,
        requestPayerEmail: true,
      });

      // Check if Apple Pay / Google Pay is available
      const result = await pr.canMakePayment();
      if (result) {
        setCanMakePayment(true);
        setPaymentRequest(pr);

        // Handle payment method
        pr.on('paymentmethod', async (ev) => {
          setLoading(true);

          try {
            // Create Payment Intent on backend
            const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/payments/create-payment-intent`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                amount,
                currency,
                description,
                metadata,
              }),
            });

            if (!res.ok) {
              throw new Error('Failed to create payment intent');
            }

            const { client_secret } = await res.json();

            // Confirm payment
            const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
              client_secret,
              {
                payment_method: ev.paymentMethod.id,
              },
              { handleActions: false }
            );

            if (confirmError) {
              ev.complete('fail');
              toast.error(confirmError.message);
              onError?.(confirmError);
            } else {
              ev.complete('success');
              
              // Handle different payment states
              if (paymentIntent.status === 'requires_action') {
                // Let Stripe handle 3D Secure
                const { error } = await stripe.confirmCardPayment(client_secret);
                if (error) {
                  toast.error(error.message);
                  onError?.(error);
                } else {
                  toast.success('Zahlung erfolgreich!');
                  onSuccess?.(paymentIntent);
                }
              } else if (paymentIntent.status === 'succeeded') {
                toast.success('Zahlung erfolgreich!');
                onSuccess?.(paymentIntent);
              }
            }
          } catch (err) {
            ev.complete('fail');
            toast.error('Zahlung fehlgeschlagen');
            onError?.(err);
          } finally {
            setLoading(false);
          }
        });
      }
    } catch (err) {
      console.error('Payment Request initialization failed:', err);
    }
  };

  if (!canMakePayment) {
    return null; // Don't show button if Apple/Google Pay not available
  }

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={async () => {
        if (paymentRequest && !loading) {
          paymentRequest.show();
        }
      }}
      disabled={loading}
      className="w-full py-4 bg-black border border-white/20 rounded-2xl font-bold text-white flex items-center justify-center gap-3 hover:bg-black/90 transition-all disabled:opacity-50"
    >
      {loading ? (
        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : (
        <>
          {/* Apple Pay Icon */}
          <svg className="w-12 h-12" viewBox="0 0 48 48" fill="currentColor">
            <path d="M35.2 18.4c-.3.3-2.8 1.6-2.8 4.9 0 3.8 3.4 5.2 3.5 5.2 0 .1-.5 1.9-1.8 3.8-1.1 1.6-2.3 3.2-4.1 3.2-1.8 0-2.3-1-4.3-1-2 0-2.7 1.1-4.3 1.1-1.7 0-3-1.5-4.2-3.3-1.4-2-2.5-5.1-2.5-8 0-4.7 3.1-7.2 6.1-7.2 1.6 0 3 1.1 4 1.1 1 0 2.6-1.2 4.5-1.2.7 0 3.3.1 5.1 2.4M30.4 11c.8-1 1.4-2.4 1.4-3.8 0-.2 0-.4-.1-.6-1.3.1-2.9.9-3.8 2-.7.9-1.4 2.2-1.4 3.6 0 .2 0 .4.1.5.1 0 .2.1.4.1 1.2 0 2.7-.8 3.4-1.8" />
          </svg>
          
          {/* Google Pay Icon */}
          <svg className="w-12 h-12" viewBox="0 0 48 48" fill="currentColor">
            <path d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5" fill="#EA4335"/>
            <path d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65" fill="#4285F4"/>
            <path d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19" fill="#FBBC05"/>
            <path d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48" fill="#34A853"/>
          </svg>
        </>
      )}
    </motion.button>
  );
}
