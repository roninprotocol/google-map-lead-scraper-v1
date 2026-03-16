import Papa from 'papaparse';
import type { BusinessRecord } from '../types';

export function downloadCSV(data: BusinessRecord[], keyword: string = 'leads', location: string = '') {
  if (!data || data.length === 0) return;

  const sanitizedData = data.map((row) => ({
    Name: row.name.replace(/,/g, ''),
    Category: row.category.replace(/,/g, ''),
    MatchConfidence: row.matchConfidence,
    Address: row.address.replace(/,/g, ''),
    Phone: row.phone.replace(/,/g, ''),
    Website: row.website.replace(/,/g, ''),
    Rating: row.rating.replace(/,/g, ''),
    Reviews: row.reviews.replace(/,/g, ''),
  }));

  const csvContent = Papa.unparse(sanitizedData);
  const dateStr = new Date().toISOString().split('T')[0];
  const finalCsv = `# Exported from Google Maps Lead Scraper - ${dateStr}\n${csvContent}`;
  const blob = new Blob([finalCsv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const safeKeyword = keyword.toLowerCase().replace(/\s+/g, '-');
  const safeLocation = location.toLowerCase().replace(/\s+/g, '-');

  anchor.href = url;
  anchor.download = `leads-${safeKeyword}${safeLocation ? `-${safeLocation}` : ''}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
