'use client';

import { ScoreValue } from '@/lib/types';

interface ScoreButtonsProps {
  value: ScoreValue | null;
  onChange: (score: ScoreValue) => void;
  disabled?: boolean;
}

export default function ScoreButtons({ value, onChange, disabled }: ScoreButtonsProps) {
  const scores: ScoreValue[] = [1, 2, 3, 4, 5];

  return (
    <div className="flex gap-1.5">
      {scores.map((s) => (
        <button
          key={s}
          type="button"
          disabled={disabled}
          onClick={() => onChange(s)}
          className={`score-btn ${
            value === s ? `score-btn-${s}` : 'score-btn-unselected'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
