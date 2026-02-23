import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

function ChallengePreviewScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const templateId = params.get('templateId') ?? undefined;
  const groupId = params.get('groupId') ?? undefined;

  useEffect(() => {
    const query = new URLSearchParams();
    if (templateId) query.set('previewTemplateId', templateId);
    if (groupId) query.set('groupId', groupId);
    navigate(`/app/challenges/suggested?${query.toString()}`, { replace: true });
  }, [navigate, templateId, groupId]);

  return null;
}

export default ChallengePreviewScreen;
