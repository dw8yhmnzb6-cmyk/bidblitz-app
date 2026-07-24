/**
 * QR Check-in Scanner
 * ===================
 * QR Code Scanner für schnellen Check-in
 */
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { QrCode, Camera, Loader2, CheckCircle, XCircle, ArrowLeft } from "lucide-react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

export default function QrCheckinScanner({ onBack, onSuccess }) {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let scanner = null;

    if (scanning) {
      scanner = new Html5QrcodeScanner(
        "qr-reader",
        { 
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        false
      );

      scanner.render(onScanSuccess, onScanError);
    }

    return () => {
      if (scanner) {
        scanner.clear().catch(console.error);
      }
    };
  }, [scanning]);

  const onScanSuccess = async (decodedText) => {
    setScanning(false);
    
    // Extract token from URL or use direct token
    let token = decodedText;
    if (decodedText.includes("token=")) {
      const url = new URL(decodedText, window.location.origin);
      token = url.searchParams.get("token");
    }

    // Scan QR and check-in
    try {
      const res = await fetch(`${API}/api/staff/qr/scan?token=${token}&action=clock_in`, {
        method: "POST",
        credentials: "include"
      });

      const data = await res.json();

      if (res.ok) {
        setResult(data);
        toast.success(`✓ ${data.staff_name} eingecheckt!`);
        if (onSuccess) onSuccess(data);
      } else {
        setError(data.detail || "Scan fehlgeschlagen");
        toast.error(data.detail || "QR Code ungültig");
      }
    } catch (err) {
      setError("Netzwerkfehler");
      toast.error("Netzwerkfehler");
    }
  };

  const onScanError = (err) => {
    // Ignore scanning errors (camera not found, etc)
    if (err.includes("NotAllowedError")) {
      setError("Kamera-Zugriff verweigert");
      setScanning(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl hover:bg-white/5 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-base font-bold font-outfit">QR Check-in</h1>
            <p className="text-[10px] text-white/40">Scanne Mitarbeiter QR-Code</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        {!scanning && !result && !error && (
          <div className="text-center">
            <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-[#00C2FF]/10 flex items-center justify-center">
              <QrCode size={48} className="text-[#00C2FF]" />
            </div>
            <h2 className="text-xl font-bold mb-2">QR Check-in</h2>
            <p className="text-sm text-white/60 mb-6 max-w-xs mx-auto">
              Mitarbeiter scannen ihren QR-Code für schnellen Check-in
            </p>
            <button
              onClick={() => setScanning(true)}
              className="px-6 py-3 rounded-xl bg-[#00C2FF] text-black font-semibold hover:bg-[#00A8E0] transition-colors flex items-center gap-2 mx-auto"
            >
              <Camera size={20} />
              Kamera starten
            </button>
          </div>
        )}

        {scanning && (
          <div className="w-full max-w-md">
            <div id="qr-reader" className="rounded-2xl overflow-hidden" />
            <button
              onClick={() => setScanning(false)}
              className="w-full mt-4 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium transition-colors"
            >
              Abbrechen
            </button>
          </div>
        )}

        {result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle size={48} className="text-green-400" />
            </div>
            <h2 className="text-xl font-bold mb-2">Erfolgreich!</h2>
            <p className="text-sm text-white/60 mb-2">{result.staff_name}</p>
            <p className="text-lg font-semibold text-green-400 mb-6">{result.message}</p>
            <button
              onClick={() => {
                setResult(null);
                setScanning(true);
              }}
              className="px-6 py-3 rounded-xl bg-[#00C2FF] text-black font-semibold hover:bg-[#00A8E0] transition-colors"
            >
              Nächster Scan
            </button>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
              <XCircle size={48} className="text-red-400" />
            </div>
            <h2 className="text-xl font-bold mb-2">Fehler</h2>
            <p className="text-sm text-red-400 mb-6">{error}</p>
            <button
              onClick={() => {
                setError(null);
                setScanning(true);
              }}
              className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 font-semibold transition-colors"
            >
              Erneut versuchen
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
