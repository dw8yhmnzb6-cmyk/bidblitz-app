import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import RideServices from "../components/RideServices";
import BottomNav from "../components/BottomNav";

export default function Ride() {
  const navigate = useNavigate();
  const [activeRide, setActiveRide] = useState(null);

  const recentRides = [
    { id: 1, type: "Taxi", from: "Hauptbahnhof", to: "Flughafen", cost: 85, date: "Heute" },
    { id: 2, type: "Scooter", from: "Mall", to: "Park", cost: 12, date: "Gestern" },
    { id: 3, type: "Bike", from: "Home", to: "Büro", cost: 8, date: "Mo, 3. März" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24">
      <div className="p-5 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-2xl">←</button>
          <h1 className="text-2xl font-bold">Mobilität</h1>
        </div>

        {/* Active Ride */}
        {activeRide && (
          <div className="bg-green-600 p-5 rounded-2xl">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm opacity-80">Aktive Fahrt</p>
                <p className="text-xl font-bold">{activeRide.type}</p>
              </div>
              <button className="bg-white text-green-600 px-4 py-2 rounded-xl font-medium">
                Beenden
              </button>
            </div>
          </div>
        )}

        {/* Ride Services */}
        <RideServices />

        {/* Map Preview */}
        <div className="bg-slate-800 rounded-2xl overflow-hidden">
          <div className="h-40 bg-slate-700 flex items-center justify-center">
            <span className="text-5xl">🗺️</span>
          </div>
          <div className="p-4">
            <p className="text-sm text-slate-400">Fahrzeuge in der Nähe</p>
            <div className="flex gap-4 mt-2">
              <span>🚕 3</span>
              <span>🛴 12</span>
              <span>🚲 8</span>
            </div>
          </div>
        </div>

        {/* Recent Rides */}
        <div className="bg-slate-800 rounded-2xl p-4">
          <h3 className="font-bold mb-4">Letzte Fahrten</h3>
          
          <div className="space-y-3">
            {recentRides.map((ride) => (
              <div key={ride.id} className="flex justify-between items-center py-2 border-b border-slate-700 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {ride.type === "Taxi" ? "🚕" : ride.type === "Scooter" ? "🛴" : "🚲"}
                  </span>
                  <div>
                    <p className="font-medium">{ride.from} → {ride.to}</p>
                    <p className="text-xs text-slate-400">{ride.date}</p>
                  </div>
                </div>
                <p className="font-bold">{ride.cost} 🪙</p>
              </div>
            ))}
          </div>
        </div>

      </div>

      <BottomNav />
    </div>
  );
}
