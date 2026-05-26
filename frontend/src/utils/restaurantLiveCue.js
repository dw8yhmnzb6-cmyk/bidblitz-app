const SOUND_PREF_KEY = "restaurant-live-sound-enabled";

export const loadRestaurantSoundEnabled = () => {
  if (typeof window === "undefined") return true;
  const raw = window.localStorage.getItem(SOUND_PREF_KEY);
  return raw === null ? true : raw === "true";
};

export const saveRestaurantSoundEnabled = (value) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SOUND_PREF_KEY, String(Boolean(value)));
};

export const playRestaurantLiveCue = (eventType = "default") => {
  if (typeof window === "undefined") return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  const context = new AudioCtx();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const frequencyMap = {
    service_call: 740,
    service_call_status: 680,
    order_created: 880,
    order_status: 620,
    order_paid: 520,
    default: 640,
  };

  oscillator.type = eventType === "service_call" ? "triangle" : "sine";
  oscillator.frequency.value = frequencyMap[eventType] || frequencyMap.default;
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.09, context.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.24);
  oscillator.onended = () => context.close().catch(() => {});
};