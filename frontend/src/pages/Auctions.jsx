import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import AuctionCard from "../components/AuctionCard";
import BottomNav from "../components/BottomNav";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

export default function Auctions() {
  const navigate = useNavigate();
  const [auctions, setAuctions] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAuctions();
  }, [filter]);

  const fetchAuctions = async () => {
    try {
      const res = await axios.get(`${API}/auctions`, {
        params: { status: filter !== "all" ? filter : undefined },
      });
      setAuctions(res.data || []);
    } catch (error) {
      console.log("Auctions error");
    } finally {
      setLoading(false);
    }
  };

  const filters = [
    { id: "all", label: "Alle" },
    { id: "active", label: "Aktiv" },
    { id: "ending", label: "Bald endend" },
    { id: "new", label: "Neu" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24">
      <div className="p-5 space-y-5">

        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Auktionen</h1>
          <button
            onClick={() => navigate("/auction/create")}
            className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-xl text-sm font-medium transition"
          >
            + Erstellen
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition ${
                filter === f.id
                  ? "bg-purple-600 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Auctions Grid */}
        {loading ? (
          <div className="text-center py-10 text-slate-400">Lädt...</div>
        ) : auctions.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-5xl mb-4">🏷️</p>
            <p className="text-slate-400">Keine Auktionen gefunden</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {auctions.map((auction) => (
              <AuctionCard key={auction.id || auction._id} auction={auction} />
            ))}
          </div>
        )}

      </div>

      <BottomNav />
    </div>
  );
}
