"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { Icon } from "@/components/ui/icons";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/cn";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const GREETING: Message = {
  role: "assistant",
  content:
    "Bonjour ! Je peux analyser votre stock et vos ventes à partir des données de la boutique. Que voulez-vous savoir ?",
};

const SUGGESTIONS = [
  "Quels produits dois-je réapprovisionner ?",
  "Résume mes ventes du mois",
  "Quels sont mes produits les plus vendus ?",
];

export function AiAssistant({
  shopName,
  enabled,
}: {
  shopName: string;
  enabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, loading, error]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;

    const next: Message[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      // Le serveur recompose le contexte de la boutique à chaque appel.
      const history = next.slice(-10).map((message) => ({
        role: message.role,
        content: message.content,
      }));
      const result = await apiFetch<{ reply: string }>("/api/ai/chat", {
        method: "POST",
        csrf: true,
        body: { messages: history },
      });
      setMessages((current) => [
        ...current,
        { role: "assistant", content: result.reply },
      ]);
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "L'assistant est indisponible. Réessayez.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(input);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send(input);
    }
  }

  if (!enabled) return null;

  return (
    <div className="print:hidden">
      {open && (
        <section
          id="ai-assistant-panel"
          role="dialog"
          aria-label="Assistant IA"
          className="fixed bottom-[4.5rem] right-3 z-50 flex max-h-[min(72vh,34rem)] w-[min(calc(100vw-1.5rem),25rem)] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-float sm:right-5"
        >
          <div className="flex items-start justify-between gap-3 border-b border-line/80 bg-surface/60 px-4 py-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-dark">
                <Icon name="sparkles" className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h2 className="text-[0.8125rem] font-bold tracking-[-0.01em]">
                  Assistant IA
                </h2>
                <p className="truncate text-[0.6875rem] text-muted">{shopName}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {messages.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setMessages([GREETING]);
                    setError(null);
                  }}
                  className="rounded-md px-1.5 py-1 text-[0.625rem] font-semibold text-muted hover:bg-white hover:text-ink"
                >
                  Effacer
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-white hover:text-ink"
                aria-label="Fermer l'assistant"
              >
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
                  <path
                    d="m5 5 10 10M15 5 5 15"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div
            ref={listRef}
            aria-live="polite"
            className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-[0.8125rem] leading-6"
          >
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={cn(
                  "flex",
                  message.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                <p
                  className={cn(
                    "max-w-[92%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2",
                    message.role === "user"
                      ? "rounded-br-md bg-primary-dark text-white"
                      : "rounded-bl-md bg-surface text-ink",
                  )}
                >
                  {message.content}
                </p>
              </div>
            ))}

            {messages.length === 1 && !loading && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void send(suggestion)}
                    className="rounded-full border border-line bg-white px-2.5 py-1 text-left text-[0.6875rem] font-medium text-muted transition-colors hover:border-primary/30 hover:text-primary-dark"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            {loading && (
              <div className="flex justify-start">
                <span className="inline-flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-surface px-3 py-2 text-[0.75rem] text-muted">
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
                  />
                  Analyse des données…
                </span>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-danger/15 bg-danger-soft px-3 py-2 text-[0.75rem] leading-5 text-danger"
              >
                {error}
              </div>
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="border-t border-line/80 bg-white px-3 py-2.5"
          >
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                maxLength={2000}
                placeholder="Posez votre question…"
                className="max-h-28 min-h-9 flex-1 resize-none rounded-xl border border-line bg-white px-3 py-2 text-[0.8125rem] leading-5 text-ink shadow-soft placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                aria-label="Envoyer la question"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-dark text-white shadow-soft transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon name="send" className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1.5 text-[0.625rem] leading-4 text-muted">
              Réponses générées à partir de vos données. Vérifiez les chiffres
              importants.
            </p>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="ai-assistant-panel"
        className={cn(
          "fixed bottom-4 right-3 z-50 inline-flex h-11 items-center gap-2 rounded-full px-4 text-[0.8125rem] font-semibold shadow-float transition-colors sm:right-5",
          open
            ? "border border-line bg-white text-ink hover:bg-surface"
            : "bg-primary-dark text-white hover:bg-primary",
        )}
      >
        <Icon name="sparkles" className="h-4 w-4" />
        {open ? "Fermer" : "Assistant IA"}
      </button>
    </div>
  );
}
