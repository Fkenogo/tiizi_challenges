/**
 * Local-development PF-05 component review boundary.
 *
 * This intentionally composes the existing Wizard rather than creating a
 * second challenge-creation implementation. The API supplies only a real,
 * Firestore-verified Group context; it has no browser-side fixture mutation.
 */
import { useQuery } from '@tanstack/react-query';
import { ApiError, apiFetch } from '../../../api/apiClient';
import { Screen } from '../../../components/Layout';
import V2CreateChallengeWizard from './V2CreateChallengeWizard';

interface PreviewComponentContext {
  groupId: string;
  legacyGroupId: string;
  groupName: string;
}

export default function ChallengeCreationComponentPreview() {
  const context = useQuery({
    queryKey: ['pf05-component-preview-context'],
    queryFn: () => apiFetch<PreviewComponentContext>('/v1/preview/challenge-creation/context', { method: 'GET' }),
    retry: false,
  });

  if (context.isLoading) {
    return (
      <Screen noPadding noBottomPadding className="st-page">
        <main className="st-frame st-form-max mt-10 px-4 text-center">
          <p className="text-[15px] font-bold text-slate-900">Loading Challenge Creation component…</p>
        </main>
      </Screen>
    );
  }

  if (context.isError || !context.data) {
    const message = context.error instanceof ApiError
      ? context.error.message
      : 'The verified local preview Group is unavailable.';
    return (
      <Screen noPadding noBottomPadding className="st-page">
        <main className="st-frame st-form-max mt-10 px-4 text-center">
          <p className="text-[15px] font-bold text-slate-900">Challenge Creation component preview is unavailable.</p>
          <p className="mt-2 text-[13px] text-slate-600">{message}</p>
          <button className="st-btn-primary mt-6" onClick={() => void context.refetch()}>
            Retry verified context
          </button>
        </main>
      </Screen>
    );
  }

  return (
    <V2CreateChallengeWizard
      componentPreview
      previewGroupId={context.data.legacyGroupId}
      previewGroupName={context.data.groupName}
      previewReturnPath="/preview/v2/challenge-creation"
      previewResultPath="/preview/v2/challenge-creation/result/:id"
    />
  );
}
