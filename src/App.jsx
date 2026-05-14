import { useEffect, useRef } from "react";
import { Mic, MicOff, Scale, Copy, Volume2, Download, Mail } from "lucide-react";
import { useVoiceConversation } from "@/hooks/useVoiceConversation.js";

function StatusRing({ isActive, isListening, isThinking, isSpeaking, onToggle }) {
  const cls = isListening
    ? "mic-listening"
    : isThinking
    ? "mic-thinking"
    : isSpeaking
    ? ""
    : isActive
    ? "mic-listening"
    : "mic-idle";

  return (
    <div className="relative flex flex-col items-center gap-6">
      <button
        onClick={onToggle}
        aria-label={isActive ? "Stop conversation" : "Start conversation"}
        className={`relative flex h-44 w-44 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95 ${cls}`}
        style={{ boxShadow: "var(--shadow-gold)" }}
      >
        {isActive ? <MicOff className="h-16 w-16" strokeWidth={1.6} /> : <Mic className="h-16 w-16" strokeWidth={1.6} />}
      </button>
      <div className="h-6 flex items-center justify-center gap-1 text-sm uppercase tracking-[0.2em] text-muted-foreground">
        {isListening && <span className="text-destructive">● Listening…</span>}
        {isThinking && <span>Thinking…</span>}
        {isSpeaking && (
          <span className="flex items-center gap-2">
            Speaking
            <span className="flex items-end h-6">
              <span className="wave-bar" />
              <span className="wave-bar" />
              <span className="wave-bar" />
              <span className="wave-bar" />
              <span className="wave-bar" />
            </span>
          </span>
        )}
        {isActive && !isListening && !isThinking && !isSpeaking && <span>Waiting for you…</span>}
        {!isActive && <span>Click to start</span>}
      </div>
    </div>
  );
}

export default function App() {
  const v = useVoiceConversation();
  const feedRef = useRef(null);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [v.messages, v.isThinking]);

  return (
    <main className="min-h-screen text-foreground">
      <header className="mx-auto max-w-6xl px-6 pt-10 pb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Scale className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl leading-none">CourtVoice</h1>
            <p className="text-xs text-muted-foreground mt-1 tracking-wide">
              Your rights. Your voice. No lawyer required.
            </p>
          </div>
        </div>
        {v.category && (
          <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs uppercase tracking-widest text-primary">
            {v.category}
          </span>
        )}
      </header>

      <section className="mx-auto max-w-6xl px-6 grid gap-8 lg:grid-cols-[1.1fr_1fr] pb-16">
        <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-8 flex flex-col items-center">
          <h2 className="text-3xl font-serif text-center mb-2">Speak your situation.</h2>
          <p className="text-muted-foreground text-center max-w-md mb-10">
            Eviction, wrongful firing, contract dispute, police encounter — say it in your own
            words. CourtVoice will respond.
          </p>

          <StatusRing
            isActive={v.isActive}
            isListening={v.isListening}
            isThinking={v.isThinking}
            isSpeaking={v.isSpeaking}
            onToggle={v.toggleConversation}
          />

          {v.error && <p className="mt-6 text-sm text-destructive text-center">{v.error}</p>}

          <div ref={feedRef} className="mt-10 w-full max-h-80 overflow-y-auto space-y-4 pr-2">
            {v.messages.length === 0 && (
              <p className="text-center text-sm text-muted-foreground italic">
                Your conversation will appear here.
              </p>
            )}
            {v.messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Scale className="h-4 w-4" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-secondary text-secondary-foreground rounded-bl-sm"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {v.isThinking && (
              <div className="flex gap-3 justify-start">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Scale className="h-4 w-4" />
                </div>
                <div className="rounded-2xl rounded-bl-sm bg-secondary px-4 py-2 text-sm text-muted-foreground">
                  Considering your case…
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="rounded-2xl border border-border bg-card/60 backdrop-blur p-6 flex flex-col">
          <h3 className="font-serif text-xl mb-4">Drafted Letter</h3>

          {v.letter ? (
            <pre className="paper flex-1 whitespace-pre-wrap rounded-lg p-6 text-sm leading-8 shadow-inner overflow-y-auto max-h-[28rem] mb-4">
              {v.letter.replace(/\[DATE\]/g, new Date().toLocaleDateString())}
            </pre>
          ) : (
            <div className="flex-1 rounded-lg border border-dashed border-border/70 flex items-center justify-center p-8 text-center text-sm text-muted-foreground italic mb-4">
              When CourtVoice has enough information, a formal letter will appear here — ready to
              read aloud, copy, download, or send by email.
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={v.readLetterAloud}
              disabled={!v.letter || v.isSpeaking || v.isThinking}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Volume2 className="h-3.5 w-3.5" /> Read aloud
            </button>
            <button
              onClick={v.copyLetter}
              disabled={!v.letter}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Copy className="h-3.5 w-3.5" /> Copy
            </button>
            <button
              onClick={v.downloadLetter}
              disabled={!v.letter}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="h-3.5 w-3.5" /> Download
            </button>
            <button
              onClick={v.emailLetter}
              disabled={!v.letter}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Mail className="h-3.5 w-3.5" /> Email
            </button>
          </div>
        </aside>
      </section>

      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        Always consult a qualified lawyer for serious legal matters.
      </footer>
    </main>
  );
}
