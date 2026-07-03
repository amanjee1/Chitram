import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Layers, Users } from 'lucide-react';
import Spinner from '../components/Spinner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { boardApi, errMsg } from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

function BoardCard({ board }) {
  return (
    <Link
      to={`/boards/${board._id}`}
      className="group block overflow-hidden rounded-card bg-white shadow-soft ring-1 ring-ink/5 transition hover:-translate-y-1"
    >
      <div className="aspect-[4/3] overflow-hidden bg-gradient-to-br from-magenta/20 via-royal/15 to-olive/20">
        {board.coverImage ? (
          <img src={board.coverImage} alt={board.name} className="h-full w-full object-cover transition group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center text-ink/30">
            <Layers className="h-10 w-10" />
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-ink line-clamp-1">{board.name}</h3>
          {board.isCollaborative && <Users className="h-4 w-4 text-royal" title="Collaborative" />}
        </div>
        <p className="mt-1 text-xs text-ink/50">
          {board.works?.length || 0} works · @{board.owner?.username}
        </p>
      </div>
    </Link>
  );
}

export default function Collections() {
  const { isAuthed } = useAuth();
  const toast = useToast();
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mine, setMine] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', isCollaborative: false });

  const load = () => {
    setLoading(true);
    boardApi
      .list(mine ? { mine: true } : {})
      .then((r) => setBoards(r.items || []))
      .catch((err) => toast.error(errMsg(err)))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [mine]);

  const create = async (e) => {
    e.preventDefault();
    try {
      await boardApi.create(form);
      toast.success('Board created');
      setForm({ name: '', description: '', isCollaborative: false });
      setCreating(false);
      setMine(true);
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <div className="container-x py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">Curated Galleries</p>
          <h1 className="mt-2 font-display text-4xl font-black text-ink sm:text-5xl">Collections</h1>
        </div>
        {isAuthed && (
          <button onClick={() => setCreating((c) => !c)} className="btn-magenta">
            <Plus className="h-4 w-4" /> New board
          </button>
        )}
      </div>

      {isAuthed && (
        <div className="mt-6 flex gap-2">
          {[
            { v: false, label: 'All public' },
            { v: true, label: 'My boards' },
          ].map((t) => (
            <button
              key={String(t.v)}
              onClick={() => setMine(t.v)}
              className={`rounded-full px-4 py-1.5 font-mono text-xs uppercase tracking-wider ${
                mine === t.v ? 'bg-ink text-white' : 'text-ink/50 hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {creating && (
        <form onSubmit={create} className="mt-6 rounded-card border border-ink/10 bg-cream/40 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <input
              className="input"
              placeholder="Board name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <input
              className="input"
              placeholder="Description (optional)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm text-ink/70">
            <input
              type="checkbox"
              checked={form.isCollaborative}
              onChange={(e) => setForm({ ...form, isCollaborative: e.target.checked })}
            />
            Make this a collaborative board (invite others to add works)
          </label>
          <button className="btn-dark mt-4">Create board</button>
        </form>
      )}

      <div className="mt-10">
        {loading ? (
          <Spinner label="Loading boards" />
        ) : boards.length === 0 ? (
          <EmptyState message={mine ? 'You have no boards yet — create one above.' : 'No public boards yet.'} />
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {boards.map((b) => (
              <BoardCard key={b._id} board={b} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
