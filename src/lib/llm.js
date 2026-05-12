import { getGeminiKey } from "./keys.js";

const SYSTEM_PROMPT = `You are CourtVoice, an empathetic AI legal aid companion. Speak in plain language, concise (max 4 sentences when conversing). When the user describes a legal problem:
1. Briefly acknowledge.
2. State the most relevant rights/laws in plain terms.
3. Recommend clear next steps.
4. If a written letter is appropriate (eviction, complaint, demand, dispute), draft one wrapped EXACTLY as: [LETTER_START] ... [LETTER_END]
5. Tag the case category EXACTLY once, somewhere in the reply, as: [CATEGORY:Housing] or [CATEGORY:Employment] etc.
Always remind the user this is general guidance, not legal advice for serious cases.`;

export async function legalChat(messages, profile) {
  const key = getGeminiKey();
  if (!key) throw new Error("Gemini API key missing. Add it in Settings.");

  const profileBlock = profile?.profileComplete
    ? `\n\nUSER PROFILE (use when drafting letters):\nName: ${profile.name}\nLocation: ${profile.location}\nPhone: ${profile.phone}\nEmail: ${profile.email || "n/a"}`
    : "";

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT + profileBlock }] },
        contents,
      }),
    }
  );
  if (!res.ok) throw new Error(`LLM failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}
