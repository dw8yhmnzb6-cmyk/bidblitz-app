/**
 * GuestSelector — popover with adults / children / rooms steppers.
 *
 * Props:
 *   value      {adults, children, rooms}
 *   onChange   fn(value)
 *   showRooms  bool (default true)
 *   minAdults  default 1
 *   testId     default "guest-selector"
 */
import { useEffect, useRef, useState } from "react";
import { Users, Minus, Plus } from "lucide-react";

const Step = ({ label, hint, value, onMinus, onPlus, minusDisabled, plusDisabled, testId }) => (
  <div className="flex items-center justify-between py-2.5">
    <div>
      <div className="text-sm text-white">{label}</div>
      {hint && <div className="text-[10px] text-gray-500">{hint}</div>}
    </div>
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={minusDisabled}
        onClick={onMinus}
        className={`w-7 h-7 rounded-full border flex items-center justify-center ${minusDisabled ? "border-white/5 text-gray-700" : "border-white/15 text-white hover:bg-white/5"}`}
        data-testid={`${testId}-minus`}
      >
        <Minus size={12} />
      </button>
      <span className="w-5 text-center text-sm font-semibold text-white" data-testid={`${testId}-value`}>{value}</span>
      <button
        type="button"
        disabled={plusDisabled}
        onClick={onPlus}
        className={`w-7 h-7 rounded-full border flex items-center justify-center ${plusDisabled ? "border-white/5 text-gray-700" : "border-white/15 text-white hover:bg-white/5"}`}
        data-testid={`${testId}-plus`}
      >
        <Plus size={12} />
      </button>
    </div>
  </div>
);

export const GuestSelector = ({
  value = { adults: 2, children: 0, rooms: 1 },
  onChange,
  showRooms = true,
  minAdults = 1,
  testId = "guest-selector",
  className = "",
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const v = { adults: value.adults ?? 2, children: value.children ?? 0, rooms: value.rooms ?? 1 };

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const set = (k, n) => onChange?.({ ...v, [k]: n });

  const summary = `${v.adults} Erw.${v.children ? ` · ${v.children} Kind` : ""}${showRooms ? ` · ${v.rooms} Zi.` : ""}`;

  return (
    <div ref={ref} className={`relative ${className}`} data-testid={testId}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 hover:border-orange-500/50 transition text-left"
        data-testid={`${testId}-trigger`}
      >
        <Users size={16} className="text-orange-400 shrink-0" />
        <span className="flex-1 text-sm text-white truncate">{summary}</span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 right-0 w-72 bg-[#15151B] border border-white/10 rounded-2xl shadow-2xl p-3 divide-y divide-white/5">
          <Step
            label="Erwachsene"
            hint="13+ Jahre"
            value={v.adults}
            onMinus={() => set("adults", Math.max(minAdults, v.adults - 1))}
            onPlus={() => set("adults", Math.min(16, v.adults + 1))}
            minusDisabled={v.adults <= minAdults}
            plusDisabled={v.adults >= 16}
            testId={`${testId}-adults`}
          />
          <Step
            label="Kinder"
            hint="0–12 Jahre"
            value={v.children}
            onMinus={() => set("children", Math.max(0, v.children - 1))}
            onPlus={() => set("children", Math.min(8, v.children + 1))}
            minusDisabled={v.children <= 0}
            plusDisabled={v.children >= 8}
            testId={`${testId}-children`}
          />
          {showRooms && (
            <Step
              label="Zimmer"
              hint=""
              value={v.rooms}
              onMinus={() => set("rooms", Math.max(1, v.rooms - 1))}
              onPlus={() => set("rooms", Math.min(8, v.rooms + 1))}
              minusDisabled={v.rooms <= 1}
              plusDisabled={v.rooms >= 8}
              testId={`${testId}-rooms`}
            />
          )}
          <div className="pt-2">
            <button onClick={() => setOpen(false)} className="w-full py-2 rounded-xl bg-orange-500 text-white text-sm font-semibold" data-testid={`${testId}-done`}>
              Übernehmen
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuestSelector;
