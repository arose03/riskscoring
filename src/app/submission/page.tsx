'use client';

import { useState, useEffect, useCallback } from 'react';

type Recommendation = 'BIND' | 'CONDITIONAL_BIND' | 'DECLINE' | 'UNKNOWN' | 'ERROR';

interface ConfigStatus {
  imap_configured: boolean;
  smtp_configured: boolean;
  imap_host: string | null;
  imap_user: string | null;
  smtp_host: string | null;
  smtp_user: string | null;
  mailbox: string;
}

interface ProcessedSubmission {
  id: number;
  submission_id: string;
  named_insured: string;
  recommendation: Recommendation;
  total_tiv: number;
  total_premium: number;
  flags: number;
  from_email: string;
  subject: string;
  processed_at: string;
}

interface CheckResult {
  checked?: boolean;
  new_emails?: number;
  processed?: number;
  errors?: number;
  results?: {
    messageId: string;
    subject: string;
    from: string;
    recommendation?: string;
    namedInsured?: string;
    totalPremium?: number;
    totalTIV?: number;
    error?: string;
    processedAt: string;
  }[];
  error?: string;
}

const REC_STYLES: Record<Recommendation, { badge: string; row: string }> = {
  BIND:             { badge: 'bg-green-100 text-green-800 border border-green-300',  row: 'bg-green-50' },
  CONDITIONAL_BIND: { badge: 'bg-yellow-100 text-yellow-800 border border-yellow-300', row: 'bg-yellow-50' },
  DECLINE:          { badge: 'bg-red-100 text-red-800 border border-red-300',        row: 'bg-red-50' },
  UNKNOWN:          { badge: 'bg-gray-100 text-gray-600 border border-gray-300',     row: '' },
  ERROR:            { badge: 'bg-orange-100 text-orange-700 border border-orange-300', row: 'bg-orange-50' },
};

function fmt(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US');
}

