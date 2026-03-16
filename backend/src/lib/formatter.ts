import { RawBusiness } from './scraper';

export interface Business {
  name: string;
  category: string;
  address: string;
  phone: string;
  website: string;
  rating: string;
  reviews: string;
  matchConfidence: 'high' | 'medium' | 'low';
}

export function formatResults(raw: RawBusiness[]): Business[] {
  console.log(`FORMATTER_INPUT_COUNT ${raw.length}`);

  const formatted = raw.flatMap((record) => {
    console.log(`FORMATTER_RECORD ${JSON.stringify(record)}`);

    if (!record.name?.trim()) {
      console.log(`FORMATTER_DROP_REASON empty_name ${JSON.stringify(record)}`);
      return [];
    }

    return [
      {
        ...record,
        // Clean reviews field: strip all non-numeric characters (e.g., "132 reviews" -> "132")
        reviews: record.reviews.replace(/[^0-9]/g, ''),
      },
    ];
  });

  console.log(`FORMATTER_OUTPUT_COUNT ${formatted.length}`);
  return formatted;
}
