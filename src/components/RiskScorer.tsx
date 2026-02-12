'use client';

import { useState, useEffect, useCallback } from 'react';
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
  constructionToScore,
  yearBuiltToScore,
  storiesToScore,
  sprinklerToScore,
  occupancyToScore,
  sponsorTierToScore,
  dscrToScore,
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
  const [universityError, setUniversityError] = useState('');

  // Fetch universities on mount
  useEffect(() => {
    fetch('/api/universities')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setUniversities(data))
      .catch((err) => {
        console.error('Failed to load universities:', err);
        setUniversityError('Failed to load university list. Check database.');
      });
  }, []);

  // ─── Auto-score from property info fields ───────────────────────
  useEffect(() => {
    const mappings: Array<{
      propKey: string;
      glKey?: string;
      score: ScoreValue | null;
      reasoning?: string;
    }> = [
      {
        propKey: 'construction',
        score: constructionToScore(propertyInfo.construction, propertyInfo.yearBuilt),
        reasoning: propertyInfo.construction
          ? `Auto-scored from construction type: ${propertyInfo.construction}`
          : undefined,
      },
      {
        propKey: 'building_age',
        score: yearBuiltToScore(propertyInfo.yearBuilt),
        reasoning: propertyInfo.yearBuilt
          ? `Auto-scored from year built: ${propertyInfo.yearBuilt} (${new Date().getFullYear() - parseInt(propertyInfo.yearBuilt)} yrs old)`
          : undefined,
      },
      {
        propKey: 'height',
        score: storiesToScore(propertyInfo.stories),
        reasoning: propertyInfo.stories
          ? `Auto-scored from stories: ${propertyInfo.stories}`
          : undefined,
      },
      {
        propKey: 'sprinkler',
        score: sprinklerToScore(propertyInfo.sprinkler),
        reasoning: propertyInfo.sprinkler
          ? `Auto-scored from sprinkler: ${propertyInfo.sprinkler === 'Y' ? 'Yes' : 'No'}`
          : undefined,
      },
      {
        propKey: 'occupancy',
        glKey: 'gl_occupancy',
        score: occupancyToScore(propertyInfo.occupancy),
        reasoning: propertyInfo.occupancy
          ? `Auto-scored from occupancy type: ${propertyInfo.occupancy}`
          : undefined,
      },
      {
        propKey: 'sponsor',
        glKey: 'gl_sponsor',
        score: sponsorTierToScore(propertyInfo.sponsorTier),
        reasoning: propertyInfo.sponsorTier
          ? `Auto-scored from sponsor tier: ${propertyInfo.sponsorTier}`
          : undefined,
      },
      {
        propKey: 'dscr',
        score: dscrToScore(propertyInfo.dscr),
        reasoning: propertyInfo.dscr
          ? `Auto-scored from DSCR: ${propertyInfo.dscr}x`
          : undefined,
      },
    ];

    setPropertyScores((prev) => {
      const next = { ...prev };
      for (const { propKey, score, reasoning } of mappings) {
        const existing = prev[propKey];
        if (score !== null && (!existing || existing.source === 'AUTO')) {
          next[propKey] = {
            factorKey: propKey,
            score,
            source: 'AUTO',
            aiReasoning: reasoning,
          };
        } else if (score === null && existing?.source === 'AUTO') {
          // Field was cleared — remove the auto score
          delete next[propKey];
        }
      }
      return next;
    });

    setGlScores((prev) => {
      const next = { ...prev };
      for (const { glKey, score, reasoning } of mappings) {
        if (!glKey) continue;
        const existing = prev[glKey];
        if (score !== null && (!existing || existing.source === 'AUTO')) {
          next[glKey] = {
            factorKey: glKey,
            score,
            source: 'AUTO',
            aiReasoning: reasoning,
          };
        } else if (score === null && existing?.source === 'AUTO') {
          delete next[glKey];
        }
      }
      return next;
    });
  }, [
    propertyInfo.construction,
    propertyInfo.yearBuilt,
    propertyInfo.stories,
    propertyInfo.sprinkler,
    propertyInfo.occupancy,
    propertyInfo.sponsorTier,
    propertyInfo.dscr,
  ]);

  // ─── University tier scoring (functional updaters — no stale closure) ──
  const applyUniversityTierScore = useCallback((university: University) => {
    const score = universityTierToScore(university.tier, university.party_score);

    setPropertyScores((prev) => ({
      ...prev,
      university_tier: {
        factorKey: 'university_tier',
        score,
        source: 'AUTO' as SourceType,
      },
    }));

    setGlScores((prev) => ({
      ...prev,
      gl_university_tier: {
        factorKey: 'gl_university_tier',
        score,
        source: 'AUTO' as SourceType,
      },
    }));
  }, []);

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
      if (!res.ok) return;
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

  // ─── AI estimates — accept explicit params to avoid stale closures ───
  const fetchCrimeEstimate = async (address: string, universityName: string) => {
    if (!address) return;
    setLoadingCrime(true);
    try {
      const res = await fetch('/api/estimate/crime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, universityName }),
      });
      if (!res.ok) {
        console.error('Crime estimate API error:', res.status);
        return;
      }
      const data = await res.json();
      if (!data.score) return;

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

  const fetchRentEstimate = async (
    address: string,
    universityName: string,
    actualRent?: string
  ) => {
    if (!address) return;
    setLoadingRent(true);
    try {
      const res = await fetch('/api/estimate/rent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          universityName,
          actualRent: actualRent || undefined,
        }),
      });
      if (!res.ok) {
        console.error('Rent estimate API error:', res.status);
        return;
      }
      const data = await res.json();
      if (!data.score) return;

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

  const handleAddressGeocode = async (address: string) => {
    if (!address) return;
    setLoadingGeocode(true);
    setGeocodeError('');

    try {
      const res = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Geocoding failed');
      }

      const { lat, lng, formatted_address: formattedAddress } = data;

      setPropertyInfo((prev) => ({
        ...prev,
        lat,
        lng,
        formattedAddress: formattedAddress || address,
      }));

      // Track the resolved address & university name for AI estimates
      const resolvedAddress = formattedAddress || address;
      let resolvedUniName = '';

      // Auto-detect nearest university and calculate distance
      try {
        const nearestRes = await fetch('/api/nearest-university', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ propertyLat: lat, propertyLng: lng }),
        });

        if (!nearestRes.ok) throw new Error(`HTTP ${nearestRes.status}`);
        const nearestData = await nearestRes.json();

        if (nearestData.university) {
          const uni = nearestData.university as University;
          resolvedUniName = uni.name;

          // Auto-select the nearest university
          setSelectedUniversity(uni);
          setPropertyInfo((prev) => ({
            ...prev,
            universityId: uni.id,
            universityName: uni.name,
          }));

          // Auto-score university tier
          const tierScore = universityTierToScore(uni.tier, uni.party_score);
          setPropertyScores((prev) => ({
            ...prev,
            university_tier: {
              factorKey: 'university_tier',
              score: tierScore,
              source: 'AUTO' as SourceType,
            },
          }));
          setGlScores((prev) => ({
            ...prev,
            gl_university_tier: {
              factorKey: 'gl_university_tier',
              score: tierScore,
              source: 'AUTO' as SourceType,
            },
          }));

          // Auto-score distance
          if (nearestData.auto_score) {
            setPropertyScores((prev) => ({
              ...prev,
              distance: {
                factorKey: 'distance',
                score: nearestData.auto_score as ScoreValue,
                source: 'AUTO',
                aiReasoning: `Distance: ${nearestData.miles} miles from ${uni.name}`,
              },
            }));
            setGlScores((prev) => ({
              ...prev,
              gl_distance: {
                factorKey: 'gl_distance',
                score: nearestData.auto_score as ScoreValue,
                source: 'AUTO',
                aiReasoning: `Distance: ${nearestData.miles} miles from ${uni.name}`,
              },
            }));
          }
        }
      } catch (nearestErr) {
        console.error('Nearest university lookup failed:', nearestErr);
        if (selectedUniversity) {
          resolvedUniName = selectedUniversity.name;
          fetchDistance(lat, lng, selectedUniversity.id);
        }
      }

      // Trigger AI estimates with resolved values — no stale closures
      fetchCrimeEstimate(resolvedAddress, resolvedUniName);
      fetchRentEstimate(resolvedAddress, resolvedUniName);
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
      const wasAutoScored = existing && (existing.source === 'AUTO' || existing.source === 'AI_EST');

      return {
        ...prev,
        [factorKey]: {
          factorKey,
          score,
          source: (wasAutoScored ? 'OVERRIDE' : 'MANUAL') as SourceType,
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
      const wasAutoScored = existing && (existing.source === 'AUTO' || existing.source === 'AI_EST');

      return {
        ...prev,
        [factorKey]: {
          factorKey,
          score,
          source: (wasAutoScored ? 'OVERRIDE' : 'MANUAL') as SourceType,
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

      {/* University error banner */}
      {universityError && (
        <div className="mb-4 px-4 py-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
          {universityError}
        </div>
      )}

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
            onClick={() =>
              fetchCrimeEstimate(
                propertyInfo.formattedAddress || propertyInfo.address,
                propertyInfo.universityName
              )
            }
            disabled={loadingCrime}
            className="px-4 py-2 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-300 rounded-lg hover:bg-amber-100 disabled:opacity-50 transition-colors"
          >
            {loadingCrime ? 'Estimating...' : 'Estimate Crime Score (AI)'}
          </button>
          <button
            type="button"
            onClick={() =>
              fetchRentEstimate(
                propertyInfo.formattedAddress || propertyInfo.address,
                propertyInfo.universityName,
                propertyInfo.actualRent
              )
            }
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
