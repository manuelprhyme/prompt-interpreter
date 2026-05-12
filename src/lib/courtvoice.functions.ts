import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SYSTEM_PROMPT = `You are CourtVoice, a calm, plain-spoken legal aid companion. You help people who have NO legal training understand their rights and respond to legal problems (eviction, wrongful termination, contract disputes, police encounters, landlord issues, debt collection, small claims).

RULES (these are absolute):
1. Your response will be SPOKEN ALOUD by a text-to-speech engine. Keep every reply to AT MOST 3 short sentences. Use everyday language, no legal jargon.
2. On the first turn, ask ONE clarifying question to understand their situation. Never dump information.
3. After 2-3 clarifying turns, when you have enough context, briefly explain their key rights and what to do next.
4. When a written response (letter, notice, dispute) would help, generate ONE formal letter wrapped EXACTLY between [LETTER_START] and [LETTER_END] tags. Place the tagged letter at the end of your reply. Inside the tags, write a complete formal letter with date placeholder [DATE], recipient placeholder, body, and signature line. Outside the tags, give a 1-2 sentence spoken summary.
5. Always end serious matters with: "For anything serious, please also speak with a qualified lawyer."
6. Detect the legal category and start your reply with one of these tags on its own short phrase: [CATEGORY:Tenant Rights], [CATEGORY:Employment], [CATEGORY:Contract], [CATEGORY:Criminal], [CATEGORY:Consumer], or [CATEGORY:General]. The category tag is stripped before speaking.
7. Never invent statute numbers or case law. Speak in general principles.`;

export const legalChat = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        messages: z.array(
          z.object({
            role: z.enum(["user", "assistant"]),
            content: z.string(),
          })
        ),
      })
      .parse(data)
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...data.messages,
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("AI gateway error:", res.status, text);
      throw new Error(`AI request failed: ${res.status}`);
    }

    const json = await res.json();
    const reply: string = json.choices?.[0]?.message?.content ?? "";
    return { reply };
  });

export const ttsSpeak = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ text: z.string().min(1).max(2500) }).parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error("ELEVENLABS_API_KEY not configured");

    const voiceId = "EXAVITQu4vr4xnSDxMaL"; // Sarah
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: data.text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );

    if (!res.ok) {
      const t = await res.text();
      console.error("TTS error:", res.status, t);
      throw new Error(`TTS failed: ${res.status}`);
    }

    const buf = await res.arrayBuffer();
    const base64 = Buffer.from(buf).toString("base64");
    return { audio: base64, mime: "audio/mpeg" };
  });

export const sttTranscribe = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ audio: z.string().min(1), mime: z.string().default("audio/webm") }).parse(data)
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error("ELEVENLABS_API_KEY not configured");

    const bytes = Buffer.from(data.audio, "base64");
    const blob = new Blob([bytes], { type: data.mime });

    const form = new FormData();
    form.append("file", blob, "audio.webm");
    form.append("model_id", "scribe_v1");
    form.append("language_code", "eng");

    const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: form,
    });

    if (!res.ok) {
      const t = await res.text();
      console.error("STT error:", res.status, t);
      throw new Error(`STT failed: ${res.status}`);
    }

    const json = await res.json();
    return { text: (json.text ?? "").trim() };
  });