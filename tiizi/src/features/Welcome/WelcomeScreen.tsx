import { useNavigate } from 'react-router-dom';
import { Screen } from '../../components/Layout';

function WelcomeScreen() {
  const navigate = useNavigate();

  return (
    <Screen noPadding noBottomPadding className="st-page bg-slate-950">
      <div className="st-hero">
        <img
          src="https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80"
          alt="Fitness community"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="st-hero-overlay" />

        <div className="st-hero-content">
          <h1 className="st-heading-xl text-white text-center">Fitness is Better Together</h1>
          <p className="st-text-lg text-white/90 text-center mt-4">The first community-driven accountability app.</p>

          <button className="st-btn-primary mt-6" onClick={() => navigate('/app/signup')}>
            Get Started →
          </button>

          <div className="mt-8 flex justify-center -space-x-2">
            <div className="h-12 w-12 rounded-full border-2 border-white bg-slate-100" />
            <div className="h-12 w-12 rounded-full border-2 border-white bg-orange-100" />
            <div className="h-12 w-12 rounded-full border-2 border-white bg-slate-200" />
            <div className="h-12 w-12 rounded-full border-2 border-slate-900 bg-primary flex items-center justify-center text-white text-sm font-bold">10K+</div>
          </div>

          <p className="text-center text-white text-[16px] leading-[22px] mt-6">
            Trusted by <span className="text-primary font-black">10,000+</span> members
          </p>
        </div>
      </div>
    </Screen>
  );
}

export default WelcomeScreen;
