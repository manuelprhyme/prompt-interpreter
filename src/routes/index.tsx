import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Mic, Scale, Copy, Volume2 } from "lucide-react";
import { useVoiceConversation } from "@/hooks/useVoiceConversation";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "CourtVoice — Your rights. Your voice." },
      {
        name: "description",
        content:
          "A fully voice-operated AI legal aid companion. Speak your legal problem and get plain-language rights, drafted letters, and clear next steps.",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&family=Inter:wght@400;500;600&display=swap",
      },
    ],
  }),
});

function StatusRing({
  isListening,
  isThinking,
  isSpeaking,
  onPointerDown,
  onPointerUp,
  disabled,
}: {
  isListening: boolean;
  isThinking: boolean;
  isSpeaking: boolean;
  onPointerDown: () => void;
  onPointerUp: () => void;
  disabled: boolean;
}) {
  const cls = isListening
    ? "mic-listening"
    : isThinking
      ? "mic-thinking"
      : isSpeaking
        ? ""
        : "mic-idle";

  return (
    <div className="relative flex flex-col items-center gap-6">
      <button
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={() => isListening && onPointerUp()}
        disabled={disabled}
        aria-label="Press and hold to speak"
        className={`relative flex h-44 w-44 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${cls}`}
        style={{ boxShadow: "var(--shadow-gold)" }}
      >
        <Mic className="h-16 w-16" strokeWidth={1.6} />
      </button>
      <div className="h-6 flex items-center justify-center gap-1 text-sm uppercase tracking-[0.2em] text-muted-foreground">
        {isListening && <span className="text-destructive">● Listening — release to send</span>}
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
        {!isListening && !isThinking && !isSpeaking && (
          <span>Press &amp; hold to speak</span>
        )}
      </div>
    </div>
  );
}

function CourtVoiceApp() {
  const v = useVoiceConversation();
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [v.messages, v.isThinking]);

  const disabled = v.isSpeaking || v.isThinking;

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
          <h2 className="text-3xl font-serif text-center mb-2">
            Speak your situation.
          </h2>
          <p className="text-muted-foreground text-center max-w-md mb-10">
            Eviction, wrongful firing, contract dispute, police encounter — say it
            in your own words. CourtVoice will respond.
          </p>

          <StatusRing
            isListening={v.isListening}
            isThinking={v.isThinking}
            isSpeaking={v.isSpeaking}
            onPointerDown={v.startListening}
            onPointerUp={v.stopListening}
            disabled={disabled}
          />

          {v.error && (
            <p className="mt-6 text-sm text-destructive text-center">{v.error}</p>
          )}

          <div
            ref={feedRef}
            className="mt-10 w-full max-h-80 overflow-y-auto space-y-4 pr-2"
          >
            {v.messages.length === 0 && (
              <p className="text-center text-sm text-muted-foreground italic">
                Your conversation will appear here.
              </p>
            )}
            {v.messages.map((m, i) => (
              <div
                key={i}
                className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
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
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-xl">Drafted Letter</h3>
            {v.letter && (
              <div className="flex gap-2">
                <button
                  onClick={v.readLetterAloud}
                  disabled={disabled}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  <Volume2 className="h-3.5 w-3.5" /> Read aloud
                </button>
                <button
                  onClick={v.copyLetter}
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy
                </button>
              </div>
            )}
          </div>

          {v.letter ? (
            <pre className="paper flex-1 whitespace-pre-wrap rounded-lg p-6 text-sm leading-8 shadow-inner overflow-y-auto max-h-[28rem]">
              {v.letter.replace(/\[DATE\]/g, new Date().toLocaleDateString())}
            </pre>
          ) : (
            <div className="flex-1 rounded-lg border border-dashed border-border/70 flex items-center justify-center p-8 text-center text-sm text-muted-foreground italic">
              When CourtVoice has enough information, a formal letter will appear
              here — ready to read aloud, copy, or print.
            </div>
          )}
        </aside>
      </section>

      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        Always consult a qualified lawyer for serious legal matters.
      </footer>
    </main>
  );
}

function Index() {
  return <CourtVoiceApp />;
}
