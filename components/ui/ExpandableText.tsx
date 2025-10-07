'use client';

import { useState, useMemo } from 'react';

type ExpandableTextProps = {
  text?: string | null;
  previewLength?: number;
  className?: string;
  moreLabel?: string;
  lessLabel?: string;
};

export function ExpandableText({
  text,
  previewLength = 140,
  className,
  moreLabel = 'さらに表示',
  lessLabel = '閉じる',
}: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const full = text || '';
  const isLong = full.length > previewLength;
  const shown = useMemo(() => {
    if (!isLong || expanded) return full;
    return full.substring(0, previewLength) + '...';
  }, [full, isLong, expanded, previewLength]);

  if (!full) return null;

  return (
    <div className={className}>
      <p className="whitespace-pre-wrap text-sm text-gray-700">{shown}</p>
      {isLong && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="mt-1 text-xs text-gray-600 underline"
        >
          {expanded ? lessLabel : moreLabel}
        </button>
      )}
    </div>
  );
}


