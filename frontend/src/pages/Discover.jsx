import { useCallback, useEffect, useState } from 'react';
import { Search, Sparkles, Users } from 'lucide-react';
import CategoryFilter from '../components/CategoryFilter.jsx';
import MasonryGrid from '../components/MasonryGrid.jsx';
import Spinner from '../components/Spinner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { workApi, searchApi, recommendationApi, errMsg } from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function Discover() {
  const { isAuthed } = useAuth();
  const toast = useToast();

  const [feedTab, setFeedTab] = useState('all');
  const [followingWorks, setFollowingWorks] = useState(null);

  const [q, setQ] = useState('');
  const [submittedQ, setSubmittedQ] = useState('');
  const [semantic, setSemantic] = useState(false);
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('recent');

  const [works, setWorks] = useState([]);
  const [recs, setRecs] = useState([]);
  const [recStrategy, setRecStrategy] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchWorks = useCallback(
    async (reset = false) => {
      setLoading(true);
      const nextPage = reset ? 1 : page;
      try {
        let res;
        if (submittedQ) {
          res = await searchApi.search({
            q: submittedQ,
            semantic,
            category: category === 'all' ? undefined : category,
            page: nextPage,
            limit: 24,
          });
        } else {
          res = await workApi.list({
            category: category === 'all' ? undefined : category,
            sort: sort === 'popular' ? 'popular' : undefined,
            page: nextPage,
            limit: 24,
          });
        }
        setTotalPages(res.totalPages || 1);
        setWorks((prev) => (reset ? res.items : [...prev, ...res.items]));
      } catch (err) {
        toast.error(errMsg(err));
      } finally {
        setLoading(false);
      }
    },
    [submittedQ, semantic, category, sort, page, toast]
  );

  useEffect(() => {
    setPage(1);
    fetchWorks(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submittedQ, semantic, category, sort]);

  useEffect(() => {
    if (page > 1) fetchWorks(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    if (!isAuthed || feedTab !== 'following' || followingWorks !== null) return;
    workApi
      .following()
      .then((r) => setFollowingWorks(r.items || []))
      .catch(() => setFollowingWorks([]));
  }, [isAuthed, feedTab, followingWorks]);

  useEffect(() => {
    if (!isAuthed) return;
    recommendationApi
      .feed(12)
      .then((r) => {
        setRecs(r.items || []);
        setRecStrategy(r.strategy || null);
      })
      .catch(() => {});
  }, [isAuthed]);

  const onSearch = (e) => {
    e.preventDefault();
    setSubmittedQ(q.trim());
  };

  const recBadge = () => {
    if (recStrategy === 'ai-personalized') {
      return (
        <span className="rounded-full bg-magenta/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-magenta">
          AI personalized
        </span>
      );
    }
    if (recStrategy === 'trending-fallback') {
      return (
        <span className="rounded-full bg-ink/5 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink/50">
          Trending picks
        </span>
      );
    }
    return null;
  };

  return (
    <div className="container-x py-12">
      <header className="mb-8">
        <div className="mb-3 h-[2px] w-10 bg-gradient-to-r from-saffron to-gold" />
        <p className="label">The Gallery</p>
        <div className="flex items-baseline gap-3">
          <h1 className="mt-2 font-display text-4xl font-black text-ink sm:text-5xl">Discover</h1>
          <span className="font-brand text-lg text-saffron/60">कला</span>
        </div>

        {isAuthed && (
          <div className="mt-5 inline-flex rounded-full border border-ink/15 p-1">
            {['all', 'following'].map((id) => (
              <button
                key={id}
                onClick={() => setFeedTab(id)}
                className={
                  'flex items-center gap-1.5 rounded-full px-4 py-1.5 font-mono text-xs uppercase tracking-wider transition ' +
                  (feedTab === id ? 'bg-saffron text-white' : 'text-ink/60 hover:text-ink')
                }
              >
                {id === 'following' && <Users className="h-3.5 w-3.5" />}
                {id === 'all' ? 'All works' : 'Following'}
              </button>
            ))}
          </div>
        )}
      </header>

      <form onSubmit={onSearch} className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
          <input
            className="input pl-11"
            placeholder="Search works, themes, moods..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={() => setSemantic((s) => !s)}
          className={'btn px-4 py-3 ' + (semantic ? 'bg-magenta text-white' : 'border border-ink/15 text-ink/70')}
          title="AI semantic search finds thematically similar works"
        >
          <Sparkles className="h-4 w-4" /> AI Search {semantic ? 'On' : 'Off'}
        </button>
        <button className="btn-dark px-6 py-3">Search</button>
      </form>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <CategoryFilter active={category} onChange={setCategory} />
        {!submittedQ && (
          <div className="flex gap-2">
            {['recent', 'popular'].map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={
                  'rounded-full px-4 py-1.5 font-mono text-xs uppercase tracking-wider ' +
                  (sort === s ? 'bg-ink text-white' : 'text-ink/50 hover:text-ink')
                }
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {isAuthed && !submittedQ && recs.length > 0 && (
        <section className="mb-12">
          <div className="mb-4 flex items-center gap-3">
            <Sparkles className="h-4 w-4 text-saffron" />
            <h2 className="font-display text-xl font-bold">Recommended for you</h2>
            {recBadge()}
          </div>
          <MasonryGrid works={recs} />
        </section>
      )}

      {feedTab === 'following' && (
        <section>
          {followingWorks === null && <Spinner label="Loading following feed" />}
          {followingWorks !== null && followingWorks.length === 0 && (
            <EmptyState
              message="No works from people you follow yet."
              action={
                <button onClick={() => setFeedTab('all')} className="btn-saffron">
                  Browse all works
                </button>
              }
            />
          )}
          {followingWorks !== null && followingWorks.length > 0 && (
            <MasonryGrid works={followingWorks} />
          )}
        </section>
      )}

      {feedTab === 'all' && submittedQ && (
        <p className="mb-4 font-mono text-xs uppercase tracking-wider text-ink/50">
          {semantic ? 'AI results for' : 'Results for'} &ldquo;{submittedQ}&rdquo;
        </p>
      )}

      {feedTab === 'all' && loading && works.length === 0 && (
        <Spinner label="Loading works" />
      )}

      {feedTab === 'all' && (!loading || works.length > 0) && (
        <>
          <MasonryGrid works={works} emptyMessage="No works found - try a different filter or search." />
          {!submittedQ && page < totalPages && (
            <div className="mt-10 flex justify-center">
              <button
                className="btn-outline"
                onClick={() => setPage((p) => p + 1)}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