function timeAgo(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function SubmissionPage() {
  const [config, setConfig] = useState<ConfigStatus | null>(null);
  const [submissions, setSubmissions] = useState<ProcessedSubmission[]>([]);
  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<CheckResult | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/email/check');
      const data = await res.json();
      setConfig(data as ConfigStatus);
    } catch {
      setConfig(null);
    }
  }, []);

  const loadSubmissions = useCallback(async () => {
    try {
      const res = await fetch('/api/email/status');
      const data = await res.json();
      setSubmissions(data.submissions ?? []);
    } catch {
      setSubmissions([]);
    }
  }, []);

  useEffect(() => {
    loadConfig();
    loadSubmissions();
  }, [loadConfig, loadSubmissions]);

  // Auto-refresh every 60 seconds when enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(async () => {
      await handleCheckNow();
    }, 60000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh]);

  const handleCheckNow = async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/email/check', { method: 'POST' });
      const data: CheckResult = await res.json();
      setLastResult(data);
      setLastCheck(new Date().toISOString());
      await loadSubmissions();
    } finally {
      setChecking(false);
    }
  };

  const isReady = config?.imap_configured && config?.smtp_configured;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#1F3864' }}>
              Submission Intake — Email Processor
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Automatically processes incoming submission emails, runs the underwriting pipeline, and replies with the workbook.
            </p>
          </div>

          {/* Auto-refresh toggle */}
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer mt-1">
            <div
              onClick={() => setAutoRefresh((v) => !v)}
              className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${autoRefresh ? 'bg-blue-500' : 'bg-gray-300'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${autoRefresh ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
            Auto-check (60s)
          </label>
        </div>

        {/* Config status cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ConfigCard
            title="Inbox (IMAP)"
            configured={config?.imap_configured ?? false}
            details={config?.imap_configured
              ? `${config.imap_user} @ ${config.imap_host} → ${config.mailbox}`
              : undefined}
            envVars={['IMAP_HOST', 'IMAP_PORT (default 993)', 'IMAP_USER', 'IMAP_PASSWORD', 'IMAP_MAILBOX (default INBOX)']}
          />
          <ConfigCard
            title="Outbox (SMTP)"
            configured={config?.smtp_configured ?? false}
            details={config?.smtp_configured
              ? `${config.smtp_user} @ ${config.smtp_host}`
              : undefined}
            envVars={['SMTP_HOST', 'SMTP_PORT (default 587)', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM_NAME', 'SMTP_CC_ADDRESS (optional)']}
          />
        </div>

        {/* How it works */}
        {!isReady && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-800 mb-2">How to set up email intake</h3>
            <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
              <li>Create a dedicated inbox (e.g. <code className="bg-blue-100 px-1 rounded">submissions@yourdomain.com</code>)</li>
              <li>Set the IMAP and SMTP environment variables above</li>
              <li>Brokers email the submission package (PDF/XLSX attachments) to that inbox</li>
              <li>Click &quot;Check Now&quot; or enable auto-check — the engine fetches, scores, and replies automatically</li>
              <li>Broker receives an email back with the 8-tab Excel workbook attached</li>
            </ol>
            <p className="text-xs text-blue-600 mt-3">
              Works with Gmail (App Password), Outlook, or any IMAP/SMTP server.
              For Gmail: enable IMAP in settings and use an App Password.
            </p>
          </div>
        )}

        {/* Check Now button + last result */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleCheckNow}
            disabled={checking || !isReady}
            className="px-6 py-2.5 rounded-lg font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            style={{ backgroundColor: isReady ? '#1F3864' : '#9ca3af' }}
          >
            {checking ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Checking inbox...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Check Inbox Now
              </>
            )}
          </button>

          {lastCheck && (
            <span className="text-sm text-gray-500">
              Last checked {timeAgo(lastCheck)}
            </span>
          )}
        </div>

        {/* Last check result */}
        {lastResult && (
          <div className={`rounded-lg p-4 border text-sm ${
            lastResult.error
              ? 'bg-red-50 border-red-300'
              : lastResult.new_emails === 0
              ? 'bg-gray-50 border-gray-200'
              : 'bg-green-50 border-green-300'
          }`}>
            {lastResult.error ? (
              <span className="text-red-700">Error: {lastResult.error}</span>
            ) : lastResult.new_emails === 0 ? (
              <span className="text-gray-600">Inbox empty — no new submissions found.</span>
            ) : (
              <div className="space-y-2">
                <p className="font-semibold text-green-800">
                  Processed {lastResult.processed} of {lastResult.new_emails} new email(s)
                  {(lastResult.errors ?? 0) > 0 && ` (${lastResult.errors} error(s))`}
                </p>
                {lastResult.results?.map((r, i) => (
                  <div key={i} className="text-xs text-green-700 ml-2">
                    {r.error
                      ? `❌ ${r.subject} — ${r.error}`
                      : `✅ ${r.namedInsured ?? r.subject} → ${r.recommendation} — ${r.totalPremium ? fmt(r.totalPremium) : 'N/A'} premium`
                    }
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Processed submissions table */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">
              Processed Submissions
              {submissions.length > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-500">({submissions.length})</span>
              )}
            </h2>
            <button
              onClick={loadSubmissions}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Refresh
            </button>
          </div>

          {submissions.length === 0 ? (
            <div className="px-4 py-12 text-center text-gray-400">
              <svg className="mx-auto h-10 w-10 mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-sm">No processed submissions yet.</p>
              <p className="text-xs mt-1">
                {isReady
                  ? 'Click "Check Inbox Now" to process waiting emails.'
                  : 'Configure IMAP/SMTP credentials to get started.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    {['Recommendation', 'Named Insured', 'From', 'Total TIV', 'Premium', 'Flags', 'Processed'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {submissions.map((sub) => {
                    const style = REC_STYLES[sub.recommendation] ?? REC_STYLES.UNKNOWN;
                    return (
                      <tr key={sub.id} className={`hover:bg-gray-50 transition-colors ${style.row}`}>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${style.badge}`}>
                            {sub.recommendation.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {sub.named_insured || '—'}
                          {sub.subject && (
                            <p className="text-xs text-gray-400 font-normal truncate max-w-48">{sub.subject}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{sub.from_email || '—'}</td>
                        <td className="px-4 py-3 text-gray-700">{sub.total_tiv ? fmt(sub.total_tiv) : '—'}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{sub.total_premium ? fmt(sub.total_premium) : '—'}</td>
                        <td className="px-4 py-3">
                          {sub.flags > 0 ? (
                            <span className="text-orange-600 font-medium">{sub.flags}</span>
                          ) : (
                            <span className="text-green-600">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{timeAgo(sub.processed_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Flow diagram */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Automated Pipeline</h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
            {[
              'Broker emails submission@habgen.com',
              'Engine fetches unseen emails',
              'Classifies each attachment',
              'Parses ACORD 125 + SOV + Loss Runs',
              'Runs property rating engine',
              'Runs GL Scorer v3.1',
              'Checks eligibility & referrals',
              'Generates 8-tab Excel workbook',
              'Emails broker with recommendation + workbook',
            ].map((step, i, arr) => (
              <span key={step} className="flex items-center gap-2">
                <span className="bg-gray-100 rounded px-2 py-1">{step}</span>
                {i < arr.length - 1 && <span className="text-gray-300">→</span>}
              </span>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

function ConfigCard({
  title,
  configured,
  details,
  envVars,
}: {
  title: string;
  configured: boolean;
  details?: string;
  envVars: string[];
}) {
  return (
    <div className={`rounded-lg border p-4 ${configured ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-2.5 h-2.5 rounded-full ${configured ? 'bg-green-500' : 'bg-gray-300'}`} />
        <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
        <span className={`text-xs px-1.5 py-0.5 rounded ${configured ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {configured ? 'Connected' : 'Not configured'}
        </span>
      </div>
      {configured && details ? (
        <p className="text-xs text-green-700 mb-2 font-mono">{details}</p>
      ) : (
        <div className="mt-2">
          <p className="text-xs text-gray-500 mb-1">Required environment variables:</p>
          <ul className="space-y-0.5">
            {envVars.map((v) => (
              <li key={v} className="text-xs font-mono text-gray-600 bg-gray-50 px-2 py-0.5 rounded">
                {v}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
