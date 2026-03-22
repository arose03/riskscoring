'use client';

import { useState, useCallback, useRef } from 'react';

type Recommendation = 'BIND' | 'CONDITIONAL_BIND' | 'DECLINE';

interface ProcessingResult {
  success: boolean;
  submission_id?: string;
  recommendation?: Recommendation;
  named_insured?: string;
  occupancy_type?: string;
  total_tiv?: number;
  total_premium?: number;
  blended_property_rate?: number;
  locations_count?: number;
  buildings_count?: number;
  flags?: number;
  decline_flags?: number;
  referral_flags?: number;
  data_gaps?: string[];
  strengths?: string[];
  concerns?: string[];
  workbook_base64?: string;
  document_types_found?: string[];
  parse_errors?: string[];
  error?: string;
}

const ACCEPTED_TYPES = [
  '.pdf', '.xlsx', '.xls', '.csv', '.docx',
  '.jpg', '.jpeg', '.png',
];

const RECOMMENDATION_CONFIG: Record<Recommendation, { color: string; bg: string; label: string }> = {
  BIND: { color: 'text-green-800', bg: 'bg-green-100 border-green-400', label: 'BIND' },
  CONDITIONAL_BIND: { color: 'text-yellow-800', bg: 'bg-yellow-100 border-yellow-400', label: 'CONDITIONAL BIND' },
  DECLINE: { color: 'text-red-800', bg: 'bg-red-100 border-red-400', label: 'DECLINE' },
};

