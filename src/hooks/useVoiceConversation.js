import { useCallback, useEffect, useRef, useState } from "react";
import { sttTranscribe, ttsSpeak } from "@/lib/elevenlabs";
import { legalChat } from "@/lib/llm";
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

const SILENCE_THRESHOLD = 18;   // RMS level below which = silence
const SILENCE_DURATION  = 1500; // ms of silence before auto-submit
const MIN_SPEECH_MS     = 400;  // ignore clips shorter than this

export function useVoiceConversation() {
  const [messages, setMessages] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isActive, setIsActive] = useState(false); // conversation session on/off
  const [category, setCategory] = useState(null);
  const [letter, setLetter] = useState(null);
  const [error, setError] = useState(null);

  const recorderRef    = useRef(null);
  const chunksRef      = useRef([]);
  const streamRef      = useRef(null);
  const audioCtxRef    = useRef(null);
  const analyserRef    = useRef(null);
  const silenceTimerRef = useRef(null);
  const speechStartRef = useRef(null);
  const activeRef      = useRef(false); // mirror of isActive for closures
  const messagesRef    = useRef([]);    // mirror of messages for closures

  // keep refs in sync
  useEffect(() => { messagesRef.current = messages; }, [messages]);

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

  // Submit a transcribed utterance, then restart listening if still active
  const sendText = useCallback(
    async (userText) => {
      if (!userText.trim()) return;
      const next = [...messagesRef.current, { role: "user", content: userText }];
      setMessages(next);
      messagesRef.current = next;
      setIsThinking(true);
      try {
        const reply = await legalChat(next, null);
        const parsed = parseReply(reply);
        const updated = [...next, { role: "assistant", content: parsed.spoken || reply }];
        setMessages(updated);
        messagesRef.current = updated;
        if (parsed.category) setCategory(parsed.category);
        if (parsed.letter) setLetter(parsed.letter);
        setIsThinking(false);
        await playTTS(parsed.spoken || reply);
      } catch (e) {
        console.error(e);
        setError(e.message || "Something went wrong.");
        setIsThinking(false);
      }
      // restart mic if session still active
      if (activeRef.current) startMic();
    },
    [playTTS]
  );

  // Stop the recorder and process the audio chunk
  const flushRecording = useCallback(async () => {
    const mr = recorderRef.current;
    if (!mr || mr.state === "inactive") return;
    clearTimeout(silenceTimerRef.current);
    setIsListening(false);
    await new Promise((resolve) => { mr.onstop = resolve; mr.stop(); });
    const elapsed = Date.now() - (speechStartRef.current || 0);
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    chunksRef.current = [];
    recorderRef.current = null;
    if (blob.size < 800 || elapsed < MIN_SPEECH_MS) {
      if (activeRef.current) startMic();
      return;
    }
    setIsThinking(true);
    try {
      const text = await sttTranscribe(blob);
      setIsThinking(false);
      if (text) await sendText(text);
      else if (activeRef.current) startMic();
    } catch (e) {
      console.error(e);
      setIsThinking(false);
      setError(e.message || "Could not transcribe audio.");
      if (activeRef.current) startMic();
    }
  }, [sendText]);

  // Start mic + silence detection (internal, not exposed)
  const startMic = useCallback(async () => {
    if (!activeRef.current) return;
    try {
      // reuse stream if still alive, otherwise get a new one
      if (!streamRef.current || !streamRef.current.active) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      const stream = streamRef.current;
      chunksRef.current = [];
      speechStartRef.current = Date.now();

      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.start(100);
      recorderRef.current = mr;
      setIsListening(true);

      // silence detection via Web Audio
      if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      let silenceSince = null;

      const tick = () => {
        if (!activeRef.current || recorderRef.current !== mr) return;
        analyser.getByteTimeDomainData(data);
        const rms = Math.sqrt(data.reduce((s, v) => s + (v - 128) ** 2, 0) / data.length);
        if (rms < SILENCE_THRESHOLD) {
          if (!silenceSince) silenceSince = Date.now();
          else if (Date.now() - silenceSince > SILENCE_DURATION) {
            flushRecording();
            return;
          }
        } else {
          silenceSince = null;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } catch (e) {
      console.error(e);
      setError("Microphone access denied.");
      setIsActive(false);
      activeRef.current = false;
    }
  }, [flushRecording]);

  // Toggle the whole conversation session
  const toggleConversation = useCallback(async () => {
    if (activeRef.current) {
      // STOP session
      activeRef.current = false;
      setIsActive(false);
      clearTimeout(silenceTimerRef.current);
      const mr = recorderRef.current;
      if (mr && mr.state !== "inactive") mr.stop();
      recorderRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
      setIsListening(false);
    } else {
      // START session
      setError(null);
      activeRef.current = true;
      setIsActive(true);
      await startMic();
    }
  }, [startMic]);

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

  const downloadLetter = useCallback(() => {
    if (!letter) return;
    const text = letter.replace(/\[DATE\]/g, new Date().toLocaleDateString());
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "courtvoice-letter.txt";
    a.click();
    URL.revokeObjectURL(url);
  }, [letter]);

  const emailLetter = useCallback(() => {
    if (!letter) return;
    const text = letter.replace(/\[DATE\]/g, new Date().toLocaleDateString());
    const subject = encodeURIComponent("Legal Letter — CourtVoice");
    const body = encodeURIComponent(text);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  }, [letter]);

  return {
    messages, isListening, isThinking, isSpeaking, isActive,
    category, letter, error,
    toggleConversation, readLetterAloud, copyLetter, downloadLetter, emailLetter,
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
