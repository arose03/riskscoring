'use client';

import { useState, useEffect, useCallback } from 'react';

// ============================================================
// Types
// ============================================================

interface RentComp {
  id: number;
  source: string;
  propertyName: string;
  address: string | null;
  distanceFromCampus: number | null;
  unitType: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  rent: number | null;
  rentPerBed: number | null;
  rentPerSqft: number | null;
  furnished: boolean;
  hasPool: boolean;
  hasGym: boolean;
  listingUrl: string | null;
  googleRating: number | null;
  googleReviewCount: number | null;
  propertyWebsite: string | null;
}

interface RentStudySummary {
  totalComps: number;
  totalProperties: number;
  avgRentPerBed: number;
  medianRentPerBed: number;
  minRentPerBed: number;
  maxRentPerBed: number;
  avgRent: number;
  medianRent: number;
  byUnitType: Record<string, {
    count: number;
    avgRent: number;
    avgRentPerBed: number;
    minRentPerBed: number;
    maxRentPerBed: number;
  }>;
  bySource: Record<string, number>;
  errors?: string[];
}

interface RentStudy {
  id: number;
  createdAt: string;
  marketName: string;
  universityName: string | null;
  status: string;
  summary: RentStudySummary | null;
  comps?: RentComp[];
}

interface University {
  id: number;
  name: string;
  campus_lat: number | null;
  campus_lng: number | null;
}

type SortKey = 'propertyName' | 'rent' | 'rentPerBed' | 'beds' | 'source' | 'sqft' | 'googleRating';

// ============================================================
// Main Component
// ============================================================

