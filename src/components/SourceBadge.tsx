'use client';

import { SourceType } from '@/lib/types';

const badgeConfig: Record<SourceType, { label: string; className: string }> = {
  AUTO: {
    label: 'AUTO',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  },
  AI_EST: {
    label: 'AI EST.',
    className: 'bg-amber-100 text-amber-700 border-amber-300',
  },
  MANUAL: {
    label: 'MANUAL',
    className: 'bg-slate-100 text-slate-600 border-slate-300',
  },
  OVERRIDE: {
    label: 'OVERRIDE',
    className: 'bg-white text-amber-700 border-amber-400 border-2',
  },
};

export default function SourceBadge({ source }: { source: SourceType }) {
  const config = badgeConfig[source];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide border ${config.className}`}
    >
      {config.label}
    </span>
  );
}
