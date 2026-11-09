import React from 'react';
import type { AssignmentKind } from '../types';
import { KIND_META } from '../utils/kinds';

/** A small labelled tag for what sort of deadline an item is. The word is always there; colour only helps. */
export const KindBadge: React.FC<{ kind: AssignmentKind; className?: string }> = ({ kind, className = '' }) => (
  <span
    data-testid="kind-badge"
    data-kind={kind}
    className={`shrink-0 text-xs font-medium px-1.5 py-0.5 rounded border ${KIND_META[kind].badge} ${className}`}
  >
    {KIND_META[kind].label}
  </span>
);
