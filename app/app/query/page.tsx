'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface NodeResult {
  id: string;
  title: string;
  type: string;
  scope?: string;
  tags?: string[];
  snippet?: string;
}

function QueryContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<NodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (initialQuery) {
      runQuery(initialQuery);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function runQuery(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      setResults(data.nodes || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    runQuery(query);
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/" className="text-sm text-cn-muted hover:text-cn-accent transition-colors">
          Home
        </Link>
        <span className="text-cn-muted mx-2">/</span>
        <span className="text-sm text-cn-text">Query Builder</span>
      </div>

      <h1 className="text-2xl font-bold text-white mb-6">Query Builder</h1>

      {/* Query Input */}
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="#tag, type:document, [[Title]], combine with + (AND), | (OR), - (NOT)"
            className="flex-1 px-4 py-3 bg-cn-surface border border-cn-border rounded-lg text-cn-text placeholder-cn-muted focus:outline-none focus:border-cn-accent transition-colors"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-cn-accent text-white font-medium rounded-lg hover:bg-cn-accent/80 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Querying...' : 'Query'}
          </button>
        </div>
        <div className="mt-2 text-xs text-cn-muted">
          Examples: <code className="text-cn-accent">#onboarding</code>{' '}
          <code className="text-cn-accent">type:document</code>{' '}
          <code className="text-cn-accent">#guide + type:document</code>{' '}
          <code className="text-cn-accent">#ops | #engineering</code>{' '}
          <code className="text-cn-accent">type:document - #deprecated</code>
        </div>
      </form>

      {/* Results */}
      {searched && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">
            Results ({results.length})
          </h2>

          {results.length === 0 ? (
            <div className="bg-cn-surface border border-cn-border rounded-lg p-8 text-center">
              <p className="text-cn-muted">No nodes match your query.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.map(node => (
                <Link
                  key={node.id}
                  href={`/node/${encodeURIComponent(node.title)}`}
                  className="block bg-cn-surface border border-cn-border rounded-lg p-4 hover:border-cn-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-cn-accent font-medium">{node.title}</h3>
                      {node.snippet && (
                        <p className="text-sm text-cn-muted mt-1 line-clamp-2">{node.snippet}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2 py-0.5 text-xs bg-cn-border/50 text-cn-muted rounded capitalize">
                        {node.type}
                      </span>
                      {node.scope && node.scope !== 'public' && (
                        <span className="px-2 py-0.5 text-xs bg-cn-yellow/10 text-cn-yellow rounded">
                          {node.scope}
                        </span>
                      )}
                    </div>
                  </div>
                  {node.tags && node.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {node.tags.map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 text-xs bg-cn-accent/10 text-cn-accent rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function QueryPage() {
  return (
    <Suspense fallback={<div className="p-8 text-cn-muted">Loading...</div>}>
      <QueryContent />
    </Suspense>
  );
}
