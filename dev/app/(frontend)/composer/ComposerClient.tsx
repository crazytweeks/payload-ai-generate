'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type {
  AIConversationMessage,
  AIGenerationArtifact,
  AIGenerationEvent,
  AIGenerationRunSummary,
  AIReferenceDataSource,
} from '../../../../src/ai-types';

// ─── helpers ────────────────────────────────────────────────────────────────

const escapeClosingTag = (str: string, tag: string) =>
  str.replace(new RegExp(`</${tag}`, 'gi'), `<\\/${tag}`);

const buildSrcdoc = (html: string, css: string, js: string, dataJSON: string) => {
  const safeCss = css ? escapeClosingTag(css, 'style') : '';
  const safeData = escapeClosingTag(dataJSON || 'null', 'script');
  const safeJs = js ? escapeClosingTag(js, 'script') : '';
  return [
    '<!DOCTYPE html><html lang="en"><head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    safeCss ? `<style>${safeCss}</style>` : '',
    '</head><body>',
    html,
    safeJs
      ? `<script>(function(){try{var CMS_DATA=${safeData};${safeJs}}catch(e){console.error(e)}})()</script>`
      : '',
    '</body></html>',
  ]
    .filter(Boolean)
    .join('');
};

// ─── types ───────────────────────────────────────────────────────────────────

type ActivityItem = {
  id: string;
  kind: 'status' | 'tool-call' | 'tool-result' | 'reference' | 'repair' | 'error';
  label: string;
  detail?: string;
};

type Artifact = {
  html: string;
  css: string;
  js: string;
  variablesJSON: string;
  dataJSON: string;
  blockPayloadJSON: string;
};

type ReferenceRow = { id: string; collection: string; limit: number };

type OutputTab = 'preview' | 'html' | 'css' | 'js' | 'block';

// ─── styles ──────────────────────────────────────────────────────────────────

const S = {
  page: {
    display: 'grid',
    gridTemplateColumns: '340px 1fr',
    gap: '1.5rem',
    minHeight: '100vh',
    padding: '1.5rem',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '14px',
    background: '#0f0f11',
    color: '#e2e2e8',
  } as React.CSSProperties,

  panel: {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '10px',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
  },

  label: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: '#a1a1aa',
    marginBottom: '4px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  },

  input: {
    width: '100%',
    padding: '8px 10px',
    background: '#09090b',
    border: '1px solid #27272a',
    borderRadius: '6px',
    color: '#e2e2e8',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },

  textarea: {
    width: '100%',
    padding: '8px 10px',
    background: '#09090b',
    border: '1px solid #27272a',
    borderRadius: '6px',
    color: '#e2e2e8',
    fontSize: '14px',
    outline: 'none',
    resize: 'vertical' as const,
    minHeight: '110px',
    boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
  },

  select: {
    width: '100%',
    padding: '8px 10px',
    background: '#09090b',
    border: '1px solid #27272a',
    borderRadius: '6px',
    color: '#e2e2e8',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },

  button: (variant: 'primary' | 'ghost' | 'danger' = 'primary'): React.CSSProperties => ({
    padding: '8px 14px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    ...(variant === 'primary' && { background: '#7c3aed', color: '#fff' }),
    ...(variant === 'ghost' && { background: '#27272a', color: '#a1a1aa' }),
    ...(variant === 'danger' && { background: '#3f1010', color: '#f87171' }),
  }),

  badge: (color: string): React.CSSProperties => ({
    display: 'inline-block',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 600,
    background: color,
    color: '#fff',
  }),

  code: {
    display: 'block',
    width: '100%',
    padding: '10px 12px',
    background: '#09090b',
    border: '1px solid #27272a',
    borderRadius: '6px',
    color: '#a5b4fc',
    fontSize: '12px',
    fontFamily: 'monospace',
    whiteSpace: 'pre' as const,
    overflowX: 'auto' as const,
    maxHeight: '360px',
    overflowY: 'auto' as const,
    boxSizing: 'border-box' as const,
    margin: 0,
  },
} as const;

