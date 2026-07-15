import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CreditCard } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Screen } from '../../components/Layout';
import { useAuth } from '../../hooks/useAuth';
import { useConfirmSupportDonation, useCreateSupportDonation, useSupportPreference } from '../../hooks/useDonations';
import { useToast } from '../../context/ToastContext';
import { adminDonationService } from '../../services/adminDonationService';
import type { SupportDonationSettings } from '../../types';

const PILOT_FALLBACK_PHONE = '+250794003947';
const PILOT_FALLBACK_CURRENCY = 'KES';

type SupportedCurrency = 'KES' | 'RWF' | 'UGX';

const SUPPORTED_CURRENCIES: SupportedCurrency[] = ['KES', 'RWF', 'UGX'];

const PRESET_AMOUNTS: Record<SupportedCurrency, number[]> = {
  KES: [100, 250, 500, 1000],
  RWF: [1000, 2500, 5000, 10000],
  UGX: [3000, 7000, 15000, 30000],
};

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

  const [platformSettings, setPlatformSettings] = useState<SupportDonationSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);

  useEffect(() => {
    adminDonationService.getPlatformSupportSettings()
      .then((s) => setPlatformSettings(s))
      .catch(() => setPlatformSettings(null))
      .finally(() => setSettingsLoading(false));
  }, []);

  const supportPhone = platformSettings?.mobileMoneyNumber ?? PILOT_FALLBACK_PHONE;
  const ussdCode = platformSettings?.mobileMoneyUssdCode ?? null;

  const resolvedDefaultCurrency = (): SupportedCurrency => {
    const raw = platformSettings?.defaultCurrency ?? platformSettings?.currency ?? PILOT_FALLBACK_CURRENCY;
    return SUPPORTED_CURRENCIES.includes(raw as SupportedCurrency)
      ? (raw as SupportedCurrency)
      : PILOT_FALLBACK_CURRENCY;
  };

  const [selectedCurrency, setSelectedCurrency] = useState<SupportedCurrency>(PILOT_FALLBACK_CURRENCY);
  const [currencyInitialised, setCurrencyInitialised] = useState(false);

  // Apply Firestore default once settings load
  useEffect(() => {
    if (!settingsLoading && !currencyInitialised) {
      setSelectedCurrency(resolvedDefaultCurrency());
      setCurrencyInitialised(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsLoading]);

  const presets = PRESET_AMOUNTS[selectedCurrency];

  const [selectedPreset, setSelectedPreset] = useState<number>(presets[0]);
  const [customAmount, setCustomAmount] = useState('');
  const [frequency, setFrequency] = useState<'one_time' | 'occasional' | 'monthly' | 'annual'>(
    (() => {
      const pref = preference?.preferredFrequency;
      if (pref === 'monthly' || pref === 'annual') return pref;
      return 'one_time';
    })(),
  );
  const [trigger] = useState<'manual' | 'challenge_completion' | 'streak_milestone'>(donationTrigger);
  const [submitted, setSubmitted] = useState(false);
  const [createdDonationId, setCreatedDonationId] = useState<string | null>(null);
  const [showPaymentInstructions, setShowPaymentInstructions] = useState(false);
  const [transactionId, setTransactionId] = useState('');

  const effectiveAmount = customAmount.trim() ? Number(customAmount) : selectedPreset;

  const handleCurrencyChange = (c: SupportedCurrency) => {
    setSelectedCurrency(c);
    setCustomAmount('');
    setSelectedPreset(PRESET_AMOUNTS[c][0]);
  };

  const submit = async () => {
    if (!user?.uid) {
      showToast('Please sign in to continue.', 'error');
      return;
    }
    if (!Number.isFinite(effectiveAmount) || effectiveAmount < 1) {
      showToast(`Enter a valid amount in ${selectedCurrency}.`, 'error');
      return;
    }

    try {
      const created = await createDonation.mutateAsync({
        amountKes: Math.round(effectiveAmount),
        currency: selectedCurrency,
        frequency,
        trigger,
        paymentMethod: 'mobile_money',
        paymentDestination: { mobileNumber: supportPhone },
        ussdCode: ussdCode ?? undefined,
        challengeId,
      });
      setCreatedDonationId(created.id);
      setShowPaymentInstructions(true);
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

  if (settingsLoading) {
    return (
      <Screen noPadding noBottomPadding className="st-page">
        <div className="mx-auto max-w-mobile min-h-screen bg-slate-50 flex items-center justify-center">
          <p className="text-[14px] text-slate-500">Loading…</p>
        </div>
      </Screen>
    );
  }

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

          {/* Intro message */}
          {trigger !== 'challenge_completion' && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[14px] leading-[20px] text-slate-600">
                Tiizi remains free for everyone. Support is completely optional.
              </p>
            </section>
          )}

          {/* Currency selector */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[16px] leading-[20px] font-black text-slate-900">Your currency</p>
            <div className="mt-3 flex gap-2">
              {SUPPORTED_CURRENCIES.map((c) => (
                <button
                  key={c}
                  className={`h-10 flex-1 rounded-xl text-sm font-bold ${selectedCurrency === c ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700'}`}
                  onClick={() => handleCurrencyChange(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </section>

          {/* Amount selection */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[16px] leading-[20px] font-black text-slate-900">Choose how much to support</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {presets.map((value) => (
                <button
                  key={value}
                  className={`h-11 rounded-xl text-sm font-bold ${!customAmount && selectedPreset === value ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700'}`}
                  onClick={() => {
                    setCustomAmount('');
                    setSelectedPreset(value);
                  }}
                >
                  {selectedCurrency} {value.toLocaleString()}
                </button>
              ))}
            </div>
            <div className="mt-3">
              <p className="text-[12px] leading-[16px] tracking-[0.08em] uppercase font-bold text-slate-500">Custom amount ({selectedCurrency})</p>
              <input
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-[15px] font-semibold text-slate-800"
                type="number"
                min={1}
                placeholder={`Enter amount in ${selectedCurrency}`}
                value={customAmount}
                onChange={(event) => setCustomAmount(event.target.value)}
              />
            </div>
          </section>

          {/* Frequency */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[16px] leading-[20px] font-black text-slate-900">How often?</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                ['one_time', 'One-time'],
                ['occasional', 'Occasional'],
                ['monthly', 'Monthly'],
                ['annual', 'Annual'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={`h-11 rounded-xl border text-sm font-bold ${frequency === value ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-slate-700'}`}
                  onClick={() => setFrequency(value as 'one_time' | 'occasional' | 'monthly' | 'annual')}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* Payment method — Mobile Money active, Card coming soon */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[16px] leading-[20px] font-black text-slate-900">Send your support</p>

            {/* Mobile Money */}
            <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
              <p className="text-[13px] font-black text-primary uppercase tracking-wide mb-1">Mobile Money</p>
              <p className="text-[13px] leading-[19px] text-slate-700 mb-2">
                Send your support to this number. You may send from Kenya, Rwanda, or Uganda depending on your mobile money provider.
              </p>
              <a
                href={`tel:${supportPhone}`}
                className="inline-flex items-center gap-2 h-11 rounded-xl bg-primary/10 px-4 text-[16px] font-black text-primary"
              >
                {supportPhone}
              </a>
              <p className="mt-2 text-[12px] leading-[18px] text-slate-500">
                You will pay directly — Tiizi does not hold funds.
              </p>
            </div>

            {/* Card — coming soon */}
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-start gap-3 opacity-60">
              <CreditCard size={20} className="text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[13px] font-black text-slate-500 uppercase tracking-wide">Card payment</p>
                <p className="text-[12px] leading-[18px] text-slate-400 mt-0.5">Coming soon.</p>
              </div>
            </div>
          </section>

          {/* Record intent */}
          <button
            className="w-full h-12 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-60"
            disabled={createDonation.isPending}
            onClick={submit}
          >
            {createDonation.isPending
              ? 'Saving…'
              : `Record my support — ${selectedCurrency} ${Math.max(0, Math.round(effectiveAmount || 0)).toLocaleString()}`}
          </button>
          <button
            className="w-full h-12 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold"
            onClick={() => navigate('/app/profile')}
          >
            Maybe later
          </button>

          {submitted && (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
              Thank you for supporting Tiizi. Your support helps keep the community growing.
            </p>
          )}

          {showPaymentInstructions && (
            <section className="rounded-2xl border border-primary/20 bg-[#fff4eb] p-4">
              <p className="text-[16px] leading-[20px] font-black text-slate-900">Complete your payment</p>
              <p className="mt-2 text-[13px] leading-[19px] text-slate-700">
                Send{' '}
                <span className="font-bold">{selectedCurrency} {Math.round(effectiveAmount).toLocaleString()}</span>{' '}
                to{' '}
                <a href={`tel:${supportPhone}`} className="font-bold text-primary">{supportPhone}</a>{' '}
                via mobile money.
              </p>
              {ussdCode && (
                <p className="mt-1 text-[13px] leading-[19px] text-slate-700">
                  USSD code: <span className="font-bold">{ussdCode}</span>
                </p>
              )}
              <p className="mt-2 text-[13px] leading-[19px] font-semibold text-slate-800">
                After sending payment, return here and confirm your support.
              </p>
              <ul className="mt-1 list-disc pl-5 text-[13px] leading-[19px] text-slate-700">
                <li>Complete the transfer on your phone</li>
                <li>Wait for SMS confirmation</li>
                <li>Enter the transaction ID below (optional but helpful)</li>
              </ul>
              <div className="mt-3">
                <p className="text-[12px] leading-[16px] tracking-[0.08em] uppercase font-bold text-slate-500">Transaction ID (optional)</p>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-[15px] font-semibold text-slate-800"
                  placeholder="Paste transaction ID from SMS"
                  value={transactionId}
                  onChange={(event) => setTransactionId(event.target.value)}
                />
              </div>
              <button
                className="mt-3 h-11 w-full rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-60"
                disabled={confirmDonation.isPending}
                onClick={confirmPayment}
              >
                {confirmDonation.isPending ? 'Saving…' : 'I have completed payment'}
              </button>
            </section>
          )}
        </main>
      </div>
    </Screen>
  );
}

export default DonateScreen;
