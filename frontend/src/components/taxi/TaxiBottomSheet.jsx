/**
 * TaxiBottomSheet — Draggable bottom-sheet container with 3 snap points.
 * - collapsed: ~30% (shows drag handle + summary peek)
 * - half: ~55%
 * - full: ~92%
 *
 * Uses framer-motion `useDragControls` for handle-only drag, but body is
 * scrollable. Tap on handle area toggles between half ↔ full.
 */
import React, { useState } from "react";
import { motion, useMotionValue, animate } from "framer-motion";

const SNAPS = { collapsed: 0.46, half: 0.68, full: 0.94 };

export default function TaxiBottomSheet({
  defaultSnap = "half",
  children,
  testId = "taxi-bottom-sheet",
}) {
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const heightFor = (snap) => SNAPS[snap] * vh;
  const [snap, setSnap] = useState(defaultSnap);
  const h = useMotionValue(heightFor(defaultSnap));

  const animateTo = (target) => {
    setSnap(target);
    animate(h, heightFor(target), { type: "spring", stiffness: 320, damping: 32 });
  };

  const onHandleTap = () => {
    if (snap === "collapsed") animateTo("half");
    else if (snap === "half") animateTo("full");
    else animateTo("half");
  };

  // Drag the handle to resize
  const onDrag = (_, info) => {
    const next = h.get() - info.delta.y;
    h.set(Math.min(vh * 0.95, Math.max(vh * 0.22, next)));
  };
  const onDragEnd = (_, info) => {
    const current = h.get();
    const velocity = info.velocity.y;
    // Project final position with simple inertia
    const projected = current - velocity * 0.15;
    // Snap to nearest
    const targets = [
      ["collapsed", heightFor("collapsed")],
      ["half", heightFor("half")],
      ["full", heightFor("full")],
    ];
    let best = "half";
    let bestDist = Infinity;
    for (const [k, v] of targets) {
      const d = Math.abs(v - projected);
      if (d < bestDist) { bestDist = d; best = k; }
    }
    animateTo(best);
  };

  return (
    <motion.div
      style={{ height: h }}
      className="fixed inset-x-0 bottom-0 z-30 bg-[#0A0A0F] rounded-t-3xl border-t border-white/10 shadow-[0_-12px_40px_rgba(0,0,0,0.6)] flex flex-col"
      data-testid={testId}
      data-snap={snap}
    >
      {/* Drag handle area */}
      <motion.div
        drag="y"
        dragMomentum={false}
        dragElastic={0}
        onDrag={onDrag}
        onDragEnd={onDragEnd}
        onClick={onHandleTap}
        className="pt-2 pb-1 flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
        data-testid={`${testId}-handle`}
      >
        <div className="w-12 h-1.5 rounded-full bg-white/25" />
      </motion.div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-6">
        {children}
      </div>
    </motion.div>
  );
}
