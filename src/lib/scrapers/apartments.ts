// ============================================================
// Apartments.com Scraper
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

function buildSearchUrl(params: ScraperSearchParams, page: number = 1): string {
  const city = params.city.toLowerCase().replace(/\s+/g, '-');
  const state = params.state.toLowerCase().replace(/\s+/g, '-');
  let url = `https://www.apartments.com/student-housing/${city}-${state}/`;
  if (page > 1) {
    url += `${page}/`;
  }
  return url;
}

function parseRentRange(rentText: string): { min: number; max: number } | null {
  // Handle formats like "$1,200", "$800 - $1,200", "$1,200/mo", "$800 – $1,200"
  const cleaned = rentText.replace(/,/g, '').replace(/\/mo/gi, '');
  const rangeMatch = cleaned.match(/\$(\d+)\s*[-–]\s*\$(\d+)/);
  if (rangeMatch) {
    return { min: parseInt(rangeMatch[1]), max: parseInt(rangeMatch[2]) };
  }
  const singleMatch = cleaned.match(/\$(\d+)/);
  if (singleMatch) {
    const val = parseInt(singleMatch[1]);
    return { min: val, max: val };
  }
  return null;
}

function parseBeds(bedText: string): number | null {
  if (/studio/i.test(bedText)) return 0;
  const match = bedText.match(/(\d+)\s*(?:bed|br|bd)/i);
  if (match) return parseInt(match[1]);
  const numMatch = bedText.match(/^(\d+)$/);
  if (numMatch) return parseInt(numMatch[1]);
  return null;
}

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache',
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

  // Apartments.com uses article/li-based listing cards
  $('li.mortar-wrapper, article[data-listingid]').each((_, el) => {
    try {
      const $el = $(el);
      const propertyName = $el.find('.property-title, .js-placardTitle, [data-tid="property-title"]').first().text().trim();
      const address = $el.find('.property-address, [data-tid="property-address"]').first().text().trim();
      const rentText = $el.find('.property-pricing, .price-range, [data-tid="property-pricing"]').first().text().trim();
      const bedText = $el.find('.property-beds, .bed-range, [data-tid="property-beds"]').first().text().trim();
      const listingUrl = $el.find('a.property-link, a[data-tid="property-link"]').first().attr('href') || '';

      if (!propertyName && !address) return;

      const rentRange = parseRentRange(rentText);
      if (!rentRange) return;

      // Parse bed range - may have multiple unit types like "1-4 Beds"
      const bedRangeMatch = bedText.match(/(\d+)\s*-\s*(\d+)\s*(?:bed|br|bd)/i);
      const studioAndBeds = /studio/i.test(bedText);

      if (bedRangeMatch) {
        const minBeds = parseInt(bedRangeMatch[1]);
        const maxBeds = parseInt(bedRangeMatch[2]);
        // Create a comp entry for the property using average rent
        const avgRent = (rentRange.min + rentRange.max) / 2;
        const midBeds = Math.ceil((minBeds + maxBeds) / 2);
        const beds = midBeds || 1;
        comps.push({
          source: 'apartments.com',
          propertyName,
          address,
          unitType: normalizeUnitType(beds),
          beds,
          rent: avgRent,
          rentPerBed: avgRent / Math.max(beds, 1),
          listingUrl: listingUrl || undefined,
        });
      } else {
        const beds = parseBeds(bedText);
        if (beds !== null) {
          const avgRent = (rentRange.min + rentRange.max) / 2;
          const effectiveBeds = Math.max(beds, 1);
          comps.push({
            source: 'apartments.com',
            propertyName,
            address,
            unitType: normalizeUnitType(beds),
            beds,
            rent: avgRent,
            rentPerBed: avgRent / effectiveBeds,
            listingUrl: listingUrl || undefined,
          });
        } else if (studioAndBeds) {
          // Studio listing
          const avgRent = (rentRange.min + rentRange.max) / 2;
          comps.push({
            source: 'apartments.com',
            propertyName,
            address,
            unitType: 'studio',
            beds: 0,
            rent: avgRent,
            rentPerBed: avgRent,
            listingUrl: listingUrl || undefined,
          });
        }
      }
    } catch {
      // Skip unparseable listings
    }
  });

  // Also try parsing from JSON-LD structured data (more reliable when present)
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || '');
      const items = Array.isArray(json) ? json : json['@graph'] || [json];
      for (const item of items) {
        if (item['@type'] === 'ApartmentComplex' || item['@type'] === 'Apartment') {
          const name = item.name || '';
          const addr = item.address?.streetAddress || '';
          // JSON-LD may have containsPlace with floor plans
          if (item.containsPlace && Array.isArray(item.containsPlace)) {
            for (const unit of item.containsPlace) {
              const beds = unit.numberOfRooms || unit.numberOfBedrooms || 1;
              const floorSize = unit.floorSize?.value;
              const offers = unit.offers || {};
              const price = offers.price || offers.lowPrice;
              if (price) {
                const rent = parseFloat(price);
                const effectiveBeds = Math.max(beds, 1);
                // Check if we already have this property from HTML parsing
                const exists = comps.some(c => c.propertyName === name && c.beds === beds);
                if (!exists) {
                  comps.push({
                    source: 'apartments.com',
                    propertyName: name,
                    address: addr,
                    unitType: normalizeUnitType(beds),
                    beds,
                    sqft: floorSize ? parseInt(floorSize) : undefined,
                    rent,
                    rentPerBed: rent / effectiveBeds,
                    rentPerSqft: floorSize ? rent / parseInt(floorSize) : undefined,
                    lat: item.geo?.latitude,
                    lng: item.geo?.longitude,
                  });
                }
              }
            }
          }
        }
      }
    } catch {
      // JSON-LD parse error, skip
    }
  });

  return comps;
}

export const apartmentsScraper: RentScraper = {
  source: 'apartments.com',

  async scrape(params: ScraperSearchParams): Promise<ScraperResult> {
    const allComps: ScrapedComp[] = [];
    const maxPages = 3;
    const maxResults = params.maxResults || 50;

    try {
      for (let page = 1; page <= maxPages; page++) {
        const url = buildSearchUrl(params, page);
        console.log(`[apartments.com] Fetching page ${page}: ${url}`);

        const html = await fetchPage(url);
        const comps = parseSearchResults(html);

        if (comps.length === 0) break; // No more results
        allComps.push(...comps);

        if (allComps.length >= maxResults) break;

        // Rate limiting - wait between pages
        if (page < maxPages) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }

      // Also try the non-student-housing URL if we got few results
      if (allComps.length < 5) {
        const altCity = params.city.toLowerCase().replace(/\s+/g, '-');
        const altState = params.state.toLowerCase().replace(/\s+/g, '-');
        const altUrl = `https://www.apartments.com/${altCity}-${altState}/`;
        console.log(`[apartments.com] Trying general search: ${altUrl}`);

        try {
          const html = await fetchPage(altUrl);
          const comps = parseSearchResults(html);
          // Deduplicate by property name
          for (const comp of comps) {
            const exists = allComps.some(c => c.propertyName === comp.propertyName && c.beds === comp.beds);
            if (!exists) allComps.push(comp);
          }
        } catch {
          // Alt search failed, that's ok
        }
      }

      return {
        source: 'apartments.com',
        comps: allComps.slice(0, maxResults),
        scrapedAt: new Date().toISOString(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[apartments.com] Scraper error: ${message}`);
      return {
        source: 'apartments.com',
        comps: allComps,
        error: message,
        scrapedAt: new Date().toISOString(),
      };
    }
  },
};
