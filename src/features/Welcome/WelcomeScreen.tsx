import { useNavigate } from 'react-router-dom';
import { Screen } from '../../components/Layout';

function WelcomeScreen() {
  const navigate = useNavigate();

  return (
    <Screen noPadding noBottomPadding className="st-page bg-slate-950">
      {/* Full-bleed cover */}
      <div className="relative h-screen w-full flex flex-col justify-end overflow-hidden">
        <img
          src="/tiizi-cover.png"
          alt="Tiizi community"
          className="absolute inset-0 h-full w-full object-cover object-top"
        />

        {/* Gradient — strong at bottom for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

        {/* Bottom-anchored content */}
        <section className="relative z-10 w-full px-6 pb-12">
          {/* Headline & subtitle — left aligned */}
          <div className="mb-8">
            <h1 className="text-[32px] leading-[38px] font-black text-white tracking-tight max-w-[85%]">
              Fitness is Better Together
            </h1>
            <p className="mt-3 text-[15px] leading-[22px] text-white/85 max-w-[90%]">
              Build healthy habits with communities that help you stay active, accountable and consistent.
            </p>
          </div>

          {/* CTA */}
          <button
            className="w-full h-14 rounded-xl bg-primary text-white text-[17px] font-bold flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-transform"
            onClick={() => navigate('/app/signup')}
          >
            Get Started →
          </button>
        </section>
      </div>
    </Screen>
  );
}

export default WelcomeScreen;
