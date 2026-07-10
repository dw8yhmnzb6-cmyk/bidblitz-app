import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Heart, X, Star, MapPin, Sparkles, MessageCircle, Check, Crown, Edit2, SlidersHorizontal, Shield, Ban, BadgeCheck, Zap, Mic, Square, Play, Trash2, Video, Gem, Lock } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "../store/I18nContext";

const API = process.env.REACT_APP_BACKEND_URL;
const emptyProfile = {
  name: "",
  age: 18,
  city: "",
  bio: "",
  occupation: "",
  profile_prompt: "",
  interests: [],
  gender: "unspecified",
  seeking: [],
  relationship_intent: "serious",
  photos: [""],
};

const chipOptions = ["Reisen", "Musik", "Kaffee", "Fitness", "Kunst", "Kochen", "Tech", "Bücher"];

const defaultPremiumPlans = [
  {
    plan_id: "premium_30d",
    label: "Dating Premium · 30 Tage",
    price_eur: 14.99,
    currency: "eur",
    duration_days: 30,
    features: ["Unbegrenzte Likes", "Likes You freischalten", "Boost & Spotlight", "Rewind ohne Limit"],
  },
];

const defaultConsumables = [
  { item_id: "boost_pack_1", type: "boost_pack", label: "1 Boost", price_eur: 4.99, quantity: 1, description: "30 Minuten Spotlight" },
  { item_id: "superlike_pack_5", type: "superlike_pack", label: "5 Super Likes", price_eur: 5.99, quantity: 5, description: "Mehr Aufmerksamkeit" },
  { item_id: "rewind_pack_10", type: "rewind_pack", label: "10 Rewinds", price_eur: 3.99, quantity: 10, description: "Verpasste Likes zurückholen" },
];

function safetyTone(level) {
  if (level === "high") return "text-red-300 bg-red-500/15 border-red-500/25";
  if (level === "medium") return "text-amber-200 bg-amber-500/15 border-amber-500/25";
  return "text-emerald-200 bg-emerald-500/15 border-emerald-500/25";
}

function safetyLabel(level) {
  if (level === "high") return "Hoch";
  if (level === "medium") return "Mittel";
  return "Niedrig";
}

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.message || `Request failed (${res.status})`);
  return data;
}

