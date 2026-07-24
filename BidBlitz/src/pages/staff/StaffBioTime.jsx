import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Fingerprint, Loader2, ShieldCheck, Play, Square, Coffee, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../services/api";

const eventLabels = {
  check_in: "Check-in",
  check_out: "Check-out",
  break_start: "Pause starten",
  break_end: "Pause beenden",
  clock_in: "Check-in",
  clock_out: "Check-out",
};

function nextPrimary(status) {
  if (status === "working") return "check_out";
  if (status === "break") return "break_end";
  return "check_in";
}

export default function StaffBioTime({ dashboard, onRecorded }) {
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState("");
  const [data, setData] = useState(null);
  const [clockToken, setClockToken] = useState("");
  const [enrollToken, setEnrollToken] = useState("");
  const [nickname, setNickname] = useState("Meine Handfläche");
  const [terminalId, setTerminalId] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const result = await api.getStaffBioTimeStatus();
      setData(result);
      if (!terminalId && result.terminals?.[0]?.terminal_id) setTerminalId(result.terminals[0].terminal_id);
    } catch (error) {
      toast.error(error.message || "BioTime konnte nicht geladen werden");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const effectiveStatus = dashboard?.status || data?.status || "off";
  const primaryEvent = useMemo(() => nextPrimary(effectiveStatus), [effectiveStatus]);
  const hasPalm = Boolean(data?.has_palm_profile);

  const enroll = async () => {
    if (!enrollToken.trim()) return toast.error("Palm Template Token eingeben");
    setActing("enroll");
    try {
      await api.enrollStaffBioTime({ template_token: enrollToken.trim(), modality: "palm", nickname });
      toast.success("PalmPay für BioTime aktiviert");
      setEnrollToken("");
      await load();
    } catch (error) {
      toast.error(error.message || "Enrollment fehlgeschlagen");
    } finally {
      setActing("");
    }
  };

  const clock = async (eventType) => {
    if (!clockToken.trim()) return toast.error("Palm Template Token scannen oder eingeben");
    setActing(eventType);
    try {
      const terminal = (data?.terminals || []).find((item) => item.terminal_id === terminalId);
      const result = await api.clockStaffBioTime({
        template_token: clockToken.trim(),
        event_type: eventType,
        modality: "palm",
        terminal_id: terminalId || undefined,
        store_id: terminal?.store_id || "",
        register_id: terminal?.register_id || "",
      });
      if (!result.ok) {
        toast.error(result.message || "BioTime abgelehnt");
      } else {
        toast.success(`${eventLabels[eventType]} gespeichert`);
        setClockToken("");
        await load();
        if (onRecorded) await onRecorded();
      }
    } catch (error) {
      toast.error(error.message || "BioTime Buchung fehlgeschlagen");
    } finally {
      setActing("");
    }
  };

  if (loading) {
    return (
      <div data-testid="staff-biotime-loading" className="py-20 flex justify-center">
        <Loader2 size={24} className="animate-spin text-[#00D4FF]" />
      </div>
    );
  }

  return (
    <div data-testid="staff-biotime-tab" className="px-5 pt-6 pb-2 space-y-5">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/40 font-semibold">PalmPay BioTime</p>
        <h2 className="text-2xl font-bold mt-1 font-outfit">Biometrische Zeiterfassung</h2>
      </div>

      <motion.div
        className="relative overflow-hidden rounded-[28px] p-5 border"
        style={{ background: "linear-gradient(135deg, rgba(0,212,255,0.12) 0%, rgba(16,217,129,0.08) 100%)", borderColor: "rgba(0,212,255,0.25)" }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        data-testid="staff-biotime-status-card"
      >
        <div className="absolute -right-10 -top-12 w-44 h-44 rounded-full blur-3xl opacity-40 bg-[#00D4FF]" />
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/45">Status</p>
            <p className="mt-1 text-xl font-bold" data-testid="staff-biotime-current-status">{effectiveStatus === "working" ? "Arbeitet" : effectiveStatus === "break" ? "Pause" : "Ausgestempelt"}</p>
            <p className="mt-1 text-[11px] text-white/50" data-testid="staff-biotime-profile-state">{hasPalm ? "Palm-Profil aktiv" : "Palm-Profil fehlt"}</p>
          </div>
          <div className="w-16 h-16 rounded-3xl flex items-center justify-center bg-white/[0.08] border border-white/10">
            <Fingerprint size={30} className={hasPalm ? "text-[#10D981]" : "text-white/35"} />
          </div>
        </div>
      </motion.div>

      {!hasPalm && (
        <section className="rounded-3xl p-4 bg-white/[0.03] border border-white/[0.07]" data-testid="staff-biotime-enroll-panel">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck size={15} className="text-[#10D981]" />
            <p className="text-sm font-bold">PalmPay Enrollment</p>
          </div>
          <input
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="Nickname"
            data-testid="staff-biotime-enroll-nickname-input"
            className="w-full px-3.5 py-3 rounded-2xl bg-white/[0.04] border border-white/10 text-sm mb-3 outline-none focus:border-[#00D4FF]/40"
          />
          <input
            value={enrollToken}
            onChange={(event) => setEnrollToken(event.target.value)}
            placeholder="Palm Template Token"
            data-testid="staff-biotime-enroll-token-input"
            className="w-full px-3.5 py-3 rounded-2xl bg-white/[0.04] border border-white/10 text-sm mb-3 outline-none focus:border-[#00D4FF]/40"
          />
          <button
            onClick={enroll}
            disabled={acting === "enroll"}
            data-testid="staff-biotime-enroll-button"
            className="w-full py-3 rounded-2xl bg-[#10D981]/15 border border-[#10D981]/25 text-[#10D981] font-semibold text-sm disabled:opacity-60"
          >
            {acting === "enroll" ? <Loader2 size={16} className="animate-spin mx-auto" /> : "PalmPay aktivieren"}
          </button>
        </section>
      )}

      <section className="rounded-3xl p-4 bg-white/[0.03] border border-white/[0.07]" data-testid="staff-biotime-clock-panel">
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-sm font-bold">BioTime Buchung</p>
          <button onClick={load} data-testid="staff-biotime-refresh-button" className="p-2 rounded-xl bg-white/[0.05] active:scale-95">
            <RefreshCw size={14} className="text-white/60" />
          </button>
        </div>
        <select
          value={terminalId}
          onChange={(event) => setTerminalId(event.target.value)}
          data-testid="staff-biotime-terminal-select"
          className="w-full px-3.5 py-3 rounded-2xl bg-white/[0.04] border border-white/10 text-sm mb-3 outline-none focus:border-[#00D4FF]/40"
        >
          <option value="">Kein Terminal gewählt</option>
          {(data?.terminals || []).map((terminal) => (
            <option key={terminal.terminal_id} value={terminal.terminal_id}>{terminal.label} · {terminal.terminal_id}</option>
          ))}
        </select>
        <input
          value={clockToken}
          onChange={(event) => setClockToken(event.target.value)}
          placeholder="Palm Template Token scannen"
          data-testid="staff-biotime-clock-token-input"
          className="w-full px-3.5 py-3 rounded-2xl bg-white/[0.04] border border-white/10 text-sm mb-3 outline-none focus:border-[#00D4FF]/40"
        />
        <button
          onClick={() => clock(primaryEvent)}
          disabled={!hasPalm || Boolean(acting)}
          data-testid="staff-biotime-primary-clock-button"
          className="w-full py-4 rounded-3xl text-black font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, #00D4FF 0%, #10D981 100%)" }}
        >
          {acting === primaryEvent ? <Loader2 size={17} className="animate-spin" /> : primaryEvent === "check_out" ? <Square size={16} /> : <Play size={16} />}
          {eventLabels[primaryEvent]}
        </button>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <BioTimeMiniButton testId="staff-biotime-break-start-button" disabled={!hasPalm || Boolean(acting) || effectiveStatus !== "working"} loading={acting === "break_start"} icon={Coffee} onClick={() => clock("break_start")}>Pause</BioTimeMiniButton>
          <BioTimeMiniButton testId="staff-biotime-clock-out-button" disabled={!hasPalm || Boolean(acting) || effectiveStatus === "off"} loading={acting === "check_out"} icon={Square} onClick={() => clock("check_out")}>Check-out</BioTimeMiniButton>
        </div>
      </section>

      <section className="rounded-3xl p-4 bg-white/[0.03] border border-white/[0.07]" data-testid="staff-biotime-history-panel">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/40 font-semibold mb-3">Letzte BioTime Events</p>
        {(data?.recent_events || []).length === 0 ? (
          <p className="text-[12px] text-white/35 py-4 text-center" data-testid="staff-biotime-empty-history">Noch keine BioTime-Buchungen</p>
        ) : (
          <div className="space-y-2">
            {(data?.recent_events || []).slice(0, 8).map((event) => (
              <div key={event.id || event.event_id || event.timestamp} className="flex items-center justify-between rounded-2xl bg-black/20 border border-white/[0.04] px-3 py-2" data-testid="staff-biotime-history-row">
                <span className="text-sm font-semibold">{eventLabels[event.event_type] || event.action}</span>
                <span className="text-[11px] text-white/45">{String(event.timestamp || event.created_at || "").slice(0, 16).replace("T", " ")}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function BioTimeMiniButton({ children, icon: Icon, loading, disabled, onClick, testId }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className="h-12 rounded-2xl bg-white/[0.05] border border-white/10 text-white/75 font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2 active:scale-95 transition-transform"
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} />}
      {children}
    </button>
  );
}