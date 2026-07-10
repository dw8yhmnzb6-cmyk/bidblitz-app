import { useEffect, useState } from "react";
import { ArrowLeft, Save, ShieldCheck, Video, Users } from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || data.message || "Request failed");
  return data;
}

export default function MiningTrustAdminPage({ onBack }) {
  const [leads, setLeads] = useState([]);
  const [videos, setVideos] = useState([]);
  const [savingCity, setSavingCity] = useState("");

  const load = async () => {
    try {
      const [leadData, videoData] = await Promise.all([
        api("/api/mining/trust/leads"),
        api("/api/mining/trust/videos"),
      ]);
      const normalizedVideos = ["Dubai", "Abu Dhabi"].map((city) => videoData.videos.find((v) => v.city === city) || ({ city, title: `${city} Video`, description: "", video_url: "", thumbnail_url: "" }));
      setLeads(leadData.leads || []);
      setVideos(normalizedVideos);
    } catch (error) {
      toast.error(error.message);
    }
  };

  useEffect(() => { load(); }, []);

  const updateLeadStatus = async (leadId, status) => {
    try {
      const data = await api(`/api/mining/trust/leads/${leadId}/status`, { method: "POST", body: JSON.stringify({ status }) });
      setLeads((prev) => prev.map((item) => item.lead_id === leadId ? data.lead : item));
      toast.success("Lead aktualisiert");
    } catch (error) {
      toast.error(error.message);
    }
  };

  const saveVideo = async (video) => {
    try {
      setSavingCity(video.city);
      const data = await api("/api/mining/trust/videos", { method: "POST", body: JSON.stringify(video) });
      setVideos((prev) => prev.map((item) => item.city === video.city ? data.video : item));
      toast.success(`${video.city} Video gespeichert`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSavingCity("");
    }
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-white pb-20" data-testid="mining-trust-admin-page">
      <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3 mb-6">
          <button onClick={onBack} className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5" data-testid="mining-trust-admin-back-button"><ArrowLeft size={18} /></button>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-200" data-testid="mining-trust-admin-badge"><ShieldCheck size={14} /> Mining Trust CRM</div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-[30px] border border-white/10 bg-white/5 p-5" data-testid="mining-trust-admin-videos">
            <div className="flex items-center gap-2 mb-4"><Video size={18} className="text-amber-300" /><h2 className="text-lg font-bold">Dubai / Abu Dhabi Videos</h2></div>
            <div className="space-y-4">
              {videos.map((video, index) => (
                <div key={video.city} className="rounded-2xl border border-white/10 bg-black/20 p-4" data-testid={`mining-trust-admin-video-${index}`}>
                  <p className="text-sm font-semibold text-white mb-3">{video.city}</p>
                  <div className="grid gap-3">
                    <input value={video.title} onChange={(e) => setVideos((prev) => prev.map((item) => item.city === video.city ? { ...item, title: e.target.value } : item))} placeholder="Titel" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none" data-testid={`mining-trust-admin-video-title-${index}`} />
                    <input value={video.video_url} onChange={(e) => setVideos((prev) => prev.map((item) => item.city === video.city ? { ...item, video_url: e.target.value } : item))} placeholder="Video URL" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none" data-testid={`mining-trust-admin-video-url-${index}`} />
                    <input value={video.thumbnail_url || ""} onChange={(e) => setVideos((prev) => prev.map((item) => item.city === video.city ? { ...item, thumbnail_url: e.target.value } : item))} placeholder="Thumbnail URL" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none" data-testid={`mining-trust-admin-video-thumb-${index}`} />
                    <textarea value={video.description || ""} onChange={(e) => setVideos((prev) => prev.map((item) => item.city === video.city ? { ...item, description: e.target.value } : item))} rows={3} placeholder="Beschreibung" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none resize-none" data-testid={`mining-trust-admin-video-description-${index}`} />
                    <button onClick={() => saveVideo(video)} className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-400 px-4 py-3 text-sm font-bold text-black" data-testid={`mining-trust-admin-video-save-${index}`}>
                      <Save size={16} /> {savingCity === video.city ? "Speichert..." : "Video speichern"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[30px] border border-white/10 bg-white/5 p-5" data-testid="mining-trust-admin-leads">
            <div className="flex items-center gap-2 mb-4"><Users size={18} className="text-sky-300" /><h2 className="text-lg font-bold">Mining Leads</h2></div>
            <div className="space-y-3">
              {leads.map((lead, index) => (
                <div key={lead.lead_id} className="rounded-2xl border border-white/10 bg-black/20 p-4" data-testid={`mining-trust-admin-lead-${index}`}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm font-semibold text-white">{lead.name} · {lead.company || "Ohne Firma"}</p>
                      <p className="text-xs text-white/55 mt-1">{lead.email}</p>
                      <p className="text-sm text-white/70 mt-3">{lead.message || "Keine Nachricht"}</p>
                    </div>
                    <select value={lead.status || "new"} onChange={(e) => updateLeadStatus(lead.lead_id, e.target.value)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs outline-none" data-testid={`mining-trust-admin-lead-status-${index}`}>
                      <option value="new">Neu</option>
                      <option value="contacted">Kontaktiert</option>
                      <option value="qualified">Qualifiziert</option>
                      <option value="closed">Abgeschlossen</option>
                    </select>
                  </div>
                </div>
              ))}
              {leads.length === 0 && <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/55" data-testid="mining-trust-admin-leads-empty">Noch keine Leads vorhanden.</div>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}