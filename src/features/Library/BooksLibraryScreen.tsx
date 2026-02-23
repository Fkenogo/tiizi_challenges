import { ArrowLeft, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BottomNav, Screen } from '../../components/Layout';
import { Card, EmptyState, LoadingSpinner } from '../../components/Mobile';
import { useBooks } from '../../hooks/useBooks';

function BooksLibraryScreen() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useBooks();

  if (isLoading) return <LoadingSpinner fullScreen label="Loading library..." />;

  if (isError) {
    return (
      <Screen className="st-page">
        <div className="st-frame flex min-h-[60vh] items-center justify-center">
          <p className="text-sm text-slate-500">Unable to load books library.</p>
        </div>
      </Screen>
    );
  }

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="st-frame min-h-screen pb-[96px]">
        <header className="st-form-max flex items-center justify-between pt-5 pb-3">
          <button
            onClick={() => navigate('/app/home')}
            className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-900"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="st-page-title">Books Library</h1>
          <div className="h-10 w-10" />
        </header>

        <section className="st-form-max mt-3 space-y-3">
          {(data ?? []).length === 0 ? (
            <EmptyState
              icon={<BookOpen size={42} />}
              title="No books available"
              message="Ask admin to publish books to the books collection."
            />
          ) : (
            (data ?? []).map((book) => (
              <Card
                key={book.id}
                interactive
                onClick={() => navigate(`/app/library/${book.id}`)}
                className="rounded-[18px] p-0 overflow-hidden"
              >
                <div className="flex items-stretch">
                  <div className="w-24 h-28 bg-slate-100 border-r border-slate-200">
                    {book.coverImageUrl ? (
                      <img src={book.coverImageUrl} alt={book.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <BookOpen size={28} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 px-4 py-3">
                    <p className="text-[17px] leading-[21px] font-black text-slate-900 line-clamp-2">{book.title}</p>
                    {book.author && <p className="mt-1 text-[13px] leading-[17px] text-slate-500">{book.author}</p>}
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1.5 text-white text-[12px] leading-[14px] font-bold">
                      <BookOpen size={14} />
                      Read
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </section>

        <BottomNav />
      </div>
    </Screen>
  );
}

export default BooksLibraryScreen;
