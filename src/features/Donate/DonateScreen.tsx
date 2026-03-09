import { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Screen } from '../../components/Layout';
import { useAuth } from '../../hooks/useAuth';
import { useConfirmSupportDonation, useCreateSupportDonation, useSupportPreference } from '../../hooks/useDonations';
import { useToast } from '../../context/ToastContext';

const PRESET_AMOUNTS = [500, 1000, 2000, 3000, 4000, 5000, 10000];
const RECEIVER_PHONE = '0722361789';
const MPESA_USSD_CODE = '*344*2*0*722361789#';
const MPESA_USSD_TEL_URI = 'tel:*344*2*0*722361789%23';

function DonateScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const createDonation = useCreateSupportDonation();
  const confirmDonation = useConfirmSupportDonation();
  const { data: preference } = useSupportPreference();

  const triggerFromRoute = params.get('trigger');
  const challengeId = params.get('challengeId') ?? undefined;
  const donationTrigger = useMemo(() => {
    if (triggerFromRoute === 'challenge_completion') return 'challenge_completion' as const;
    if (triggerFromRoute === 'streak_milestone') return 'streak_milestone' as const;
    return 'manual' as const;
  }, [triggerFromRoute]);

  const [amountKes, setAmountKes] = useState<number>(1000);
  const [customAmount, setCustomAmount] = useState('');
  const [frequency, setFrequency] = useState<'monthly' | 'annual' | 'goal_triggered'>(
    preference?.preferredFrequency ?? 'monthly',
  );
  const [trigger, setTrigger] = useState<'manual' | 'challenge_completion' | 'streak_milestone'>(
    donationTrigger,
  );
  const [paymentMethod, setPaymentMethod] = useState<'mobile_money' | 'card'>('mobile_money');
  const [mobileNumber] = useState(RECEIVER_PHONE);
  const [cardUrl] = useState('https://payments.tiizi.app/support');
  const [submitted, setSubmitted] = useState(false);
  const [createdDonationId, setCreatedDonationId] = useState<string | null>(null);
  const [showPaymentInstructions, setShowPaymentInstructions] = useState(false);
  const [transactionId, setTransactionId] = useState('');

  const effectiveAmount = customAmount.trim() ? Number(customAmount) : amountKes;

  const submit = async () => {
    if (!user?.uid) {
      showToast('Please sign in to continue.', 'error');
      return;
    }
    if (!Number.isFinite(effectiveAmount) || effectiveAmount < 100) {
      showToast('Enter a valid amount (minimum KES 100).', 'error');
      return;
    }
    if (paymentMethod === 'mobile_money' && !mobileNumber.trim()) {
      showToast('Add a mobile number for payment instructions.', 'error');
      return;
    }
    if (paymentMethod === 'card' && !cardUrl.trim()) {
      showToast('Add a card checkout URL.', 'error');
      return;
    }

    try {
      const created = await createDonation.mutateAsync({
        amountKes: Math.round(effectiveAmount),
        frequency,
        trigger,
        paymentMethod,
        paymentDestination: {
          mobileNumber: paymentMethod === 'mobile_money' ? mobileNumber.trim() : undefined,
          cardUrl: paymentMethod === 'card' ? cardUrl.trim() : undefined,
        },
        ussdCode: paymentMethod === 'mobile_money' ? MPESA_USSD_CODE : undefined,
        challengeId,
      });
      setCreatedDonationId(created.id);
      if (paymentMethod === 'mobile_money') {
        setShowPaymentInstructions(true);
      } else {
        setSubmitted(true);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Could not save support contribution.';
      showToast(msg, 'error');
    }
  };

  const confirmPayment = async () => {
    if (!createdDonationId) return;
    try {
      await confirmDonation.mutateAsync({
        donationId: createdDonationId,
        transactionId: transactionId.trim() || undefined,
      });
      setShowPaymentInstructions(false);
      setSubmitted(true);
      showToast('Donation confirmation saved. Thank you for supporting Tiizi.', 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Could not confirm donation.';
      showToast(msg, 'error');
    }
  };

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="mx-auto max-w-mobile min-h-screen bg-slate-50 pb-[96px]">
        <header className="px-4 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
          <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate(-1)}>
            <ArrowLeft size={22} className="text-slate-900" />
          </button>
          <h1 className="text-[18px] leading-[22px] font-black text-slate-900">Support Tiizi</h1>
          <span className="w-10" />
        </header>

        <main className="px-4 py-4 space-y-4">
          {trigger === 'challenge_completion' && (
            <section className="rounded-2xl border border-primary/20 bg-[#fff4eb] p-4">
              <p className="text-[18px] leading-[22px] font-black text-slate-900">Nice work finishing the challenge</p>
              <p className="mt-2 text-[14px] leading-[20px] text-slate-600">
                If Tiizi helped you stay consistent, you can support its growth. This is optional.
              </p>
            </section>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[16px] leading-[20px] font-black text-slate-900">Choose how you’d like to support Tiizi</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {PRESET_AMOUNTS.map((value) => (
                <button
                  key={value}
                  className={`h-11 rounded-xl text-sm font-bold ${!customAmount && amountKes === value ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700'}`}
                  onClick={() => {
                    setCustomAmount('');
                    setAmountKes(value);
                  }}
                >
                  KES {value.toLocaleString()}
                </button>
              ))}
            </div>
            <div className="mt-3">
              <p className="text-[12px] leading-[16px] tracking-[0.08em] uppercase font-bold text-slate-500">Custom amount</p>
              <input
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-[15px] font-semibold text-slate-800"
                type="number"
                min={100}
                placeholder="Enter another amount"
                value={customAmount}
                onChange={(event) => setCustomAmount(event.target.value)}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[16px] leading-[20px] font-black text-slate-900">How often would you like to contribute?</p>
            <div className="mt-3 grid grid-cols-1 gap-2">
              {[
                ['monthly', 'Monthly'],
                ['annual', 'Annual'],
                ['goal_triggered', 'Goal-triggered'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={`h-11 rounded-xl border text-sm font-bold ${frequency === value ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-slate-700'}`}
                  onClick={() => setFrequency(value as 'monthly' | 'annual' | 'goal_triggered')}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[16px] leading-[20px] font-black text-slate-900">Donate here</p>
            <div className="mt-3 flex gap-2">
              <button
                className={`h-10 rounded-xl px-4 text-sm font-bold ${paymentMethod === 'mobile_money' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700'}`}
                onClick={() => setPaymentMethod('mobile_money')}
              >
                Mobile Money
              </button>
              <button
                className={`h-10 rounded-xl px-4 text-sm font-bold ${paymentMethod === 'card' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700'}`}
                onClick={() => setPaymentMethod('card')}
              >
                Card
              </button>
            </div>
            {paymentMethod === 'mobile_money' ? (
              <div className="mt-3">
                <p className="text-[12px] leading-[16px] tracking-[0.08em] uppercase font-bold text-slate-500">Phone number</p>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-[15px] font-semibold text-slate-800"
                  value={mobileNumber}
                  readOnly
                />
              </div>
            ) : (
              <div className="mt-3">
                <p className="text-[12px] leading-[16px] tracking-[0.08em] uppercase font-bold text-slate-500">Card checkout URL</p>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-[15px] font-semibold text-slate-800"
                  value={cardUrl}
                  readOnly
                />
                <p className="mt-2 text-[12px] leading-[16px] text-slate-500">Card integration session follows separately.</p>
              </div>
            )}
            <p className="mt-3 text-[12px] leading-[18px] text-slate-500">
              Payments are made directly to the recipient. Tiizi does not hold or process funds.
            </p>
          </section>

          <button
            className="w-full h-12 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-60"
            disabled={createDonation.isPending}
            onClick={() => {
              if (paymentMethod === 'mobile_money') {
                window.location.href = MPESA_USSD_TEL_URI;
              }
              submit();
            }}
          >
            {createDonation.isPending
              ? 'Saving...'
              : paymentMethod === 'mobile_money'
                ? 'Donate Now'
                : `Donate KES ${Math.max(0, Math.round(effectiveAmount || 0)).toLocaleString()}`}
          </button>
          <button className="w-full h-12 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold" onClick={() => navigate('/app/profile')}>
            Maybe later
          </button>
          {submitted && (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
              Thank you for supporting Tiizi. Your support helps keep the community growing.
            </p>
          )}
          {showPaymentInstructions && (
            <section className="rounded-2xl border border-primary/20 bg-[#fff4eb] p-4">
              <p className="text-[16px] leading-[20px] font-black text-slate-900">Complete payment on your phone</p>
              <p className="mt-2 text-[13px] leading-[19px] text-slate-700">
                Dialed code: <span className="font-bold">{MPESA_USSD_CODE}</span>
              </p>
              <ul className="mt-2 list-disc pl-5 text-[13px] leading-[19px] text-slate-700">
                <li>Enter amount in USSD flow</li>
                <li>Confirm recipient number</li>
                <li>Enter PIN and complete</li>
              </ul>
              <p className="mt-2 text-[12px] leading-[18px] text-slate-600">Wait for SMS confirmation. SMS is proof of payment.</p>
              <div className="mt-3">
                <p className="text-[12px] leading-[16px] tracking-[0.08em] uppercase font-bold text-slate-500">Transaction ID (optional)</p>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-[15px] font-semibold text-slate-800"
                  placeholder="Paste MPESA transaction ID from SMS"
                  value={transactionId}
                  onChange={(event) => setTransactionId(event.target.value)}
                />
              </div>
              <button
                className="mt-3 h-11 w-full rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-60"
                disabled={confirmDonation.isPending}
                onClick={confirmPayment}
              >
                {confirmDonation.isPending ? 'Saving...' : 'I have completed payment'}
              </button>
            </section>
          )}
        </main>
      </div>
    </Screen>
  );
}

export default DonateScreen;
