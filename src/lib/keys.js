const ELEVEN_KEY = "courtvoice.elevenlabsKey";
const LLM_KEY = "courtvoice.groqKey";

export function getElevenLabsKey() {
  return localStorage.getItem(ELEVEN_KEY) || "";
}
export function setElevenLabsKey(v) {
  localStorage.setItem(ELEVEN_KEY, v);
}
export function getGroqKey() {
  return localStorage.getItem(LLM_KEY) || "";
}
export function setGroqKey(v) {
  localStorage.setItem(LLM_KEY, v);
}
export function hasAllKeys() {
  return !!getElevenLabsKey() && !!getGroqKey();
}
