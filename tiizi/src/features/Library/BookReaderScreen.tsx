import { ArrowLeft, BookOpen } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { BottomNav, Screen } from '../../components/Layout';
import { Card, EmptyState, LoadingSpinner } from '../../components/Mobile';
import { useBook } from '../../hooks/useBooks';

function BookReaderScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: book, isLoading, isError } = useBook(id);

  if (isLoading) return <LoadingSpinner fullScreen label="Loading book..." />;

  if (isError || !book) {
    return (
      <EmptyState
        icon={<BookOpen size={42} />}
        title="Book not found"
        message="This library item may have been removed."
        action={(
          <button className="h-11 px-4 rounded-xl bg-primary text-white text-sm font-bold" onClick={() => navigate('/app/library')}>
            Back to Library
          </button>
        )}
      />
    );
  }

  const sections = book.plainText
    .split(/\n{2,}/)
    .map((value) => value.trim())
    .filter(Boolean);

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="st-frame min-h-screen pb-[96px]">
        <header className="st-form-max flex items-center justify-between pt-5 pb-3">
          <button
            onClick={() => navigate('/app/library')}
            className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-900"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="st-page-title line-clamp-1">{book.title}</h1>
          <div className="h-10 w-10" />
        </header>

        <section className="st-form-max mt-2">
          {book.author && (
            <p className="text-[13px] leading-[18px] text-slate-500 mb-3">By {book.author}</p>
          )}
          {book.description && (
            <Card className="mb-3 rounded-[14px] bg-[#fff8f3] border-primary/20">
              <p className="text-[13px] leading-[19px] text-slate-700">{book.description}</p>
            </Card>
          )}
        </section>

        <article className="st-form-max space-y-2">
          {sections.length === 0 ? (
            <Card className="rounded-[14px]">
              <p className="text-[14px] leading-[22px] text-slate-600">
                No readable content available for this book yet.
              </p>
            </Card>
          ) : (
            sections.map((section, index) => (
              <p key={`${book.id}-section-${index}`} className="rounded-[10px] px-2 py-1 text-[15px] leading-[24px] text-slate-700">
                {section}
              </p>
            ))
          )}
        </article>

        <BottomNav active="home" />
      </div>
    </Screen>
  );
}

export default BookReaderScreen;
