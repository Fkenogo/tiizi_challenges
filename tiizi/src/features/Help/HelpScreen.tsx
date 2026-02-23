import { MessageCircleQuestion, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Screen, Section } from '../../components/Layout';
import { Card } from '../../components/Mobile';

const faqs = [
  { q: 'How do I join a group?', a: 'Open Groups, tap Join Group, then enter the group code.' },
  { q: 'How do I track challenge workouts?', a: 'Open a challenge, tap Log Workout, and select an exercise.' },
  { q: 'Can I edit my profile details?', a: 'Use Profile menu options for personal info and privacy placeholders.' },
];

function HelpScreen() {
  const navigate = useNavigate();

  return (
    <Screen>
      <Section title="Help & Feedback">
        <Card className="mb-3">
          <div className="flex items-center gap-2">
            <MessageCircleQuestion size={18} className="text-primary" />
            <p className="text-sm font-bold text-slate-900">Support Center</p>
          </div>
          <p className="text-xs text-slate-600 mt-2">Browse quick answers or send feedback.</p>
        </Card>

        <div className="space-y-2">
          {faqs.map((item) => (
            <Card key={item.q} variant="flat">
              <p className="text-sm font-bold text-slate-900">{item.q}</p>
              <p className="text-xs text-slate-600 mt-1">{item.a}</p>
            </Card>
          ))}
        </div>

        <Card className="mt-3">
          <button className="w-full h-11 rounded-xl bg-primary text-white text-sm font-bold" onClick={() => navigate('/app/flow')}>
            <Send size={14} className="inline-block mr-1" />
            Open Feedback Flow
          </button>
          <button className="w-full h-11 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold mt-2" onClick={() => navigate('/app/profile')}>
            Back to Profile
          </button>
        </Card>
      </Section>
    </Screen>
  );
}

export default HelpScreen;
