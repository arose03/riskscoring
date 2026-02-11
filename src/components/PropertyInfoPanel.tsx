'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { PropertyInfo, University } from '@/lib/types';

interface PropertyInfoPanelProps {
  propertyInfo: PropertyInfo;
  onChange: (info: PropertyInfo) => void;
  universities: University[];
  onUniversitySelect: (university: University) => void;
  onAddressGeocode: (address: string) => void;
}

export default function PropertyInfoPanel({
  propertyInfo,
  onChange,
  universities,
  onUniversitySelect,
  onAddressGeocode,
}: PropertyInfoPanelProps) {
  const [uniSearch, setUniSearch] = useState('');
  const [uniDropdownOpen, setUniDropdownOpen] = useState(false);
  const uniRef = useRef<HTMLDivElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  // Filter universities
  const filteredUnis = uniSearch
    ? universities.filter((u) =>
        u.name.toLowerCase().includes(uniSearch.toLowerCase())
      )
    : universities;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (uniRef.current && !uniRef.current.contains(e.target as Node)) {
        setUniDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Google Places Autocomplete initialization
  const initAutocomplete = useCallback(() => {
    if (!addressInputRef.current || autocompleteRef.current) return;
    if (!window.google?.maps?.places) return;

    autocompleteRef.current = new google.maps.places.Autocomplete(
      addressInputRef.current,
      {
        types: ['address'],
        componentRestrictions: { country: 'us' },
        fields: ['formatted_address', 'geometry'],
      }
    );

    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current?.getPlace();
      if (place?.formatted_address) {
        onChange({
          ...propertyInfo,
          address: place.formatted_address,
          formattedAddress: place.formatted_address,
          lat: place.geometry?.location?.lat() ?? null,
          lng: place.geometry?.location?.lng() ?? null,
        });
      }
    });
  }, [onChange, propertyInfo]);

  useEffect(() => {
    // Try to init if Google Maps is already loaded
    initAutocomplete();

    // If not loaded, wait for it
    const checkInterval = setInterval(() => {
      if (window.google?.maps?.places) {
        initAutocomplete();
        clearInterval(checkInterval);
      }
    }, 500);

    return () => clearInterval(checkInterval);
  }, [initAutocomplete]);

  const handleField = (field: keyof PropertyInfo, value: string) => {
    onChange({ ...propertyInfo, [field]: value });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="text-sm font-semibold text-slate-700 mb-4">
        Property Information
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Address */}
        <div className="lg:col-span-2">
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Property Address
          </label>
          <div className="flex gap-2">
            <input
              ref={addressInputRef}
              type="text"
              value={propertyInfo.address}
              onChange={(e) => handleField('address', e.target.value)}
              placeholder="Start typing an address..."
              className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={() => onAddressGeocode(propertyInfo.address)}
              disabled={!propertyInfo.address}
              className="px-3 py-2 text-xs font-medium bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Geocode
            </button>
          </div>
          {propertyInfo.lat && propertyInfo.lng && (
            <div className="text-[10px] text-slate-400 mt-1">
              {propertyInfo.formattedAddress} ({propertyInfo.lat.toFixed(4)},{' '}
              {propertyInfo.lng.toFixed(4)})
            </div>
          )}
        </div>

        {/* University */}
        <div ref={uniRef} className="relative">
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Nearest University
          </label>
          <input
            type="text"
            value={uniDropdownOpen ? uniSearch : propertyInfo.universityName}
            onChange={(e) => {
              setUniSearch(e.target.value);
              setUniDropdownOpen(true);
            }}
            onFocus={() => setUniDropdownOpen(true)}
            placeholder="Search universities..."
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {uniDropdownOpen && (
            <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl">
              {filteredUnis.slice(0, 50).map((uni) => (
                <button
                  key={uni.id}
                  type="button"
                  onClick={() => {
                    onUniversitySelect(uni);
                    setUniSearch('');
                    setUniDropdownOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0"
                >
                  <div className="font-medium text-slate-700">{uni.name}</div>
                  <div className="text-[10px] text-slate-400">
                    Tier {uni.tier} &bull; Party Score: {uni.party_score}
                  </div>
                </button>
              ))}
              {filteredUnis.length === 0 && (
                <div className="px-3 py-2 text-sm text-slate-400">
                  No universities found
                </div>
              )}
            </div>
          )}
        </div>

        {/* TIV */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Total Insured Value (TIV)
          </label>
          <input
            type="text"
            value={propertyInfo.tiv}
            onChange={(e) => handleField('tiv', e.target.value)}
            placeholder="$0"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Units */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Units
          </label>
          <input
            type="number"
            value={propertyInfo.units}
            onChange={(e) => handleField('units', e.target.value)}
            placeholder="0"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Year Built */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Year Built
          </label>
          <input
            type="number"
            value={propertyInfo.yearBuilt}
            onChange={(e) => handleField('yearBuilt', e.target.value)}
            placeholder="2000"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Stories */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Stories
          </label>
          <input
            type="number"
            value={propertyInfo.stories}
            onChange={(e) => handleField('stories', e.target.value)}
            placeholder="0"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Construction */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Construction Type
          </label>
          <select
            value={propertyInfo.construction}
            onChange={(e) => handleField('construction', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="">Select...</option>
            <option value="FR">Fire Resistive (FR)</option>
            <option value="NC">Non-Combustible (NC)</option>
            <option value="JM">Joisted Masonry (JM)</option>
            <option value="FRAME">Wood Frame</option>
          </select>
        </div>

        {/* Sprinkler */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Sprinkler System
          </label>
          <select
            value={propertyInfo.sprinkler}
            onChange={(e) => handleField('sprinkler', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="">Select...</option>
            <option value="Y">Yes</option>
            <option value="N">No</option>
          </select>
        </div>

        {/* Occupancy */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Occupancy Type
          </label>
          <select
            value={propertyInfo.occupancy}
            onChange={(e) => handleField('occupancy', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="">Select...</option>
            <option value="senior">Senior / LIHTC</option>
            <option value="workforce">Workforce</option>
            <option value="graduate">Graduate</option>
            <option value="undergraduate">Undergraduate</option>
            <option value="greek">Greek / Party</option>
          </select>
        </div>

        {/* Sponsor Tier */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Sponsor Tier
          </label>
          <select
            value={propertyInfo.sponsorTier}
            onChange={(e) => handleField('sponsorTier', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="">Select...</option>
            <option value="A">A - Top Institutional</option>
            <option value="B">B - Strong Regional</option>
            <option value="C">C - Adequate</option>
          </select>
        </div>

        {/* DSCR */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            DSCR
          </label>
          <input
            type="number"
            step="0.01"
            value={propertyInfo.dscr}
            onChange={(e) => handleField('dscr', e.target.value)}
            placeholder="1.25"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Actual Rent */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Actual Rent ($/bed/mo)
          </label>
          <input
            type="number"
            value={propertyInfo.actualRent}
            onChange={(e) => handleField('actualRent', e.target.value)}
            placeholder="0"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>
    </div>
  );
}
