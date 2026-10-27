import { useNavigate } from 'react-router-dom';
import { V2Button, V2Card, V2Page, V2SectionHeader } from '../components/V2Primitives';
import {
  SUPPORT_CONTACT_EMAIL,
  SUPPORT_HEADLINE,
  SUPPORT_NEXT_STEP,
  SUPPORT_SECTIONS,
  SUPPORT_STATUS,
} from './supportContent';

/**
 * TIIZI — V2 Experience Recovery 001: Support Tiizi information screen
 * (`/v2/support`).
 *
 * Information only. This screen performs no request, stores nothing and
 * executes no contribution: it has no form, no amount, no payment control and
 * no fundraising figure. It states the approved voluntary-support model and a
 * clear next step (an email contact). Contribution execution is a separately
 * authorized Founder decision and is deliberately not implemented here.
 */
export function V2SupportTiiziScreen() {
  const navigate = useNavigate();
  return (
    <V2Page>
      <V2SectionHeader
        eyebrow={SUPPORT_HEADLINE.eyebrow}
        title={SUPPORT_HEADLINE.title}
        description={SUPPORT_HEADLINE.description}
      />

      <div className="space-y-3">
        {SUPPORT_SECTIONS.map((section) => (
          <V2Card key={section.id}>
            <h2 className="text-base font-black text-slate-900">{section.title}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">{section.body}</p>
          </V2Card>
        ))}

        <V2Card className="border-amber-200 bg-amber-50">
          <h2 className="text-base font-black text-amber-950">{SUPPORT_STATUS.title}</h2>
          <p className="mt-1 text-sm leading-6 text-amber-900">{SUPPORT_STATUS.body}</p>
        </V2Card>

        <V2Card>
          <h2 className="text-base font-black text-slate-900">{SUPPORT_NEXT_STEP.title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">{SUPPORT_NEXT_STEP.body}</p>
          <a
            href={`mailto:${SUPPORT_CONTACT_EMAIL}`}
            className="mt-3 inline-flex min-h-11 items-center break-all rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 hover:bg-slate-50"
          >
            {SUPPORT_CONTACT_EMAIL}
          </a>
        </V2Card>

        <div className="pt-1">
          <V2Button variant="secondary" onClick={() => navigate('/v2/profile')}>
            Back to Profile
          </V2Button>
        </div>
      </div>
    </V2Page>
  );
}
