import type { ReactNode } from 'react';
import type { ComposerChallengeType } from '../../../api/challengeCreationApi';
import { V2ChoiceCard } from '../../components/V2Primitives';
import { CHALLENGE_TYPE_OPTIONS } from '../challengeCreationDraft';

/**
 * Reusable "Challenge type" step. `footer` carries composition-specific copy
 * (the member Wizard's "set up from scratch" note); this step owns none.
 */
export function ChallengeTypeStep({
  selected,
  onSelect,
  footer,
}: {
  selected: ComposerChallengeType | null;
  onSelect: (type: ComposerChallengeType) => void;
  footer?: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-slate-600">
        Each type counts progress differently — pick the one that fits how you want this Challenge to work.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {CHALLENGE_TYPE_OPTIONS.map((option) => (
          <V2ChoiceCard
            key={option.value}
            selected={selected === option.value}
            onClick={() => onSelect(option.value)}
            title={option.label}
            subtitle={option.sub}
            description={option.blurb}
            badge={option.badge}
          />
        ))}
      </div>
      {footer}
    </div>
  );
}
