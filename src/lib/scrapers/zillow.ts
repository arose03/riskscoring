// ============================================================
// Zillow Scraper – Search results via HTML parsing
// ============================================================

import * as cheerio from 'cheerio';
import { RentScraper, ScraperSearchParams, ScraperResult, ScrapedComp, UnitType } from './types';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function normalizeUnitType(beds: number): UnitType {
  if (beds === 0) return 'studio';
  if (beds === 1) return '1br';
  if (beds === 2) return '2br';
  if (beds === 3) return '3br';
  if (beds === 4) return '4br';
  return '5br+';
}

function buildSearchUrl(params: ScraperSearchParams): string {
  const city = (params.city || '').toLowerCase().replace(/\s+/g, '-');
  const state = (params.state || '').toLowerCase().replace(/\s+/g, '-');
  return `https://www.zillow.com/${city}-${state}/rentals/`;
}

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
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

  // Zillow embeds search results data in a __NEXT_DATA__ script tag or similar JSON
  // Try to extract from preloaded data first
  $('script#__NEXT_DATA__, script[data-zrr-shared-data-key]').each((_, el) => {
    try {
      let dataStr = $(el).html() || '';
      // Some Zillow pages wrap data in <!--...-->
      dataStr = dataStr.replace(/^<!--/, '').replace(/-->$/, '');
      const data = JSON.parse(dataStr);

      // Navigate to search results in the JSON structure
      const results =
        data?.props?.pageProps?.searchPageState?.cat1?.searchResults?.listResults ||
        data?.cat1?.searchResults?.listResults ||
        [];

      for (const listing of results) {
        try {
          const propertyName = listing.buildingName || listing.address || '';
          const address = listing.address || '';
          const lat = listing.latLong?.latitude;
          const lng = listing.latLong?.longitude;
          const detailUrl = listing.detailUrl || '';
          const price = listing.price ? parseInt(String(listing.price).replace(/[^0-9]/g, '')) : null;
          const beds = listing.beds ?? null;
          const baths = listing.baths ?? null;
          const sqft = listing.area ? parseInt(String(listing.area).replace(/[^0-9]/g, '')) : null;

          if (price && beds !== null) {
            const effectiveBeds = Math.max(beds, 1);
            comps.push({
              source: 'zillow',
              propertyName,
              address,
              lat,
              lng,
              unitType: normalizeUnitType(beds),
              beds,
              baths,
              sqft: sqft || undefined,
              rent: price,
              rentPerBed: price / effectiveBeds,
              rentPerSqft: sqft ? price / sqft : undefined,
              listingUrl: detailUrl.startsWith('http') ? detailUrl : `https://www.zillow.com${detailUrl}`,
            });
          }

          // Some buildings have multiple units listed
          if (listing.units && Array.isArray(listing.units)) {
            for (const unit of listing.units) {
              const unitPrice = unit.price ? parseInt(String(unit.price).replace(/[^0-9]/g, '')) : null;
              const unitBeds = unit.beds ?? beds;
              if (unitPrice && unitBeds !== null) {
                const effectiveBeds = Math.max(unitBeds, 1);
                comps.push({
                  source: 'zillow',
                  propertyName,
                  address,
                  lat,
                  lng,
                  unitType: normalizeUnitType(unitBeds),
                  beds: unitBeds,
                  baths: unit.baths ?? baths,
                  sqft: unit.sqft || sqft || undefined,
                  rent: unitPrice,
                  rentPerBed: unitPrice / effectiveBeds,
                  listingUrl: detailUrl.startsWith('http') ? detailUrl : `https://www.zillow.com${detailUrl}`,
                });
              }
            }
          }
        } catch {
          // Skip unparseable listing
        }
      }
    } catch {
      // JSON parse error
    }
  });

  // Fallback: parse HTML listing cards if no JSON data found
  if (comps.length === 0) {
    $('article[data-test="property-card"], li[class*="ListItem"]').each((_, el) => {
      try {
        const $el = $(el);
        const propertyName = $el.find('[data-test="property-card-addr"]').text().trim() ||
                             $el.find('address').text().trim();
        const address = propertyName;
        const priceText = $el.find('[data-test="property-card-price"]').text().trim() ||
                          $el.find('[class*="Price"]').first().text().trim();
        const detailsText = $el.find('[data-test="property-card-details"]').text().trim() ||
                            $el.find('[class*="Details"]').first().text().trim();
        const href = $el.find('a').first().attr('href') || '';

        const priceMatch = priceText.replace(/,/g, '').match(/\$(\d+)/);
        if (!priceMatch) return;
        const rent = parseInt(priceMatch[1]);

        const bedMatch = detailsText.match(/(\d+)\s*(?:bd|bed|br)/i);
        const studioMatch = /studio/i.test(detailsText);
        const beds = bedMatch ? parseInt(bedMatch[1]) : studioMatch ? 0 : null;
        if (beds === null) return;

        const bathMatch = detailsText.match(/([\d.]+)\s*(?:ba|bath)/i);
        const baths = bathMatch ? parseFloat(bathMatch[1]) : undefined;

        const sqftMatch = detailsText.replace(/,/g, '').match(/(\d+)\s*(?:sq\s*ft|sqft)/i);
        const sqft = sqftMatch ? parseInt(sqftMatch[1]) : undefined;

        const effectiveBeds = Math.max(beds, 1);
        comps.push({
          source: 'zillow',
          propertyName,
          address,
          unitType: normalizeUnitType(beds),
          beds,
          baths,
          sqft,
          rent,
          rentPerBed: rent / effectiveBeds,
          rentPerSqft: sqft ? rent / sqft : undefined,
          listingUrl: href.startsWith('http') ? href : `https://www.zillow.com${href}`,
        });
      } catch {
        // Skip unparseable card
      }
    });
  }

  return comps;
}

export const zillowScraper: RentScraper = {
  source: 'zillow',

  async scrape(params: ScraperSearchParams): Promise<ScraperResult> {
    const maxResults = params.maxResults || 40;

    try {
      const url = buildSearchUrl(params);
      console.log(`[zillow] Fetching: ${url}`);

      const html = await fetchPage(url);
      const comps = parseSearchResults(html);

      return {
        source: 'zillow',
        comps: comps.slice(0, maxResults),
        scrapedAt: new Date().toISOString(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[zillow] Scraper error: ${message}`);
      return {
        source: 'zillow',
        comps: [],
        error: message,
        scrapedAt: new Date().toISOString(),
      };
    }
  },
};
