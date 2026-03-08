import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import BottomNav from "../components/BottomNav";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API}/auth/me`, { headers });
      setUser(res.data);
    } catch (error) {
      console.log("Profile error");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const menuItems = [
    { icon: "👤", label: "Profil bearbeiten", path: "/profile/edit" },
    { icon: "🔔", label: "Benachrichtigungen", path: "/notifications" },
    { icon: "🔒", label: "Sicherheit", path: "/security" },
    { icon: "💳", label: "Zahlungsmethoden", path: "/payment-methods" },
    { icon: "🌐", label: "Sprache", path: "/settings" },
    { icon: "❓", label: "Hilfe & Support", path: "/support" },
    { icon: "📜", label: "AGB & Datenschutz", path: "/legal" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white">Lädt...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24">
      <div className="p-5 space-y-5">

        {/* Header */}
        <h1 className="text-2xl font-bold">Profil</h1>

        {/* User Card */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-5 rounded-2xl">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-3xl">
              {user?.name?.charAt(0) || "👤"}
            </div>
            <div>
              <p className="text-xl font-bold">{user?.name || "Benutzer"}</p>
              <p className="text-sm opacity-80">{user?.email || ""}</p>
            </div>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-5">
            <div className="text-center">
              <p className="text-2xl font-bold">{user?.coins || 0}</p>
              <p className="text-xs opacity-80">Coins</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{user?.bids || 0}</p>
              <p className="text-xs opacity-80">Gebote</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{user?.level || 1}</p>
              <p className="text-xs opacity-80">Level</p>
            </div>
          </div>
        </div>

        {/* Menu */}
        <div className="bg-slate-800 rounded-2xl overflow-hidden">
          {menuItems.map((item, idx) => (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-4 p-4 hover:bg-slate-700 transition text-left ${
                idx !== menuItems.length - 1 ? "border-b border-slate-700" : ""
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span>{item.label}</span>
              <span className="ml-auto text-slate-400">→</span>
            </button>
          ))}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full bg-red-600 hover:bg-red-700 p-4 rounded-xl font-medium transition"
        >
          🚪 Abmelden
        </button>

        {/* Version */}
        <p className="text-center text-slate-500 text-sm">
          BidBlitz v2.0.0
        </p>

      </div>

      <BottomNav />
    </div>
  );
}
