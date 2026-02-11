'use client';

import { ScoringResult } from '@/lib/types';

function getActionColor(actionType: string): string {
  switch (actionType) {
    case 'BIND':
      return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    case 'REFER':
      return 'bg-amber-100 text-amber-800 border-amber-300';
    case 'DECLINE':
      return 'bg-red-100 text-red-800 border-red-300';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

function getGradeColor(grade: string): string {
  if (grade.startsWith('A')) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
  if (grade.startsWith('B')) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  if (grade.startsWith('C')) return 'text-orange-600 bg-orange-50 border-orange-200';
  return 'text-red-600 bg-red-50 border-red-200';
}

function getRateModDisplay(rateMod: number): { label: string; className: string } {
  if (rateMod < 0)
    return { label: `${rateMod}%`, className: 'text-emerald-600' };
  if (rateMod === 0)
    return { label: 'Base Rate', className: 'text-slate-600' };
  return { label: `+${rateMod}%`, className: 'text-red-600' };
}

export default function ResultsPanel({
  result,
  label,
}: {
  result: ScoringResult;
  label: string;
}) {
  const { weightedScore, grade, completedFactors, totalFactors, isComplete } = result;

  // Gauge position: map 1.00–5.00 to 0–100%
  const gaugePercent = weightedScore
    ? Math.max(0, Math.min(100, ((weightedScore - 1) / 4) * 100))
    : 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="text-sm font-semibold text-slate-700 mb-4">{label}</div>

      {/* Gauge */}
      <div className="mb-4">
        <div className="relative h-3 rounded-full gauge-track overflow-hidden">
          {weightedScore && (
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 border-slate-800 rounded-full shadow-md transition-all duration-500"
              style={{ left: `${gaugePercent}%` }}
            />
          )}
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
          <span>1.00</span>
          <span>2.00</span>
          <span>3.00</span>
          <span>4.00</span>
          <span>5.00</span>
        </div>
      </div>

      {!isComplete ? (
        <div className="text-center py-3">
          <div className="text-sm text-slate-500">
            Incomplete &ndash; {totalFactors - completedFactors} factor
            {totalFactors - completedFactors !== 1 ? 's' : ''} remaining
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {completedFactors}/{totalFactors} scored
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-3 text-center">
          {/* Score */}
          <div>
            <div className="text-xs text-slate-500 mb-1">Score</div>
            <div className="text-2xl font-bold text-slate-800">
              {weightedScore?.toFixed(2)}
            </div>
          </div>

          {/* Grade */}
          <div>
            <div className="text-xs text-slate-500 mb-1">Grade</div>
            {grade && (
              <div
                className={`inline-block px-3 py-1 rounded-lg border text-lg font-bold ${getGradeColor(
                  grade.grade
                )}`}
              >
                {grade.grade}
              </div>
            )}
          </div>

          {/* Action */}
          <div>
            <div className="text-xs text-slate-500 mb-1">UW Action</div>
            {grade && (
              <div
                className={`inline-block px-2 py-1 rounded border text-xs font-semibold ${getActionColor(
                  grade.actionType
                )}`}
              >
                {grade.action}
              </div>
            )}
          </div>

          {/* Rate Mod */}
          <div>
            <div className="text-xs text-slate-500 mb-1">Rate Mod</div>
            {grade && (
              <div
                className={`text-xl font-bold ${
                  getRateModDisplay(grade.rateMod).className
                }`}
              >
                {getRateModDisplay(grade.rateMod).label}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
