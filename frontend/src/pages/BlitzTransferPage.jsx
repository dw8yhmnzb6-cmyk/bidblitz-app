import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Upload, Send, FileText, Image, Music, Film, Archive, Code,
  ChevronLeft, X, Download, Clock, Link2, Copy, Check, Trash2,
  Plus, Shield, Zap,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const FILE_ICONS = {
  pdf: FileText, doc: FileText, docx: FileText, txt: FileText, csv: FileText, xls: FileText, xlsx: FileText,
  jpg: Image, jpeg: Image, png: Image, gif: Image, webp: Image, svg: Image,
  mp3: Music, wav: Music, ogg: Music, flac: Music,
  mp4: Film, mov: Film, avi: Film, mkv: Film, webm: Film,
  zip: Archive, rar: Archive, "7z": Archive, tar: Archive, gz: Archive,
  js: Code, py: Code, html: Code, css: Code, json: Code,
};

const getIcon = (ext) => FILE_ICONS[ext] || FileText;

const humanSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
};

const BlitzTransferPage = ({ onNavigate, onBack }) => {
  const [tab, setTab] = useState("upload");
  const [files, setFiles] = useState([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [recipient, setRecipient] = useState("");
  const [expDays, setExpDays] = useState(7);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [myTransfers, setMyTransfers] = useState([]);
  const [copied, setCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  const loadTransfers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/transfer/my-transfers`, { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        setMyTransfers(d.transfers || []);
      }
    } catch {}
  }, []);

  useEffect(() => { loadTransfers(); }, [loadTransfers]);

  const addFiles = (newFiles) => {
    const arr = Array.from(newFiles);
    if (files.length + arr.length > 10) {
      toast.error("Maximal 10 Dateien");
      return;
    }
    setFiles(prev => [...prev, ...arr]);
  };

  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB

  const uploadChunked = async (file) => {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    // Init
    const initRes = await fetch(`${API}/api/transfer/chunk/init`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, total_size: file.size, total_chunks: totalChunks }),
    });
    if (!initRes.ok) { const d = await initRes.json(); throw new Error(d.detail || "Init failed"); }
    const { upload_id } = await initRes.json();

    // Upload chunks
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const blob = file.slice(start, end);

      const form = new FormData();
      form.append("chunk", blob, `chunk_${i}`);

      const chunkRes = await fetch(`${API}/api/transfer/chunk/${upload_id}/${i}`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (!chunkRes.ok) throw new Error(`Chunk ${i} fehlgeschlagen`);
      setProgress(Math.round(((i + 1) / totalChunks) * 90));
    }

    return upload_id;
  };

  const handleUpload = async () => {
    if (files.length === 0) { toast.error("Keine Dateien ausgewaehlt"); return; }
    setUploading(true);
    setProgress(5);

    try {
      // For large files (>50 MB single file): use chunked upload
      if (files.length === 1 && files[0].size > 50 * 1024 * 1024) {
        const uploadId = await uploadChunked(files[0]);
        setProgress(92);

        // Finalize
        const finRes = await fetch(`${API}/api/transfer/chunk/finalize`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ upload_id: uploadId, title, message, recipient_email: recipient, expires_days: expDays }),
        });
        const d = await finRes.json();
        if (!finRes.ok) throw new Error(d.detail || "Finalize fehlgeschlagen");
        setProgress(100);
        setResult(d);
        toast.success(d.message);
      } else {
        // Small files: normal upload
        const formData = new FormData();
        files.forEach(f => formData.append("files", f));
        formData.append("title", title);
        formData.append("message", message);
        formData.append("recipient_email", recipient);
        formData.append("expires_days", expDays.toString());

        setProgress(30);
        const res = await fetch(`${API}/api/transfer/create`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        setProgress(90);
        const d = await res.json();
        if (!res.ok) throw new Error(d.detail || "Upload fehlgeschlagen");
        setProgress(100);
        setResult(d);
        toast.success(d.message);
      }
      loadTransfers();
    } catch (e) {
      toast.error(e.message);
    }
    setUploading(false);
  };

  const copyLink = () => {
    if (!result) return;
    const link = `${window.location.origin}${result.share_link}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      toast.success("Link kopiert!");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const deleteTransfer = async (id) => {
    try {
      await fetch(`${API}/api/transfer/${id}`, { method: "DELETE", credentials: "include" });
      toast.success("Transfer geloescht");
      loadTransfers();
    } catch {}
  };

  const resetUpload = () => {
    setFiles([]);
    setTitle("");
    setMessage("");
    setRecipient("");
    setResult(null);
    setProgress(0);
  };

  const totalSize = files.reduce((s, f) => s + f.size, 0);

  return (
    <div className="min-h-screen pb-24" style={{ background: "#030303" }}>
      {/* Header */}
      <div className="sticky top-0 z-30 px-4 py-3 flex items-center gap-3" style={{ background: "rgba(3,3,3,0.9)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <motion.button whileTap={{ scale: 0.9 }} onClick={onBack || (() => onNavigate("/"))} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)" }}>
          <ChevronLeft size={16} className="text-white/60" />
        </motion.button>
        <div className="flex-1">
          <h1 className="text-[15px] font-bold text-white flex items-center gap-2">
            <Zap size={14} className="text-[#00C2FF]" /> BlitzTransfer
          </h1>
          <p className="text-[10px] text-white/30">Dateien sicher teilen — bis 10 GB</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-3 flex gap-2">
        {[{ id: "upload", label: "Senden" }, { id: "history", label: "Meine Transfers" }].map(t => (
          <motion.button
            key={t.id}
            whileTap={{ scale: 0.95 }}
            onClick={() => setTab(t.id)}
            className="px-4 py-2 rounded-xl text-[12px] font-bold"
            style={{
              background: tab === t.id ? "rgba(0,194,255,0.15)" : "rgba(255,255,255,0.04)",
              color: tab === t.id ? "#00C2FF" : "rgba(255,255,255,0.4)",
              border: `1px solid ${tab === t.id ? "rgba(0,194,255,0.2)" : "rgba(255,255,255,0.06)"}`,
            }}
          >
            {t.label}
          </motion.button>
        ))}
      </div>

      <div className="px-4 pt-4">
        {tab === "upload" && !result && (
          <div className="space-y-4">
            {/* Drop Zone */}
            <motion.div
              className="rounded-2xl p-6 text-center cursor-pointer relative overflow-hidden"
              style={{
                background: dragOver ? "rgba(0,194,255,0.08)" : "#0A0A0A",
                border: `2px dashed ${dragOver ? "#00C2FF" : "rgba(255,255,255,0.08)"}`,
              }}
              whileTap={{ scale: 0.98 }}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
              data-testid="transfer-dropzone"
            >
              <Upload size={32} className="mx-auto mb-3" style={{ color: dragOver ? "#00C2FF" : "rgba(255,255,255,0.15)" }} />
              <p className="text-[13px] font-bold text-white/60">Dateien hierher ziehen</p>
              <p className="text-[10px] text-white/30 mt-1">oder tippen zum Auswaehlen</p>
              <p className="text-[9px] text-white/20 mt-2">Max. 10 GB | 10 Dateien | PDF, ZIP, Bilder, Videos, Audio...</p>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
            </motion.div>

            {/* File List */}
            {files.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-white/40">{files.length} Datei(en) — {humanSize(totalSize)}</p>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => setFiles([])} className="text-[10px] text-red-400">Alle entfernen</motion.button>
                </div>
                {files.map((f, i) => {
                  const ext = f.name.split(".").pop()?.toLowerCase() || "";
                  const Icon = getIcon(ext);
                  return (
                    <motion.div
                      key={i}
                      className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.06)" }}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(0,194,255,0.1)" }}>
                        <Icon size={16} className="text-[#00C2FF]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-white truncate">{f.name}</p>
                        <p className="text-[9px] text-white/30">{humanSize(f.size)}</p>
                      </div>
                      <motion.button whileTap={{ scale: 0.8 }} onClick={() => removeFile(i)}>
                        <X size={14} className="text-white/30" />
                      </motion.button>
                    </motion.div>
                  );
                })}

                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => fileRef.current?.click()}
                  className="w-full py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}
                >
                  <Plus size={12} /> Weitere Dateien
                </motion.button>
              </div>
            )}

            {/* Options */}
            {files.length > 0 && (
              <div className="space-y-3">
                <input
                  className="w-full px-4 py-3 rounded-xl text-[12px] text-white placeholder:text-white/20"
                  style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.06)" }}
                  placeholder="Titel (optional)"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  data-testid="transfer-title"
                />
                <input
                  className="w-full px-4 py-3 rounded-xl text-[12px] text-white placeholder:text-white/20"
                  style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.06)" }}
                  placeholder="Empfaenger E-Mail (optional)"
                  value={recipient}
                  onChange={e => setRecipient(e.target.value)}
                  data-testid="transfer-recipient"
                />
                <textarea
                  className="w-full px-4 py-3 rounded-xl text-[12px] text-white placeholder:text-white/20 resize-none"
                  style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.06)" }}
                  placeholder="Nachricht (optional)"
                  rows={2}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  data-testid="transfer-message"
                />

                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-white/40">Gueltig fuer:</span>
                  {[3, 7, 14, 30].map(d => (
                    <motion.button
                      key={d}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setExpDays(d)}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-bold"
                      style={{
                        background: expDays === d ? "rgba(0,194,255,0.15)" : "rgba(255,255,255,0.04)",
                        color: expDays === d ? "#00C2FF" : "rgba(255,255,255,0.3)",
                      }}
                    >
                      {d} Tage
                    </motion.button>
                  ))}
                </div>

                {/* Upload Progress */}
                {uploading && (
                  <div className="rounded-xl p-3" style={{ background: "rgba(0,194,255,0.05)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] text-[#00C2FF] font-bold">Wird hochgeladen...</span>
                      <span className="text-[11px] text-[#00C2FF]">{progress}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <motion.div className="h-full rounded-full" style={{ background: "#00C2FF" }} animate={{ width: `${progress}%` }} />
                    </div>
                  </div>
                )}

                {/* Send Button */}
                <motion.button
                  data-testid="transfer-send-btn"
                  className="w-full py-4 rounded-2xl text-[14px] font-bold flex items-center justify-center gap-2 text-white"
                  style={{ background: "linear-gradient(135deg, #00C2FF, #0088CC)", boxShadow: "0 4px 24px rgba(0,194,255,0.3)" }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleUpload}
                  disabled={uploading}
                >
                  <Send size={16} /> Transfer senden
                </motion.button>
              </div>
            )}
          </div>
        )}

        {/* Success Result */}
        {tab === "upload" && result && (
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="text-center py-6">
              <motion.div
                className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4"
                style={{ background: "rgba(16,185,129,0.15)" }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
              >
                <Check size={28} className="text-emerald-400" />
              </motion.div>
              <h2 className="text-[18px] font-bold text-white">Transfer bereit!</h2>
              <p className="text-[12px] text-white/40 mt-1">{result.file_count} Datei(en) — {result.total_size}</p>
              <p className="text-[10px] text-white/25 mt-0.5">Gueltig fuer {result.expires_days} Tage</p>
            </div>

            {/* Share Link */}
            <div className="rounded-2xl p-4" style={{ background: "#0A0A0A", border: "1px solid rgba(0,194,255,0.15)" }}>
              <p className="text-[10px] text-white/30 mb-2">Download-Link</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 rounded-lg text-[10px] font-mono text-[#00C2FF] truncate" style={{ background: "rgba(0,194,255,0.05)" }}>
                  {window.location.origin}{result.share_link}
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={copyLink}
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: copied ? "rgba(16,185,129,0.15)" : "rgba(0,194,255,0.15)" }}
                  data-testid="copy-link-btn"
                >
                  {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} className="text-[#00C2FF]" />}
                </motion.button>
              </div>
            </div>

            <div className="flex gap-2">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={resetUpload}
                className="flex-1 py-3 rounded-xl text-[12px] font-bold"
                style={{ background: "rgba(0,194,255,0.1)", color: "#00C2FF" }}
              >
                Neuer Transfer
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setTab("history")}
                className="flex-1 py-3 rounded-xl text-[12px] font-bold"
                style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)" }}
              >
                Meine Transfers
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* History Tab */}
        {tab === "history" && (
          <div className="space-y-3">
            {myTransfers.length === 0 ? (
              <div className="text-center py-12">
                <Send size={32} className="mx-auto mb-3 text-white/10" />
                <p className="text-[13px] text-white/30">Noch keine Transfers</p>
              </div>
            ) : myTransfers.map((t, i) => {
              const expired = t.status === "expired";
              const deleted = t.status === "deleted";
              return (
                <motion.div
                  key={t.transfer_id}
                  className="rounded-2xl p-4"
                  style={{
                    background: "#0A0A0A",
                    border: `1px solid ${expired || deleted ? "rgba(255,255,255,0.04)" : "rgba(0,194,255,0.1)"}`,
                    opacity: expired || deleted ? 0.5 : 1,
                  }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: expired || deleted ? 0.5 : 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-white truncate">{t.title || "Transfer"}</p>
                      <p className="text-[10px] text-white/30">{t.file_count} Datei(en) — {t.total_size_human}</p>
                    </div>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                      expired ? "bg-red-500/10 text-red-400" :
                      deleted ? "bg-white/5 text-white/30" :
                      "bg-emerald-500/10 text-emerald-400"
                    }`}>
                      {expired ? "Abgelaufen" : deleted ? "Geloescht" : "Aktiv"}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-[10px] text-white/25">
                    <span className="flex items-center gap-1"><Download size={10} /> {t.downloads}x</span>
                    <span className="flex items-center gap-1"><Clock size={10} /> {new Date(t.created_at).toLocaleDateString("de-DE")}</span>
                  </div>

                  {!expired && !deleted && (
                    <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/blitz-transfer/${t.transfer_id}/${t.download_code || ""}`);
                          toast.success("Link kopiert!");
                        }}
                        className="flex-1 py-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1"
                        style={{ background: "rgba(0,194,255,0.1)", color: "#00C2FF" }}
                      >
                        <Link2 size={10} /> Link kopieren
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => deleteTransfer(t.transfer_id)}
                        className="py-2 px-3 rounded-lg"
                        style={{ background: "rgba(239,68,68,0.1)" }}
                      >
                        <Trash2 size={12} className="text-red-400" />
                      </motion.button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default BlitzTransferPage;
