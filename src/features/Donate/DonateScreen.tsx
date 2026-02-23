import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen, Section } from '../../components/Layout';
import { Card } from '../../components/Mobile';

const presetAmounts = [10, 25, 50, 100];

function DonateScreen() {
  const navigate = useNavigate();
  const [amount, setAmount] = useState<number>(25);

  return (
    <Screen>
      <Section title="Support Tiizi">
        <Card>
          <p className="text-sm text-slate-700">Support community programs, challenge rewards, and local events.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {presetAmounts.map((value) => (
              <button
                key={value}
                className={`h-10 rounded-lg text-sm font-bold ${amount === value ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700'}`}
                onClick={() => setAmount(value)}
              >
                ${value}
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            <button className="w-full h-11 rounded-xl bg-primary text-white text-sm font-bold" onClick={() => navigate('/app/profile')}>
              Donate ${amount}
            </button>
            <button className="w-full h-11 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold" onClick={() => navigate('/app/profile')}>
              Back to Profile
            </button>
          </div>
        </Card>
      </Section>
    </Screen>
  );
}

export default DonateScreen;

