// ============================================================
// Rent Comp Scraper – Shared Types
// ============================================================

export type ScraperSource = 'apartments.com' | 'zillow' | 'rentcafe' | 'rentcast' | 'manual';

export type UnitType = 'studio' | '1br' | '2br' | '3br' | '4br' | '5br+';

export type StudyStatus = 'pending' | 'scraping' | 'complete' | 'error';

export interface ScrapedComp {
  source: ScraperSource;
  propertyName: string;
  address: string;
  lat?: number;
  lng?: number;
  totalUnits?: number;
  yearBuilt?: number;
  unitType: UnitType;
  beds: number;
  baths?: number;
  sqft?: number;
  rent: number;           // monthly rent for the unit
  rentPerBed: number;     // rent / beds (key metric for student housing)
  rentPerSqft?: number;
  furnished?: boolean;
  hasPool?: boolean;
  hasGym?: boolean;
  hasParking?: boolean;
  petFriendly?: boolean;
  listingUrl?: string;
  rawData?: Record<string, unknown>;
}

export interface ScraperSearchParams {
  city: string;
  state: string;
  lat?: number;
  lng?: number;
  radiusMiles?: number;
  universityName?: string;
  maxResults?: number;
}

export interface ScraperResult {
  source: ScraperSource;
  comps: ScrapedComp[];
  error?: string;
  scrapedAt: string;
}

export interface RentStudySummary {
  totalComps: number;
  totalProperties: number;
  avgRentPerBed: number;
  medianRentPerBed: number;
  minRentPerBed: number;
  maxRentPerBed: number;
  avgRent: number;
  medianRent: number;
  byUnitType: Record<UnitType, {
    count: number;
    avgRent: number;
    avgRentPerBed: number;
    minRentPerBed: number;
    maxRentPerBed: number;
  }>;
  bySource: Record<string, number>;
}

export interface RentStudy {
  id: number;
  createdAt: string;
  marketName: string;
  centerLat: number | null;
  centerLng: number | null;
  radiusMiles: number;
  universityId: number | null;
  universityName: string | null;
  status: StudyStatus;
  summary: RentStudySummary | null;
  comps: RentComp[];
}

export interface RentComp {
  id: number;
  rentStudyId: number;
  source: ScraperSource;
  propertyName: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  distanceFromCampus: number | null;
  totalUnits: number | null;
  yearBuilt: number | null;
  unitType: UnitType | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  rent: number | null;
  rentPerBed: number | null;
  rentPerSqft: number | null;
  furnished: boolean;
  hasPool: boolean;
  hasGym: boolean;
  hasParking: boolean;
  petFriendly: boolean;
  listingUrl: string | null;
  scrapedAt: string;
}

// Scraper interface that each source implements
export interface RentScraper {
  source: ScraperSource;
  scrape(params: ScraperSearchParams): Promise<ScraperResult>;
}
