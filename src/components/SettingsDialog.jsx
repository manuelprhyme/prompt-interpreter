import { useEffect, useState } from "react";
import { Key } from "lucide-react";
import {
  getElevenLabsKey, setElevenLabsKey,
  getGroqKey, setGroqKey,
} from "@/lib/keys.js";

export default function SettingsDialog({ open, onClose }) {
  const [el, setEl] = useState("");
  const [gm, setGm] = useState("");

  useEffect(() => {
    if (open) {
      setEl(getElevenLabsKey());
      setGm(getGroqKey());
    }
  }, [open]);

  if (!open) return null;

  const save = () => {
    setElevenLabsKey(el.trim());
    setGroqKey(gm.trim());
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border-2 border-primary/60 bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Key className="h-5 w-5 text-primary" />
          <h2 className="font-serif text-2xl">API Keys</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Keys are stored in your browser only. They are sent directly to ElevenLabs and Groq
          from this page. Do not use a key you would not paste into a public site.
        </p>

        <label className="text-xs uppercase tracking-widest text-muted-foreground">
          ElevenLabs API Key
        </label>
        <input
          type="password"
          value={el}
          onChange={(e) => setEl(e.target.value)}
          placeholder="sk_..."
          className="mt-1 mb-4 w-full rounded-md border border-border bg-input px-3 py-2 text-sm"
        />

        <label className="text-xs uppercase tracking-widest text-muted-foreground">
          Groq API Key
        </label>
        <input
          type="password"
          value={gm}
          onChange={(e) => setGm(e.target.value)}
          placeholder="gsk_..."
          className="mt-1 mb-6 w-full rounded-md border border-border bg-input px-3 py-2 text-sm"
        />

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={save}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