// ─── component ───────────────────────────────────────────────────────────────

export function ComposerClient({
  presets,
  referenceCollections,
}: {
  presets: { id: string; title: string }[];
  referenceCollections: string[];
}) {
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [followup, setFollowup] = useState('');
  const [presetId, setPresetId] = useState('');
  const [references, setReferences] = useState<ReferenceRow[]>([]);

  const [artifact, setArtifact] = useState<Artifact>({
    html: '',
    css: '',
    js: '',
    variablesJSON: '[]',
    dataJSON: '{}',
    blockPayloadJSON: '',
  });
  const [messages, setMessages] = useState<AIConversationMessage[]>([]);
  const [lastRun, setLastRun] = useState<AIGenerationRunSummary | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<OutputTab>('preview');

  const abortRef = useRef<AbortController | null>(null);
  const activityEndRef = useRef<HTMLDivElement | null>(null);
  const pendingUserMsg = useRef<AIConversationMessage | null>(null);

  const hasOutput = Boolean(artifact.html || artifact.css || artifact.js);
  const hasHistory = messages.length > 0;

  const addActivity = useCallback((item: Omit<ActivityItem, 'id'>) => {
    setActivity((prev) => [...prev, { ...item, id: crypto.randomUUID() }]);
    setTimeout(() => activityEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  const applyEvent = useCallback(
    (event: AIGenerationEvent) => {
      switch (event.type) {
        case 'status':
          addActivity({
            kind: event.stage === 'repairing' ? 'repair' : 'status',
            label: event.stage.charAt(0).toUpperCase() + event.stage.slice(1).replace(/-/g, ' '),
            detail: event.message,
          });
          break;
        case 'tool-call':
          addActivity({
            kind: 'tool-call',
            label: `Tool: ${event.toolName}`,
            detail: event.summary,
          });
          break;
        case 'tool-result':
          addActivity({
            kind: 'tool-result',
            label: `Result: ${event.toolName}`,
            detail: event.summary,
          });
          break;
        case 'references':
          addActivity({
            kind: 'reference',
            label: `References (${event.items.length})`,
            detail: event.items.map((i) => i.label).join(', '),
          });
          break;
        case 'repair-start':
          addActivity({
            kind: 'repair',
            label: `Repair ${event.attempt}/${event.maxAttempts}`,
            detail: event.reason,
          });
          break;
        case 'repair-result':
          addActivity({
            kind: event.fixed ? 'repair' : 'error',
            label: event.fixed ? 'Repair OK' : `Repair ${event.attempt} failed`,
            detail: event.message,
          });
          break;
        case 'field-update':
          setArtifact((a) => ({
            ...a,
            [event.field === 'blockPayloadJSON' ? 'blockPayloadJSON' : event.field]: event.value,
          }));
          break;
        case 'final':
          setArtifact({
            html: event.html,
            css: event.css,
            js: event.js,
            variablesJSON: event.variablesJSON,
            dataJSON: event.dataJSON,
            blockPayloadJSON: JSON.stringify(event.blockPayload, null, 2),
          });
          setLastRun(event.run);
          setMessages((prev) => [
            ...prev,
            ...(pendingUserMsg.current ? [pendingUserMsg.current] : []),
            {
              content: JSON.stringify(event.blockPayload),
              createdAt: new Date().toISOString(),
              metadata: {
                modelId: event.run.modelId,
                outcome: event.run.outcome,
                provider: event.run.provider,
                source: 'followup',
              },
              role: 'assistant',
            },
          ]);
          pendingUserMsg.current = null;
          setActiveTab('preview');
          break;
        case 'error':
          setError(event.message);
          addActivity({ kind: 'error', label: 'Error', detail: event.message });
          if (event.run) {
            setLastRun(event.run);
          }
          break;
        default:
          break;
      }
    },
    [addActivity]
  );

  const generate = useCallback(
    async (mode: 'generate' | 'followup' | 'retry-fix') => {
      setError(null);
      setIsGenerating(true);
      setActivity([]);

      const followupText =
        mode === 'retry-fix'
          ? 'Fix the previous generation using the current artifact and the last error.'
          : followup.trim();

      pendingUserMsg.current = {
        content: mode === 'generate' ? instructions : followupText,
        createdAt: new Date().toISOString(),
        metadata: {
          source:
            mode === 'generate' ? 'instructions' : mode === 'retry-fix' ? 'repair' : 'followup',
        },
        role: 'user',
      };

      const currentArtifact: AIGenerationArtifact = {
        html: artifact.html,
        css: artifact.css,
        js: artifact.js,
        variablesJSON: artifact.variablesJSON,
        dataJSON: artifact.dataJSON,
      };

      const refs: AIReferenceDataSource[] = references
        .filter((r) => r.collection.trim())
        .map((r) => ({ collection: r.collection, limit: r.limit, dataLoading: 'server' }));

      abortRef.current = new AbortController();

      try {
        const res = await fetch('/api/ai-generate/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
          signal: abortRef.current.signal,
          body: JSON.stringify({
            title: title.trim() || undefined,
            instructions,
            followup: followupText || undefined,
            messages,
            mode,
            presetId: presetId || undefined,
            currentArtifact,
            references: refs.length ? refs : undefined,
            stream: true,
          }),
        });

        if (!res.ok) {
          const json = (await res.json()) as { error?: string };
          throw new Error(json.error ?? 'Generation failed');
        }

        if (!res.body) {
          throw new Error('No response body');
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const line of lines) {
            const t = line.trim();
            if (t) applyEvent(JSON.parse(t) as AIGenerationEvent);
          }
        }

        if (buf.trim()) {
          applyEvent(JSON.parse(buf.trim()) as AIGenerationEvent);
        }

        if (mode !== 'generate') setFollowup('');
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          addActivity({ kind: 'status', label: 'Cancelled' });
        } else {
          const msg = err instanceof Error ? err.message : 'Generation failed';
          setError(msg);
        }
      } finally {
        abortRef.current = null;
        pendingUserMsg.current = null;
        setIsGenerating(false);
      }
    },
    [
      addActivity,
      applyEvent,
      artifact,
      followup,
      instructions,
      messages,
      presetId,
      references,
      title,
    ]
  );

  const srcdoc = useMemo(
    () => buildSrcdoc(artifact.html, artifact.css, artifact.js, artifact.dataJSON),
    [artifact.html, artifact.css, artifact.js, artifact.dataJSON]
  );

  const addReference = () => {
    setReferences((prev) => [...prev, { id: crypto.randomUUID(), collection: '', limit: 10 }]);
  };

  const removeReference = (id: string) => {
    setReferences((prev) => prev.filter((r) => r.id !== id));
  };

  const updateReference = (id: string, field: 'collection' | 'limit', value: string | number) => {
    setReferences((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const kindColor: Record<ActivityItem['kind'], string> = {
    status: '#3f3f46',
    'tool-call': '#1e3a5f',
    'tool-result': '#1a3a2a',
    reference: '#2d2a4a',
    repair: '#3b2a12',
    error: '#3f1010',
  };

  const outcomeColor = lastRun
    ? lastRun.outcome.startsWith('failed')
      ? '#f87171'
      : '#4ade80'
    : null;

  return (
    <div style={{ ...S.page, maxWidth: '100%' }}>
      {/* ── Left panel: inputs ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={S.panel}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#f4f4f5' }}>AI Composer</div>

          {/* Title */}
          <div>
            <label htmlFor="composer-title" style={S.label}>
              Title
            </label>
            <input
              id="composer-title"
              style={S.input}
              placeholder="Pricing block…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Instructions */}
          <div>
            <label htmlFor="composer-instructions" style={S.label}>
              Instructions
            </label>
            <textarea
              id="composer-instructions"
              style={S.textarea}
              placeholder="Describe the block to generate…"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </div>

          {/* Preset */}
          {presets.length > 0 && (
            <div>
              <label htmlFor="composer-preset" style={S.label}>
                Preset
              </label>
              <select
                id="composer-preset"
                style={S.select}
                value={presetId}
                onChange={(e) => setPresetId(e.target.value)}
              >
                <option value="">— none —</option>
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {!isGenerating ? (
              <button
                type="button"
                style={S.button('primary')}
                disabled={!instructions.trim()}
                onClick={() => generate('generate')}
              >
                Generate
              </button>
            ) : (
              <button
                type="button"
                style={S.button('danger')}
                onClick={() => abortRef.current?.abort()}
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Reference collections */}
        <div style={S.panel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#a1a1aa' }}>
              Reference Collections
            </span>
            <button
              type="button"
              style={{ ...S.button('ghost'), padding: '4px 10px', fontSize: '12px' }}
              onClick={addReference}
            >
              + Add
            </button>
          </div>

          {references.length === 0 && (
            <p style={{ fontSize: '12px', color: '#52525b', margin: 0 }}>
              No reference data. Add a collection to inject query results into the prompt.
            </p>
          )}

          {references.map((ref) => (
            <div
              key={ref.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 60px 24px',
                gap: '6px',
                alignItems: 'center',
              }}
            >
              {referenceCollections.length > 0 ? (
                <select
                  style={{ ...S.select, fontSize: '13px', padding: '6px 8px' }}
                  value={ref.collection}
                  onChange={(e) => updateReference(ref.id, 'collection', e.target.value)}
                >
                  <option value="">— pick —</option>
                  {referenceCollections.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  style={{ ...S.input, fontSize: '13px', padding: '6px 8px' }}
                  placeholder="collection-slug"
                  value={ref.collection}
                  onChange={(e) => updateReference(ref.id, 'collection', e.target.value)}
                />
              )}
              <input
                style={{
                  ...S.input,
                  fontSize: '13px',
                  padding: '6px 8px',
                  textAlign: 'center' as const,
                }}
                type="number"
                min={1}
                max={100}
                value={ref.limit}
                onChange={(e) => updateReference(ref.id, 'limit', Number(e.target.value))}
              />
              <button
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#71717a',
                  cursor: 'pointer',
                  fontSize: '16px',
                  padding: 0,
                }}
                onClick={() => removeReference(ref.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {/* Follow-up (only when there's output) */}
        {(hasHistory || hasOutput) && (
          <div style={S.panel}>
            <label htmlFor="composer-followup" style={S.label}>
              Follow-up
            </label>
            <textarea
              id="composer-followup"
              style={{ ...S.textarea, minHeight: '72px' }}
              placeholder="Make the heading bolder, change colours to blue…"
              value={followup}
              onChange={(e) => setFollowup(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              {!isGenerating ? (
                <>
                  <button
                    type="button"
                    style={S.button('primary')}
                    disabled={!followup.trim()}
                    onClick={() => generate('followup')}
                  >
                    Follow-up
                  </button>
                  {lastRun?.outcome?.startsWith('failed') && (
                    <button
                      type="button"
                      style={S.button('ghost')}
                      onClick={() => generate('retry-fix')}
                    >
                      Retry Fix
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  style={S.button('danger')}
                  onClick={() => abortRef.current?.abort()}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}

        {/* Last run metadata */}
        {lastRun && (
          <div style={{ ...S.panel, padding: '0.75rem', gap: '6px' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={S.badge(outcomeColor ?? '#3f3f46')}>{lastRun.outcome}</span>
              <span style={S.badge('#27272a')}>{lastRun.provider}</span>
              <span style={{ fontSize: '11px', color: '#52525b', fontFamily: 'monospace' }}>
                {lastRun.modelId}
              </span>
            </div>
            {lastRun.repairAttemptsUsed > 0 && (
              <div style={{ fontSize: '11px', color: '#a16207' }}>
                Repaired {lastRun.repairAttemptsUsed}/{lastRun.maxRepairAttempts}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Right panel: output ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>
        {/* Activity log */}
        {(isGenerating || activity.length > 0) && (
          <div style={{ ...S.panel, maxHeight: '220px', overflowY: 'auto', gap: '4px' }}>
            <div
              style={{ fontSize: '12px', fontWeight: 600, color: '#a1a1aa', marginBottom: '4px' }}
            >
              Activity {isGenerating && <span style={{ color: '#7c3aed' }}>●</span>}
            </div>
            {activity.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  gap: '8px',
                  padding: '5px 8px',
                  borderRadius: '5px',
                  background: kindColor[item.kind],
                  fontSize: '12px',
                }}
              >
                <span style={{ fontWeight: 600, whiteSpace: 'nowrap', color: '#e2e2e8' }}>
                  {item.label}
                </span>
                {item.detail && (
                  <span
                    style={{
                      color: '#a1a1aa',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.detail}
                  </span>
                )}
              </div>
            ))}
            <div ref={activityEndRef} />
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div
            style={{
              padding: '10px 12px',
              background: '#3f1010',
              border: '1px solid #7f1d1d',
              borderRadius: '6px',
              color: '#f87171',
              fontSize: '13px',
            }}
          >
            {error}
          </div>
        )}

        {/* Output tabs + content */}
        {hasOutput && (
          <div style={S.panel}>
            {/* Tab bar */}
            <div
              style={{
                display: 'flex',
                gap: '4px',
                borderBottom: '1px solid #27272a',
                paddingBottom: '8px',
              }}
            >
              {(['preview', 'html', 'css', 'js', 'block'] as OutputTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '5px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: 'none',
                    background: activeTab === tab ? '#7c3aed' : 'transparent',
                    color: activeTab === tab ? '#fff' : '#71717a',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {tab}
                </button>
              ))}
              <div style={{ marginLeft: 'auto' }}>
                <button
                  type="button"
                  style={{ ...S.button('ghost'), padding: '4px 10px', fontSize: '11px' }}
                  onClick={() => {
                    const text =
                      activeTab === 'html'
                        ? artifact.html
                        : activeTab === 'css'
                          ? artifact.css
                          : activeTab === 'js'
                            ? artifact.js
                            : activeTab === 'block'
                              ? artifact.blockPayloadJSON
                              : '';
                    if (text) navigator.clipboard.writeText(text);
                  }}
                >
                  Copy
                </button>
              </div>
            </div>

            {/* Tab content */}
            {activeTab === 'preview' && (
              <iframe
                sandbox="allow-scripts"
                srcDoc={srcdoc}
                style={{
                  width: '100%',
                  minHeight: '420px',
                  border: 'none',
                  borderRadius: '6px',
                  background: '#fff',
                }}
                title="Preview"
              />
            )}

            {activeTab === 'html' && <pre style={S.code}>{artifact.html || '—'}</pre>}

            {activeTab === 'css' && <pre style={S.code}>{artifact.css || '—'}</pre>}

            {activeTab === 'js' && <pre style={S.code}>{artifact.js || '—'}</pre>}

            {activeTab === 'block' && (
              <pre style={{ ...S.code, color: '#86efac' }}>{artifact.blockPayloadJSON || '—'}</pre>
            )}
          </div>
        )}

        {/* Empty state */}
        {!hasOutput && !isGenerating && !error && (
          <div
            style={{
              ...S.panel,
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '300px',
              color: '#52525b',
              fontSize: '14px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>✦</div>
            <div>Enter instructions and click Generate</div>
          </div>
        )}
      </div>
    </div>
  );
}