export default function DatingPage({ onBack }) {
  const { t } = useI18n();
  const [profiles, setProfiles] = useState([]);
  const [matches, setMatches] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [tab, setTab] = useState("discover");
  const [dir, setDir] = useState(null);
  const [swipesLeft, setSwipesLeft] = useState(20);
  const [isPremium, setIsPremium] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [activeMatch, setActiveMatch] = useState(null);
  const [chatText, setChatText] = useState("");
  const [showSafetySheet, setShowSafetySheet] = useState(null);
  const [reportReason, setReportReason] = useState("");
  const [matchPopup, setMatchPopup] = useState(false);
  const [profileForm, setProfileForm] = useState(emptyProfile);
  const [filters, setFilters] = useState({ age_min: 18, age_max: 99, city: "", seeking: [], relationship_intent: "" });
  const [likesYou, setLikesYou] = useState({ locked: true, profiles: [], count: 0 });
  const [chatReadAt, setChatReadAt] = useState(null);
  const [aiBioSuggestions, setAiBioSuggestions] = useState([]);
  const [aiCoachTips, setAiCoachTips] = useState([]);
  const [aiIcebreakers, setAiIcebreakers] = useState([]);
  const [aiLoading, setAiLoading] = useState("");
  const [nearbyProfiles, setNearbyProfiles] = useState([]);
  const [crossedProfiles, setCrossedProfiles] = useState([]);
  const [locationState, setLocationState] = useState({ enabled: false, loading: false });
  const [voiceIntroState, setVoiceIntroState] = useState({ recording: false, uploading: false, seconds: 0, playingId: "" });
  const [videoProfileState, setVideoProfileState] = useState({ recording: false, uploading: false, seconds: 0, playingId: "" });
  const [premiumPlans, setPremiumPlans] = useState(defaultPremiumPlans);
  const [consumables, setConsumables] = useState(defaultConsumables);
  const [monetization, setMonetization] = useState({ entitlements: {}, starter_offer: null, likes_you_count: 0, profile_completion: 0 });
  const [premiumCheckoutState, setPremiumCheckoutState] = useState({ loading: false, checking: false, sessionId: "" });
  const [packCheckoutState, setPackCheckoutState] = useState({ loading: "" });
  const [safetyRefreshing, setSafetyRefreshing] = useState(false);
  const [chatSafetySummary, setChatSafetySummary] = useState(null);
  const [chatSafetyChecking, setChatSafetyChecking] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordStartedAtRef = useRef(0);
  const recordTimerRef = useRef(null);
  const streamRef = useRef(null);
  const videoRecorderRef = useRef(null);
  const videoChunksRef = useRef([]);
  const videoStartedAtRef = useRef(0);
  const videoTimerRef = useRef(null);
  const videoStreamRef = useRef(null);

  const boostState = userProfile?.boost || { is_active: false, seconds_left: 0, cooldown_remaining_seconds: 0, duration_minutes: 30 };
  const boostLabel = boostState.is_active
    ? `Boost aktiv · ${Math.max(1, Math.ceil((boostState.seconds_left || 0) / 60))} Min`
    : boostState.cooldown_remaining_seconds > 0
      ? `Boost Cooldown · ${Math.max(1, Math.ceil((boostState.cooldown_remaining_seconds || 0) / 3600))}h`
      : `Boost · ${boostState.duration_minutes || 30} Min`;

  const current = profiles[idx];
  const currentPhotos = current?.photos?.length ? current.photos : current?.avatar ? [current.avatar] : [];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, discoverRes, matchesRes, swipeRes, likesRes, nearbyRes, crossedRes, plansRes, monetizationRes] = await Promise.all([
        api("/api/dating/profile/me"),
        api("/api/dating/discover"),
        api("/api/dating/matches"),
        api("/api/dating/swipes-left"),
        api("/api/dating/likes-you"),
        api("/api/dating/nearby").catch(() => ({ nearby_enabled: false, profiles: [] })),
        api("/api/dating/crossed-paths").catch(() => ({ profiles: [] })),
        api("/api/dating/premium/plans").catch(() => ({ plans: defaultPremiumPlans })),
        api("/api/dating/monetization").catch(() => ({ consumables: defaultConsumables, entitlements: {}, starter_offer: null, likes_you_count: 0, profile_completion: 0 })),
      ]);
      setUserProfile(profileRes.profile);
      setProfileForm({
        ...emptyProfile,
        ...profileRes.profile,
        photos: profileRes.profile?.photos?.length ? profileRes.profile.photos : [profileRes.profile?.avatar || ""],
      });
      setFilters(profileRes.filters || { age_min: 18, age_max: 99, city: "", seeking: [], relationship_intent: "" });
      setIsPremium(Boolean(profileRes.profile?.premium));
      setSwipesLeft(swipeRes.swipes_left || 0);
      setProfiles(discoverRes.profiles || []);
      setMatches(matchesRes.matches || []);
      setLikesYou(likesRes || { locked: true, profiles: [], count: 0 });
      setNearbyProfiles(nearbyRes.profiles || []);
      setCrossedProfiles(crossedRes.profiles || []);
      setPremiumPlans(plansRes.plans?.length ? plansRes.plans : defaultPremiumPlans);
      setConsumables(monetizationRes.consumables?.length ? monetizationRes.consumables : defaultConsumables);
      setMonetization(monetizationRes);
      setLocationState((prev) => ({ ...prev, enabled: Boolean(nearbyRes.nearby_enabled) }));
      setIdx(0);
      if ((!profileRes.profile?.bio || !profileRes.profile?.photos?.[0]) && !window.sessionStorage.getItem("dating-profile-setup-dismissed")) setShowProfileSetup(true);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const premiumSessionId = params.get("premium_session_id");
    if (premiumSessionId) {
      checkPremiumStatus(premiumSessionId, 0);
    }
    if (params.get("premium_cancelled") === "true") {
      toast.error("Premium-Zahlung abgebrochen");
      const url = new URL(window.location.href);
      url.searchParams.delete("premium_cancelled");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  useEffect(() => () => {
    stopRecordingCleanup();
    stopVideoRecordingCleanup();
  }, []);

  const loadMessages = useCallback(async (match) => {
    try {
      const data = await api(`/api/dating/matches/${match.match_id}/messages`);
      setMessages(data.messages || []);
      setChatReadAt(data.read_at || null);
      setChatSafetySummary(data.chat_safety_summary || null);
      setActiveMatch(match);
      setTab("chat");
      setMatches((prev) => prev.map((item) => item.match_id === match.match_id ? { ...item, unread_count: 0 } : item));
    } catch (error) {
      toast.error(error.message);
    }
  }, []);

  const handleAction = async (type) => {
    const p = profiles[idx];
    if (!p) return;
    if (!isPremium && swipesLeft <= 0 && type !== "pass") {
      setShowPaywall(true);
      return;
    }
    setDir(type === "pass" ? "left" : "right");
    try {
      if (type === "pass") {
        await api("/api/dating/pass", { method: "POST", body: JSON.stringify({ profile_id: p.profile_id }) });
      } else {
        const res = await api("/api/dating/like", { method: "POST", body: JSON.stringify({ profile_id: p.profile_id, super_like: type === "superlike" }) });
        if (!isPremium) setSwipesLeft((value) => Math.max(0, value - 1));
        if (res.match) {
          setMatchPopup(true);
          await load();
        }
      }
    } catch (error) {
      if (String(error.message).includes("Swipe-Limit")) setShowPaywall(true);
      else toast.error(error.message);
    }
    setTimeout(() => {
      setProfiles((prev) => prev.filter((item) => item.profile_id !== p.profile_id));
      setDir(null);
    }, 280);
  };

  const handleRewind = async () => {
    try {
      const data = await api("/api/dating/rewind", { method: "POST" });
      setProfiles((prev) => [data.profile, ...prev]);
      setIdx(0);
      toast.success("Letzten Swipe zurückgeholt");
    } catch (error) {
      toast.error(error.message);
    }
  };

  const saveProfile = async () => {
    try {
      const payload = { ...profileForm, interests: profileForm.interests.filter(Boolean), photos: profileForm.photos.filter(Boolean) };
      const data = await api("/api/dating/profile/me", { method: "PUT", body: JSON.stringify(payload) });
      setUserProfile(data.profile);
      setProfileForm({ ...emptyProfile, ...data.profile, photos: data.profile?.photos?.length ? data.profile.photos : [data.profile?.avatar || ""] });
      setShowProfileSetup(false);
      toast.success("Dating-Profil gespeichert");
      const [discoverRes, matchesRes, swipeRes, likesRes] = await Promise.all([
        api("/api/dating/discover"),
        api("/api/dating/matches"),
        api("/api/dating/swipes-left"),
        api("/api/dating/likes-you"),
      ]);
      setProfiles(discoverRes.profiles || []);
      setMatches(matchesRes.matches || []);
      setLikesYou(likesRes || { locked: true, profiles: [], count: 0 });
      setSwipesLeft(swipeRes.swipes_left || 0);
      setIdx(0);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const saveFilters = async () => {
    try {
      await api("/api/dating/filters", { method: "POST", body: JSON.stringify(filters) });
      toast.success("Filter gespeichert");
      setShowFilters(false);
      await load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const runDemoVerify = async () => {
    try {
      await api("/api/dating/verify/demo", { method: "POST", body: JSON.stringify({ selfie_url: profileForm.photos?.[0] || userProfile?.avatar || "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&q=80" }) });
      toast.success("Dating-Profil verifiziert");
      await load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const activateBoost = async () => {
    if (!isPremium) {
      setShowPaywall(true);
      return;
    }
    try {
      const data = await api("/api/dating/boost/activate", { method: "POST" });
      setUserProfile((prev) => prev ? { ...prev, boost: data.boost } : prev);
      toast.success(data.message || "Boost aktiviert");
      await load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const refreshSafetyScan = async () => {
    if (!userProfile?.profile_id) return;
    try {
      setSafetyRefreshing(true);
      await api("/api/dating/safety/scan", { method: "POST", body: JSON.stringify({ profile_id: userProfile.profile_id, force: true }) });
      toast.success("Safety Pro aktualisiert");
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSafetyRefreshing(false);
    }
  };

  const checkPremiumStatus = async (sessionId, attempt = 0) => {
    try {
      setPremiumCheckoutState({ loading: false, checking: true, sessionId });
      const result = await api(`/api/dating/premium/status/${sessionId}`);
      if (result.payment_status === "paid" || result.premium_activated) {
        toast.success("Dating Premium aktiviert");
        const url = new URL(window.location.href);
        url.searchParams.delete("premium_session_id");
        window.history.replaceState({}, "", url.toString());
        await load();
      } else if (result.status === "expired") {
        toast.error("Premium-Session abgelaufen");
      } else if (attempt < 4) {
        window.setTimeout(() => {
          checkPremiumStatus(sessionId, attempt + 1);
        }, 2000);
        return;
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setPremiumCheckoutState((prev) => ({ ...prev, checking: false }));
    }
  };

  const startPremiumCheckout = async (planId = null) => {
    try {
      setPremiumCheckoutState({ loading: true, checking: false, sessionId: "" });
      const chosenPlanId = planId || premiumPlans?.[0]?.plan_id || "gold_30d";
      const data = await api("/api/dating/premium/checkout", {
        method: "POST",
        body: JSON.stringify({ plan_id: chosenPlanId, origin_url: window.location.origin }),
      });
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }
      throw new Error("Keine Checkout-URL erhalten");
    } catch (error) {
      toast.error(error.message);
      setPremiumCheckoutState({ loading: false, checking: false, sessionId: "" });
    }
  };

  const startConsumableCheckout = async (itemId) => {
    try {
      setPackCheckoutState({ loading: itemId });
      const data = await api("/api/dating/consumables/checkout", {
        method: "POST",
        body: JSON.stringify({ item_id: itemId, origin_url: window.location.origin }),
      });
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }
      throw new Error("Keine Checkout-URL erhalten");
    } catch (error) {
      toast.error(error.message);
      setPackCheckoutState({ loading: "" });
    }
  };

  const runAiBio = async () => {
    try {
      setAiLoading("bio");
      const data = await api("/api/dating/ai/bio", { method: "POST", body: JSON.stringify({ prompt: userProfile?.profile_prompt || "" }) });
      setAiBioSuggestions(data.suggestions || []);
      toast.success("AI-Bio erstellt");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setAiLoading("");
    }
  };

  const runAiCoach = async () => {
    try {
      setAiLoading("coach");
      const data = await api("/api/dating/ai/profile-coach", { method: "POST", body: JSON.stringify({ prompt: "Optimiere für hochwertige Matches" }) });
      setAiCoachTips(data.tips || []);
      toast.success("Profil-Coach fertig");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setAiLoading("");
    }
  };

  const runAiIcebreakers = async (matchId) => {
    try {
      setAiLoading(`ice-${matchId}`);
      const data = await api("/api/dating/ai/icebreakers", { method: "POST", body: JSON.stringify({ match_id: matchId }) });
      setAiIcebreakers(data.icebreakers || []);
      toast.success("Icebreaker geladen");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setAiLoading("");
    }
  };

  const enableNearby = async () => {
    if (!navigator.geolocation) {
      toast.error("Standort auf diesem Gerät nicht verfügbar");
      return;
    }
    setLocationState((prev) => ({ ...prev, loading: true }));
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        await api("/api/dating/location", {
          method: "POST",
          body: JSON.stringify({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy_m: position.coords.accuracy || 50,
          }),
        });
        toast.success("Nearby Dating aktiviert");
        await load();
      } catch (error) {
        toast.error(error.message);
      } finally {
        setLocationState((prev) => ({ ...prev, loading: false }));
      }
    }, () => {
      setLocationState((prev) => ({ ...prev, loading: false }));
      toast.error("Standortfreigabe abgelehnt");
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 120000 });
  };

  const dismissProfileSetup = () => {
    window.sessionStorage.setItem("dating-profile-setup-dismissed", "1");
    setShowProfileSetup(false);
  };

  const uploadVoiceIntroBlob = async (blob, durationSeconds) => {
    const form = new FormData();
    form.append("file", blob, "voice-intro.webm");
    form.append("duration_seconds", String(durationSeconds));
    const res = await fetch(`${API}/api/dating/voice-intro`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`);
    return data;
  };

  const uploadVideoProfileBlob = async (blob, durationSeconds) => {
    const form = new FormData();
    form.append("file", blob, "video-profile.webm");
    form.append("duration_seconds", String(durationSeconds));
    const res = await fetch(`${API}/api/dating/video-profile`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`);
    return data;
  };

  const stopRecordingCleanup = () => {
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
  };

  const stopVideoRecordingCleanup = () => {
    if (videoTimerRef.current) {
      window.clearInterval(videoTimerRef.current);
      videoTimerRef.current = null;
    }
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach((track) => track.stop());
      videoStreamRef.current = null;
    }
    videoRecorderRef.current = null;
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    } else {
      stopRecordingCleanup();
      setVoiceIntroState((prev) => ({ ...prev, recording: false }));
    }
  };

  const startVoiceRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Audioaufnahme wird auf diesem Gerät nicht unterstützt");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = recorder;
      recordStartedAtRef.current = Date.now();
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        const durationSeconds = Math.max(1, Math.min(30, Math.round((Date.now() - recordStartedAtRef.current) / 1000)));
        stopRecordingCleanup();
        setVoiceIntroState((prev) => ({ ...prev, recording: false, uploading: true, seconds: 0 }));
        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          await uploadVoiceIntroBlob(blob, durationSeconds);
          toast.success("Voice Intro gespeichert");
          await load();
        } catch (error) {
          toast.error(error.message);
        } finally {
          setVoiceIntroState((prev) => ({ ...prev, uploading: false }));
        }
      };
      recorder.start();
      setVoiceIntroState((prev) => ({ ...prev, recording: true, seconds: 0 }));
      recordTimerRef.current = window.setInterval(() => {
        const next = Math.floor((Date.now() - recordStartedAtRef.current) / 1000);
        setVoiceIntroState((prev) => ({ ...prev, seconds: next }));
        if (next >= 30) stopVoiceRecording();
      }, 250);
    } catch (error) {
      toast.error("Mikrofonzugriff fehlgeschlagen");
      stopRecordingCleanup();
    }
  };

  const stopVideoRecording = () => {
    if (videoRecorderRef.current && videoRecorderRef.current.state !== "inactive") {
      videoRecorderRef.current.stop();
    } else {
      stopVideoRecordingCleanup();
      setVideoProfileState((prev) => ({ ...prev, recording: false }));
    }
  };

  const startVideoRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Videoaufnahme wird auf diesem Gerät nicht unterstützt");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      videoStreamRef.current = stream;
      videoChunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      videoRecorderRef.current = recorder;
      videoStartedAtRef.current = Date.now();
      recorder.ondataavailable = (event) => {
        if (event.data?.size) videoChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        const durationSeconds = Math.max(1, Math.min(45, Math.round((Date.now() - videoStartedAtRef.current) / 1000)));
        stopVideoRecordingCleanup();
        setVideoProfileState((prev) => ({ ...prev, recording: false, uploading: true, seconds: 0 }));
        try {
          const blob = new Blob(videoChunksRef.current, { type: "video/webm" });
          await uploadVideoProfileBlob(blob, durationSeconds);
          toast.success("Video-Profil gespeichert");
          await load();
        } catch (error) {
          toast.error(error.message);
        } finally {
          setVideoProfileState((prev) => ({ ...prev, uploading: false }));
        }
      };
      recorder.start();
      setVideoProfileState((prev) => ({ ...prev, recording: true, seconds: 0 }));
      videoTimerRef.current = window.setInterval(() => {
        const next = Math.floor((Date.now() - videoStartedAtRef.current) / 1000);
        setVideoProfileState((prev) => ({ ...prev, seconds: next }));
        if (next >= 45) stopVideoRecording();
      }, 250);
    } catch (error) {
      toast.error("Kamera-/Mikrofonzugriff fehlgeschlagen");
      stopVideoRecordingCleanup();
    }
  };

  const removeVoiceIntro = async () => {
    try {
      await api("/api/dating/voice-intro", { method: "DELETE", body: JSON.stringify({ media_id: userProfile?.voice_intro?.media_id || null }) });
      toast.success("Voice Intro gelöscht");
      await load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const removeVideoProfile = async () => {
    try {
      await api("/api/dating/video-profile", { method: "DELETE", body: JSON.stringify({ media_id: userProfile?.video_profile?.media_id || null }) });
      toast.success("Video-Profil gelöscht");
      await load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const togglePlayVoiceIntro = (mediaId) => {
    const audio = document.getElementById(`dating-voice-audio-${mediaId}`);
    if (!audio) return;
    if (voiceIntroState.playingId === mediaId) {
      audio.pause();
      audio.currentTime = 0;
      setVoiceIntroState((prev) => ({ ...prev, playingId: "" }));
      return;
    }
    document.querySelectorAll('[data-dating-voice-audio="true"]').forEach((node) => {
      if (node !== audio) {
        node.pause();
        node.currentTime = 0;
      }
    });
    audio.play().catch(() => toast.error("Audio konnte nicht abgespielt werden"));
    setVoiceIntroState((prev) => ({ ...prev, playingId: mediaId }));
  };

  const togglePlayVideoProfile = (mediaId) => {
    const video = document.getElementById(`dating-video-player-${mediaId}`);
    if (!video) return;
    if (videoProfileState.playingId === mediaId) {
      video.pause();
      video.currentTime = 0;
      setVideoProfileState((prev) => ({ ...prev, playingId: "" }));
      return;
    }
    document.querySelectorAll('[data-dating-video-player="true"]').forEach((node) => {
      if (node !== video) {
        node.pause();
        node.currentTime = 0;
      }
    });
    video.play().catch(() => toast.error("Video konnte nicht abgespielt werden"));
    setVideoProfileState((prev) => ({ ...prev, playingId: mediaId }));
  };

  const sendChat = async () => {
    if (!activeMatch || !chatText.trim()) return;
    try {
      const data = await api(`/api/dating/matches/${activeMatch.match_id}/messages`, { method: "POST", body: JSON.stringify({ text: chatText.trim() }) });
      setMessages((prev) => [...prev, data.message]);
      setChatText("");
      setChatSafetySummary(data.chat_safety_summary || chatSafetySummary);
      setMatches((prev) => prev.map((item) => item.match_id === activeMatch.match_id ? { ...item, last_message: data.message.text, last_message_at: data.message.created_at } : item));
    } catch (error) {
      toast.error(error.message);
    }
  };

  const refreshChatSafety = async () => {
    if (!activeMatch?.match_id) return;
    try {
      setChatSafetyChecking(true);
      const data = await api(`/api/dating/matches/${activeMatch.match_id}/chat-safety`, {
        method: "POST",
        body: JSON.stringify({ match_id: activeMatch.match_id, force: true }),
      });
      setChatSafetySummary(data.chat_safety_summary || null);
      toast.success("Chat-Sicherheit aktualisiert");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setChatSafetyChecking(false);
    }
  };

  const runSafetyAction = async (action) => {
    if (!showSafetySheet) return;
    try {
      if (action === "block") {
        await api("/api/dating/block", { method: "POST", body: JSON.stringify({ profile_id: showSafetySheet.profile_id, reason: reportReason || "Blockiert" }) });
        toast.success("Profil blockiert");
      } else if (action === "report") {
        await api("/api/dating/report", { method: "POST", body: JSON.stringify({ profile_id: showSafetySheet.profile_id, reason: reportReason || "Unangemessenes Verhalten" }) });
        toast.success("Profil gemeldet");
      } else if (action === "unmatch" && showSafetySheet.match_id) {
        await api(`/api/dating/unmatch/${showSafetySheet.match_id}`, { method: "POST" });
        toast.success("Match entfernt");
      }
      setShowSafetySheet(null);
      setReportReason("");
      await load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const photoSlots = useMemo(() => {
    const slots = [...(profileForm.photos || [])];
    while (slots.length < 3) slots.push("");
    return slots.slice(0, 3);
  }, [profileForm.photos]);

  return (
    <div className="min-h-screen pb-24 bg-[#05060A] text-white" data-testid="dating-page" data-cookie-banner-suppress="true">
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5" data-testid="dating-back-button"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-bold">Dating</h1>
        {!isPremium && tab === "discover" && <div className="ml-2 px-3 py-1 rounded-full flex items-center gap-1.5 bg-pink-500/15"><Heart size={12} className="text-pink-400" /><span className="text-xs font-bold text-pink-300">{swipesLeft}/20</span></div>}
        {isPremium && <div className="ml-2 px-3 py-1 rounded-full flex items-center gap-1 bg-gradient-to-r from-yellow-300 to-orange-400 text-black"><Crown size={12} /><span className="text-xs font-bold">Premium</span></div>}
        <div className="ml-auto flex gap-1 p-1 rounded-xl bg-white/5">
          {[
            { id: "discover", label: "Entdecken" },
            { id: "matches", label: "Matches" },
            { id: "likes", label: `Likes You${likesYou.count ? ` (${likesYou.count})` : ""}` },
          ].map((item) => (
            <button key={item.id} onClick={() => setTab(item.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${tab === item.id ? "bg-pink-500 text-white" : "text-white/60"}`} data-testid={`dating-tab-${item.id}`}>{item.label}</button>
          ))}
        </div>
        <button onClick={() => setShowFilters(true)} className="w-9 h-9 rounded-full flex items-center justify-center bg-white/5" data-testid="dating-open-filters"><SlidersHorizontal size={16} /></button>
        <button onClick={() => setShowProfileSetup(true)} className="w-9 h-9 rounded-full flex items-center justify-center bg-white/5" data-testid="dating-open-profile-edit"><Edit2 size={16} /></button>
      </div>

      {!isPremium && (
        <div className="px-4 mb-3" data-testid="dating-conversion-strip">
          <button onClick={() => setShowPaywall(true)} className="w-full rounded-2xl border border-yellow-400/20 bg-yellow-500/10 px-4 py-3 text-left">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-yellow-200/70">Upgrade Trigger</p>
                <p className="text-sm font-semibold text-white">{likesYou.count || monetization.likes_you_count || 0} Likes warten · freischalten für mehr Matches</p>
              </div>
              <Crown size={16} className="text-yellow-300" />
            </div>
          </button>
        </div>
      )}

      {premiumCheckoutState.checking && (
        <div className="px-4 mb-3" data-testid="dating-premium-status-banner">
          <div className="rounded-2xl border border-yellow-400/20 bg-yellow-500/10 px-4 py-3 text-xs text-yellow-100">
            Premium-Zahlung wird geprüft...
          </div>
        </div>
      )}

      {userProfile && (
        <div className="px-4 mb-4 space-y-4" data-testid="dating-profile-completion-card">
          {!isPremium && (
            <div className="rounded-[28px] border border-yellow-400/20 bg-gradient-to-br from-yellow-500/12 via-orange-500/10 to-pink-500/10 p-5" data-testid="dating-monetization-hero-card">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs uppercase tracking-[0.18em] text-yellow-200/70">Monetarisierung · Konkurrenzniveau</p>
                  <h2 className="mt-2 text-2xl font-bold text-white">Mehr Matches, mehr Sichtbarkeit, mehr Umsatz</h2>
                  <p className="mt-2 text-sm text-white/65">Wie Tinder Gold / Platinum und HingeX: Likes You, Priorität, Boosts, Super Likes und limitierte Starter-Angebote.</p>
                  {monetization?.starter_offer && <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200" data-testid="dating-starter-offer-chip"><Gem size={13} />Starter Deal · {monetization.starter_offer.offer_price_eur.toFixed(2)} € statt {monetization.starter_offer.regular_price_eur.toFixed(2)} € · {monetization.starter_offer.days_left} Tage</div>}
                </div>
                <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[430px]">
                  {premiumPlans.slice(0, 3).map((plan) => (
                    <button key={plan.plan_id} onClick={() => startPremiumCheckout(plan.plan_id)} className={`rounded-2xl border px-4 py-4 text-left transition-transform hover:-translate-y-0.5 ${plan.tier === 'platinum' ? 'border-fuchsia-400/30 bg-fuchsia-500/10' : plan.tier === 'gold' ? 'border-yellow-400/25 bg-yellow-500/10' : 'border-white/10 bg-white/5'}`} data-testid={`dating-plan-card-${plan.plan_id}`}>
                      <div className="flex items-center justify-between gap-2"><span className="text-sm font-bold text-white">{plan.label}</span>{plan.tier === 'platinum' ? <Gem size={14} className="text-fuchsia-300" /> : plan.tier === 'gold' ? <Crown size={14} className="text-yellow-300" /> : <Lock size={14} className="text-white/45" />}</div>
                      <p className="mt-2 text-lg font-bold text-white">{(plan.starter_offer?.offer_price_eur || plan.price_eur).toFixed(2)} €</p>
                      {plan.starter_offer ? <p className="text-[11px] text-emerald-200">Starterpreis statt {plan.price_eur.toFixed(2)} €</p> : <p className="text-[11px] text-white/45">30 Tage</p>}
                      <div className="mt-3 space-y-1">{(plan.features || []).slice(0, 3).map((feature, index) => <p key={`${feature}-${index}`} className="text-[11px] text-white/75" data-testid={`dating-plan-feature-${plan.plan_id}-${index}`}>• {feature}</p>)}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-[0.18em] text-white/45 mb-1">Profil-Vervollständigung</p>
              <p className="text-sm font-semibold text-white">{userProfile.profile_completion || 0}% bereit für bessere Matches</p>
              <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-gradient-to-r from-pink-500 to-orange-400" style={{ width: `${userProfile.profile_completion || 0}%` }} /></div>
            </div>
            <div className="flex flex-wrap gap-2" data-testid="dating-profile-action-row">
              <button
                onClick={activateBoost}
                disabled={Boolean(boostState.is_active || boostState.cooldown_remaining_seconds > 0)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${boostState.is_active ? "bg-yellow-400 text-black" : boostState.cooldown_remaining_seconds > 0 ? "bg-white/10 text-white/45" : "bg-yellow-500/15 text-yellow-200"}`}
                data-testid="dating-boost-button"
              >
                <Zap size={14} className="inline mr-1" />
                {boostLabel}
              </button>
              {!userProfile.verified && <button onClick={runDemoVerify} className="px-3 py-2 rounded-xl text-xs font-semibold bg-blue-500/15 text-blue-300" data-testid="dating-verify-demo-button"><BadgeCheck size={14} className="inline mr-1" />Verifizieren</button>}
              <button onClick={() => setShowProfileSetup(true)} className="px-3 py-2 rounded-xl text-xs font-semibold bg-pink-500/15 text-pink-300" data-testid="dating-profile-completion-edit">Verbessern</button>
              {!isPremium && <button onClick={startPremiumCheckout} className="px-3 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-yellow-300 to-orange-400 text-black" data-testid="dating-upgrade-premium-inline">{premiumCheckoutState.loading ? 'Weiterleitung...' : 'Premium holen'}</button>}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-3" data-testid="dating-consumables-grid">
            {consumables.map((item) => (
              <div key={item.item_id} className="rounded-2xl border border-white/10 bg-white/5 p-4" data-testid={`dating-consumable-card-${item.item_id}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-white/45">Einzelkauf</p>
                    <h3 className="text-sm font-semibold text-white">{item.label}</h3>
                  </div>
                  {item.type === 'boost_pack' ? <Zap size={15} className="text-yellow-300" /> : item.type === 'superlike_pack' ? <Star size={15} className="text-blue-300" /> : <ArrowLeft size={15} className="text-white/70" />}
                </div>
                <p className="mt-2 text-xl font-bold text-white">{item.price_eur.toFixed(2)} €</p>
                <p className="mt-1 text-xs text-white/55">{item.description}</p>
                <button onClick={() => startConsumableCheckout(item.item_id)} className="mt-4 w-full rounded-2xl bg-white/10 px-4 py-3 text-xs font-semibold text-white" data-testid={`dating-consumable-buy-${item.item_id}`}>{packCheckoutState.loading === item.item_id ? 'Weiterleitung...' : 'Jetzt kaufen'}</button>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4" data-testid="dating-safety-pro-card">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">Safety Pro</p>
                <h3 className="text-sm font-semibold text-white">Scam Detection & Nudity Warning</h3>
                <p className="mt-1 text-xs text-white/55">Dein Profil wird auf riskante Signale geprüft und die Discovery-Reihenfolge berücksichtigt das Ergebnis.</p>
              </div>
              <button onClick={refreshSafetyScan} className="px-3 py-2 rounded-xl bg-white/10 text-white text-xs font-semibold" data-testid="dating-safety-refresh-button">
                {safetyRefreshing ? "Prüft..." : "Neu prüfen"}
              </button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className={`rounded-2xl border px-3 py-3 ${safetyTone(userProfile?.safety_summary?.scam_level)}`} data-testid="dating-safety-scam-tile">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs uppercase tracking-[0.14em]">Scam-Risiko</span>
                  <span className="text-xs font-bold">{safetyLabel(userProfile?.safety_summary?.scam_level)}</span>
                </div>
                <p className="mt-2 text-lg font-bold">{userProfile?.safety_summary?.scam_score || 0}/100</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(userProfile?.safety_summary?.scam_flags || []).length === 0 ? <span className="text-[11px] opacity-80">Keine kritischen Textsignale</span> : (userProfile?.safety_summary?.scam_flags || []).map((flag, index) => <span key={`${flag}-${index}`} className="rounded-full bg-black/15 px-2 py-1 text-[10px] font-semibold" data-testid={`dating-safety-scam-flag-${index}`}>{flag}</span>)}
                </div>
              </div>
              <div className={`rounded-2xl border px-3 py-3 ${safetyTone(userProfile?.safety_summary?.nudity_level)}`} data-testid="dating-safety-nudity-tile">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs uppercase tracking-[0.14em]">Bild-Warnung</span>
                  <span className="text-xs font-bold">{safetyLabel(userProfile?.safety_summary?.nudity_level)}</span>
                </div>
                <p className="mt-2 text-lg font-bold">{userProfile?.safety_summary?.nudity_score || 0}/100</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(userProfile?.safety_summary?.nudity_flags || []).length === 0 ? <span className="text-[11px] opacity-80">Kein kritischer Bildhinweis</span> : (userProfile?.safety_summary?.nudity_flags || []).map((flag, index) => <span key={`${flag}-${index}`} className="rounded-full bg-black/15 px-2 py-1 text-[10px] font-semibold" data-testid={`dating-safety-nudity-flag-${index}`}>{flag}</span>)}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2" data-testid="dating-ai-tools-grid">
            <div className="rounded-2xl border border-fuchsia-500/20 bg-white/5 p-4" data-testid="dating-ai-bio-card">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">AI Bio</p>
                  <h3 className="text-sm font-semibold text-white">3 bessere Bio-Vorschläge</h3>
                </div>
                <button onClick={runAiBio} className="px-3 py-2 rounded-xl bg-fuchsia-500/15 text-fuchsia-200 text-xs font-semibold" data-testid="dating-ai-bio-button">{aiLoading === "bio" ? "Lädt..." : "Erstellen"}</button>
              </div>
              <div className="mt-3 space-y-2">
                {aiBioSuggestions.length === 0 ? <p className="text-xs text-white/55">Kurz, modern und besser für Matches.</p> : aiBioSuggestions.map((item, index) => <button key={`${item}-${index}`} onClick={() => setProfileForm((prev) => ({ ...prev, bio: item }))} className="w-full rounded-xl bg-white/5 px-3 py-2 text-left text-xs text-white/85 hover:bg-white/10 transition-colors" data-testid={`dating-ai-bio-suggestion-${index}`}>{item}</button>)}
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-500/20 bg-white/5 p-4" data-testid="dating-ai-coach-card">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">AI Profil-Coach</p>
                  <h3 className="text-sm font-semibold text-white">Konkrete Verbesserungen</h3>
                </div>
                <button onClick={runAiCoach} className="px-3 py-2 rounded-xl bg-cyan-500/15 text-cyan-200 text-xs font-semibold" data-testid="dating-ai-coach-button">{aiLoading === "coach" ? "Lädt..." : "Analysieren"}</button>
              </div>
              <div className="mt-3 space-y-2">
                {aiCoachTips.length === 0 ? <p className="text-xs text-white/55">Bekomme direkte Tipps für Bio, Fotos und Profilwirkung.</p> : aiCoachTips.map((item, index) => <div key={`${item}-${index}`} className="rounded-xl bg-white/5 px-3 py-2 text-xs text-white/85" data-testid={`dating-ai-coach-tip-${index}`}>{item}</div>)}
              </div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2" data-testid="dating-location-grid">
            <div className="rounded-2xl border border-emerald-500/20 bg-white/5 p-4" data-testid="dating-nearby-card">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Nearby</p>
                  <h3 className="text-sm font-semibold text-white">Singles in deiner Nähe</h3>
                </div>
                <button onClick={enableNearby} className="px-3 py-2 rounded-xl bg-emerald-500/15 text-emerald-200 text-xs font-semibold" data-testid="dating-enable-nearby-button">{locationState.loading ? "Lädt..." : locationState.enabled ? "Aktualisieren" : "Aktivieren"}</button>
              </div>
              <div className="mt-3 space-y-2">
                {nearbyProfiles.length === 0 ? <p className="text-xs text-white/55">Zeige echte Nähe-Matches mit Distanz, sobald Standort aktiv ist.</p> : nearbyProfiles.slice(0, 3).map((profile) => <button key={profile.profile_id} onClick={() => { setTab('discover'); setProfiles((prev) => [profile, ...prev.filter((item) => item.profile_id !== profile.profile_id)]); setIdx(0); }} className="w-full rounded-xl bg-white/5 px-3 py-2 text-left text-xs text-white/85 hover:bg-white/10 transition-colors" data-testid={`dating-nearby-profile-${profile.profile_id}`}>{profile.name} · {profile.distance_km} km · {profile.compatibility_score}% Match</button>)}
              </div>
            </div>

            <div className="rounded-2xl border border-orange-500/20 bg-white/5 p-4" data-testid="dating-crossed-paths-card">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Crossed Paths</p>
                  <h3 className="text-sm font-semibold text-white">Wem du begegnet bist</h3>
                </div>
                <span className="px-3 py-2 rounded-xl bg-orange-500/15 text-orange-200 text-xs font-semibold" data-testid="dating-crossed-paths-count">{crossedProfiles.length}</span>
              </div>
              <div className="mt-3 space-y-2">
                {crossedProfiles.length === 0 ? <p className="text-xs text-white/55">Wird automatisch gefüllt, wenn sich Wege räumlich kreuzen.</p> : crossedProfiles.slice(0, 3).map((profile) => <button key={profile.profile_id} onClick={() => { setTab('discover'); setProfiles((prev) => [profile, ...prev.filter((item) => item.profile_id !== profile.profile_id)]); setIdx(0); }} className="w-full rounded-xl bg-white/5 px-3 py-2 text-left text-xs text-white/85 hover:bg-white/10 transition-colors" data-testid={`dating-crossed-profile-${profile.profile_id}`}>{profile.name} · {profile.cross_count || 1}x gesehen · {profile.last_distance_km || 0} km</button>)}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-violet-500/20 bg-white/5 p-4" data-testid="dating-voice-intro-card">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">Voice Intro</p>
                <h3 className="text-sm font-semibold text-white">Deine Stimme in 30 Sekunden</h3>
              </div>
              <div className="flex items-center gap-2 flex-wrap" data-testid="dating-voice-intro-actions">
                {!voiceIntroState.recording ? (
                  <button onClick={startVoiceRecording} disabled={voiceIntroState.uploading} className="px-3 py-2 rounded-xl bg-violet-500/15 text-violet-200 text-xs font-semibold" data-testid="dating-voice-record-button">
                    <Mic size={14} className="inline mr-1" />
                    {voiceIntroState.uploading ? "Upload..." : "Aufnehmen"}
                  </button>
                ) : (
                  <button onClick={stopVoiceRecording} className="px-3 py-2 rounded-xl bg-red-500/15 text-red-200 text-xs font-semibold" data-testid="dating-voice-stop-button">
                    <Square size={14} className="inline mr-1" />Stop · {voiceIntroState.seconds}s
                  </button>
                )}
                {userProfile?.voice_intro?.media_id && <button onClick={removeVoiceIntro} className="px-3 py-2 rounded-xl bg-white/10 text-white/75 text-xs font-semibold" data-testid="dating-voice-delete-button"><Trash2 size={14} className="inline mr-1" />Löschen</button>}
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {!userProfile?.voice_intro?.media_id ? <p className="text-xs text-white/55">Füge eine kurze Sprachnachricht hinzu, damit Matches sofort deine Energie hören.</p> : <div className="rounded-xl bg-white/5 px-3 py-3" data-testid="dating-voice-intro-preview"><div className="flex items-center justify-between gap-3 flex-wrap"><div><p className="text-xs text-white font-semibold">{userProfile.voice_intro.duration_seconds}s Voice Intro</p><p className="text-[11px] text-white/45">Maximal 30 Sekunden, direkt im Profil sichtbar</p></div><button onClick={() => togglePlayVoiceIntro(userProfile.voice_intro.media_id)} className="px-3 py-2 rounded-xl bg-violet-500/15 text-violet-200 text-xs font-semibold" data-testid="dating-voice-play-button"><Play size={14} className="inline mr-1" />{voiceIntroState.playingId === userProfile.voice_intro.media_id ? "Neu starten" : "Abspielen"}</button></div><audio id={`dating-voice-audio-${userProfile.voice_intro.media_id}`} data-dating-voice-audio="true" src={`${API}/api/dating/voice-intro/${userProfile.voice_intro.media_id}`} onEnded={() => setVoiceIntroState((prev) => ({ ...prev, playingId: "" }))} /></div>}
            </div>
          </div>

          <div className="rounded-2xl border border-sky-500/20 bg-white/5 p-4" data-testid="dating-video-profile-card">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">Video-Profil</p>
                <h3 className="text-sm font-semibold text-white">Dein erster Eindruck in Bewegung</h3>
              </div>
              <div className="flex items-center gap-2 flex-wrap" data-testid="dating-video-profile-actions">
                {!videoProfileState.recording ? (
                  <button onClick={startVideoRecording} disabled={videoProfileState.uploading} className="px-3 py-2 rounded-xl bg-sky-500/15 text-sky-200 text-xs font-semibold" data-testid="dating-video-record-button">
                    <Video size={14} className="inline mr-1" />
                    {videoProfileState.uploading ? "Upload..." : "Video aufnehmen"}
                  </button>
                ) : (
                  <button onClick={stopVideoRecording} className="px-3 py-2 rounded-xl bg-red-500/15 text-red-200 text-xs font-semibold" data-testid="dating-video-stop-button">
                    <Square size={14} className="inline mr-1" />Stop · {videoProfileState.seconds}s
                  </button>
                )}
                {userProfile?.video_profile?.media_id && <button onClick={removeVideoProfile} className="px-3 py-2 rounded-xl bg-white/10 text-white/75 text-xs font-semibold" data-testid="dating-video-delete-button"><Trash2 size={14} className="inline mr-1" />Löschen</button>}
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {!userProfile?.video_profile?.media_id ? <p className="text-xs text-white/55">Zeig deine Mimik, Energie und Stimme mit einem kurzen Video bis 45 Sekunden.</p> : <div className="rounded-xl bg-white/5 px-3 py-3" data-testid="dating-video-profile-preview"><div className="flex items-center justify-between gap-3 flex-wrap mb-3"><div><p className="text-xs text-white font-semibold">{userProfile.video_profile.duration_seconds}s Video-Profil</p><p className="text-[11px] text-white/45">Sichtbar direkt im Profil und beim Entdecken</p></div><button onClick={() => togglePlayVideoProfile(userProfile.video_profile.media_id)} className="px-3 py-2 rounded-xl bg-sky-500/15 text-sky-200 text-xs font-semibold" data-testid="dating-video-play-button"><Play size={14} className="inline mr-1" />{videoProfileState.playingId === userProfile.video_profile.media_id ? "Neu starten" : "Abspielen"}</button></div><video id={`dating-video-player-${userProfile.video_profile.media_id}`} data-dating-video-player="true" className="w-full rounded-2xl bg-black/40 max-h-72 object-cover" src={`${API}/api/dating/video-profile/${userProfile.video_profile.media_id}`} onEnded={() => setVideoProfileState((prev) => ({ ...prev, playingId: "" }))} playsInline controls={false} /></div>}
            </div>
          </div>
        </div>
      )}

      {tab === "discover" && (
        <div className="px-4 flex flex-col items-center">
      {loading ? <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" /></div> : !current ? (
            <div className="text-center py-20"><Heart size={48} className="mx-auto mb-3 text-white/20" /><p className="text-sm text-white/60">Keine Profile mehr. Filter ändern oder später wiederkommen.</p></div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div key={current.profile_id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1, x: dir === "right" ? 260 : dir === "left" ? -260 : 0, rotate: dir === "right" ? 12 : dir === "left" ? -12 : 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="w-full max-w-sm rounded-3xl overflow-hidden bg-white/5 border border-white/10" data-testid={`dating-profile-${current.profile_id}`}>
                <div className="relative">
                  <img src={currentPhotos[0]} alt={current.name} className="w-full h-80 object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                  {current.spotlight && <div className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-yellow-300 px-3 py-1 text-[11px] font-bold text-black" data-testid={`dating-spotlight-badge-${current.profile_id}`}><Zap size={12} />Spotlight</div>}
                  <div className="absolute right-4 top-4 flex flex-col items-end gap-2">
                    <div className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold border ${safetyTone(current?.safety_summary?.scam_level)}`} data-testid={`dating-scam-badge-${current.profile_id}`}>
                      <Shield size={11} />Scam {safetyLabel(current?.safety_summary?.scam_level)}
                    </div>
                    <div className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold border ${safetyTone(current?.safety_summary?.nudity_level)}`} data-testid={`dating-nudity-badge-${current.profile_id}`}>
                      <Ban size={11} />Foto {safetyLabel(current?.safety_summary?.nudity_level)}
                    </div>
                  </div>
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="flex items-center gap-2"><h2 className="text-xl font-bold text-white">{current.name}{current.age ? `, ${current.age}` : ""}</h2>{current.verified && <Check size={16} className="text-blue-400" />}{current.premium && <Crown size={15} className="text-yellow-300" />}</div>
                    <div className="flex items-center gap-1 text-white/70 text-sm mt-1"><MapPin size={14} />{current.city || "Unbekannt"}</div>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-sm mb-2 text-white/80">{current.bio || "Noch keine Bio"}</p>
                  {(current.occupation || current.profile_prompt || current.compatibility_score || current.distance_km !== undefined || current.voice_intro?.media_id || current.video_profile?.media_id || current?.safety_summary) && <div className="space-y-2 mb-3">{current.occupation && <p className="text-xs text-white/55">{current.occupation}</p>}{current.profile_prompt && <p className="text-xs text-blue-200/80">“{current.profile_prompt}”</p>}{current.compatibility_score ? <p className="text-xs font-semibold text-green-300">{current.compatibility_score}% Match · Rank {current.discover_rank || 0}</p> : null}{current.distance_km !== undefined && current.distance_km !== null ? <p className="text-[11px] text-emerald-200">{current.distance_km} km entfernt</p> : null}{current.is_recently_active && <p className="text-[11px] text-emerald-300">Jetzt aktiv</p>}{current?.safety_summary ? <div className="flex flex-wrap gap-2" data-testid={`dating-safety-summary-${current.profile_id}`}><span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-semibold border ${safetyTone(current.safety_summary.scam_level)}`}>Scam {current.safety_summary.scam_score}/100</span><span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-semibold border ${safetyTone(current.safety_summary.nudity_level)}`}>Foto {current.safety_summary.nudity_score}/100</span></div> : null}{current.voice_intro?.media_id ? <button onClick={() => togglePlayVoiceIntro(current.voice_intro.media_id)} className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-3 py-1 text-[11px] font-semibold text-violet-200" data-testid={`dating-card-voice-play-${current.profile_id}`}><Play size={11} />Voice Intro · {current.voice_intro.duration_seconds}s</button> : null}{current.video_profile?.media_id ? <button onClick={() => togglePlayVideoProfile(current.video_profile.media_id)} className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-3 py-1 text-[11px] font-semibold text-sky-200" data-testid={`dating-card-video-play-${current.profile_id}`}><Video size={11} />Video · {current.video_profile.duration_seconds}s</button> : null}{current.voice_intro?.media_id ? <audio id={`dating-voice-audio-${current.voice_intro.media_id}`} data-dating-voice-audio="true" src={`${API}/api/dating/voice-intro/${current.voice_intro.media_id}`} onEnded={() => setVoiceIntroState((prev) => ({ ...prev, playingId: "" }))} /> : null}{current.video_profile?.media_id ? <video id={`dating-video-player-${current.video_profile.media_id}`} data-dating-video-player="true" className="hidden" src={`${API}/api/dating/video-profile/${current.video_profile.media_id}`} onEnded={() => setVideoProfileState((prev) => ({ ...prev, playingId: "" }))} playsInline /> : null}</div>}
                  {current?.match_reasons?.length ? <div className="mb-3 flex flex-wrap gap-2" data-testid={`dating-match-reasons-${current.profile_id}`}>{current.match_reasons.map((reason, index) => <span key={`${reason}-${index}`} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold text-white/80" data-testid={`dating-match-reason-${current.profile_id}-${index}`}>{reason}</span>)}</div> : null}
                  <div className="flex flex-wrap gap-2">{(current.interests || []).map((interest) => <span key={interest} className="px-3 py-1 rounded-full text-xs bg-pink-500/15 text-pink-300">{interest}</span>)}</div>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
          {current && (
            <div className="flex items-center gap-6 mt-6">
              <button onClick={handleRewind} className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg bg-white/5 border border-white/15" data-testid="dating-rewind-button"><ArrowLeft size={20} className="text-white/80" /></button>
              <button onClick={() => handleAction("pass")} className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg bg-white/5 border-2 border-red-400" data-testid="dating-pass-button"><X size={28} className="text-red-400" /></button>
              <button onClick={() => handleAction("superlike")} className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg bg-white/5 border-2 border-blue-400 relative" data-testid="dating-superlike-button"><Star size={22} className="text-blue-400" /><span className="absolute -bottom-6 text-[10px] text-blue-300 whitespace-nowrap">Super Like</span></button>
              <button onClick={() => handleAction("like")} className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg bg-white/5 border-2 border-green-400" data-testid="dating-like-button"><Heart size={28} className="text-green-400" /></button>
            </div>
          )}
        </div>
      )}

      {tab === "likes" && (
        <div className="px-4 space-y-3" data-testid="dating-likes-you-list">
          {likesYou.locked ? (
            <div className="rounded-3xl border border-yellow-400/20 bg-yellow-500/10 p-6 text-center" data-testid="dating-likes-paywall-card"><Crown size={36} className="mx-auto mb-3 text-yellow-300" /><h3 className="text-lg font-bold text-white">Likes You ist Gold / Platinum</h3><p className="text-sm text-white/65 mt-2">{likesYou.count} Personen haben dich bereits geliked — jetzt sichtbar machen.</p><div className="mt-4 grid grid-cols-3 gap-2 opacity-70 blur-[1px]" data-testid="dating-likes-blur-grid">{Array.from({ length: Math.min(Math.max(likesYou.count, 3), 6) }).map((_, index) => <div key={index} className="rounded-2xl border border-white/10 bg-white/10 p-3"><div className="mx-auto h-12 w-12 rounded-full bg-white/15" /><div className="mt-2 h-2 rounded bg-white/15" /><div className="mt-1 h-2 w-2/3 mx-auto rounded bg-white/10" /></div>)}</div><p className="text-xs text-white/55 mt-4">{premiumPlans.find((plan) => plan.tier === 'gold') ? `${premiumPlans.find((plan) => plan.tier === 'gold').label} · ${(premiumPlans.find((plan) => plan.tier === 'gold').starter_offer?.offer_price_eur || premiumPlans.find((plan) => plan.tier === 'gold').price_eur).toFixed(2)} €` : 'Gold aktivieren'}</p><button onClick={() => startPremiumCheckout('gold_30d')} className="mt-4 px-5 py-3 rounded-2xl font-bold text-black bg-gradient-to-r from-yellow-300 to-orange-400" data-testid="dating-likes-upgrade-button">{premiumCheckoutState.loading ? 'Weiterleitung...' : 'Likes freischalten'}</button></div>
          ) : likesYou.profiles.length === 0 ? (
            <div className="text-center py-20"><Heart size={48} className="mx-auto mb-3 text-white/20" /><p className="text-sm text-white/60">Noch keine Likes</p></div>
          ) : likesYou.profiles.map((profile) => (
            <motion.div key={profile.profile_id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl p-4 flex items-center gap-3 bg-white/5 border border-blue-500/20" data-testid={`dating-like-you-${profile.profile_id}`}>
              <img src={profile.avatar} alt={profile.name} className="w-14 h-14 rounded-full object-cover" />
              <div className="flex-1"><h3 className="text-sm font-semibold text-white flex items-center gap-1">{profile.name}{profile.age ? `, ${profile.age}` : ''}{profile.verified && <BadgeCheck size={13} className="text-blue-300" />}</h3><p className="text-xs text-white/60 truncate">{profile.city} · {profile.incoming_type === 'superlike' ? 'Super Like' : 'Like'}</p><div className="flex flex-wrap gap-2 mt-2">{profile?.safety_summary ? <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold border ${safetyTone(profile.safety_summary.scam_level)}`} data-testid={`dating-like-safety-${profile.profile_id}`}>Safety {profile.safety_summary.total_score}/100</span> : null}{profile.voice_intro?.media_id ? <button onClick={() => togglePlayVoiceIntro(profile.voice_intro.media_id)} className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-1 text-[10px] font-semibold text-violet-200" data-testid={`dating-like-voice-play-${profile.profile_id}`}><Play size={10} />Voice</button> : null}{profile.video_profile?.media_id ? <button onClick={() => togglePlayVideoProfile(profile.video_profile.media_id)} className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-1 text-[10px] font-semibold text-sky-200" data-testid={`dating-like-video-play-${profile.profile_id}`}><Video size={10} />Video</button> : null}</div>{profile.voice_intro?.media_id ? <audio id={`dating-voice-audio-${profile.voice_intro.media_id}`} data-dating-voice-audio="true" src={`${API}/api/dating/voice-intro/${profile.voice_intro.media_id}`} onEnded={() => setVoiceIntroState((prev) => ({ ...prev, playingId: "" }))} /> : null}{profile.video_profile?.media_id ? <video id={`dating-video-player-${profile.video_profile.media_id}`} data-dating-video-player="true" className="hidden" src={`${API}/api/dating/video-profile/${profile.video_profile.media_id}`} onEnded={() => setVideoProfileState((prev) => ({ ...prev, playingId: "" }))} playsInline /> : null}</div>
              <button onClick={() => { setTab('discover'); setProfiles((prev) => [profile, ...prev.filter((item) => item.profile_id !== profile.profile_id)]); setIdx(0); }} className="px-3 py-2 rounded-xl bg-blue-500/15 text-blue-300 text-xs font-semibold" data-testid={`dating-open-like-${profile.profile_id}`}>Ansehen</button>
            </motion.div>
          ))}
        </div>
      )}

      {tab === "matches" && (
        <div className="px-4 space-y-3" data-testid="dating-matches-list">
          {matches.length === 0 ? <div className="text-center py-20"><Sparkles size={48} className="mx-auto mb-3 text-white/20" /><p className="text-sm text-white/60">Noch keine Matches</p></div> : matches.map((match) => (
            <motion.div key={match.match_id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl p-4 flex items-center gap-3 bg-white/5 border border-pink-500/20" data-testid={`dating-match-${match.match_id}`}>
              <img src={match.avatar} alt={match.name} className="w-14 h-14 rounded-full object-cover" />
              <button className="flex-1 text-left" onClick={() => loadMessages(match)} data-testid={`dating-open-chat-${match.match_id}`}>
                <h3 className="text-sm font-semibold text-white">{match.name}</h3>
                <p className="text-xs text-white/60 truncate">{match.last_message || match.city}</p>
                <p className="text-[10px] text-white/35 mt-1">{match.last_message_at ? 'Aktiv im Chat' : 'Neu gematcht'}</p>
                <div className="flex flex-wrap gap-2 mt-2">{match?.safety_summary ? <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold border ${safetyTone(match.safety_summary.scam_level)}`} data-testid={`dating-match-safety-chip-${match.match_id}`}><Shield size={10} />Safety {match.safety_summary.total_score}/100</span> : null}{match?.chat_safety_summary?.score > 0 ? <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold border ${safetyTone(match.chat_safety_summary.level)}`} data-testid={`dating-match-chat-safety-${match.match_id}`}><Ban size={10} />Chat {match.chat_safety_summary.score}/100</span> : null}{match.voice_intro?.media_id ? <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-1 text-[10px] font-semibold text-violet-200" data-testid={`dating-match-voice-chip-${match.match_id}`}><Mic size={10} />Voice Intro</span> : null}{match.video_profile?.media_id ? <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-1 text-[10px] font-semibold text-sky-200" data-testid={`dating-match-video-chip-${match.match_id}`}><Video size={10} />Video-Profil</span> : null}</div>
                {match?.match_reasons?.length ? <div className="mt-2 flex flex-wrap gap-2" data-testid={`dating-match-reasons-list-${match.match_id}`}>{match.match_reasons.map((reason, index) => <span key={`${reason}-${index}`} className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-white/70" data-testid={`dating-match-reason-chip-${match.match_id}-${index}`}>{reason}</span>)}</div> : null}
              </button>
              {match.voice_intro?.media_id ? <button onClick={() => togglePlayVoiceIntro(match.voice_intro.media_id)} className="px-3 py-2 rounded-xl bg-violet-500/15 text-violet-200 text-[11px] font-semibold" data-testid={`dating-match-voice-play-${match.match_id}`}>{voiceIntroState.playingId === match.voice_intro.media_id ? 'Neu starten' : 'Voice'}</button> : null}
              {match.video_profile?.media_id ? <button onClick={() => togglePlayVideoProfile(match.video_profile.media_id)} className="px-3 py-2 rounded-xl bg-sky-500/15 text-sky-200 text-[11px] font-semibold" data-testid={`dating-match-video-play-${match.match_id}`}>{videoProfileState.playingId === match.video_profile.media_id ? 'Neu starten' : 'Video'}</button> : null}
              {match.voice_intro?.media_id ? <audio id={`dating-voice-audio-${match.voice_intro.media_id}`} data-dating-voice-audio="true" src={`${API}/api/dating/voice-intro/${match.voice_intro.media_id}`} onEnded={() => setVoiceIntroState((prev) => ({ ...prev, playingId: "" }))} /> : null}
              {match.video_profile?.media_id ? <video id={`dating-video-player-${match.video_profile.media_id}`} data-dating-video-player="true" className="hidden" src={`${API}/api/dating/video-profile/${match.video_profile.media_id}`} onEnded={() => setVideoProfileState((prev) => ({ ...prev, playingId: "" }))} playsInline /> : null}
              <button onClick={() => runAiIcebreakers(match.match_id)} className="px-3 py-2 rounded-xl bg-cyan-500/15 text-cyan-200 text-[11px] font-semibold" data-testid={`dating-ai-icebreaker-button-${match.match_id}`}>{aiLoading === `ice-${match.match_id}` ? '...' : 'AI Icebreaker'}</button>
              {match.unread_count > 0 && <span className="min-w-6 h-6 px-2 rounded-full bg-pink-500 text-white text-xs font-bold flex items-center justify-center" data-testid={`dating-unread-${match.match_id}`}>{match.unread_count}</span>}
              <button onClick={() => loadMessages(match)} className="w-10 h-10 rounded-full flex items-center justify-center bg-pink-500/15" data-testid={`dating-message-button-${match.match_id}`}><MessageCircle size={18} className="text-pink-300" /></button>
              <button onClick={() => setShowSafetySheet({ profile_id: match.profile_id, match_id: match.match_id, name: match.name })} className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5" data-testid={`dating-safety-button-${match.match_id}`}><Shield size={16} className="text-white/70" /></button>
            </motion.div>
          ))}
        </div>
      )}

      {tab === "chat" && activeMatch && (
        <div className="px-4 pb-4" data-testid="dating-chat-panel">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setTab("matches")} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center" data-testid="dating-chat-back"><ArrowLeft size={18} /></button>
            <img src={activeMatch.avatar} alt={activeMatch.name} className="w-11 h-11 rounded-full object-cover" />
            <div className="flex-1"><h3 className="font-semibold text-white">{activeMatch.name}</h3><p className="text-xs text-white/55">{activeMatch.city} · {activeMatch.verified ? 'Verifiziert' : 'Nicht verifiziert'}</p></div>
            <button onClick={() => setShowSafetySheet({ profile_id: activeMatch.profile_id, match_id: activeMatch.match_id, name: activeMatch.name })} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center" data-testid="dating-chat-safety"><Ban size={16} className="text-white/75" /></button>
          </div>
          <div className="mb-3 grid gap-3 sm:grid-cols-2" data-testid="dating-chat-safety-summary-grid">
            <div className={`rounded-2xl border px-4 py-3 ${safetyTone(activeMatch?.safety_summary?.scam_level)}`} data-testid="dating-chat-profile-safety-card">
              <p className="text-[11px] uppercase tracking-[0.16em]">Profil-Sicherheit</p>
              <p className="mt-1 text-sm font-semibold">Scam {activeMatch?.safety_summary?.scam_score || 0}/100 · Foto {activeMatch?.safety_summary?.nudity_score || 0}/100</p>
            </div>
            <div className={`rounded-2xl border px-4 py-3 ${safetyTone(chatSafetySummary?.level)}`} data-testid="dating-chat-message-safety-card">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em]">Chat-Sicherheit</p>
                  <p className="mt-1 text-sm font-semibold">{chatSafetySummary?.score || 0}/100 · {safetyLabel(chatSafetySummary?.level)}</p>
                </div>
                <button onClick={refreshChatSafety} className="rounded-xl bg-black/15 px-3 py-2 text-[11px] font-semibold" data-testid="dating-chat-safety-refresh-button">{chatSafetyChecking ? 'Prüft...' : 'Neu prüfen'}</button>
              </div>
              {chatSafetySummary?.warning ? <p className="mt-2 text-xs" data-testid="dating-chat-safety-warning">{chatSafetySummary.warning}</p> : <p className="mt-2 text-xs" data-testid="dating-chat-safety-clear">Keine kritischen Chat-Signale.</p>}
            </div>
          </div>
          {activeMatch?.match_reasons?.length ? <div className="mb-3 flex flex-wrap gap-2" data-testid="dating-chat-match-reasons">{activeMatch.match_reasons.map((reason, index) => <span key={`${reason}-${index}`} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold text-white/75" data-testid={`dating-chat-match-reason-${index}`}>{reason}</span>)}</div> : null}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-3 space-y-3 min-h-[52vh] max-h-[52vh] overflow-y-auto" data-testid="dating-chat-messages">
            {messages.length === 0 ? <p className="text-sm text-white/55 text-center py-10">Schreib die erste Nachricht.</p> : messages.map((message) => (
              <div key={message.message_id} className={`flex ${message.sender_user_id === userProfile?.user_id ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[78%] px-4 py-3 rounded-2xl text-sm ${message.sender_user_id === userProfile?.user_id ? "bg-pink-500 text-white" : "bg-white/10 text-white"}`}>{message.text}</div>
              </div>
            ))}
          </div>
          {aiIcebreakers.length > 0 && <div className="mt-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-3" data-testid="dating-ai-icebreakers-panel"><p className="text-[11px] uppercase tracking-[0.18em] text-cyan-200/70 mb-2">AI Icebreaker</p><div className="space-y-2">{aiIcebreakers.map((item, index) => <button key={`${item}-${index}`} onClick={() => setChatText(item)} className="w-full rounded-xl bg-white/5 px-3 py-2 text-left text-xs text-white hover:bg-white/10 transition-colors" data-testid={`dating-ai-icebreaker-${index}`}>{item}</button>)}</div></div>}
          {chatReadAt && <p className="mt-2 text-[11px] text-white/35 text-right" data-testid="dating-chat-read-state">Gelesen / geöffnet</p>}
          <div className="mt-3 flex gap-2">
            <input value={chatText} onChange={(event) => setChatText(event.target.value)} placeholder="Nachricht schreiben..." className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none" data-testid="dating-chat-input" />
            <button onClick={sendChat} className="px-4 py-3 rounded-2xl bg-pink-500 text-white font-semibold" data-testid="dating-chat-send">Senden</button>
          </div>
          <p className="mt-2 text-[11px] text-white/40" data-testid="dating-chat-safety-hint">Kein Geld, keine Codes, keine externen Zahlungsdaten im Dating-Chat teilen.</p>
        </div>
      )}

      <AnimatePresence>
        {matchPopup && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur" onClick={() => setMatchPopup(false)}><motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="text-center p-8"><Sparkles size={64} className="mx-auto mb-4 text-pink-400" /><h2 className="text-3xl font-bold text-white mb-2">It&apos;s a Match!</h2><p className="text-white/70">Ihr mögt euch gegenseitig.</p><button onClick={() => { setMatchPopup(false); setTab("matches"); }} className="mt-6 px-6 py-3 rounded-xl font-semibold text-sm bg-pink-500 text-white" data-testid="dating-match-close">Zum Match</button></motion.div></motion.div>}
      </AnimatePresence>

      <AnimatePresence>
        {showPaywall && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"><motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="w-full max-w-2xl rounded-3xl p-8 bg-[#0F1016] border border-pink-500/30" data-testid="dating-paywall-modal"><div className="flex items-start gap-4"><div className="w-20 h-20 rounded-full flex items-center justify-center bg-gradient-to-r from-yellow-300 to-orange-400"><Crown size={40} className="text-black" /></div><div><h2 className="text-2xl font-bold text-white mb-2">Mehr Matches freischalten</h2><p className="text-gray-400 text-sm">Wie bei Tinder Gold / Platinum: Unlimited Likes, Likes You, Priorität, Boosts und stärkere Conversion.</p>{monetization?.starter_offer ? <p className="mt-2 text-xs text-emerald-200" data-testid="dating-paywall-starter-offer">Starter Deal aktiv: {monetization.starter_offer.offer_price_eur.toFixed(2)} € statt {monetization.starter_offer.regular_price_eur.toFixed(2)} €</p> : null}</div></div><div className="mt-6 grid gap-3 md:grid-cols-3">{premiumPlans.slice(0, 3).map((plan) => <button key={plan.plan_id} onClick={() => startPremiumCheckout(plan.plan_id)} className={`rounded-3xl border px-4 py-5 text-left ${plan.tier === 'platinum' ? 'border-fuchsia-400/30 bg-fuchsia-500/10' : plan.tier === 'gold' ? 'border-yellow-400/25 bg-yellow-500/10' : 'border-white/10 bg-white/5'}`} data-testid={`dating-paywall-plan-${plan.plan_id}`}><p className="text-sm font-bold text-white">{plan.label}</p><p className="mt-2 text-2xl font-bold text-white">{(plan.starter_offer?.offer_price_eur || plan.price_eur).toFixed(2)} €</p><p className="text-[11px] text-white/45">30 Tage</p><div className="mt-3 space-y-1">{(plan.features || []).slice(0, 4).map((feature, index) => <p key={`${feature}-${index}`} className="text-[11px] text-white/75" data-testid={`dating-paywall-plan-feature-${plan.plan_id}-${index}`}>• {feature}</p>)}</div></button>)}</div><div className="mt-5 grid gap-3 sm:grid-cols-3" data-testid="dating-paywall-consumables-grid">{consumables.slice(0, 3).map((item) => <button key={item.item_id} onClick={() => startConsumableCheckout(item.item_id)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left" data-testid={`dating-paywall-consumable-${item.item_id}`}><p className="text-xs uppercase tracking-[0.16em] text-white/45">Einzelkauf</p><p className="mt-1 text-sm font-bold text-white">{item.label}</p><p className="mt-1 text-lg font-bold text-white">{item.price_eur.toFixed(2)} €</p></button>)}</div><button onClick={() => setShowPaywall(false)} className="mt-5 w-full py-3 rounded-xl font-medium text-white bg-white/5" data-testid="dating-upgrade-cancel">Abbrechen</button></motion.div></motion.div>}
      </AnimatePresence>

      <AnimatePresence>
        {showProfileSetup && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm overflow-y-auto"><div className="min-h-screen flex items-start justify-center px-4 py-6"><div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0C0E14] p-5" data-testid="dating-profile-editor"><div className="flex items-center justify-between mb-4"><div><h2 className="text-xl font-bold text-white">Dating Quick Setup</h2><p className="mt-1 text-sm text-white/55">Name, Alter, Stadt und Bild sind schon aus deiner Registrierung da. Hier stellst du nur Dating-Präferenzen ein.</p></div><div className="flex items-center gap-3"><button onClick={dismissProfileSetup} className="text-xs text-white/45" data-testid="dating-profile-skip-button">Später</button><button onClick={() => setShowProfileSetup(false)} className="text-white/60">{t("common.close")}</button></div></div><div className="space-y-4"><div className="rounded-2xl border border-white/10 bg-white/5 p-4" data-testid="dating-profile-auto-import-card"><p className="text-xs uppercase tracking-[0.18em] text-white/45 mb-2">Automatisch übernommen</p><div className="grid grid-cols-2 gap-3 text-sm text-white/75"><div data-testid="dating-profile-auto-name">Name: <span className="text-white">{profileForm.name || '—'}</span></div><div data-testid="dating-profile-auto-age">Alter: <span className="text-white">{profileForm.age || '—'}</span></div><div data-testid="dating-profile-auto-city">Stadt: <span className="text-white">{profileForm.city || '—'}</span></div><div data-testid="dating-profile-auto-photo">Foto: <span className="text-white">{profileForm.photos?.[0] ? 'Vorhanden' : 'Fehlt'}</span></div></div></div><input value={profileForm.occupation || ''} onChange={(e) => setProfileForm((p) => ({ ...p, occupation: e.target.value }))} placeholder="Beruf / Rolle" className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm" data-testid="dating-profile-occupation-input" /><textarea value={profileForm.bio} onChange={(e) => setProfileForm((p) => ({ ...p, bio: e.target.value }))} placeholder="Beschreibe dich" rows={4} className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm" data-testid="dating-profile-bio-input" /><textarea value={profileForm.profile_prompt || ''} onChange={(e) => setProfileForm((p) => ({ ...p, profile_prompt: e.target.value }))} placeholder="Profil-Prompt: z. B. Mein perfekter Sonntag ist..." rows={3} className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm" data-testid="dating-profile-prompt-input" /><div><p className="text-xs uppercase tracking-[0.18em] text-white/45 mb-2">Interessen</p><div className="flex flex-wrap gap-2">{chipOptions.map((chip) => { const active = profileForm.interests.includes(chip); return <button key={chip} type="button" onClick={() => setProfileForm((p) => ({ ...p, interests: active ? p.interests.filter((item) => item !== chip) : [...p.interests, chip] }))} className={`px-3 py-2 rounded-full text-xs border ${active ? "border-pink-400 bg-pink-500/20 text-pink-300" : "border-white/10 bg-white/5 text-white/70"}`} data-testid={`dating-interest-${chip}`}>{chip}</button>; })}</div></div><div className="grid grid-cols-2 gap-3"><select value={profileForm.gender} onChange={(e) => setProfileForm((p) => ({ ...p, gender: e.target.value }))} className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm" data-testid="dating-profile-gender-select"><option value="unspecified">Geschlecht</option><option value="man">Mann</option><option value="woman">Frau</option><option value="nonbinary">Non-binary</option></select><select value={profileForm.relationship_intent} onChange={(e) => setProfileForm((p) => ({ ...p, relationship_intent: e.target.value }))} className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm" data-testid="dating-profile-intent-select"><option value="serious">Beziehung</option><option value="casual">Locker</option><option value="friends">Freunde</option><option value="open">Offen</option></select></div><div><p className="text-xs uppercase tracking-[0.18em] text-white/45 mb-2">Ich interessiere mich für</p><div className="flex flex-wrap gap-2">{[{ key: "women", label: "Frauen" }, { key: "men", label: "Männer" }, { key: "nonbinary", label: "Non-binary" }].map((item) => { const active = profileForm.seeking.includes(item.key); return <button key={item.key} type="button" onClick={() => setProfileForm((p) => ({ ...p, seeking: active ? p.seeking.filter((entry) => entry !== item.key) : [...p.seeking, item.key] }))} className={`px-3 py-2 rounded-full text-xs border ${active ? "border-blue-400 bg-blue-500/20 text-blue-300" : "border-white/10 bg-white/5 text-white/70"}`} data-testid={`dating-seeking-${item.key}`}>{item.label}</button>; })}</div></div><button onClick={saveProfile} className="w-full py-4 rounded-2xl font-bold bg-pink-500 text-white" data-testid="dating-profile-save-button">{t("common.save")}</button></div></div></div></motion.div>}
      </AnimatePresence>

      <AnimatePresence>
        {showFilters && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm overflow-y-auto"><div className="min-h-screen flex items-start justify-center px-4 py-6"><div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0C0E14] p-5" data-testid="dating-filters-sheet"><div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold text-white">Dating-Filter</h2><button onClick={() => setShowFilters(false)} className="text-white/60">{t("common.close")}</button></div><div className="grid grid-cols-2 gap-3"><input type="number" min="18" max="99" value={filters.age_min} onChange={(e) => setFilters((f) => ({ ...f, age_min: Number(e.target.value || 18) }))} placeholder="Alter min" className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm" data-testid="dating-filter-age-min" /><input type="number" min="18" max="99" value={filters.age_max} onChange={(e) => setFilters((f) => ({ ...f, age_max: Number(e.target.value || 99) }))} placeholder="Alter max" className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm" data-testid="dating-filter-age-max" /></div><input value={filters.city} onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))} placeholder="Stadt" className="mt-3 w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm" data-testid="dating-filter-city" /><select value={filters.relationship_intent || ""} onChange={(e) => setFilters((f) => ({ ...f, relationship_intent: e.target.value }))} className="mt-3 w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm" data-testid="dating-filter-intent"><option value="">Alle Absichten</option><option value="serious">Beziehung</option><option value="casual">Locker</option><option value="friends">Freunde</option><option value="open">Offen</option></select><div className="mt-3"><p className="text-xs uppercase tracking-[0.18em] text-white/45 mb-2">Suche</p><div className="flex flex-wrap gap-2">{[{ key: "women", label: "Frauen" }, { key: "men", label: "Männer" }, { key: "nonbinary", label: "Non-binary" }].map((item) => { const active = (filters.seeking || []).includes(item.key); return <button key={item.key} type="button" onClick={() => setFilters((f) => ({ ...f, seeking: active ? f.seeking.filter((entry) => entry !== item.key) : [...(f.seeking || []), item.key] }))} className={`px-3 py-2 rounded-full text-xs border ${active ? "border-blue-400 bg-blue-500/20 text-blue-300" : "border-white/10 bg-white/5 text-white/70"}`} data-testid={`dating-filter-seeking-${item.key}`}>{item.label}</button>; })}</div></div><button onClick={saveFilters} className="w-full mt-4 py-4 rounded-2xl font-bold bg-pink-500 text-white" data-testid="dating-filter-save-button">Filter anwenden</button></div></div></motion.div>}
      </AnimatePresence>

      <AnimatePresence>
        {showSafetySheet && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-end"><div className="w-full rounded-t-3xl border border-white/10 bg-[#0C0E14] p-5" data-testid="dating-safety-sheet"><div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold text-white">Sicherheit · {showSafetySheet.name}</h2><button onClick={() => setShowSafetySheet(null)} className="text-white/60">{t("common.close")}</button></div><textarea value={reportReason} onChange={(e) => setReportReason(e.target.value)} placeholder="Grund angeben" rows={3} className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm" data-testid="dating-safety-reason" /><div className="grid grid-cols-1 gap-3 mt-4"><button onClick={() => runSafetyAction("report")} className="py-3 rounded-2xl bg-amber-500/15 text-amber-300 font-semibold" data-testid="dating-report-button">Profil melden</button><button onClick={() => runSafetyAction("block")} className="py-3 rounded-2xl bg-red-500/15 text-red-300 font-semibold" data-testid="dating-block-button">Profil blockieren</button>{showSafetySheet.match_id && <button onClick={() => runSafetyAction("unmatch")} className="py-3 rounded-2xl bg-white/5 text-white font-semibold" data-testid="dating-unmatch-button">Match auflösen</button>}</div></div></motion.div>}
      </AnimatePresence>
    </div>
  );
}