export function createSearchUrl(keyword: string, location: string): string {
  const query = encodeURIComponent(`${keyword} ${location}`);
  return `https://www.google.com/maps/search/${query}`;
}
