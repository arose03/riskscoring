'use client';

import { useState } from 'react';
import { ScoringFactor, FactorScore, ScoreValue, SourceType } from '@/lib/types';
import ScoreButtons from './ScoreButtons';
import SourceBadge from './SourceBadge';
import ScoreGuideTooltip from './ScoreGuideTooltip';

interface ScoringGridProps {
  factors: ScoringFactor[];
  scores: Record<string, FactorScore>;
  onScoreChange: (factorKey: string, score: ScoreValue) => void;
}

export default function ScoringGrid({
  factors,
  scores,
  onScoreChange,
}: ScoringGridProps) {
  const [expandedReasoning, setExpandedReasoning] = useState<string | null>(null);

  const handleScoreChange = (factor: ScoringFactor, score: ScoreValue) => {
    onScoreChange(factor.key, score);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[1fr_180px_70px_80px_80px_60px] gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
        <div>Factor</div>
        <div className="text-center">Score (1–5)</div>
        <div className="text-center">Weight</div>
        <div className="text-center">Wtd Score</div>
        <div className="text-center">Source</div>
        <div className="text-right">Guide</div>
      </div>

      {/* Rows */}
      {factors.map((factor) => {
        const fs = scores[factor.key];
        const score = fs?.score ?? null;
        const source: SourceType = fs?.source ?? factor.autoType;
        const wtdScore = score !== null ? (score * factor.weight).toFixed(2) : '—';

        return (
          <div key={factor.key}>
            <div className="grid grid-cols-[1fr_180px_70px_80px_80px_60px] gap-2 px-4 py-3 border-b border-slate-100 items-center hover:bg-slate-50/50 transition-colors">
              <div className="text-sm font-medium text-slate-700">
                {factor.label}
              </div>
              <div className="flex justify-center">
                <ScoreButtons
                  value={score}
                  onChange={(s) => handleScoreChange(factor, s)}
                />
              </div>
              <div className="text-center text-xs text-slate-500">
                {(factor.weight * 100).toFixed(0)}%
              </div>
              <div className="text-center text-sm font-mono text-slate-600">
                {wtdScore}
              </div>
              <div className="text-center">
                <SourceBadge source={source} />
              </div>
              <div className="text-right">
                <ScoreGuideTooltip guide={factor.scoreGuide} />
              </div>
            </div>

            {/* AI Reasoning expandable */}
            {fs?.aiReasoning && source === 'AI_EST' && (
              <div className="px-4 pb-2 border-b border-slate-100">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedReasoning(
                      expandedReasoning === factor.key ? null : factor.key
                    )
                  }
                  className="text-xs text-amber-600 hover:text-amber-700 underline decoration-dotted"
                >
                  {expandedReasoning === factor.key
                    ? 'Hide reasoning'
                    : 'View AI reasoning'}
                </button>
                {expandedReasoning === factor.key && (
                  <div className="mt-1 text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded p-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-amber-700">
                        Confidence: {fs.aiConfidence || 'medium'}
                      </span>
                    </div>
                    {fs.aiReasoning}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
