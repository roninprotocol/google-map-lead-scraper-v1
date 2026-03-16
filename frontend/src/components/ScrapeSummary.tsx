interface ScrapeSummaryProps {
  keyword: string;
  location: string;
  results: Array<{
    phone: string;
    website: string;
    rating: string;
  }>;
  durationMs: number;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

function formatDate(): string {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const year = today.getFullYear();
  return `${month}/${day}/${year}`;
}

export default function ScrapeSummary({ keyword, location, results, durationMs }: ScrapeSummaryProps) {
  const withPhone = results.filter((r) => r.phone !== '').length;
  const withWebsite = results.filter((r) => r.website !== '').length;

  const containerStyle: React.CSSProperties = {
    backgroundColor: '#1a1a2e',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '16px',
    padding: '20px 24px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  };

  const queryStyle: React.CSSProperties = {
    color: '#e2e8f0',
    fontSize: '14px',
    fontWeight: 500,
  };

  const dateStyle: React.CSSProperties = {
    color: '#94a3b8',
    fontSize: '13px',
  };

  const statsRowStyle: React.CSSProperties = {
    display: 'flex',
    gap: '24px',
    flexWrap: 'wrap',
  };

  const statBlockStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  };

  const statValueStyle: React.CSSProperties = {
    color: '#f8fafc',
    fontSize: '24px',
    fontWeight: 700,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  };

  const statLabelStyle: React.CSSProperties = {
    color: '#64748b',
    fontSize: '12px',
    textTransform: 'lowercase',
    letterSpacing: '0.02em',
  };

  return (
    <div style={containerStyle}>
      <div style={rowStyle}>
        <span style={queryStyle}>
          {keyword} &bull; {location}
        </span>
        <span style={dateStyle}>{formatDate()}</span>
      </div>

      <div style={statsRowStyle}>
        <div style={statBlockStyle}>
          <span style={statValueStyle}>{results.length}</span>
          <span style={statLabelStyle}>extracted</span>
        </div>

        <div style={statBlockStyle}>
          <span style={statValueStyle}>{withPhone}</span>
          <span style={statLabelStyle}>contact-ready</span>
        </div>

        <div style={statBlockStyle}>
          <span style={statValueStyle}>{withWebsite}</span>
          <span style={statLabelStyle}>clickable</span>
        </div>

        <div style={statBlockStyle}>
          <span style={statValueStyle}>{formatDuration(durationMs)}</span>
          <span style={statLabelStyle}>duration</span>
        </div>
      </div>
    </div>
  );
}
