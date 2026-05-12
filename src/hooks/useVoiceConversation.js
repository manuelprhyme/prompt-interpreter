import { useCallback, useRef, useState } from "react";
import { sttTranscribe, ttsSpeak } from "@/lib/elevenlabs";
import { legalChat } from "@/lib/llm";
import { useUserProfile } from "@/context/UserProfileContext.jsx";

function parseReply(raw) {
  let text = raw;
  let category = null;
  const cat = text.match(/\[CATEGORY:([^\]]+)\]/);
  if (cat) {
    category = cat[1].trim();
    text = text.replace(cat[0], "");
  }
  let letter = null;
  const lm = text.match(/\[LETTER_START\]([\s\S]*?)\[LETTER_END\]/);
  if (lm) {
    letter = lm[1].trim();
    text = text.replace(lm[0], "").trim();
  }
  return { spoken: text.trim(), category, letter };
}

export function useVoiceConversation() {
  const { userProfile } = useUserProfile();
  const [messages, setMessages] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [category, setCategory] = useState(null);
  const [letter, setLetter] = useState(null);
  const [error, setError] = useState(null);

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  const playTTS = useCallback(async (text) => {
    if (!text) return;
    try {
      setIsSpeaking(true);
      await ttsSpeak(text);
    } catch (e) {
      console.error(e);
      setError(e.message);
    } finally {
      setIsSpeaking(false);
    }
  }, []);

  const sendText = useCallback(
    async (userText) => {
      if (!userText.trim()) return;
      const next = [...messages, { role: "user", content: userText }];
      setMessages(next);
      setIsThinking(true);
      try {
        const reply = await legalChat(next, userProfile);
        const parsed = parseReply(reply);
        setMessages([...next, { role: "assistant", content: parsed.spoken || reply }]);
        if (parsed.category) setCategory(parsed.category);
        if (parsed.letter) setLetter(parsed.letter);
        setIsThinking(false);
        await playTTS(parsed.spoken || reply);
      } catch (e) {
        console.error(e);
        setError(e.message || "Something went wrong.");
        setIsThinking(false);
      }
    },
    [messages, playTTS, userProfile]
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
      setError("Microphone access denied.");
    }
  }, [isListening, isSpeaking, isThinking]);

  const stopListening = useCallback(async () => {
    const mr = recorderRef.current;
    if (!mr) return;
    setIsListening(false);
    await new Promise((resolve) => {
      mr.onstop = () => resolve();
      mr.stop();
    });
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    chunksRef.current = [];
    if (blob.size < 800) return;
    setIsThinking(true);
    try {
      const text = await sttTranscribe(blob);
      setIsThinking(false);
      if (text) await sendText(text);
    } catch (e) {
      console.error(e);
      setIsThinking(false);
      setError(e.message || "Could not transcribe audio.");
    }
  }, [sendText]);

  const readLetterAloud = useCallback(async () => {
    if (!letter) return;
    await playTTS(letter.replace(/\[DATE\]/g, new Date().toLocaleDateString()));
  }, [letter, playTTS]);

  const copyLetter = useCallback(async () => {
    if (!letter) return;
    try {
      await navigator.clipboard.writeText(letter);
    } catch (e) { console.error(e); }
  }, [letter]);

  return {
    messages, isListening, isThinking, isSpeaking,
    category, letter, error,
    startListening, stopListening, readLetterAloud, copyLetter,
  };
}

// Standalone helper: record + transcribe a single utterance (for onboarding)
export function useVoiceCapture() {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  const start = useCallback(async () => {
    if (isListening || isProcessing) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    chunksRef.current = [];
    const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.start();
    recorderRef.current = mr;
    setIsListening(true);
  }, [isListening, isProcessing]);

  const stop = useCallback(async () => {
    const mr = recorderRef.current;
    if (!mr) return "";
    setIsListening(false);
    await new Promise((r) => { mr.onstop = () => r(); mr.stop(); });
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    chunksRef.current = [];
    if (blob.size < 800) return "";
    setIsProcessing(true);
    try {
      const text = await sttTranscribe(blob);
      return text;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return { isListening, isProcessing, start, stop };
}

export { ttsSpeak };
