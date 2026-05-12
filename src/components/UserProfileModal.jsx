import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Check, RotateCcw, Scale } from "lucide-react";
import { useUserProfile } from "@/context/UserProfileContext.jsx";
import { useVoiceCapture, ttsSpeak } from "@/hooks/useVoiceConversation.js";
import { hasAllKeys } from "@/lib/keys.js";

const STEPS = [
  { key: "name", label: "Your Full Name", prompt: "What is your full name?" },
  { key: "location", label: "Your Location", prompt: "What city and country are you in?" },
  { key: "phone", label: "Your Phone Number", prompt: "What is your phone number?" },
  { key: "email", label: "Your Email (Optional)", prompt: "What is your email address? Say skip if you prefer not to share." },
];

export default function UserProfileModal({ open, onClose }) {
  const { userProfile, updateUserProfile } = useUserProfile();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState({ name: "", location: "", phone: "", email: "" });
  const [heard, setHeard] = useState("");
  const [error, setError] = useState("");
  const { isListening, isProcessing, start, stop } = useVoiceCapture();
  const promptedRef = useRef(-1);

  // Speak the prompt when the step changes (only if voice keys are configured).
  useEffect(() => {
    if (!open) return;
    if (promptedRef.current === step) return;
    promptedRef.current = step;
    setHeard("");
    setError("");
    if (hasAllKeys()) {
      ttsSpeak(STEPS[step].prompt).catch((e) => setError(e.message));
    }
  }, [open, step]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(0);
      setDraft({
        name: userProfile.name || "",
        location: userProfile.location || "",
        phone: userProfile.phone || "",
        email: userProfile.email || "",
      });
      promptedRef.current = -1;
    }
  }, [open, userProfile]);

  const onPointerDown = useCallback(async () => {
    setError("");
    try { await start(); } catch (e) { setError(e.message || "Microphone error."); }
  }, [start]);

  const onPointerUp = useCallback(async () => {
    if (!isListening) return;
    try {
      const text = await stop();
      if (text) {
        const cur = STEPS[step];
        let value = text.trim();
        if (cur.key === "email" && /^skip\.?$/i.test(value)) value = "";
        setHeard(value);
        setDraft((d) => ({ ...d, [cur.key]: value }));
      }
    } catch (e) {
      setError(e.message || "Could not transcribe.");
    }
  }, [isListening, stop, step]);

  const reRecord = () => {
    const cur = STEPS[step];
    setHeard("");
    setDraft((d) => ({ ...d, [cur.key]: "" }));
    if (hasAllKeys()) ttsSpeak(STEPS[step].prompt).catch(() => {});
  };

  const confirm = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      updateUserProfile({ ...draft, profileComplete: true });
      onClose?.();
    }
  };

  const finish = confirm;

  if (!open) return null;
  const cur = STEPS[step];
  const value = draft[cur.key];
  const isLast = step === STEPS.length - 1;
  const canConfirm = cur.key === "email" ? true : value.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-xl rounded-2xl border-2 border-primary/60 bg-card p-8 shadow-2xl"
        style={{ boxShadow: "var(--shadow-gold)" }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Scale className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-serif text-3xl">Before we begin…</h2>
          </div>
        </div>

        <p className="text-muted-foreground mb-6">
          I need a few details to draft letters on your behalf. Speak each answer when prompted.
        </p>

        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-2.5 w-2.5 rounded-full transition-colors ${
                i <= step ? "bg-primary" : "bg-border"
              }`}
            />
          ))}
          <span className="ml-3 text-xs uppercase tracking-widest text-muted-foreground">
            Step {step + 1} of {STEPS.length}
          </span>
        </div>

        <label className="block text-sm font-medium mb-2 text-muted-foreground uppercase tracking-wider">
          {cur.label}
        </label>
        <p className="font-serif text-xl mb-4">{cur.prompt}</p>

        <div className="rounded-lg border border-border bg-secondary/60 px-4 py-3 mb-6 min-h-[3rem] text-foreground">
          {value || <span className="italic text-muted-foreground">Press &amp; hold the mic to answer…</span>}
        </div>

        <div className="flex flex-col items-center gap-4 mb-6">
          <button
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerLeave={() => isListening && onPointerUp()}
            disabled={isProcessing}
            aria-label="Hold to speak"
            className={`flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95 disabled:opacity-50 ${
              isListening ? "mic-listening" : "mic-idle"
            }`}
          >
            <Mic className="h-8 w-8" />
          </button>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {isListening ? "Listening — release to send" : isProcessing ? "Transcribing…" : "Press & hold to speak"}
          </p>
        </div>

        {error && <p className="text-sm text-destructive text-center mb-4">{error}</p>}

        <div className="flex items-center justify-center gap-3">
          {value && (
            <button
              onClick={reRecord}
              className="inline-flex items-center gap-2 rounded-md border border-primary/60 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10"
            >
              <RotateCcw className="h-4 w-4" /> Re-record
            </button>
          )}
          {!isLast && (
            <button
              onClick={confirm}
              disabled={!canConfirm}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Check className="h-4 w-4" /> Confirm
            </button>
          )}
          {isLast && (
            <button
              onClick={finish}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Start CourtVoice
            </button>
          )}
        </div>

        {/* Quick keyboard fallback for accessibility */}
        <details className="mt-6 text-xs text-muted-foreground">
          <summary className="cursor-pointer">Prefer to type? (fallback)</summary>
          <input
            value={value}
            onChange={(e) => setDraft((d) => ({ ...d, [cur.key]: e.target.value }))}
            placeholder={cur.label}
            className="mt-2 w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
          />
        </details>
      </div>
    </div>
  );
}
