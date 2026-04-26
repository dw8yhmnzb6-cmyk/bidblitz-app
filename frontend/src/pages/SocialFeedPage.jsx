/**
 * BidBlitz V2 - Social Feed / Community
 * Posts, Likes, Kommentare, Stories, Follow
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Heart, MessageCircle, Send, Plus, Image, X, Loader2,
  MoreHorizontal, UserPlus, UserMinus, Compass, User, Camera
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const SocialFeedPage = ({ onBack }) => {
  const [tab, setTab] = useState("feed"); // feed | explore | profile
  const [posts, setPosts] = useState([]);
  const [storyGroups, setStoryGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myProfile, setMyProfile] = useState(null);

  // New post
  const [showCreate, setShowCreate] = useState(false);
  const [newText, setNewText] = useState("");
  const [newImage, setNewImage] = useState("");
  const [postType, setPostType] = useState("post");
  const [posting, setPosting] = useState(false);

  // Comments
  const [activePost, setActivePost] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [commenting, setCommenting] = useState(false);

  const loadFeed = useCallback(async () => {
    try {
      const endpoint = tab === "explore" ? `${API}/api/social/explore` : `${API}/api/social/feed`;
      const res = await fetch(endpoint, { credentials: "include" });
      if (res.ok) { const d = await res.json(); setPosts(d.posts || []); }
    } catch {}
    setLoading(false);
  }, [tab]);

  const loadStories = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/social/stories`, { credentials: "include" });
      if (res.ok) { const d = await res.json(); setStoryGroups(d.story_groups || []); }
    } catch {}
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/social/my-profile`, { credentials: "include" });
      if (res.ok) setMyProfile(await res.json());
    } catch {}
  }, []);

  useEffect(() => { loadFeed(); loadStories(); loadProfile(); }, [loadFeed, loadStories, loadProfile]);

  const createPost = async () => {
    if (!newText && !newImage) return;
    setPosting(true);
    try {
      const res = await fetch(`${API}/api/social/posts`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newText, image_url: newImage, post_type: postType }),
      });
      if (res.ok) { setShowCreate(false); setNewText(""); setNewImage(""); loadFeed(); loadStories(); }
    } catch {}
    setPosting(false);
  };

  const toggleLike = async (postId) => {
    const res = await fetch(`${API}/api/social/like/${postId}`, { method: "POST", credentials: "include" });
    if (res.ok) {
      const d = await res.json();
      setPosts(prev => prev.map(p => p.post_id === postId ? { ...p, liked: d.liked, like_count: p.like_count + (d.liked ? 1 : -1) } : p));
    }
  };

  const openComments = async (postId) => {
    try {
      const res = await fetch(`${API}/api/social/posts/${postId}`, { credentials: "include" });
      if (res.ok) setActivePost(await res.json());
    } catch {}
  };

  const addComment = async () => {
    if (!commentText || !activePost) return;
    setCommenting(true);
    try {
      const res = await fetch(`${API}/api/social/comments`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: activePost.post_id, text: commentText }),
      });
      if (res.ok) { setCommentText(""); openComments(activePost.post_id); }
    } catch {}
    setCommenting(false);
  };

  const toggleFollow = async (userId) => {
    await fetch(`${API}/api/social/follow/${userId}`, { method: "POST", credentials: "include" });
  };

  const timeAgo = (iso) => {
    if (!iso) return "";
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return "gerade";
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24" data-testid="social-feed-page">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="p-2 rounded-xl bg-white/5 border border-white/10"><ArrowLeft size={18} /></motion.button>
            <h1 className="text-[15px] font-bold">Community</h1>
          </div>
          <div className="flex gap-2">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowCreate(true)}
              className="p-2 rounded-xl bg-[#00C2FF] text-black" data-testid="social-create-btn"><Plus size={16} /></motion.button>
          </div>
        </div>
        <div className="flex gap-1 mt-3">
          {[
            { id: "feed", label: "Feed", icon: Heart },
            { id: "explore", label: "Entdecken", icon: Compass },
            { id: "profile", label: "Profil", icon: User },
          ].map(t => (
            <motion.button key={t.id} whileTap={{ scale: 0.95 }} onClick={() => { setTab(t.id); setLoading(true); }}
              className={`flex-1 py-2 rounded-xl text-[10px] font-medium flex items-center justify-center gap-1 ${tab === t.id ? "bg-[#00C2FF] text-black" : "bg-white/5 text-gray-500"}`}
              data-testid={`social-tab-${t.id}`}><t.icon size={12} /> {t.label}</motion.button>
          ))}
        </div>
      </div>

      {/* Stories Row */}
      {tab === "feed" && storyGroups.length > 0 && (
        <div className="px-4 pt-3 pb-1">
          <div className="flex gap-3 overflow-x-auto pb-2">
            {storyGroups.map(sg => (
              <div key={sg.author_id} className="flex-shrink-0 flex flex-col items-center gap-1 w-[58px]">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#F59E0B] to-[#EC4899] p-[2px]">
                  <div className="w-full h-full rounded-full bg-[#0A0A0F] flex items-center justify-center text-[11px] font-bold">
                    {(sg.author_name || "?")[0].toUpperCase()}
                  </div>
                </div>
                <span className="text-[8px] text-gray-500 truncate w-full text-center">{sg.author_name?.split(" ")[0]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-[#00C2FF]" /></div>}

      {/* Posts */}
      {(tab === "feed" || tab === "explore") && !loading && (
        <div className="divide-y divide-white/5">
          {posts.length === 0 ? (
            <div className="text-center py-16"><Heart size={40} className="mx-auto text-[#333] mb-3" /><p className="text-sm text-gray-500">{tab === "feed" ? "Folge Leuten um ihren Feed zu sehen" : "Noch keine Posts"}</p></div>
          ) : posts.map((p, i) => (
            <motion.div key={p.post_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
              className="p-4" data-testid={`post-${p.post_id}`}>
              {/* Author */}
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#00C2FF]/30 to-[#A855F7]/30 flex items-center justify-center text-[11px] font-bold">
                  {(p.author_name || "?")[0].toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-[12px] font-semibold">{p.author_name}</p>
                  <p className="text-[9px] text-gray-600">{timeAgo(p.created_at)}</p>
                </div>
              </div>
              {/* Content */}
              {p.text && <p className="text-[13px] text-gray-200 mb-2 leading-relaxed">{p.text}</p>}
              {p.image_url && <img src={p.image_url} alt="" className="w-full rounded-2xl mb-2 max-h-80 object-cover" />}
              {/* Actions */}
              <div className="flex items-center gap-5 mt-1">
                <motion.button whileTap={{ scale: 0.8 }} onClick={() => toggleLike(p.post_id)}
                  className="flex items-center gap-1.5" data-testid={`like-${p.post_id}`}>
                  <Heart size={18} className={p.liked ? "text-[#EF4444] fill-[#EF4444]" : "text-gray-500"} />
                  <span className="text-[11px] text-gray-500">{p.like_count || 0}</span>
                </motion.button>
                <motion.button whileTap={{ scale: 0.8 }} onClick={() => openComments(p.post_id)}
                  className="flex items-center gap-1.5" data-testid={`comment-btn-${p.post_id}`}>
                  <MessageCircle size={18} className="text-gray-500" />
                  <span className="text-[11px] text-gray-500">{p.comment_count || 0}</span>
                </motion.button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Profile */}
      {tab === "profile" && myProfile && (
        <div className="p-4">
          <div className="bg-[#111118] rounded-2xl border border-white/5 p-5 text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#00C2FF] to-[#A855F7] flex items-center justify-center text-xl font-bold mx-auto mb-3">
              {(myProfile.name || "?")[0].toUpperCase()}
            </div>
            <h2 className="text-base font-bold">{myProfile.name}</h2>
            <div className="flex items-center justify-center gap-6 mt-3 text-center">
              <div><p className="text-lg font-bold text-[#00C2FF]">{myProfile.post_count}</p><p className="text-[9px] text-gray-500">Posts</p></div>
              <div><p className="text-lg font-bold">{myProfile.follower_count}</p><p className="text-[9px] text-gray-500">Follower</p></div>
              <div><p className="text-lg font-bold">{myProfile.following_count}</p><p className="text-[9px] text-gray-500">Folge ich</p></div>
            </div>
          </div>
        </div>
      )}

      {/* Create Post Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-end justify-center" onClick={() => setShowCreate(false)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28 }} onClick={e => e.stopPropagation()}
              className="w-full max-w-lg bg-[#111118] rounded-t-3xl border-t border-white/10 p-5" data-testid="create-post-modal">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[15px] font-bold">Neuer Beitrag</h3>
                <div className="flex gap-2">
                  <div className="flex bg-white/5 rounded-lg p-0.5">
                    {["post", "story"].map(pt => (
                      <motion.button key={pt} whileTap={{ scale: 0.95 }} onClick={() => setPostType(pt)}
                        className={`px-3 py-1.5 rounded-md text-[10px] font-medium ${postType === pt ? "bg-[#00C2FF] text-black" : "text-gray-500"}`}>{pt === "post" ? "Post" : "Story"}</motion.button>
                    ))}
                  </div>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowCreate(false)} className="p-2 rounded-xl bg-white/5"><X size={14} className="text-gray-400" /></motion.button>
                </div>
              </div>
              <textarea value={newText} onChange={e => setNewText(e.target.value)} placeholder="Was gibt's Neues?" rows={3}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none resize-none mb-3" data-testid="post-text" />
              <input type="url" value={newImage} onChange={e => setNewImage(e.target.value)} placeholder="Bild-URL (optional)"
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] outline-none mb-3" data-testid="post-image" />
              <motion.button whileTap={{ scale: 0.97 }} onClick={createPost} disabled={(!newText && !newImage) || posting}
                className="w-full py-3.5 rounded-xl bg-[#00C2FF] text-black font-bold text-sm disabled:opacity-30 flex items-center justify-center gap-2"
                data-testid="post-submit">{posting ? <Loader2 size={18} className="animate-spin" /> : <><Send size={16} /> Veröffentlichen</>}</motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comments Modal */}
      <AnimatePresence>
        {activePost && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-end justify-center" onClick={() => setActivePost(null)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28 }} onClick={e => e.stopPropagation()}
              className="w-full max-w-lg bg-[#111118] rounded-t-3xl border-t border-white/10 max-h-[70vh] flex flex-col" data-testid="comments-modal">
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-sm font-bold">Kommentare ({activePost.comments?.length || 0})</h3>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setActivePost(null)}><X size={16} className="text-gray-400" /></motion.button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {(activePost.comments || []).map(c => (
                  <div key={c.comment_id} className="flex gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                      {(c.author_name || "?")[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-[11px]"><span className="font-semibold">{c.author_name}</span> <span className="text-gray-400">{c.text}</span></p>
                      <p className="text-[8px] text-gray-600 mt-0.5">{timeAgo(c.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-white/5 flex gap-2">
                <input type="text" value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Kommentar..."
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs outline-none" data-testid="comment-input"
                  onKeyDown={e => e.key === "Enter" && addComment()} />
                <motion.button whileTap={{ scale: 0.9 }} onClick={addComment} disabled={!commentText || commenting}
                  className="p-2.5 rounded-xl bg-[#00C2FF] text-black disabled:opacity-30" data-testid="comment-send">
                  <Send size={14} />
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SocialFeedPage;
