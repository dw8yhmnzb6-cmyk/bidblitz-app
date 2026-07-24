/**
 * FilterBar — generic, schema-driven filter row.
 *
 * Props:
 *   filters: array of filter definitions, each:
 *     { key, label, type, options?, min?, max?, step? }
 *     types: "select" (options=[{value,label}]),
 *            "multi"  (options=[{value,label}]),
 *            "range"  (min,max,step)
 *            "toggle" (boolean)
 *            "sort"   (options=[{value,label}])
 *   value:    object { [key]: any }
 *   onChange: fn(newValue)
 *   onReset:  fn()
 *   testId:   default "filter-bar"
 */
import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, X, Check } from "lucide-react";

const Pill = ({ active, children, onClick, testId }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition shrink-0 ${active ? "bg-orange-500 border-orange-500 text-white" : "bg-white/5 border-white/10 text-gray-300 hover:border-orange-500/40"}`}
    data-testid={testId}
  >
    {children}
  </button>
);

const RangeInput = ({ filter, value, onChange, testId }) => {
  const v = value ?? [filter.min, filter.max];
  const [lo, hi] = v;
  return (
    <div className="px-2" data-testid={testId}>
      <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
        <span>{filter.formatter ? filter.formatter(lo) : lo}</span>
        <span>{filter.formatter ? filter.formatter(hi) : hi}</span>
      </div>
      <div className="flex gap-2">
        <input
          type="number"
          value={lo}
          min={filter.min} max={hi} step={filter.step || 1}
          onChange={(e) => onChange([Number(e.target.value), hi])}
          className="w-20 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
          data-testid={`${testId}-lo`}
        />
        <input
          type="number"
          value={hi}
          min={lo} max={filter.max} step={filter.step || 1}
          onChange={(e) => onChange([lo, Number(e.target.value)])}
          className="w-20 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
          data-testid={`${testId}-hi`}
        />
      </div>
    </div>
  );
};

const Popover = ({ children, label, count, testId }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  return (
    <div ref={ref} className="relative" data-testid={testId}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border shrink-0 transition ${count > 0 ? "bg-orange-500/15 border-orange-500/40 text-orange-300" : "bg-white/5 border-white/10 text-gray-300"}`}
        data-testid={`${testId}-trigger`}
      >
        {label}
        {count > 0 && <span className="bg-orange-500 text-white rounded-full px-1.5 text-[9px]">{count}</span>}
      </button>
      {open && (
        <div className="absolute z-50 mt-1.5 left-0 min-w-[220px] bg-[#15151B] border border-white/10 rounded-xl shadow-2xl p-3">
          {children}
        </div>
      )}
    </div>
  );
};

export const FilterBar = ({
  filters = [],
  value = {},
  onChange,
  onReset,
  testId = "filter-bar",
  className = "",
}) => {
  const set = (k, v) => onChange?.({ ...value, [k]: v });
  const activeCount = filters.reduce((n, f) => {
    const v = value[f.key];
    if (v === undefined || v === null) return n;
    if (f.type === "multi") return n + (Array.isArray(v) ? v.length : 0);
    if (f.type === "toggle") return n + (v ? 1 : 0);
    if (f.type === "range") return n + (Array.isArray(v) ? 1 : 0);
    if (v === "") return n;
    return n + 1;
  }, 0);

  return (
    <div className={`flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 ${className}`} data-testid={testId}>
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-gray-300 shrink-0">
        <SlidersHorizontal size={12} className="text-orange-400" />
        Filter {activeCount > 0 && <span className="bg-orange-500 text-white rounded-full px-1.5 text-[9px]">{activeCount}</span>}
      </div>

      {filters.map((f) => {
        const v = value[f.key];
        if (f.type === "toggle") {
          return <Pill key={f.key} active={!!v} onClick={() => set(f.key, !v)} testId={`${testId}-${f.key}`}>{f.label}</Pill>;
        }
        if (f.type === "sort" || f.type === "select") {
          return (
            <Popover key={f.key} label={f.label + (v ? `: ${f.options?.find(o => o.value === v)?.label || v}` : "")} count={v ? 1 : 0} testId={`${testId}-${f.key}`}>
              <div className="space-y-0.5 max-h-60 overflow-y-auto">
                {f.options?.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => set(f.key, v === o.value ? "" : o.value)}
                    className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center gap-2 ${v === o.value ? "bg-orange-500/20 text-orange-200" : "hover:bg-white/5 text-gray-300"}`}
                    data-testid={`${testId}-${f.key}-opt-${o.value}`}
                  >
                    {v === o.value && <Check size={12} />}
                    {o.label}
                  </button>
                ))}
              </div>
            </Popover>
          );
        }
        if (f.type === "multi") {
          const arr = Array.isArray(v) ? v : [];
          return (
            <Popover key={f.key} label={f.label} count={arr.length} testId={`${testId}-${f.key}`}>
              <div className="space-y-0.5 max-h-60 overflow-y-auto">
                {f.options?.map((o) => {
                  const on = arr.includes(o.value);
                  return (
                    <button
                      key={o.value}
                      onClick={() => set(f.key, on ? arr.filter(x => x !== o.value) : [...arr, o.value])}
                      className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center gap-2 ${on ? "bg-orange-500/20 text-orange-200" : "hover:bg-white/5 text-gray-300"}`}
                      data-testid={`${testId}-${f.key}-opt-${o.value}`}
                    >
                      <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${on ? "border-orange-400 bg-orange-500" : "border-white/20"}`}>
                        {on && <Check size={10} />}
                      </span>
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </Popover>
          );
        }
        if (f.type === "range") {
          return (
            <Popover key={f.key} label={f.label} count={Array.isArray(v) ? 1 : 0} testId={`${testId}-${f.key}`}>
              <RangeInput filter={f} value={v} onChange={(nv) => set(f.key, nv)} testId={`${testId}-${f.key}-range`} />
            </Popover>
          );
        }
        return null;
      })}

      {activeCount > 0 && (
        <button
          onClick={() => onReset ? onReset() : onChange?.({})}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-300 text-xs shrink-0 hover:bg-red-500/20"
          data-testid={`${testId}-reset`}
        >
          <X size={12} /> Zurücksetzen
        </button>
      )}
    </div>
  );
};

export default FilterBar;
