import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export default function FriendsPage({ onBack }) {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("friends"); // friends, requests, search
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState({ received: [], sent: [] });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const fetchFriends = async () => {
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/friends/list`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setFriends(data.friends);
        setLoading(false);
      }
    } catch (err) {
      toast.error("Fehler beim Laden");
      setLoading(false);
    }
  };

  const fetchRequests = async () => {
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/friends/requests`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (err) {
      toast.error("Fehler beim Laden");
    }
  };

  useEffect(() => {
    fetchFriends();
    fetchRequests();
  }, []);

  const handleSearch = async () => {
    if (searchQuery.length < 2) {
      toast.error("Mindestens 2 Zeichen eingeben");
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/friends/search?q=${encodeURIComponent(searchQuery)}`,
        { credentials: "include" }
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.users);
      }
    } catch (err) {
      toast.error("Fehler bei der Suche");
    }
    setSearchLoading(false);
  };

  const handleSendRequest = async (friendId) => {
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/friends/send-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ friend_id: friendId }),
      });
      if (res.ok) {
        toast.success("Anfrage gesendet");
        fetchRequests();
        handleSearch(); // Refresh search results
      } else {
        const err = await res.json();
        toast.error(err.detail || "Fehler");
      }
    } catch (err) {
      toast.error("Fehler");
    }
  };

  const handleAccept = async (requestId) => {
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/friends/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ request_id: requestId }),
      });
      if (res.ok) {
        toast.success("Freund hinzugefügt!");
        fetchFriends();
        fetchRequests();
      }
    } catch (err) {
      toast.error("Fehler");
    }
  };

  const handleDecline = async (requestId) => {
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/friends/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ request_id: requestId }),
      });
      if (res.ok) {
        toast.success("Anfrage abgelehnt");
        fetchRequests();
      }
    } catch (err) {
      toast.error("Fehler");
    }
  };

  const handleRemove = async (friendId) => {
    if (!window.confirm("Freund wirklich entfernen?")) return;
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/friends/remove/${friendId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        toast.success("Freund entfernt");
        fetchFriends();
      }
    } catch (err) {
      toast.error("Fehler");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-[#00E0FF] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030303] text-white font-outfit pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-xl transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-black">Freunde</h1>
          <div className="w-9" />
        </div>

        {/* Tabs */}
        <div className="max-w-md mx-auto px-4 flex gap-2 pb-2">
          {["friends", "requests", "search"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${
                activeTab === tab ? "bg-[#00E0FF] text-black" : "bg-white/5 hover:bg-white/10"
              }`}
            >
              {tab === "friends" && `Freunde (${friends.length})`}
              {tab === "requests" && `Anfragen (${requests.received.length})`}
              {tab === "search" && "Suchen"}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 mt-6">
        {/* Friends Tab */}
        {activeTab === "friends" && (
          <div className="space-y-3">
            {friends.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-4xl mb-3">👥</p>
                <p className="text-white/60">Noch keine Freunde</p>
                <button
                  onClick={() => setActiveTab("search")}
                  className="mt-4 px-4 py-2 bg-[#00E0FF] text-black rounded-xl font-semibold"
                >
                  Freunde suchen
                </button>
              </div>
            ) : (
              friends.map((friend) => (
                <motion.div
                  key={friend.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-4 flex items-center gap-3"
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00E0FF] to-[#0088CC] flex items-center justify-center text-xl">
                    {friend.photo_url ? (
                      <img src={friend.photo_url} alt={friend.name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      friend.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold">{friend.name}</h3>
                    <p className="text-xs text-white/60">{friend.email}</p>
                  </div>
                  <button
                    onClick={() => handleRemove(friend.id)}
                    className="p-2 hover:bg-red-500/10 rounded-xl transition text-red-500"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* Requests Tab */}
        {activeTab === "requests" && (
          <div className="space-y-6">
            {/* Received */}
            <div>
              <h3 className="text-sm font-bold text-white/60 mb-3">Empfangen ({requests.received.length})</h3>
              {requests.received.length === 0 ? (
                <p className="text-center text-white/40 py-6">Keine Anfragen</p>
              ) : (
                <div className="space-y-3">
                  {requests.received.map((req) => (
                    <div
                      key={req.request_id}
                      className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-4"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00E0FF] to-[#0088CC] flex items-center justify-center text-lg">
                          {req.from_user_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold">{req.from_user_name}</h4>
                          <p className="text-xs text-white/60">möchte dein Freund sein</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAccept(req.request_id)}
                          className="flex-1 py-2 bg-[#10B981] hover:bg-[#10B981]/90 rounded-xl font-semibold transition"
                        >
                          Akzeptieren
                        </button>
                        <button
                          onClick={() => handleDecline(req.request_id)}
                          className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-xl font-semibold transition"
                        >
                          Ablehnen
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sent */}
            <div>
              <h3 className="text-sm font-bold text-white/60 mb-3">Gesendet ({requests.sent.length})</h3>
              {requests.sent.length === 0 ? (
                <p className="text-center text-white/40 py-6">Keine ausstehenden Anfragen</p>
              ) : (
                <div className="space-y-3">
                  {requests.sent.map((req) => (
                    <div
                      key={req.request_id}
                      className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-4 flex items-center gap-3"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFD166] to-[#FF9800] flex items-center justify-center text-lg">
                        {req.to_user_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold">{req.to_user_name}</h4>
                        <p className="text-xs text-white/60">Ausstehend...</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Search Tab */}
        {activeTab === "search" && (
          <div>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Name oder E-Mail suchen..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#00E0FF]"
              />
              <button
                onClick={handleSearch}
                disabled={searchLoading}
                className="px-6 py-3 bg-[#00E0FF] hover:bg-[#00E0FF]/90 text-black rounded-xl font-bold transition disabled:opacity-50"
              >
                {searchLoading ? "..." : "🔍"}
              </button>
            </div>

            <div className="space-y-3">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-4 flex items-center gap-3"
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00E0FF] to-[#0088CC] flex items-center justify-center text-xl">
                    {user.photo_url ? (
                      <img src={user.photo_url} alt={user.name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      user.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold">{user.name}</h3>
                    <p className="text-xs text-white/60">{user.email}</p>
                  </div>
                  <button
                    onClick={() => handleSendRequest(user.id)}
                    disabled={user.request_pending}
                    className={`px-4 py-2 rounded-xl font-semibold transition ${
                      user.request_pending
                        ? "bg-white/5 text-white/40 cursor-not-allowed"
                        : "bg-[#00E0FF] hover:bg-[#00E0FF]/90 text-black"
                    }`}
                  >
                    {user.request_pending ? "Ausstehend" : "Hinzufügen"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
