'use client';

import { ChevronLeft, ChevronRight, Clock, Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type SessionItem = {
  id: string;
  title: string;
  updatedAt: string;
};

type Props = {
  activeSessionId?: string;
  onNewSession: () => void;
  onSelectSession: (id: string) => void;
};

function formatDate(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

export function SessionsSidebar({ activeSessionId, onNewSession, onSelectSession }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/ai-generate/composer-session');
      if (!res.ok) return;
      const data = (await res.json()) as { sessions: SessionItem[] };
      setSessions(data.sessions);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  // Refresh list when active session changes (new session saved)
  useEffect(() => {
    if (activeSessionId) {
      void fetchSessions();
    }
  }, [activeSessionId, fetchSessions]);

  if (collapsed) {
    return (
      <div className="flex w-11 shrink-0 flex-col items-center border-r border-zinc-800 bg-[#15171b] py-3 gap-3">
        <button
          aria-label="Expand sessions"
          className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          onClick={() => setCollapsed(false)}
          title="Expand sessions"
          type="button"
        >
          <ChevronRight size={16} />
        </button>
        <button
          aria-label="New session"
          className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          onClick={onNewSession}
          title="New session"
          type="button"
        >
          <Plus size={16} />
        </button>
        <div className="mt-2 flex flex-col gap-1">
          {sessions.slice(0, 8).map((session) => (
            <button
              aria-label={session.title}
              className={`flex h-7 w-7 items-center justify-center rounded text-xs ${
                session.id === activeSessionId
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'text-zinc-600 hover:bg-zinc-800 hover:text-zinc-300'
              }`}
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              title={session.title}
              type="button"
            >
              <Clock size={13} />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-56 shrink-0 flex-col border-r border-zinc-800 bg-[#15171b]">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-zinc-800 px-3">
        <span className="text-xs font-semibold uppercase text-zinc-500">Sessions</span>
        <div className="flex items-center gap-1">
          <button
            aria-label="New session"
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            onClick={onNewSession}
            title="New session"
            type="button"
          >
            <Plus size={14} />
          </button>
          <button
            aria-label="Collapse sessions"
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            onClick={() => setCollapsed(true)}
            title="Collapse sessions"
            type="button"
          >
            <ChevronLeft size={14} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-3 text-xs text-zinc-600">Loading…</div>
        ) : sessions.length === 0 ? (
          <div className="p-3 text-xs text-zinc-600">No sessions yet.</div>
        ) : (
          <ul className="py-1">
            {sessions.map((session) => (
              <li key={session.id}>
                <button
                  className={`group w-full rounded-none px-3 py-2 text-left transition-colors ${
                    session.id === activeSessionId
                      ? 'bg-cyan-500/10 text-cyan-300'
                      : 'text-zinc-300 hover:bg-zinc-800/60'
                  }`}
                  onClick={() => onSelectSession(session.id)}
                  type="button"
                >
                  <p className="truncate text-xs font-medium leading-tight">{session.title}</p>
                  <p className="mt-0.5 text-[10px] text-zinc-600 group-hover:text-zinc-500">
                    {formatDate(session.updatedAt)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
