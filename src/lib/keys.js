const ELEVEN_KEY = "courtvoice.elevenlabsKey";
const LLM_KEY = "courtvoice.geminiKey";

export function getElevenLabsKey() {
  return localStorage.getItem(ELEVEN_KEY) || "";
}
export function setElevenLabsKey(v) {
  localStorage.setItem(ELEVEN_KEY, v);
}
export function getGeminiKey() {
  return localStorage.getItem(LLM_KEY) || "";
}
export function setGeminiKey(v) {
  localStorage.setItem(LLM_KEY, v);
}
export function hasAllKeys() {
  return !!getElevenLabsKey() && !!getGeminiKey();
}
