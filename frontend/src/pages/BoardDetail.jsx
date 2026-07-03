import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Trash2, UserPlus, Users, X } from 'lucide-react';
import Spinner from '../components/Spinner.jsx';
import WorkCard from '../components/WorkCard.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { boardApi, errMsg } from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function BoardDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [collabName, setCollabName] = useState('');

  const uid = user?._id;

  const load = () => {
    setLoading(true);
    boardApi
      .get(id)
      .then(({ board: b }) => setBoard(b))
      .catch((err) => toast.error(errMsg(err)))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [id]);

  if (loading) return <Spinner full />;
  if (!board) return null;

  const isOwner = uid && (board.owner?._id === uid || board.owner === uid);
  const isCollaborator = board.collaborators?.some((c) => (c._id || c) === uid);
  const canEdit = isOwner || (board.isCollaborative && isCollaborator);

  const removeWork = async (workId) => {
    try {
      await boardApi.removeWork(id, workId);
      setBoard((b) => ({ ...b, works: b.works.filter((w) => w._id !== workId) }));
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const addCollaborator = async (e) => {
    e.preventDefault();
    if (!collabName.trim()) return;
    try {
      const { board: b } = await boardApi.addCollaborator(id, collabName.trim());
      setBoard(b);
      setCollabName('');
      toast.success('Collaborator added');
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const removeCollaborator = async (userId) => {
    try {
      await boardApi.removeCollaborator(id, userId);
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const deleteBoard = async () => {
    if (!window.confirm('Delete this board?')) return;
    try {
      await boardApi.remove(id);
      toast.success('Board deleted');
      navigate('/collections');
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <div className="container-x py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label">Collection · @{board.owner?.username}</p>
          <h1 className="mt-2 font-display text-4xl font-black text-ink sm:text-5xl">{board.name}</h1>
          {board.description && <p className="mt-3 max-w-xl text-ink/60">{board.description}</p>}
          <p className="mt-2 font-mono text-xs uppercase tracking-wider text-ink/40">
            {board.works?.length || 0} works
            {board.isCollaborative && ' · collaborative'}
          </p>
        </div>
        {isOwner && (
          <button onClick={deleteBoard} className="btn border border-ink/15 px-5 py-2.5 text-magenta hover:bg-magenta hover:text-white">
            <Trash2 className="h-4 w-4" /> Delete board
          </button>
        )}
      </div>

      {/* Collaborators (owner only management) */}
      {(board.isCollaborative || board.collaborators?.length > 0) && (
        <div className="mt-6 rounded-card border border-ink/10 bg-cream/40 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Users className="h-4 w-4 text-royal" /> Collaborators
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {board.collaborators?.length ? (
              board.collaborators.map((c) => (
                <span key={c._id} className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm ring-1 ring-ink/10">
                  @{c.username}
                  {isOwner && (
                    <button onClick={() => removeCollaborator(c._id)} className="text-ink/30 hover:text-magenta">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </span>
              ))
            ) : (
              <span className="text-sm text-ink/40">No collaborators yet.</span>
            )}
          </div>
          {isOwner && (
            <form onSubmit={addCollaborator} className="mt-4 flex max-w-sm gap-2">
              <input
                className="input"
                placeholder="username to invite"
                value={collabName}
                onChange={(e) => setCollabName(e.target.value)}
              />
              <button className="btn-dark px-4">
                <UserPlus className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>
      )}

      {/* Works */}
      <div className="mt-10">
        {board.works?.length ? (
          <div className="masonry">
            {board.works.map((w) => (
              <div key={w._id} className="relative">
                <WorkCard work={w} />
                {canEdit && (
                  <button
                    onClick={() => removeWork(w._id)}
                    className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-magenta shadow hover:bg-magenta hover:text-white"
                    title="Remove from board"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="No works in this board yet. Open a work and use “Add to board”." />
        )}
      </div>
    </div>
  );
}
