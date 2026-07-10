import { Compass } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '../../components/Layout';
import { useAuth } from '../../hooks/useAuth';

function NotFoundScreen() {
  const navigate = useNavigate();
  const { isAuthenticated, isReady } = useAuth();

  const handleGoToTiizi = () => {
    if (!isReady) {
      navigate('/app/welcome');
      return;
    }
    navigate(isAuthenticated ? '/app/home' : '/app/welcome');
  };

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="mx-auto flex min-h-screen max-w-mobile flex-col items-center justify-center bg-slate-50 px-6 py-12 text-center">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Compass size={30} className="text-primary" />
        </div>
        <h1 className="mt-5 text-[22px] leading-[27px] font-black text-slate-900">Page not found</h1>
        <p className="mt-2 text-[14px] leading-[20px] text-slate-500 max-w-[280px]">
          The page you're looking for doesn't exist or may have moved.
        </p>
        <button
          type="button"
          className="mt-7 h-12 w-full max-w-[240px] rounded-2xl bg-primary text-[15px] font-bold text-white active:opacity-80"
          onClick={handleGoToTiizi}
        >
          Go to Tiizi
        </button>
      </div>
    </Screen>
  );
}

export default NotFoundScreen;
