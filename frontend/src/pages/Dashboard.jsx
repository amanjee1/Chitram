import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Eye, Heart, Bookmark, MessageCircle, Image as ImageIcon, Trash2, Plus, TrendingUp, X } from 'lucide-react';
import Spinner from '../components/Spinner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { insightApi, userApi, workApi, errMsg } from '../api/endpoints.js';
import { useToast } from '../context/ToastContext.jsx';

const STAT_CARDS = [
  { key: 'views', label: 'Views', icon: Eye, color: 'text-royal' },
  { key: 'likes', label: 'Likes', icon: Heart, color: 'text-magenta' },
  { key: 'saves', label: 'Saves', icon: Bookmark, color: 'text-olive' },
  { key: 'comments', label: 'Comments', icon: MessageCircle, color: 'text-ink' },
];

export default function Dashboard() {
  const toast = useToast();
  const [overview, setOverview] = useState(null);
  const [series, setSeries] = useState([]);
  const [works, setWorks] = useState([]);
  const [boards, setBoards] = useState([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [workInsight, setWorkInsight] = useState(null); // { id, title, series } | null

  const loadTrends = (d) => {
    insightApi.trends(d).then((r) => setSeries(r.series || [])).catch(() => {});
  };

  useEffect(() => {
    Promise.all([insightApi.overview(), userApi.dashboard()])
      .then(([ov, dash]) => {
        setOverview(ov);
        setWorks(dash.dashboard?.works || []);
        setBoards(dash.dashboard?.boards || []);
      })
      .catch((err) => toast.error(errMsg(err)))
      .finally(() => setLoading(false));
    loadTrends(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadTrends(days);
  }, [days]);

  const removeWork = async (id) => {
    if (!window.confirm('Delete this work?')) return;
    try {
      await workApi.remove(id);
      setWorks((w) => w.filter((x) => x._id !== id));
      if (workInsight?.id === id) setWorkInsight(null);
      toast.success('Deleted');
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const openWorkInsight = async (w) => {
    if (workInsight?.id === w._id) { setWorkInsight(null); return; }
    setWorkInsight({ id: w._id, title: w.title, series: null });
    try {
      const r = await insightApi.work(w._id, 30);
      setWorkInsight({ id: w._id, title: w.title, series: r.series || [] });
    } catch {
      setWorkInsight(null);
    }
  };

  if (loading) return <Spinner full />;

  const totals = overview?.totals || {};

  return (
    <div className="container-x py-12">
      <p className="label">Content Insights</p>
      <h1 className="mt-2 font-display text-4xl font-black text-ink sm:text-5xl">Dashboard</h1>

      {/* Stat cards */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {STAT_CARDS.map(({ key, label, icon: Icon, color }) => (
          <div key={key} className="rounded-card bg-white p-5 shadow-soft ring-1 ring-ink/5">
            <Icon className={`h-5 w-5 ${color}`} />
            <p className="mt-3 font-display text-3xl font-black text-ink">{totals[key] ?? 0}</p>
            <p className="font-mono text-[11px] uppercase tracking-wider text-ink/40">{label}</p>
          </div>
        ))}
      </div>

      {/* Trend chart */}
      <section className="mt-10 rounded-card bg-white p-6 shadow-soft ring-1 ring-ink/5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Engagement trends</h2>
          <div className="flex gap-2">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-wider ${
                  days === d ? 'bg-ink text-white' : 'text-ink/50 hover:text-ink'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gV" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1f43ff" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#1f43ff" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gL" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#c4137f" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#c4137f" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#999' }} tickFormatter={(d) => d?.slice(5)} />
              <YAxis tick={{ fontSize: 11, fill: '#999' }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="views" stroke="#1f43ff" fill="url(#gV)" strokeWidth={2} />
              <Area type="monotone" dataKey="likes" stroke="#c4137f" fill="url(#gL)" strokeWidth={2} />
              <Area type="monotone" dataKey="saves" stroke="#8a7a12" fillOpacity={0} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* My works */}
      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Your works</h2>
          <Link to="/upload" className="btn-magenta">
            <Plus className="h-4 w-4" /> Upload
          </Link>
        </div>
        {works.length === 0 ? (
          <EmptyState message="No uploads yet." action={<Link to="/upload" className="btn-dark">Upload your first work</Link>} />
        ) : (
          <div className="overflow-hidden rounded-card ring-1 ring-ink/10">
            {works.map((w) => (
              <div key={w._id}>
                <div className="flex items-center gap-4 border-b border-ink/5 bg-white p-3 last:border-0">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-cream">
                    {w.thumbnailUrl ? (
                      <img src={w.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-ink/30"><ImageIcon className="h-5 w-5" /></div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link to={`/works/${w._id}`} className="block truncate font-semibold text-ink hover:text-magenta">
                      {w.title}
                    </Link>
                    <p className="font-mono text-[11px] uppercase tracking-wider text-ink/40">
                      {w.category} · {w.viewCount} views · {w.likeCount} likes
                    </p>
                  </div>
                  <button
                    onClick={() => openWorkInsight(w)}
                    title="Per-work insights"
                    className={`text-ink/30 hover:text-royal ${workInsight?.id === w._id ? 'text-royal' : ''}`}
                  >
                    <TrendingUp className="h-4 w-4" />
                  </button>
                  <button onClick={() => removeWork(w._id)} className="text-ink/30 hover:text-magenta">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Expandable per-work insight chart */}
                {workInsight?.id === w._id && (
                  <div className="border-b border-ink/5 bg-cream/40 px-4 py-5">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="font-mono text-[11px] uppercase tracking-wider text-ink/50">
                        30-day engagement · {w.title}
                      </p>
                      <button onClick={() => setWorkInsight(null)} className="text-ink/30 hover:text-ink">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    {workInsight.series === null ? (
                      <p className="text-sm text-ink/40">Loading…</p>
                    ) : workInsight.series.length === 0 ? (
                      <p className="text-sm text-ink/40">No engagement data yet for this work.</p>
                    ) : (
                      <div className="h-40 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={workInsight.series} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                            <defs>
                              <linearGradient id="gwV" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#1f43ff" stopOpacity={0.25} />
                                <stop offset="95%" stopColor="#1f43ff" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#999' }} tickFormatter={(d) => d?.slice(5)} />
                            <YAxis tick={{ fontSize: 10, fill: '#999' }} allowDecimals={false} />
                            <Tooltip />
                            <Area type="monotone" dataKey="views" stroke="#1f43ff" fill="url(#gwV)" strokeWidth={2} />
                            <Area type="monotone" dataKey="likes" stroke="#c4137f" fillOpacity={0} strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* My boards */}
      {boards.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 font-display text-xl font-bold">Your boards</h2>
          <div className="flex flex-wrap gap-3">
            {boards.map((b) => (
              <Link
                key={b._id}
                to={`/boards/${b._id}`}
                className="rounded-full bg-cream px-4 py-2 text-sm font-medium text-ink ring-1 ring-ink/10 hover:bg-ink hover:text-white"
              >
                {b.name} · {b.works?.length || 0}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
