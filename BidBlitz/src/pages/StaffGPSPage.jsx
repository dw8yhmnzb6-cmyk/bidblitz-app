/**
 * Staff GPS Tracking Page — Live-Standorte aller Mitarbeiter
 */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ChevronLeft, MapPin, Users, RefreshCw, Loader2,
  Navigation, Clock,
} from "lucide-react";
import StaffGPSMap from "../components/StaffGPSMap";

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

export default function StaffGPSPage({ onBack }) {
  const [staffLocations, setStaffLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLocations();
    const interval = setInterval(loadLocations, 30000); // Update alle 30s
    return () => clearInterval(interval);
  }, []);

  const loadLocations = async () => {
    try {
      const res = await api("/api/staff/gps/staff-locations");
      setStaffLocations(res.staff_locations || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (ts) => {
    if (!ts) return "—";
    const d = new Date(ts);
    return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-green-50 to-blue-50 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-gray-200">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
            <ChevronLeft size={24} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">GPS-Tracking</h1>
            <p className="text-xs text-gray-600">
              {staffLocations.length} Mitarbeiter online
            </p>
          </div>
          <button
            onClick={loadLocations}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <RefreshCw size={20} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin text-green-600" />
          </div>
        )}

        {!loading && staffLocations.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Users size={48} className="mx-auto mb-2 opacity-50" />
            <p>Keine Mitarbeiter online</p>
            <p className="text-xs mt-1">GPS-Tracking muss aktiviert sein</p>
          </div>
        )}

        <div className="space-y-3">
          {staffLocations.map((staff) => (
            <motion.div
              key={staff.staff_id}
              className="bg-white rounded-xl p-4 shadow-sm border border-gray-200"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <MapPin size={20} className="text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{staff.user_name || "Mitarbeiter"}</p>
                  <p className="text-xs text-gray-500">{staff.user_email || staff.staff_id}</p>
                  
                  {staff.last_location && (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Navigation size={14} />
                        <span>
                          {staff.last_location.lat.toFixed(4)}, {staff.last_location.lng.toFixed(4)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Clock size={14} />
                        <span>
                          Zuletzt: {formatTime(staff.last_location.updated_at)}
                        </span>
                      </div>
                      {staff.last_location.accuracy && (
                        <p className="text-xs text-gray-500">
                          Genauigkeit: ±{Math.round(staff.last_location.accuracy)}m
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Map Placeholder */}
        {staffLocations.length > 0 && (
          <div className="mt-6">
            <StaffGPSMap staffLocations={staffLocations} />
          </div>
        )}
      </div>
    </div>
  );
}
