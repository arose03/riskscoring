// ============================================================
// RentCafe / Entrata Scraper
// ============================================================

import * as cheerio from 'cheerio';
import { RentScraper, ScraperSearchParams, ScraperResult, ScrapedComp, UnitType } from './types';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function normalizeUnitType(beds: number): UnitType {
  if (beds === 0) return 'studio';
  if (beds === 1) return '1br';
  if (beds === 2) return '2br';
  if (beds === 3) return '3br';
  if (beds === 4) return '4br';
  return '5br+';
}

function buildSearchUrl(params: ScraperSearchParams): string {
  const state = (params.state || '').toLowerCase().replace(/\s+/g, '-');
  const city = (params.city || '').toLowerCase().replace(/\s+/g, '-');
  return `https://www.rentcafe.com/apartments-for-rent/us/${state}/${city}/`;
}

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.text();
}

function parseSearchResults(html: string): ScrapedComp[] {
  const $ = cheerio.load(html);
  const comps: ScrapedComp[] = [];

  // RentCafe listing cards
  $('.listing-item, .apartment-card, [data-listingid], .search-results-item').each((_, el) => {
    try {
      const $el = $(el);
      const propertyName = $el.find('.listing-title, .property-name, .community-name, h2 a, h3 a').first().text().trim();
      const address = $el.find('.listing-address, .property-address, .community-address').first().text().trim();
      const rentText = $el.find('.listing-price, .rent-range, .price, .property-pricing').first().text().trim();
      const bedText = $el.find('.listing-beds, .bed-range, .beds, .property-beds').first().text().trim();
      const sqftText = $el.find('.listing-sqft, .sqft-range, .sqft, .property-sqft').first().text().trim();
      const href = $el.find('a').first().attr('href') || '';

      if (!propertyName) return;

      // Parse rent
      const rentClean = rentText.replace(/,/g, '');
      const rentRangeMatch = rentClean.match(/\$(\d+)\s*[-–]\s*\$(\d+)/);
      const rentSingleMatch = rentClean.match(/\$(\d+)/);
      let rent: number | null = null;
      if (rentRangeMatch) {
        rent = (parseInt(rentRangeMatch[1]) + parseInt(rentRangeMatch[2])) / 2;
      } else if (rentSingleMatch) {
        rent = parseInt(rentSingleMatch[1]);
      }
      if (!rent) return;

      // Parse beds
      let beds: number | null = null;
      if (/studio/i.test(bedText)) {
        beds = 0;
      } else {
        const bedMatch = bedText.match(/(\d+)\s*(?:bed|br|bd)/i);
        if (bedMatch) beds = parseInt(bedMatch[1]);
      }

      // Parse sqft
      const sqftClean = sqftText.replace(/,/g, '');
      const sqftMatch = sqftClean.match(/(\d+)\s*(?:sq\s*ft|sqft)/i);
      const sqft = sqftMatch ? parseInt(sqftMatch[1]) : undefined;

      if (beds !== null) {
        const effectiveBeds = Math.max(beds, 1);
        comps.push({
          source: 'rentcafe',
          propertyName,
          address,
          unitType: normalizeUnitType(beds),
          beds,
          sqft,
          rent,
          rentPerBed: rent / effectiveBeds,
          rentPerSqft: sqft ? rent / sqft : undefined,
          listingUrl: href.startsWith('http') ? href : href ? `https://www.rentcafe.com${href}` : undefined,
        });
      } else {
        // No bed count, assume aggregate listing
        comps.push({
          source: 'rentcafe',
          propertyName,
          address,
          unitType: '2br', // Default assumption
          beds: 2,
          sqft,
          rent,
          rentPerBed: rent / 2,
          rentPerSqft: sqft ? rent / sqft : undefined,
          listingUrl: href.startsWith('http') ? href : href ? `https://www.rentcafe.com${href}` : undefined,
        });
      }
    } catch {
      // Skip unparseable listing
    }
  });

  // Try JSON-LD structured data
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || '');
      const items = Array.isArray(json) ? json : [json];
      for (const item of items) {
        if (item['@type'] === 'ApartmentComplex' || item['@type'] === 'Residence') {
          const name = item.name || '';
          const addr = typeof item.address === 'string' ? item.address : item.address?.streetAddress || '';
          const lat = item.geo?.latitude;
          const lng = item.geo?.longitude;

          if (item.containsPlace && Array.isArray(item.containsPlace)) {
            for (const unit of item.containsPlace) {
              const beds = unit.numberOfBedrooms || unit.numberOfRooms || 1;
              const sqft = unit.floorSize?.value ? parseInt(unit.floorSize.value) : undefined;
              const price = unit.offers?.price || unit.offers?.lowPrice;
              if (price) {
                const rent = parseFloat(price);
                const effectiveBeds = Math.max(beds, 1);
                const exists = comps.some(c => c.propertyName === name && c.beds === beds);
                if (!exists) {
                  comps.push({
                    source: 'rentcafe',
                    propertyName: name,
                    address: addr,
                    lat,
                    lng,
                    unitType: normalizeUnitType(beds),
                    beds,
                    sqft,
                    rent,
                    rentPerBed: rent / effectiveBeds,
                    rentPerSqft: sqft ? rent / sqft : undefined,
                  });
                }
              }
            }
          }
        }
      }
    } catch {
      // JSON-LD parse error
    }
  });

  return comps;
}

export const rentcafeScraper: RentScraper = {
  source: 'rentcafe',

  async scrape(params: ScraperSearchParams): Promise<ScraperResult> {
    const maxResults = params.maxResults || 40;

    try {
      const url = buildSearchUrl(params);
      console.log(`[rentcafe] Fetching: ${url}`);

      const html = await fetchPage(url);
      const comps = parseSearchResults(html);

      return {
        source: 'rentcafe',
        comps: comps.slice(0, maxResults),
        scrapedAt: new Date().toISOString(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[rentcafe] Scraper error: ${message}`);
      return {
        source: 'rentcafe',
        comps: [],
        error: message,
        scrapedAt: new Date().toISOString(),
      };
    }
  },
};
