import { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Globe,
  MapPin,
  Phone,
  Star,
} from 'lucide-react';
import type { BusinessRecord } from '../types';

interface ResultsTableProps {
  data: BusinessRecord[];
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

export default function ResultsTable({ data }: ResultsTableProps) {
  const [feedbackKey, setFeedbackKey] = useState<string | null>(null);

  if (!data || data.length === 0) return null;

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
              const phoneFeedbackKey = `${index}-phone`;
              const rowFeedbackKey = `${index}-row`;
              const exportFeedbackKey = `${index}-export`;
              const websiteHref = row.website
                ? (row.website.startsWith('http') ? row.website : `https://${row.website}`)
                : '';

              return (
                <tr
                  key={`${row.name}-${index}`}
                  className="group/row transition duration-300 hover:bg-[rgba(59,130,246,0.05)]"
                >
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
                        <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[rgba(109,76,255,0.14)] text-[var(--text-accent)]">
                          <Phone className="h-4 w-4" />
                        </span>
                        <div>
                          <div className="font-medium">{row.phone || 'No phone available'}</div>
                          <div className="mt-1 text-xs text-[var(--text-muted)]">Copy or export this lead on hover.</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 opacity-100 transition sm:opacity-0 sm:group-hover/row:opacity-100">
                        <button
                          type="button"
                          onClick={() => {
                            if (!row.phone) return;
                            navigator.clipboard.writeText(row.phone);
                            flashFeedback(phoneFeedbackKey);
                          }}
                          disabled={!row.phone}
                          className="ghost-button inline-flex h-9 w-9 items-center justify-center rounded-xl disabled:cursor-not-allowed disabled:opacity-40"
                          title="Copy phone"
                        >
                          {feedbackKey === phoneFeedbackKey ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </button>

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
                      <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[rgba(59,130,246,0.14)] text-[var(--blue-accent)]">
                        <MapPin className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-medium" title={row.address || 'Address unavailable'}>
                          {row.address || 'Address unavailable'}
                        </div>
                        <div className="mt-1 text-xs text-[var(--text-muted)]">
                          Google Maps location block
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="border-b border-[rgba(196,181,253,0.06)] px-5 py-5 align-top">
                    <div className="min-w-[210px] space-y-3">
                      <div className="inline-flex items-start gap-3 text-sm text-[var(--text-primary)]">
                        <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[rgba(139,92,246,0.14)] text-[var(--text-accent)]">
                          <Globe className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-medium" title={websiteHref || 'Website unavailable'}>
                            {websiteHref ? getDomainLabel(websiteHref) : 'Website unavailable'}
                          </div>
                          <div className="mt-1 text-xs text-[var(--text-muted)]">
                            {websiteHref ? 'Open business site' : 'No website captured'}
                          </div>
                        </div>
                      </div>

                      {websiteHref ? (
                        <a
                          href={websiteHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ghost-button inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium text-[var(--text-primary)]"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Open website
                        </a>
                      ) : (
                        <span className="inline-flex h-9 items-center rounded-xl border border-[rgba(196,181,253,0.08)] px-3 text-sm text-[var(--text-muted)]">
                          Waiting on source website
                        </span>
                      )}
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
