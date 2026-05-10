/**
 * EVStartChargingPage — Customer entry from QR-code or NFC tap.
 * URL pattern: /ev/start/:charge_point_id/:connector_id
 *
 * Flow: load station detail → show tariff → confirm → POST /api/ev/start →
 * navigate to /ev/session/:session_id (live view).
 */
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

export default function EVStartChargingPage({ chargePointId, connectorId, onNavigate }) {
  const [station, setStation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [maxAmount, setMaxAmount] = useState(50);
  const [walletBalance, setWalletBalance] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`${API}/api/ev/station/${chargePointId}`, { credentials: "include" });
        if (!r.ok) throw new Error("404");
        const s = await r.json();
        if (alive) setStation(s);
      } catch (e) {
        if (alive) setError("Station nicht gefunden");
      } finally {
        if (alive) setLoading(false);
      }
      try {
        const r = await fetch(`${API}/api/wallet/`, { credentials: "include" });
        if (r.ok) {
          const w = await r.json();
          if (alive) setWalletBalance(w?.balance ?? null);
        }
      } catch {}
    })();
    return () => { alive = false; };
  }, [chargePointId]);

  const startCharging = async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/ev/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          charge_point_id: chargePointId,
          connector_id: Number(connectorId) || 1,
          max_amount: Number(maxAmount),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Start fehlgeschlagen");
      toast.success("Ladevorgang gestartet");
      onNavigate(`/ev/session/${data.session_id}`);
    } catch (e) {
      setError(e.message);
      toast.error(e.message);
    } finally {
      setStarting(false);
    }
  };

  const connector = station?.connectors?.find(
    (c) => Number(c.connector_id) === Number(connectorId)
  );
  const tariff = station?.tariff || station?.station?.tariff;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white flex items-center justify-center">
        <p className="text-gray-400">Lade Station…</p>
      </div>
    );
  }

  if (!station) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white p-6 flex flex-col items-center justify-center">
        <p className="text-red-400 mb-4">{error || "Station unbekannt"}</p>
        <button
          onClick={() => onNavigate("/")}
          className="px-5 py-2 rounded-xl bg-cyan-500 text-white font-semibold"
          data-testid="ev-back-home"
        >
          Zur Startseite
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24">
      <div className="px-5 pt-12 pb-6">
        <button onClick={() => onNavigate("/")} className="text-gray-400 text-sm" data-testid="ev-close">
          ← Zurück
        </button>
        <h1 className="text-2xl font-bold mt-3" data-testid="ev-station-name">
          {station.station?.name || "Ladestation"}
        </h1>
        <p className="text-sm text-gray-400">
          {station.station?.location?.address}
        </p>

        <div className="mt-6 p-4 rounded-2xl bg-white/5 border border-white/10">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs text-gray-400 uppercase tracking-wider">Stecker</span>
            <span
              className={`text-[11px] font-bold px-2 py-1 rounded-full ${
                connector?.status === "Available"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-yellow-500/20 text-yellow-400"
              }`}
              data-testid="ev-connector-status"
            >
              {connector?.status || "—"}
            </span>
          </div>
          <p className="text-lg font-semibold">Stecker #{connectorId}</p>
          <p className="text-xs text-gray-500 mt-1">
            CP-ID: {chargePointId} · {station.online ? "online" : "offline"}
          </p>
        </div>

        {tariff && (
          <div className="mt-4 p-4 rounded-2xl bg-cyan-500/5 border border-cyan-500/20">
            <p className="text-[10px] text-cyan-400 uppercase tracking-wider font-semibold mb-2">Tarif</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-400">Pro kWh:</span><span className="font-bold ml-2" data-testid="ev-tariff-kwh">€{Number(tariff.price_per_kwh || 0).toFixed(2)}</span></div>
              <div><span className="text-gray-400">Sessiongebühr:</span><span className="font-bold ml-2">€{Number(tariff.session_fee || 0).toFixed(2)}</span></div>
              {Number(tariff.price_per_minute) > 0 && (
                <div><span className="text-gray-400">Pro Minute:</span><span className="font-bold ml-2">€{Number(tariff.price_per_minute).toFixed(2)}</span></div>
              )}
              {Number(tariff.minimum_fee) > 0 && (
                <div><span className="text-gray-400">Mindestbetrag:</span><span className="font-bold ml-2">€{Number(tariff.minimum_fee).toFixed(2)}</span></div>
              )}
            </div>
          </div>
        )}

        <div className="mt-5">
          <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Maximalbetrag (Reservierung)</label>
          <div className="flex items-center mt-2 bg-white/5 rounded-xl border border-white/10 px-4 py-3">
            <span className="text-gray-400 mr-2">€</span>
            <input
              type="number"
              min="1"
              max="500"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              className="flex-1 bg-transparent text-white text-lg font-semibold outline-none"
              data-testid="ev-max-amount"
            />
          </div>
          {walletBalance != null && (
            <p className="text-xs text-gray-500 mt-2">
              Wallet-Guthaben: €{walletBalance.toFixed(2)}
            </p>
          )}
        </div>

        {error && (
          <p className="mt-4 text-red-400 text-sm" data-testid="ev-error">{error}</p>
        )}

        <motion.button
          whileTap={{ scale: 0.97 }}
          disabled={starting || connector?.status === "Charging" || connector?.status === "Faulted" || !station.online}
          onClick={startCharging}
          className="mt-6 w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 text-black font-bold text-lg disabled:opacity-50"
          data-testid="ev-start-btn"
        >
          {starting ? "Wird gestartet…" : "Jetzt laden"}
        </motion.button>

        <p className="text-[11px] text-gray-500 text-center mt-3">
          Du wirst per OCPP autorisiert. Abrechnung über BidBlitz Wallet.
        </p>
      </div>
    </div>
  );
}
