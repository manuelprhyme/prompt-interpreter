import { getElevenLabsKey } from "./keys.js";

const VOICE_ID = "EXAVITQu4vr4xnSDxMaL"; // Sarah

function requireKey() {
  const k = getElevenLabsKey();
  if (!k) throw new Error("ElevenLabs API key missing. Add it in Settings.");
  return k;
}

export async function ttsSpeak(text) {
  const key = requireKey();
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ text, model_id: "eleven_turbo_v2_5" }),
    }
  );
  if (!res.ok) throw new Error(`TTS failed: ${res.status} ${await res.text()}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  await new Promise((resolve) => {
    audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
    audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
    audio.play().catch(() => resolve());
  });
}

export async function sttTranscribe(blob) {
  const key = requireKey();
  const fd = new FormData();
  fd.append("file", blob, "audio.webm");
  fd.append("model_id", "scribe_v1");
  fd.append("language_code", "eng");
  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": key },
    body: fd,
  });
  if (!res.ok) throw new Error(`STT failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.text || "";
}
