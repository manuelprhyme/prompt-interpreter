import { useCallback, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { legalChat, sttTranscribe, ttsSpeak } from "@/lib/courtvoice.functions";

export type ChatMessage = { role: "user" | "assistant"; content: string };

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function parseReply(raw: string): { spoken: string; category: string | null; letter: string | null } {
  let text = raw;
  let category: string | null = null;
  const catMatch = text.match(/\[CATEGORY:([^\]]+)\]/);
  if (catMatch) {
    category = catMatch[1].trim();
    text = text.replace(catMatch[0], "");
  }
  let letter: string | null = null;
  const letterMatch = text.match(/\[LETTER_START\]([\s\S]*?)\[LETTER_END\]/);
  if (letterMatch) {
    letter = letterMatch[1].trim();
    text = text.replace(letterMatch[0], "").trim();
  }
  return { spoken: text.trim(), category, letter };
}

export function useVoiceConversation() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [letter, setLetter] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const chatFn = useServerFn(legalChat);
  const sttFn = useServerFn(sttTranscribe);
  const ttsFn = useServerFn(ttsSpeak);

  const playTTS = useCallback(
    async (text: string) => {
      if (!text) return;
      try {
        setIsSpeaking(true);
        const { audio, mime } = await ttsFn({ data: { text } });
        const src = `data:${mime};base64,${audio}`;
        const el = new Audio(src);
        audioRef.current = el;
        await new Promise<void>((resolve) => {
          el.onended = () => resolve();
          el.onerror = () => resolve();
          el.play().catch(() => resolve());
        });
      } finally {
        setIsSpeaking(false);
        audioRef.current = null;
      }
    },
    [ttsFn]
  );

  const sendText = useCallback(
    async (userText: string) => {
      if (!userText.trim()) return;
      const next: ChatMessage[] = [...messages, { role: "user", content: userText }];
      setMessages(next);
      setIsThinking(true);
      try {
        const { reply } = await chatFn({ data: { messages: next } });
        const parsed = parseReply(reply);
        setMessages([...next, { role: "assistant", content: parsed.spoken || reply }]);
        if (parsed.category) setCategory(parsed.category);
        if (parsed.letter) setLetter(parsed.letter);
        setIsThinking(false);
        await playTTS(parsed.spoken || reply);
      } catch (e) {
        console.error(e);
        setError("Something went wrong. Please try again.");
        setIsThinking(false);
        await playTTS("Sorry, something went wrong. Please try again.");
      }
    },
    [messages, chatFn, playTTS]
  );

  const startListening = useCallback(async () => {
    if (isListening || isSpeaking || isThinking) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.start();
      recorderRef.current = mr;
      setIsListening(true);
    } catch (e) {
      console.error(e);
      setError("Microphone access denied. Please allow microphone permissions.");
      await playTTS("I cannot hear you. Please allow microphone access.");
    }
  }, [isListening, isSpeaking, isThinking, playTTS]);

  const stopListening = useCallback(async () => {
    const mr = recorderRef.current;
    if (!mr) return;
    setIsListening(false);
    await new Promise<void>((resolve) => {
      mr.onstop = () => resolve();
      mr.stop();
    });
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    chunksRef.current = [];
    if (blob.size < 800) return; // ignore extremely short clips
    setIsThinking(true);
    try {
      const base64 = await blobToBase64(blob);
      const { text } = await sttFn({ data: { audio: base64, mime: "audio/webm" } });
      setIsThinking(false);
      if (text) await sendText(text);
    } catch (e) {
      console.error(e);
      setIsThinking(false);
      setError("Could not transcribe audio.");
      await playTTS("I could not understand that. Please try again.");
    }
  }, [sttFn, sendText, playTTS]);

  const readLetterAloud = useCallback(async () => {
    if (!letter) return;
    await playTTS(letter.replace(/\[DATE\]/g, new Date().toLocaleDateString()));
  }, [letter, playTTS]);

  const copyLetter = useCallback(async () => {
    if (!letter) return;
    try {
      await navigator.clipboard.writeText(letter);
    } catch (e) {
      console.error(e);
    }
  }, [letter]);

  return {
    messages,
    isListening,
    isThinking,
    isSpeaking,
    category,
    letter,
    error,
    startListening,
    stopListening,
    readLetterAloud,
    copyLetter,
  };
}