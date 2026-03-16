import { useEffect, useRef } from 'react';
import { Activity, CheckCircle2 } from 'lucide-react';

interface StatusLogProps {
  messages: string[];
}

export default function StatusLog({ messages }: StatusLogProps) {
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!messages || messages.length === 0) return null;

  const visibleMessages = messages.slice(-6).reverse();

  return (
    <div className="glass-panel rounded-[28px] p-6 sm:p-7">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-[var(--text-muted)]">Status rail</p>
          <h2 className="mt-2 text-xl font-bold tracking-[-0.03em] text-[var(--text-primary)]">Live operation feed</h2>
        </div>
        <div className="glass-pill inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-[var(--text-accent)]">
          <Activity className="h-4 w-4" />
          {messages.length} events
        </div>
      </div>

      <div className="relative mt-6 space-y-3 before:absolute before:bottom-2 before:left-[11px] before:top-2 before:w-px before:bg-[linear-gradient(180deg,rgba(196,181,253,0.22),rgba(59,130,246,0.08))]">
        {visibleMessages.map((msg, index) => {
          const isLatest = index === 0;

          return (
            <div
              key={`${msg}-${index}`}
              className="log-reveal relative flex gap-4 rounded-[20px] border border-[rgba(196,181,253,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-3"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <div className="relative z-10 mt-1 flex h-6 w-6 items-center justify-center rounded-full border border-[rgba(196,181,253,0.18)] bg-[var(--surface-elevated)]">
                {isLatest ? (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--blue-accent)] opacity-75 animate-ping" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--violet-secondary)]" />
                  </span>
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 text-[var(--success)]" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {isLatest ? 'Latest signal' : `Step ${messages.length - index}`}
                  </p>
                  <span className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
                    {isLatest ? 'Live' : 'Stored'}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{msg}</p>
              </div>
            </div>
          );
        })}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}