export default function SubmissionPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [dscr, setDscr] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [occupancyType, setOccupancyType] = useState<'auto' | 'student_housing' | 'conventional_mf'>('auto');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    setFiles((prev) => [...prev, ...dropped]);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    setFiles((prev) => [...prev, ...selected]);
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (files.length === 0) return;

    setProcessing(true);
    setResult(null);
    setProgress('Uploading files...');

    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f));
      if (dscr) formData.append('dscr', dscr);
      if (operatorName) formData.append('operatorName', operatorName);
      if (occupancyType !== 'auto') formData.append('occupancyType', occupancyType);

      setProgress('Classifying documents...');

      const response = await fetch('/api/submission/process', {
        method: 'POST',
        body: formData,
      });

      setProgress('Scoring submission...');
      const data: ProcessingResult = await response.json();
      setResult(data);
    } catch (err) {
      setResult({ success: false, error: String(err) });
    } finally {
      setProcessing(false);
      setProgress('');
    }
  };

  const downloadWorkbook = () => {
    if (!result?.workbook_base64) return;
    const blob = new Blob(
      [Buffer.from(result.workbook_base64, 'base64')],
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HABGEN_UW_${result.named_insured?.replace(/\s+/g, '_') ?? 'Submission'}_${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const recConfig = result?.recommendation ? RECOMMENDATION_CONFIG[result.recommendation] : null;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-navy-900" style={{ color: '#1F3864' }}>
            Submission Intake & Underwriting Engine
          </h1>
          <p className="text-gray-600 mt-2">
            Upload a complete submission package. The engine will parse all documents, score the risk, and generate an 8-tab underwriting workbook.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: Upload + Config */}
          <div className="lg:col-span-2 space-y-6">

            {/* Drop zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                isDragging
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400 bg-white'
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPTED_TYPES.join(',')}
                className="hidden"
                onChange={handleFileSelect}
              />
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <p className="text-gray-600 font-medium">Drop files here or click to browse</p>
              <p className="text-sm text-gray-400 mt-1">
                PDF, XLSX, XLS, CSV, DOCX, JPG, PNG
              </p>
              <p className="text-xs text-gray-400 mt-1">
                ACORD 125/140 · Statement of Values · Loss Runs · GL Supplemental · Inspection Reports
              </p>
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
                <div className="px-4 py-3 bg-gray-50 flex items-center justify-between rounded-t-lg">
                  <span className="text-sm font-medium text-gray-700">{files.length} file(s) queued</span>
                  <button
                    onClick={() => setFiles([])}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    Clear all
                  </button>
                </div>
                {files.map((file, idx) => (
                  <div key={idx} className="px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileTypeIcon ext={file.name.split('.').pop() ?? ''} />
                      <div>
                        <p className="text-sm text-gray-800">{file.name}</p>
                        <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB</p>
                      </div>
                    </div>
                    <button onClick={() => removeFile(idx)} className="text-gray-400 hover:text-red-500 ml-4">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={files.length === 0 || processing}
              className="w-full py-3 px-6 rounded-lg font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#1F3864' }}
            >
              {processing ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {progress || 'Processing...'}
                </span>
              ) : (
                'Process Submission →'
              )}
            </button>
          </div>

          {/* Right: Optional overrides */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Optional Overrides</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Occupancy Type</label>
                  <select
                    value={occupancyType}
                    onChange={(e) => setOccupancyType(e.target.value as typeof occupancyType)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  >
                    <option value="auto">Auto-detect</option>
                    <option value="student_housing">Student Housing</option>
                    <option value="conventional_mf">Conventional MF</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">DSCR</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 1.35"
                    value={dscr}
                    onChange={(e) => setDscr(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                  <p className="text-xs text-gray-400 mt-1">Debt Service Coverage Ratio</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Operator / Manager</label>
                  <input
                    type="text"
                    placeholder="e.g. Asset Living"
                    value={operatorName}
                    onChange={(e) => setOperatorName(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Supported documents */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Supported Documents</h3>
              <ul className="text-xs text-gray-600 space-y-1.5">
                {[
                  ['ACORD 125', 'Auto-parsed'],
                  ['ACORD 140', 'Auto-parsed'],
                  ['Statement of Values', 'XLS/CSV/PDF'],
                  ['5-Year Loss Runs', 'PDF'],
                  ['GL Supplemental', 'PDF'],
                  ['Prior Declarations', 'PDF'],
                  ['Inspection Reports', 'PDF'],
                  ['Property Photos', 'JPG/PNG'],
                ].map(([doc, format]) => (
                  <li key={doc} className="flex justify-between">
                    <span>{doc}</span>
                    <span className="text-gray-400">{format}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="mt-8 space-y-6">

            {/* Error state */}
            {!result.success && (
              <div className="bg-red-50 border border-red-300 rounded-lg p-4">
                <h3 className="font-semibold text-red-800 mb-1">Processing Failed</h3>
                <p className="text-sm text-red-700">{result.error}</p>
              </div>
            )}

            {/* Success state */}
            {result.success && (
              <>
                {/* Recommendation banner */}
                {recConfig && result.recommendation && (
                  <div className={`border-2 rounded-lg p-6 text-center ${recConfig.bg}`}>
                    <div className={`text-4xl font-bold ${recConfig.color}`}>
                      {recConfig.label}
                    </div>
                    <p className={`mt-1 text-lg ${recConfig.color}`}>
                      {result.named_insured ?? 'Unknown Insured'}
                    </p>
                  </div>
                )}

                {/* Key metrics grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <MetricCard label="Total TIV" value={result.total_tiv ? '$' + Math.round(result.total_tiv).toLocaleString() : 'N/A'} />
                  <MetricCard label="Total Premium" value={result.total_premium ? '$' + Math.round(result.total_premium).toLocaleString() : 'N/A'} />
                  <MetricCard label="Property Rate" value={result.blended_property_rate ? '$' + result.blended_property_rate.toFixed(4) + '/$100' : 'N/A'} />
                  <MetricCard label="Buildings / Locs" value={`${result.buildings_count ?? 0} / ${result.locations_count ?? 0}`} />
                </div>

                {/* Flags summary */}
                {(result.flags ?? 0) > 0 && (
                  <div className="grid grid-cols-2 gap-4">
                    {(result.decline_flags ?? 0) > 0 && (
                      <div className="bg-red-50 border border-red-300 rounded-lg p-4">
                        <div className="text-2xl font-bold text-red-800">{result.decline_flags}</div>
                        <div className="text-sm text-red-700">Decline Trigger(s)</div>
                      </div>
                    )}
                    {(result.referral_flags ?? 0) > 0 && (
                      <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
                        <div className="text-2xl font-bold text-yellow-800">{result.referral_flags}</div>
                        <div className="text-sm text-yellow-700">Referral Item(s)</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Strengths & Concerns */}
                {(result.strengths?.length ?? 0) > 0 || (result.concerns?.length ?? 0) > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(result.strengths?.length ?? 0) > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h3 className="font-semibold text-green-800 mb-2">Key Strengths</h3>
                        <ul className="space-y-1">
                          {result.strengths!.map((s, i) => (
                            <li key={i} className="text-sm text-green-700">• {s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(result.concerns?.length ?? 0) > 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <h3 className="font-semibold text-yellow-800 mb-2">Key Concerns</h3>
                        <ul className="space-y-1">
                          {result.concerns!.map((c, i) => (
                            <li key={i} className="text-sm text-yellow-700">• {c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Data gaps */}
                {(result.data_gaps?.length ?? 0) > 0 && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-700 mb-2">Data Gaps / Notes</h3>
                    <ul className="space-y-1">
                      {result.data_gaps!.map((gap, i) => (
                        <li key={i} className="text-sm text-gray-600">• {gap}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Parse info */}
                {(result.parse_errors?.length ?? 0) > 0 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <h3 className="font-semibold text-orange-700 mb-2">Parse Notes</h3>
                    <ul className="space-y-1">
                      {result.parse_errors!.map((err, i) => (
                        <li key={i} className="text-sm text-orange-600">• {err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Documents found */}
                {(result.document_types_found?.length ?? 0) > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <span className="text-sm font-medium text-blue-700">Documents detected: </span>
                    <span className="text-sm text-blue-600">
                      {result.document_types_found!.join(', ')}
                    </span>
                  </div>
                )}

                {/* Download button */}
                <button
                  onClick={downloadWorkbook}
                  className="w-full py-4 px-6 rounded-lg font-semibold text-white bg-green-700 hover:bg-green-800 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download 8-Tab Underwriting Workbook (.xlsx)
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="text-xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function FileTypeIcon({ ext }: { ext: string }) {
  const colors: Record<string, string> = {
    pdf: 'text-red-500',
    xlsx: 'text-green-600',
    xls: 'text-green-600',
    csv: 'text-green-700',
    docx: 'text-blue-500',
    jpg: 'text-purple-500',
    jpeg: 'text-purple-500',
    png: 'text-purple-500',
  };
  return (
    <span className={`text-xs font-bold uppercase ${colors[ext] ?? 'text-gray-400'} w-10 text-center`}>
      {ext.toUpperCase()}
    </span>
  );
}
