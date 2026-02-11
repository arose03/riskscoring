'use client';

import { useState } from 'react';
import { ScoreGuideEntry } from '@/lib/types';

export default function ScoreGuideTooltip({ guide }: { guide: ScoreGuideEntry[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-slate-400 hover:text-slate-600 transition-colors text-xs underline decoration-dotted"
      >
        Guide
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-6 z-50 w-72 bg-white rounded-lg shadow-xl border border-slate-200 p-3">
            <div className="text-xs font-semibold text-slate-700 mb-2">Scoring Guide</div>
            <table className="w-full text-xs">
              <tbody>
                {guide.map((entry) => (
                  <tr key={entry.score} className="border-t border-slate-100">
                    <td className="py-1.5 pr-2 font-semibold text-slate-600 align-top w-6">
                      {entry.score}
                    </td>
                    <td className="py-1.5 pr-2 font-medium text-slate-700 align-top whitespace-nowrap">
                      {entry.label}
                    </td>
                    <td className="py-1.5 text-slate-500">{entry.criteria}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
