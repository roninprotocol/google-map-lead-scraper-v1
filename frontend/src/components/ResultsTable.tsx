import { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Globe,
  MapPin,
  Phone,
  Star,
} from 'lucide-react';
import type { BusinessRecord } from '../types';

// ADD THIS: Extended props for selection
interface ResultsTableProps {
  data: BusinessRecord[];
  selectedIds: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: (allIds: string[]) => void;
}

function getDomainLabel(website: string) {
  if (!website) {
    return '';
  }

  try {
    const parsed = new URL(website.startsWith('http') ? website : `https://${website}`);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return website.replace(/^https?:\/\//, '').replace(/^www\./, '');
  }
}

function downloadSingleRow(row: BusinessRecord) {
  const csv = [
    ['Name', 'Category', 'MatchConfidence', 'Address', 'Phone', 'Website', 'Rating', 'Reviews'],
    [row.name, row.category, row.matchConfidence, row.address, row.phone, row.website, row.rating, row.reviews],
  ]
    .map((fields) => fields.map((field) => `"${(field || '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const safeName = (row.name || 'lead').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  anchor.href = url;
  anchor.download = `${safeName || 'lead'}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function createRowSummary(row: BusinessRecord) {
  return [
    `Name: ${row.name || '-'}`,
    `Category: ${row.category || '-'}`,
    `Relevance: ${row.matchConfidence}`,
    `Phone: ${row.phone || '-'}`,
    `Address: ${row.address || '-'}`,
    `Website: ${row.website || '-'}`,
    `Rating: ${row.rating || '-'}`,
    `Reviews: ${row.reviews || '-'}`,
  ].join('\n');
}

// CopyCell component for reusable copy actions
function CopyCell({ value, display }: { value: string; display?: string }) {
  const [copied, setCopied] = useState(false);
  const [timeoutId, setTimeoutId] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = () => {
    if (!value) return;

    navigator.clipboard.writeText(value);
    setCopied(true);

    const id = setTimeout(() => {
      setCopied(false);
    }, 1500);

    setTimeoutId(id);
  };

  // Clear timeout on unmount to prevent memory leaks
  useState(() => {
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  });

  const displayText = display || value;

  return (
    <span className="inline-flex items-center gap-2">
      <span className="truncate" title={value || undefined}>
        {displayText || '—'}
      </span>
      {value && (
        <button
          type="button"
          onClick={handleCopy}
          className="ghost-button inline-flex h-7 w-7 items-center justify-center rounded-lg opacity-70 transition hover:opacity-100"
          title="Copy to clipboard"
        >
          {copied ? (
            <svg className="h-4 w-4 text-[var(--success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
      )}
    </span>
  );
}

// ADD THIS: Checkbox component for selection
function Checkbox({
  checked,
  onChange,
  indeterminate = false,
}: {
  checked: boolean;
  onChange: () => void;
  indeterminate?: boolean;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      ref={(el) => {
        if (el) el.indeterminate = indeterminate;
      }}
      className="h-4 w-4 cursor-pointer rounded border border-[rgba(196,181,253,0.3)] bg-[rgba(7,3,15,0.6)] text-[var(--violet-primary)] accent-[var(--violet-primary)] transition hover:border-[var(--violet-primary)]"
    />
  );
}

export default function ResultsTable({ data, selectedIds, onToggleRow, onToggleAll }: ResultsTableProps) {
  const [feedbackKey, setFeedbackKey] = useState<string | null>(null);

  if (!data || data.length === 0) return null;

  // ADD THIS: Compute selection state for header checkbox
  const allIds = data.map((r) => r._id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const someSelected = allIds.some((id) => selectedIds.has(id)) && !allSelected;

  const flashFeedback = (key: string) => {
    setFeedbackKey(key);
    window.setTimeout(() => {
      setFeedbackKey((current) => (current === key ? null : current));
    }, 1500);
  };

  const getRelevanceClasses = (matchConfidence: BusinessRecord['matchConfidence']) => {
    if (matchConfidence === 'high') {
      return 'border-[rgba(34,197,94,0.28)] bg-[rgba(34,197,94,0.14)] text-[var(--success)] shadow-[0_0_24px_rgba(34,197,94,0.12)]';
    }

    if (matchConfidence === 'medium') {
      return 'border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.14)] text-[var(--warning)] shadow-[0_0_24px_rgba(245,158,11,0.12)]';
    }

    return 'border-[rgba(196,181,253,0.18)] bg-[rgba(139,92,246,0.1)] text-[var(--text-accent)]';
  };

  return (
    <div className="glass-panel overflow-hidden rounded-[30px] p-3 sm:p-4">
      <div className="overflow-auto rounded-[24px] border border-[rgba(196,181,253,0.08)] bg-[rgba(7,3,15,0.4)]">
        <table className="min-w-full border-separate border-spacing-0 text-left">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[rgba(18,9,31,0.88)] backdrop-blur-xl">
              {/* ADD THIS: Select-all checkbox header */}
              <th className="border-b border-[rgba(196,181,253,0.08)] px-5 py-4 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
                <Checkbox
                  checked={allSelected}
                  onChange={() => onToggleAll(allIds)}
                  indeterminate={someSelected}
                />
              </th>
              {['Name', 'Category', 'Relevance', 'Contact Block', 'Location', 'Website'].map((heading) => (
                <th
                  key={heading}
                  className="border-b border-[rgba(196,181,253,0.08)] px-5 py-4 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => {
              const rowFeedbackKey = `${index}-row`;
              const exportFeedbackKey = `${index}-export`;
              const websiteHref = row.website
                ? (row.website.startsWith('http') ? row.website : `https://${row.website}`)
                : '';

              // ADD THIS: Check if row is selected
              const isSelected = selectedIds.has(row._id);

              return (
                <tr
                  key={row._id}
                  className={`group/row transition duration-300 hover:bg-[rgba(59,130,246,0.05)] ${
                    // ADD THIS: Highlight selected rows
                    isSelected ? 'bg-[rgba(109,76,255,0.08)]' : ''
                  }`}
                >
                  {/* ADD THIS: Row checkbox cell */}
                  <td className="border-b border-[rgba(196,181,253,0.06)] px-5 py-5 align-top">
                    <Checkbox checked={isSelected} onChange={() => onToggleRow(row._id)} />
                  </td>
                  <td className="border-b border-[rgba(196,181,253,0.06)] px-5 py-5 align-top">
                    <div className="min-w-[220px] space-y-3">
                      <div className="text-[17px] font-semibold leading-7 tracking-[-0.02em] text-[var(--text-primary)]">
                        {row.name || 'Unnamed business'}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
                        <span className="inline-flex items-center gap-1.5">
                          <Star className="h-3.5 w-3.5 text-[var(--warning)]" />
                          {row.rating || 'No rating'}
                        </span>
                        <span>{row.reviews ? `${row.reviews} reviews` : 'Reviews unavailable'}</span>
                      </div>
                    </div>
                  </td>

                  <td className="border-b border-[rgba(196,181,253,0.06)] px-5 py-5 align-top">
                    <div className="inline-flex rounded-full border border-[rgba(196,181,253,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-sm font-medium text-[var(--text-primary)]">
                      {row.category || 'Category unavailable'}
                    </div>
                  </td>

                  <td className="border-b border-[rgba(196,181,253,0.06)] px-5 py-5 align-top">
                    <span
                      className={`inline-flex rounded-full border px-4 py-2 text-sm font-semibold capitalize ${getRelevanceClasses(row.matchConfidence)}`}
                    >
                      {row.matchConfidence}
                    </span>
                  </td>

                  <td className="border-b border-[rgba(196,181,253,0.06)] px-5 py-5 align-top">
                    <div className="min-w-[220px] space-y-3">
                      <div className="inline-flex items-start gap-3 text-sm text-[var(--text-primary)]">
                        {row.phone ? (
                          <a
                            href={`tel:${row.phone}`}
                            className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[rgba(109,76,255,0.14)] text-[var(--text-accent)] transition hover:bg-[rgba(109,76,255,0.24)]"
                            title="Call phone number"
                          >
                            <Phone className="h-4 w-4" />
                          </a>
                        ) : (
                          <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[rgba(109,76,255,0.14)] text-[var(--text-accent)]">
                            <Phone className="h-4 w-4" />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <CopyCell value={row.phone || ''} />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 opacity-100 transition sm:opacity-0 sm:group-hover/row:opacity-100">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(createRowSummary(row));
                            flashFeedback(rowFeedbackKey);
                          }}
                          className="ghost-button inline-flex h-9 w-9 items-center justify-center rounded-xl"
                          title="Copy row"
                        >
                          {feedbackKey === rowFeedbackKey ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            downloadSingleRow(row);
                            flashFeedback(exportFeedbackKey);
                          }}
                          className="ghost-button inline-flex h-9 w-9 items-center justify-center rounded-xl"
                          title="Export single row"
                        >
                          {feedbackKey === exportFeedbackKey ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </td>

                  <td className="border-b border-[rgba(196,181,253,0.06)] px-5 py-5 align-top">
                    <div className="min-w-[220px] inline-flex items-start gap-3 text-sm text-[var(--text-primary)]">
                      {row.address ? (
                        <a
                          href={`https://www.google.com/maps/search/${encodeURIComponent(row.address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[rgba(59,130,246,0.14)] text-[var(--blue-accent)] transition hover:bg-[rgba(59,130,246,0.24)]"
                          title="Open in Google Maps"
                        >
                          <MapPin className="h-4 w-4" />
                        </a>
                      ) : (
                        <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[rgba(59,130,246,0.14)] text-[var(--blue-accent)]">
                          <MapPin className="h-4 w-4" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <CopyCell
                          value={row.address || ''}
                          display={row.address ? (row.address.length > 40 ? row.address.slice(0, 40) + '...' : row.address) : ''}
                        />
                      </div>
                    </div>
                  </td>

                  <td className="border-b border-[rgba(196,181,253,0.06)] px-5 py-5 align-top">
                    <div className="min-w-[210px] space-y-3">
                      <div className="inline-flex items-start gap-3 text-sm text-[var(--text-primary)]">
                        {websiteHref ? (
                          <a
                            href={websiteHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[rgba(139,92,246,0.14)] text-[var(--text-accent)] transition hover:bg-[rgba(139,92,246,0.24)]"
                            title="Open website"
                          >
                            <Globe className="h-4 w-4" />
                          </a>
                        ) : (
                          <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[rgba(139,92,246,0.14)] text-[var(--text-accent)]">
                            <Globe className="h-4 w-4" />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <CopyCell value={websiteHref} display={websiteHref ? getDomainLabel(websiteHref) : ''} />
                          <div className="mt-1 text-xs text-[var(--text-muted)]">
                            {websiteHref ? '' : 'No website captured'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
