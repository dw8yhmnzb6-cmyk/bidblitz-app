import { GraduationCap } from "lucide-react";
import { Button } from "../ui/button";

export const POS_TRAINING_STORAGE_KEY = "bidblitz-pos-training-complete";

export const PosTrainingGuide = ({ copy, visible, onComplete, onSkip }) => {
  if (!visible) return null;
  const steps = [copy.trainingStep1, copy.trainingStep2, copy.trainingStep3, copy.trainingStep4, copy.trainingStep5];

  return (
    <div className="rounded-[28px] border border-cyan-400/20 bg-[linear-gradient(135deg,rgba(6,182,212,0.16),rgba(255,255,255,0.04))] p-5 text-white" data-testid="merchant-pos-training-guide">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-cyan-400/20 bg-cyan-400/10 text-cyan-100">
          <GraduationCap size={18} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-black">{copy.training}</h2>
          <div className="mt-3 grid gap-2 md:grid-cols-5">
            {steps.map((step, index) => (
              <div key={step} className="rounded-[18px] border border-white/10 bg-[#071019] p-3 text-sm" data-testid={`merchant-pos-training-step-${index + 1}`}>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#82E7FF]">{index + 1}</div>
                <div className="mt-2 font-semibold">{step}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={onComplete} className="min-h-12 bg-[#06B6D4] text-black" data-testid="merchant-pos-training-complete-button">{copy.completed}</Button>
            <Button onClick={onSkip} variant="outline" className="min-h-12 border-white/10 bg-white/5 text-white" data-testid="merchant-pos-training-skip-button">{copy.skip}</Button>
            <Button onClick={onSkip} variant="outline" className="min-h-12 border-white/10 bg-white/5 text-white" data-testid="merchant-pos-training-replay-later-button">{copy.replayLater}</Button>
          </div>
        </div>
      </div>
    </div>
  );
};