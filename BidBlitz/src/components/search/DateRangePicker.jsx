/**
 * DateRangePicker — single component that lets the user pick check-in / check-out
 * (or any date range). Mobile-friendly: uses a popover with two month grids.
 *
 * Props:
 *   from        (YYYY-MM-DD | "")
 *   to          (YYYY-MM-DD | "")
 *   onChange    fn({from, to})
 *   minDate     (YYYY-MM-DD)  default today
 *   blockedDates (string[])
 *   labelFrom   default "Anreise"
 *   labelTo     default "Abreise"
 *   testId      default "date-range"
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar as Cal, X } from "lucide-react";

const fmtDay = (d) => d.toISOString().slice(0, 10);
const todayStr = () => new Date().toISOString().slice(0, 10);
const parse = (s) => (s ? new Date(s + "T00:00:00") : null);
const sameMonth = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

const Month = ({ year, month, from, to, onPick, minDate, blocked }) => {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Mon-first
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d));

  const isBetween = (d) => from && to && d > from && d < to;
  const min = parse(minDate);

  return (
    <div className="p-3">
      <div className="text-center text-sm font-semibold mb-2 text-white">
        {first.toLocaleDateString("de-DE", { month: "long", year: "numeric" })}
      </div>
      <div className="grid grid-cols-7 gap-1 text-[10px] text-gray-500 mb-1">
        {["M","D","M","D","F","S","S"].map((x, i) => <div key={i} className="text-center">{x}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const ds = fmtDay(d);
          const isFrom = from && fmtDay(from) === ds;
          const isTo = to && fmtDay(to) === ds;
          const between = isBetween(d);
          const disabled = (min && d < min) || blocked?.includes(ds);
          return (
            <button
              key={i}
              disabled={disabled}
              onClick={() => onPick(d)}
              className={`h-9 text-xs rounded-lg transition
                ${isFrom || isTo ? "bg-orange-500 text-white font-bold" : ""}
                ${between ? "bg-orange-500/20 text-orange-200" : ""}
                ${!isFrom && !isTo && !between && !disabled ? "text-white hover:bg-white/10" : ""}
                ${disabled ? "text-gray-700 cursor-not-allowed line-through" : ""}
              `}
              data-testid={`day-${ds}`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const DateRangePicker = ({
  from = "",
  to = "",
  onChange,
  minDate,
  blockedDates = [],
  labelFrom = "Anreise",
  labelTo = "Abreise",
  testId = "date-range",
  className = "",
}) => {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState("from");
  const ref = useRef(null);
  const min = minDate || todayStr();
  const fromD = parse(from);
  const toD = parse(to);

  const [cursor, setCursor] = useState(() => fromD || new Date());
  const next = useMemo(() => new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1), [cursor]);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const onPick = (d) => {
    if (stage === "from" || (fromD && d < fromD)) {
      onChange?.({ from: fmtDay(d), to: "" });
      setStage("to");
    } else if (stage === "to") {
      if (fromD && d.getTime() === fromD.getTime()) return;
      onChange?.({ from: fmtDay(fromD), to: fmtDay(d) });
      setStage("from");
      setOpen(false);
    }
  };

  const display = (() => {
    if (from && to) {
      const fd = parse(from); const td = parse(to);
      const nights = Math.round((td - fd) / 86400000);
      return `${fd.toLocaleDateString("de-DE",{day:"2-digit",month:"short"})} → ${td.toLocaleDateString("de-DE",{day:"2-digit",month:"short"})} · ${nights}N`;
    }
    if (from) return `${parse(from).toLocaleDateString("de-DE")} → ?`;
    return `${labelFrom} – ${labelTo}`;
  })();

  return (
    <div ref={ref} className={`relative ${className}`} data-testid={testId}>
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setStage(from && !to ? "to" : "from"); }}
        className="w-full flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 hover:border-orange-500/50 transition text-left"
        data-testid={`${testId}-trigger`}
      >
        <Cal size={16} className="text-orange-400 shrink-0" />
        <span className={`flex-1 text-sm truncate ${from ? "text-white" : "text-gray-500"}`}>{display}</span>
        {(from || to) && (
          <button onClick={(e) => { e.stopPropagation(); onChange?.({ from: "", to: "" }); setStage("from"); }} className="text-gray-500 hover:text-white">
            <X size={14} />
          </button>
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 left-0 right-0 sm:right-auto sm:w-[600px] bg-[#15151B] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-white/5">
            <Month year={cursor.getFullYear()} month={cursor.getMonth()} from={fromD} to={toD} onPick={onPick} minDate={min} blocked={blockedDates} />
            <Month year={next.getFullYear()} month={next.getMonth()} from={fromD} to={toD} onPick={onPick} minDate={min} blocked={blockedDates} />
          </div>
          <div className="flex items-center justify-between p-2 border-t border-white/5 bg-black/30">
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="px-3 py-1.5 rounded-lg hover:bg-white/5 text-xs text-gray-300" data-testid={`${testId}-prev`}>‹ Zurück</button>
            <div className="text-[10px] text-gray-500">{stage === "from" ? "Anreise wählen" : "Abreise wählen"}</div>
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="px-3 py-1.5 rounded-lg hover:bg-white/5 text-xs text-gray-300" data-testid={`${testId}-next`}>Weiter ›</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;
