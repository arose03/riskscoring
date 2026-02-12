'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  PropertyInfo,
  University,
  FactorScore,
  ScoreValue,
  SourceType,
} from '@/lib/types';
import {
  PROPERTY_FACTORS,
  GL_FACTORS,
  computeScore,
  universityTierToScore,
} from '@/lib/scoring';
import PropertyInfoPanel from './PropertyInfoPanel';
import ScoringGrid from './ScoringGrid';
import ResultsPanel from './ResultsPanel';

type TabType = 'property' | 'gl';

const initialPropertyInfo: PropertyInfo = {
  address: '',
  formattedAddress: '',
  lat: null,
  lng: null,
  universityId: null,
  universityName: '',
  tiv: '',
  units: '',
  yearBuilt: '',
  stories: '',
  construction: '',
  sprinkler: '',
  occupancy: '',
  sponsorTier: '',
  dscr: '',
  actualRent: '',
};

export default function RiskScorer() {
  const [activeTab, setActiveTab] = useState<TabType>('property');
  const [propertyInfo, setPropertyInfo] = useState<PropertyInfo>(initialPropertyInfo);
  const [universities, setUniversities] = useState<University[]>([]);
  const [selectedUniversity, setSelectedUniversity] = useState<University | null>(null);

  // Scores for property and GL
  const [propertyScores, setPropertyScores] = useState<Record<string, FactorScore>>({});
  const [glScores, setGlScores] = useState<Record<string, FactorScore>>({});

  // Loading states
  const [loadingGeocode, setLoadingGeocode] = useState(false);
  const [geocodeError, setGeocodeError] = useState('');
  const [loadingCrime, setLoadingCrime] = useState(false);
  const [loadingRent, setLoadingRent] = useState(false);

  // Fetch universities on mount
  useEffect(() => {
    fetch('/api/universities')
      .then((res) => res.json())
      .then((data) => setUniversities(data))
      .catch(console.error);
  }, []);

  // Auto-score university tier when university is selected
  const applyUniversityTierScore = useCallback(
    (university: University) => {
      const score = universityTierToScore(university.tier, university.party_score);

      const newPropertyScores = { ...propertyScores };
      newPropertyScores['university_tier'] = {
        factorKey: 'university_tier',
        score,
        source: 'AUTO' as SourceType,
      };
      setPropertyScores(newPropertyScores);

      const newGlScores = { ...glScores };
      newGlScores['gl_university_tier'] = {
        factorKey: 'gl_university_tier',
        score,
        source: 'AUTO' as SourceType,
      };
      setGlScores(newGlScores);
    },
    [propertyScores, glScores]
  );

  // Handle university selection
  const handleUniversitySelect = useCallback(
    (university: University) => {
      setSelectedUniversity(university);
      setPropertyInfo((prev) => ({
        ...prev,
        universityId: university.id,
        universityName: university.name,
      }));
      applyUniversityTierScore(university);

      // If we have property coordinates, auto-calculate distance
      if (propertyInfo.lat && propertyInfo.lng) {
        fetchDistance(propertyInfo.lat, propertyInfo.lng, university.id);
      }
    },
    [propertyInfo.lat, propertyInfo.lng, applyUniversityTierScore]
  );

  // Fetch distance and auto-score
  const fetchDistance = async (
    propertyLat: number,
    propertyLng: number,
    universityId: number
  ) => {
    try {
      const res = await fetch('/api/distance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyLat, propertyLng, universityId }),
      });
      const data = await res.json();

      if (data.auto_score) {
        setPropertyScores((prev) => ({
          ...prev,
          distance: {
            factorKey: 'distance',
            score: data.auto_score as ScoreValue,
            source: 'AUTO',
            aiReasoning: `Distance: ${data.miles} miles from ${data.university_name || 'campus'}`,
          },
        }));
        setGlScores((prev) => ({
          ...prev,
          gl_distance: {
            factorKey: 'gl_distance',
            score: data.auto_score as ScoreValue,
            source: 'AUTO',
            aiReasoning: `Distance: ${data.miles} miles from ${data.university_name || 'campus'}`,
          },
        }));
      }
    } catch (err) {
      console.error('Distance calc failed:', err);
    }
  };

  // Fetch AI crime estimate
  const fetchCrimeEstimate = async () => {
    if (!propertyInfo.address) return;
    setLoadingCrime(true);
    try {
      const res = await fetch('/api/estimate/crime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: propertyInfo.formattedAddress || propertyInfo.address,
          universityName: propertyInfo.universityName,
        }),
      });
      const data = await res.json();

      const crimeScore: FactorScore = {
        factorKey: 'crime',
        score: data.score as ScoreValue,
        source: 'AI_EST',
        aiReasoning: data.reasoning,
        aiConfidence: data.confidence,
      };
      setPropertyScores((prev) => ({ ...prev, crime: crimeScore }));
      setGlScores((prev) => ({
        ...prev,
        gl_crime: { ...crimeScore, factorKey: 'gl_crime' },
      }));
    } catch (err) {
      console.error('Crime estimate failed:', err);
    } finally {
      setLoadingCrime(false);
    }
  };

  // Fetch AI rent estimate
  const fetchRentEstimate = async () => {
    if (!propertyInfo.address) return;
    setLoadingRent(true);
    try {
      const res = await fetch('/api/estimate/rent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: propertyInfo.formattedAddress || propertyInfo.address,
          universityName: propertyInfo.universityName,
          actualRent: propertyInfo.actualRent || undefined,
        }),
      });
      const data = await res.json();

      const rentScore: FactorScore = {
        factorKey: 'rent_vs_market',
        score: data.score as ScoreValue,
        source: 'AI_EST',
        aiReasoning: `${data.reasoning}${data.estimated_market_rent ? ` Est. market rent: $${data.estimated_market_rent}/bed/mo.` : ''}`,
        aiConfidence: data.confidence,
      };
      setPropertyScores((prev) => ({ ...prev, rent_vs_market: rentScore }));
      setGlScores((prev) => ({
        ...prev,
        gl_rent_vs_market: { ...rentScore, factorKey: 'gl_rent_vs_market' },
      }));
    } catch (err) {
      console.error('Rent estimate failed:', err);
    } finally {
      setLoadingRent(false);
    }
  };

  // Load Google Maps JS API for client-side geocoding
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  const loadGoogleMaps = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (typeof google !== 'undefined' && google.maps) {
        resolve();
        return;
      }
      const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
      if (!key) {
        reject(new Error('NEXT_PUBLIC_GOOGLE_MAPS_KEY is not set'));
        return;
      }
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Maps'));
      document.head.appendChild(script);
    });
  };

  // Handle geocoding (client-side)
  const handleAddressGeocode = async (address: string) => {
    if (!address) return;
    setLoadingGeocode(true);
    setGeocodeError('');

    try {
      await loadGoogleMaps();

      if (!geocoderRef.current) {
        geocoderRef.current = new google.maps.Geocoder();
      }

      const result = await geocoderRef.current.geocode({ address });

      if (!result.results?.length) {
        setGeocodeError('No results found for this address');
        return;
      }

      const place = result.results[0];
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      const formattedAddress = place.formatted_address;

      setPropertyInfo((prev) => ({
        ...prev,
        lat,
        lng,
        formattedAddress: formattedAddress || address,
      }));

      // Auto-calculate distance if university is selected
      if (selectedUniversity) {
        fetchDistance(lat, lng, selectedUniversity.id);
      }

      // Trigger AI estimates
      setTimeout(() => {
        fetchCrimeEstimate();
        fetchRentEstimate();
      }, 100);
    } catch (err: unknown) {
      console.error('Geocode failed:', err);
      const message = err instanceof Error ? err.message : 'Geocoding failed';
      setGeocodeError(message);
    } finally {
      setLoadingGeocode(false);
    }
  };

  // Handle manual score change with override tracking
  const handlePropertyScoreChange = (factorKey: string, score: ScoreValue) => {
    setPropertyScores((prev) => {
      const existing = prev[factorKey];
      const factor = PROPERTY_FACTORS.find((f) => f.key === factorKey);
      const isAutoOrAI = factor?.autoType === 'AUTO' || factor?.autoType === 'AI_EST';
      const wasAutoScored = existing && (existing.source === 'AUTO' || existing.source === 'AI_EST');

      return {
        ...prev,
        [factorKey]: {
          factorKey,
          score,
          source: (isAutoOrAI && wasAutoScored ? 'OVERRIDE' : existing?.source || 'MANUAL') as SourceType,
          originalSource: wasAutoScored ? existing.source : undefined,
          aiReasoning: existing?.aiReasoning,
          aiConfidence: existing?.aiConfidence,
        },
      };
    });
  };

  const handleGlScoreChange = (factorKey: string, score: ScoreValue) => {
    setGlScores((prev) => {
      const existing = prev[factorKey];
      const factor = GL_FACTORS.find((f) => f.key === factorKey);
      const isAutoOrAI = factor?.autoType === 'AUTO' || factor?.autoType === 'AI_EST';
      const wasAutoScored = existing && (existing.source === 'AUTO' || existing.source === 'AI_EST');

      return {
        ...prev,
        [factorKey]: {
          factorKey,
          score,
          source: (isAutoOrAI && wasAutoScored ? 'OVERRIDE' : existing?.source || 'MANUAL') as SourceType,
          originalSource: wasAutoScored ? existing.source : undefined,
          aiReasoning: existing?.aiReasoning,
          aiConfidence: existing?.aiConfidence,
        },
      };
    });
  };

  // Compute results
  const propertyResult = computeScore(PROPERTY_FACTORS, propertyScores);
  const glResult = computeScore(GL_FACTORS, glScores);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-200 rounded-lg p-1 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('property')}
          className={`px-5 py-2 text-sm font-medium rounded-md transition-all ${
            activeTab === 'property'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Property Scoring
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('gl')}
          className={`px-5 py-2 text-sm font-medium rounded-md transition-all ${
            activeTab === 'gl'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          GL Scoring
        </button>
      </div>

      {/* Property Info (shared between tabs) */}
      <div className="mb-6">
        <PropertyInfoPanel
          propertyInfo={propertyInfo}
          onChange={setPropertyInfo}
          universities={universities}
          onUniversitySelect={handleUniversitySelect}
          onAddressGeocode={handleAddressGeocode}
          loadingGeocode={loadingGeocode}
          geocodeError={geocodeError}
        />
      </div>

      {/* AI Estimate Buttons */}
      {propertyInfo.address && (
        <div className="flex gap-3 mb-6">
          <button
            type="button"
            onClick={fetchCrimeEstimate}
            disabled={loadingCrime}
            className="px-4 py-2 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-300 rounded-lg hover:bg-amber-100 disabled:opacity-50 transition-colors"
          >
            {loadingCrime ? 'Estimating...' : 'Estimate Crime Score (AI)'}
          </button>
          <button
            type="button"
            onClick={fetchRentEstimate}
            disabled={loadingRent}
            className="px-4 py-2 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-300 rounded-lg hover:bg-amber-100 disabled:opacity-50 transition-colors"
          >
            {loadingRent ? 'Estimating...' : 'Estimate Rent vs. Market (AI)'}
          </button>
        </div>
      )}

      {/* Scoring Grid */}
      <div className="mb-6">
        {activeTab === 'property' ? (
          <ScoringGrid
            factors={PROPERTY_FACTORS}
            scores={propertyScores}
            onScoreChange={handlePropertyScoreChange}
          />
        ) : (
          <ScoringGrid
            factors={GL_FACTORS}
            scores={glScores}
            onScoreChange={handleGlScoreChange}
          />
        )}
      </div>

      {/* Results Panel (sticky) */}
      <div className="sticky bottom-0 pb-4 z-30">
        {activeTab === 'property' ? (
          <ResultsPanel result={propertyResult} label="Property Risk Assessment" />
        ) : (
          <ResultsPanel result={glResult} label="General Liability Risk Assessment" />
        )}
      </div>
    </div>
  );
}