export default function RentStudyPage() {
  // Search form state
  const [address, setAddress] = useState('');
  const [radiusMiles, setRadiusMiles] = useState(1);
  const [universitySearch, setUniversitySearch] = useState('');
  const [selectedUniversity, setSelectedUniversity] = useState<University | null>(null);
  const [universityResults, setUniversityResults] = useState<University[]>([]);
  const [showUniDropdown, setShowUniDropdown] = useState(false);

  // Study state
  const [studies, setStudies] = useState<RentStudy[]>([]);
  const [activeStudy, setActiveStudy] = useState<RentStudy | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Table state
  const [sortKey, setSortKey] = useState<SortKey>('rentPerBed');
  const [sortAsc, setSortAsc] = useState(true);
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterUnitType, setFilterUnitType] = useState<string>('all');

  // Load existing studies on mount
  useEffect(() => {
    fetchStudies();
  }, []);

  const fetchStudies = async () => {
    try {
      const res = await fetch('/api/rent-study');
      const data = await res.json();
      setStudies(data.studies || []);
    } catch {
      // Silent fail on load
    }
  };

  // University search
  const searchUniversities = useCallback(async (query: string) => {
    if (query.length < 2) {
      setUniversityResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/universities?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setUniversityResults(data.universities || []);
      setShowUniDropdown(true);
    } catch {
      setUniversityResults([]);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchUniversities(universitySearch), 300);
    return () => clearTimeout(timer);
  }, [universitySearch, searchUniversities]);

  // Run new rent study
  const runStudy = async () => {
    if (!address.trim()) {
      setError('Please enter an address');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/rent-study', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: address.trim(),
          radiusMiles,
          universityId: selectedUniversity?.id,
          universityName: selectedUniversity?.name,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to run study');
        return;
      }

      setActiveStudy(data.study);
      await fetchStudies();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run study');
    } finally {
      setLoading(false);
    }
  };

  // Retry a failed study by re-running with the same parameters
  const retryStudy = async (study: RentStudy) => {
    setLoading(true);
    setError(null);

    try {
      // Delete the old failed study
      await fetch(`/api/rent-study/${study.id}`, { method: 'DELETE' });

      // Re-run with the same address
      const res = await fetch('/api/rent-study', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: study.marketName,
          radiusMiles,
          universityName: study.universityName,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to retry study');
        return;
      }

      setActiveStudy(data.study);
      await fetchStudies();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry study');
    } finally {
      setLoading(false);
    }
  };

  // Load a specific study
  const loadStudy = async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/rent-study/${id}`);
      const data = await res.json();
      setActiveStudy(data.study);
    } catch {
      setError('Failed to load study');
    } finally {
      setLoading(false);
    }
  };

  // Delete a study
  const deleteStudy = async (id: number) => {
    try {
      await fetch(`/api/rent-study/${id}`, { method: 'DELETE' });
      if (activeStudy?.id === id) setActiveStudy(null);
      await fetchStudies();
    } catch {
      setError('Failed to delete study');
    }
  };

  // Sort and filter comps
  const getFilteredComps = (): RentComp[] => {
    if (!activeStudy?.comps) return [];
    let comps = [...activeStudy.comps];

    if (filterSource !== 'all') {
      comps = comps.filter(c => c.source === filterSource);
    }
    if (filterUnitType !== 'all') {
      comps = comps.filter(c => c.unitType === filterUnitType);
    }

    comps.sort((a, b) => {
      const aVal = a[sortKey] ?? 0;
      const bVal = b[sortKey] ?? 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortAsc ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
    });

    return comps;
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === 'propertyName' || key === 'source');
    }
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return ' \u2195';
    return sortAsc ? ' \u2191' : ' \u2193';
  };

  const fmt = (n: number | null) => n != null ? `$${Math.round(n).toLocaleString()}` : '—';

  const filteredComps = getFilteredComps();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Rent Comp Study</h1>
            <p className="text-sm text-slate-500 mt-1">
              Scrape rental listings to build market comp sets — per-bed pricing for student housing
            </p>
          </div>
          <a href="/" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
            &larr; Risk Scorer
          </a>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left sidebar - Search + History */}
          <div className="lg:col-span-1 space-y-4">
            {/* Search Form */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h2 className="font-semibold text-slate-900 mb-3">New Rent Study</h2>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="e.g. 123 Main St, Athens, GA"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Search Radius</label>
                  <select
                    value={radiusMiles}
                    onChange={e => setRadiusMiles(parseFloat(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value={0.25}>0.25 miles</option>
                    <option value={0.5}>0.5 miles</option>
                    <option value={0.75}>0.75 miles</option>
                    <option value={1}>1 mile</option>
                    <option value={2}>2 miles</option>
                    <option value={3}>3 miles</option>
                    <option value={5}>5 miles</option>
                  </select>
                </div>

                <div className="relative">
                  <label className="block text-xs font-medium text-slate-600 mb-1">University (optional)</label>
                  <input
                    type="text"
                    value={universitySearch}
                    onChange={e => {
                      setUniversitySearch(e.target.value);
                      setSelectedUniversity(null);
                    }}
                    placeholder="Search university..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {showUniDropdown && universityResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {universityResults.map(u => (
                        <button
                          key={u.id}
                          onClick={() => {
                            setSelectedUniversity(u);
                            setUniversitySearch(u.name);
                            setShowUniDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-slate-100 last:border-0"
                        >
                          {u.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedUniversity && (
                    <div className="mt-1 text-xs text-green-600">
                      Selected: {selectedUniversity.name}
                    </div>
                  )}
                </div>

                <button
                  onClick={runStudy}
                  disabled={loading || !address.trim()}
                  className="w-full py-2 px-4 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Scraping...
                    </span>
                  ) : 'Run Rent Study'}
                </button>

                {error && (
                  <div className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</div>
                )}
              </div>
            </div>

            {/* Study History */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h2 className="font-semibold text-slate-900 mb-3">Recent Studies</h2>
              {studies.length === 0 ? (
                <p className="text-sm text-slate-400">No studies yet</p>
              ) : (
                <div className="space-y-2">
                  {studies.map(s => (
                    <div
                      key={s.id}
                      className={`p-2 rounded-md border cursor-pointer transition-colors ${
                        activeStudy?.id === s.id
                          ? 'border-blue-400 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                      onClick={() => loadStudy(s.id)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-800">{s.marketName}</span>
                        <button
                          onClick={e => { e.stopPropagation(); deleteStudy(s.id); }}
                          className="text-slate-400 hover:text-red-500 text-xs"
                          title="Delete"
                        >
                          &times;
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-block w-2 h-2 rounded-full ${
                          s.status === 'complete' ? 'bg-green-400' :
                          s.status === 'scraping' ? 'bg-yellow-400' :
                          s.status === 'error' ? 'bg-red-400' : 'bg-slate-300'
                        }`} />
                        <span className="text-xs text-slate-500">
                          {s.summary?.totalComps || 0} comps
                          {s.universityName && ` \u00B7 ${s.universityName}`}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {new Date(s.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Main content area */}
          <div className="lg:col-span-3">
            {!activeStudy ? (
              <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
                <div className="text-slate-400 text-lg mb-2">No study selected</div>
                <p className="text-sm text-slate-400">
                  Run a new rent study or select one from history to view comp data
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Summary Cards */}
                {activeStudy.summary && activeStudy.summary.totalComps > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <SummaryCard
                      label="Avg Rent/Bed"
                      value={fmt(activeStudy.summary.avgRentPerBed)}
                      sublabel="/bed/mo"
                      accent="blue"
                    />
                    <SummaryCard
                      label="Median Rent/Bed"
                      value={fmt(activeStudy.summary.medianRentPerBed)}
                      sublabel="/bed/mo"
                      accent="indigo"
                    />
                    <SummaryCard
                      label="Range"
                      value={`${fmt(activeStudy.summary.minRentPerBed)} – ${fmt(activeStudy.summary.maxRentPerBed)}`}
                      sublabel="/bed/mo"
                      accent="purple"
                    />
                    <SummaryCard
                      label="Total Comps"
                      value={String(activeStudy.summary.totalComps)}
                      sublabel={`${activeStudy.summary.totalProperties} properties`}
                      accent="emerald"
                    />
                  </div>
                )}

                {/* Unit Type Breakdown */}
                {activeStudy.summary && activeStudy.summary.totalComps > 0 && (
                  <div className="bg-white rounded-lg border border-slate-200 p-4">
                    <h3 className="font-semibold text-slate-900 mb-3">Rent by Unit Type (Per Bed)</h3>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                      {(['studio', '1br', '2br', '3br', '4br', '5br+'] as const).map(ut => {
                        const data = activeStudy.summary?.byUnitType?.[ut];
                        if (!data || data.count === 0) return (
                          <div key={ut} className="text-center p-2 bg-slate-50 rounded">
                            <div className="text-xs font-medium text-slate-400 uppercase">{ut}</div>
                            <div className="text-sm text-slate-300 mt-1">—</div>
                          </div>
                        );
                        return (
                          <div key={ut} className="text-center p-2 bg-blue-50 rounded">
                            <div className="text-xs font-medium text-blue-600 uppercase">{ut}</div>
                            <div className="text-lg font-bold text-slate-900 mt-1">{fmt(data.avgRentPerBed)}</div>
                            <div className="text-xs text-slate-500">{data.count} comps</div>
                            <div className="text-xs text-slate-400">
                              {fmt(data.minRentPerBed)}–{fmt(data.maxRentPerBed)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Scraper warnings (shown even on partial success) */}
                {activeStudy.status === 'complete' && activeStudy.summary?.errors && (activeStudy.summary.errors as string[]).length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-2">
                    <span className="text-amber-500 text-sm leading-none mt-0.5">!</span>
                    <div className="text-xs text-amber-700">
                      <span className="font-medium">Some scrapers had issues: </span>
                      {(activeStudy.summary.errors as string[]).join('; ')}
                    </div>
                  </div>
                )}

                {/* Source breakdown */}
                {activeStudy.summary?.bySource && Object.keys(activeStudy.summary.bySource).length > 0 && (
                  <div className="flex gap-2">
                    {Object.entries(activeStudy.summary.bySource).map(([src, count]) => (
                      <span key={src} className="inline-flex items-center px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-600">
                        {src}: {count}
                      </span>
                    ))}
                  </div>
                )}

                {/* Comp Table */}
                <div className="bg-white rounded-lg border border-slate-200">
                  <div className="p-4 border-b border-slate-200">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-slate-900">Comp Details</h3>
                      <div className="flex gap-2">
                        <select
                          value={filterSource}
                          onChange={e => setFilterSource(e.target.value)}
                          className="text-xs border border-slate-300 rounded px-2 py-1"
                        >
                          <option value="all">All Sources</option>
                          <option value="rentcast">RentCast</option>
                          <option value="manual">Manual</option>
                        </select>
                        <select
                          value={filterUnitType}
                          onChange={e => setFilterUnitType(e.target.value)}
                          className="text-xs border border-slate-300 rounded px-2 py-1"
                        >
                          <option value="all">All Types</option>
                          <option value="studio">Studio</option>
                          <option value="1br">1 BR</option>
                          <option value="2br">2 BR</option>
                          <option value="3br">3 BR</option>
                          <option value="4br">4 BR</option>
                          <option value="5br+">5+ BR</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {filteredComps.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-400">
                      {activeStudy.status === 'scraping' ? 'Scraping in progress...' :
                       activeStudy.status === 'error' ? (
                         <div className="max-w-md mx-auto">
                           <div className="bg-red-50 border border-red-200 rounded-lg p-5 text-left">
                             <div className="flex items-start gap-3">
                               <span className="text-red-500 text-lg leading-none mt-0.5">!</span>
                               <div>
                                 <h4 className="text-sm font-semibold text-red-800">Scraping Failed</h4>
                                 {activeStudy.summary?.errors ? (
                                   <ul className="mt-2 space-y-1">
                                     {(activeStudy.summary.errors as string[]).map((err, i) => (
                                       <li key={i} className="text-sm text-red-700 font-mono">{err}</li>
                                     ))}
                                   </ul>
                                 ) : (
                                   <p className="mt-1 text-sm text-red-700">An unknown error occurred.</p>
                                 )}
                                 {(activeStudy.summary?.errors as string[] | undefined)?.some(e => e.includes('API_KEY') || e.includes('not set')) && (
                                   <p className="mt-3 text-xs text-red-600">
                                     Add <code className="bg-red-100 px-1 rounded">RENTCAST_API_KEY</code> to your <code className="bg-red-100 px-1 rounded">.env</code> file. Get a key at{' '}
                                     <a href="https://developers.rentcast.io" target="_blank" rel="noopener noreferrer" className="underline hover:text-red-800">developers.rentcast.io</a>.
                                   </p>
                                 )}
                                 <button
                                   onClick={() => retryStudy(activeStudy)}
                                   disabled={loading}
                                   className="mt-4 px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-red-300 transition-colors"
                                 >
                                   {loading ? 'Retrying...' : 'Retry Study'}
                                 </button>
                               </div>
                             </div>
                           </div>
                         </div>
                       ) :
                       'No comps found. Try a different market or broaden your search.'}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="text-left px-3 py-2 font-medium text-slate-600 cursor-pointer hover:text-slate-900" onClick={() => handleSort('propertyName')}>
                              Property{sortIcon('propertyName')}
                            </th>
                            <th className="text-left px-3 py-2 font-medium text-slate-600 cursor-pointer hover:text-slate-900" onClick={() => handleSort('beds')}>
                              Beds{sortIcon('beds')}
                            </th>
                            <th className="text-left px-3 py-2 font-medium text-slate-600 cursor-pointer hover:text-slate-900" onClick={() => handleSort('sqft')}>
                              Sqft{sortIcon('sqft')}
                            </th>
                            <th className="text-right px-3 py-2 font-medium text-slate-600 cursor-pointer hover:text-slate-900" onClick={() => handleSort('rent')}>
                              Rent{sortIcon('rent')}
                            </th>
                            <th className="text-right px-3 py-2 font-medium text-blue-700 cursor-pointer hover:text-blue-900 bg-blue-50" onClick={() => handleSort('rentPerBed')}>
                              $/Bed{sortIcon('rentPerBed')}
                            </th>
                            <th className="text-center px-3 py-2 font-medium text-slate-600 cursor-pointer hover:text-slate-900" onClick={() => handleSort('googleRating')}>
                              Rating{sortIcon('googleRating')}
                            </th>
                            <th className="text-left px-3 py-2 font-medium text-slate-600">
                              Website
                            </th>
                            <th className="text-left px-3 py-2 font-medium text-slate-600 cursor-pointer hover:text-slate-900" onClick={() => handleSort('source')}>
                              Source{sortIcon('source')}
                            </th>
                            <th className="text-left px-3 py-2 font-medium text-slate-600">
                              Amenities
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredComps.map((comp, i) => (
                            <tr
                              key={comp.id || i}
                              className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                            >
                              <td className="px-3 py-2">
                                <div className="font-medium text-slate-800">
                                  {comp.listingUrl ? (
                                    <a href={comp.listingUrl} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 hover:underline">
                                      {comp.propertyName}
                                    </a>
                                  ) : comp.propertyName}
                                </div>
                                {comp.address && (
                                  <div className="text-xs text-slate-400 truncate max-w-[200px]">{comp.address}</div>
                                )}
                              </td>
                              <td className="px-3 py-2 text-slate-600">
                                {comp.beds === 0 ? 'Studio' : comp.beds ? `${comp.beds} BR` : '—'}
                              </td>
                              <td className="px-3 py-2 text-slate-600">
                                {comp.sqft ? comp.sqft.toLocaleString() : '—'}
                              </td>
                              <td className="px-3 py-2 text-right text-slate-800 font-medium">
                                {fmt(comp.rent)}
                              </td>
                              <td className="px-3 py-2 text-right font-bold text-blue-700 bg-blue-50/50">
                                {fmt(comp.rentPerBed)}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {comp.googleRating != null ? (
                                  <span className="inline-flex items-center gap-1 text-sm" title={`${comp.googleReviewCount ?? 0} reviews`}>
                                    <span className="text-yellow-500">&#9733;</span>
                                    <span className="font-medium text-slate-800">{comp.googleRating.toFixed(1)}</span>
                                    {comp.googleReviewCount != null && (
                                      <span className="text-xs text-slate-400">({comp.googleReviewCount})</span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">&mdash;</span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {comp.propertyWebsite ? (
                                  <a
                                    href={comp.propertyWebsite}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 hover:underline text-xs truncate block max-w-[140px]"
                                    title={comp.propertyWebsite}
                                  >
                                    {new URL(comp.propertyWebsite).hostname.replace(/^www\./, '')}
                                  </a>
                                ) : (
                                  <span className="text-slate-300">&mdash;</span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <SourceBadge source={comp.source} />
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex gap-1">
                                  {comp.furnished && <AmenityTag label="Furn" />}
                                  {comp.hasPool && <AmenityTag label="Pool" />}
                                  {comp.hasGym && <AmenityTag label="Gym" />}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {filteredComps.length > 0 && (
                    <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 text-xs text-slate-500">
                      Showing {filteredComps.length} of {activeStudy.comps?.length || 0} comps
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function SummaryCard({ label, value, sublabel, accent }: {
  label: string;
  value: string;
  sublabel: string;
  accent: string;
}) {
  const colors: Record<string, string> = {
    blue: 'border-blue-200 bg-blue-50',
    indigo: 'border-indigo-200 bg-indigo-50',
    purple: 'border-purple-200 bg-purple-50',
    emerald: 'border-emerald-200 bg-emerald-50',
  };
  const textColors: Record<string, string> = {
    blue: 'text-blue-700',
    indigo: 'text-indigo-700',
    purple: 'text-purple-700',
    emerald: 'text-emerald-700',
  };
  return (
    <div className={`rounded-lg border p-3 ${colors[accent] || colors.blue}`}>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`text-xl font-bold mt-1 ${textColors[accent] || textColors.blue}`}>{value}</div>
      <div className="text-xs text-slate-400 mt-0.5">{sublabel}</div>
    </div>
  );
}

function SourceBadge({ source }: { source: string }) {
  const colors: Record<string, string> = {
    'rentcast': 'bg-teal-100 text-teal-700',
    'apartments.com': 'bg-orange-100 text-orange-700',
    'zillow': 'bg-blue-100 text-blue-700',
    'rentcafe': 'bg-green-100 text-green-700',
    'manual': 'bg-slate-100 text-slate-700',
  };
  return (
    <span className={`inline-block px-1.5 py-0.5 text-xs rounded-full font-medium ${colors[source] || colors.manual}`}>
      {source}
    </span>
  );
}

function AmenityTag({ label }: { label: string }) {
  return (
    <span className="inline-block px-1.5 py-0.5 text-xs rounded bg-slate-100 text-slate-500">
      {label}
    </span>
  );
}
