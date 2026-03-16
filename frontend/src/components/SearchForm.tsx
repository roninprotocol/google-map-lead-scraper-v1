import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, MapPin, Search } from 'lucide-react';
import type { Status } from '../types';

interface SearchFormProps {
  onSubmit: (keyword: string, location: string) => void;
  status: Status;
  initialKeyword?: string;
  initialLocation?: string;
}

export default function SearchForm({
  onSubmit,
  status,
  initialKeyword = '',
  initialLocation = '',
}: SearchFormProps) {
  const [keyword, setKeyword] = useState(initialKeyword);
  const [location, setLocation] = useState(initialLocation);

  useEffect(() => {
    setKeyword(initialKeyword);
  }, [initialKeyword]);

  useEffect(() => {
    setLocation(initialLocation);
  }, [initialLocation]);

  const isLoading = status === 'loading' || status === 'streaming';
  const isDisabled = !keyword.trim() || !location.trim() || isLoading;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isDisabled) {
      onSubmit(keyword.trim(), location.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="glass-elevated rounded-[28px] p-4 sm:p-5">
      <div className="soft-outline rounded-[24px] border border-[rgba(196,181,253,0.12)] bg-[rgba(255,255,255,0.02)] p-3 sm:p-4">
        <div className="grid gap-3 xl:grid-cols-[1fr,1fr,220px]">
          <div className="rounded-[20px] border border-[rgba(196,181,253,0.12)] bg-[rgba(255,255,255,0.03)] px-4 py-3 transition duration-300 focus-within:border-[rgba(139,92,246,0.7)] focus-within:bg-[rgba(255,255,255,0.05)] focus-within:shadow-[0_0_0_4px_rgba(109,76,255,0.14)]">
            <label htmlFor="keyword" className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
              <Search className="h-4 w-4 text-[var(--text-accent)]" />
              Business type
            </label>
            <input
              id="keyword"
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              readOnly={isLoading}
              autoFocus
              placeholder="Dentist, plumber, gym..."
              className="command-input h-11 w-full border-0 bg-transparent px-0 py-0 text-base text-[var(--text-primary)] outline-none placeholder:text-[rgba(148,163,184,0.72)]"
            />
          </div>

          <div className="rounded-[20px] border border-[rgba(196,181,253,0.12)] bg-[rgba(255,255,255,0.03)] px-4 py-3 transition duration-300 focus-within:border-[rgba(139,92,246,0.7)] focus-within:bg-[rgba(255,255,255,0.05)] focus-within:shadow-[0_0_0_4px_rgba(109,76,255,0.14)]">
            <label htmlFor="location" className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
              <MapPin className="h-4 w-4 text-[var(--blue-accent)]" />
              City
            </label>
            <input
              id="location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              readOnly={isLoading}
              placeholder="London, Karachi, Manchester..."
              className="command-input h-11 w-full border-0 bg-transparent px-0 py-0 text-base text-[var(--text-primary)] outline-none placeholder:text-[rgba(148,163,184,0.72)]"
            />
          </div>

          <button
            type="submit"
            disabled={isDisabled}
            className="primary-button flex h-14 items-center justify-center gap-3 rounded-[22px] px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-white/70 opacity-70 animate-ping" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
                </span>
                Scraping live
              </>
            ) : (
              <>
                Start Scrape
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>

        <div className="mt-4 text-sm text-[var(--text-muted)]">
          <p>Scrape up to 20 local business leads from Google Maps with live progress updates.</p>
        </div>
      </div>
    </form>
  );
}
