import Link from 'next/link';
import { getAllNodes } from '@/lib/vault';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const nodes = await getAllNodes();
  const types = [...new Set(nodes.map(n => n.type))].sort();
  const allTags = [...new Set(nodes.flatMap(n => n.tags || []))].sort();

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Context Vault</h1>
        <p className="text-cn-muted">
          {nodes.length} nodes across {types.length} types
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {types.map(type => {
          const count = nodes.filter(n => n.type === type).length;
          return (
            <div key={type} className="bg-cn-surface border border-cn-border rounded-lg p-4">
              <div className="text-2xl font-bold text-white">{count}</div>
              <div className="text-sm text-cn-muted capitalize">{type}s</div>
            </div>
          );
        })}
      </div>

      {/* Search / Query Link */}
      <div className="mb-8">
        <Link
          href="/query"
          className="inline-flex items-center gap-2 px-4 py-2 bg-cn-accent/10 text-cn-accent border border-cn-accent/30 rounded-lg hover:bg-cn-accent/20 transition-colors"
        >
          Open Query Builder
        </Link>
      </div>

      {/* Tags */}
      {allTags.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">Tags</h2>
          <div className="flex flex-wrap gap-2">
            {allTags.map(tag => (
              <Link
                key={tag}
                href={`/query?q=${encodeURIComponent(tag)}`}
                className="px-2.5 py-1 text-xs bg-cn-accent/10 text-cn-accent rounded-full hover:bg-cn-accent/20 transition-colors"
              >
                {tag}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* All Nodes Table */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">All Nodes</h2>
        <div className="bg-cn-surface border border-cn-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-cn-border">
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-cn-muted">Title</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-cn-muted">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-cn-muted">Scope</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-cn-muted">Tags</th>
              </tr>
            </thead>
            <tbody>
              {nodes.sort((a, b) => a.title.localeCompare(b.title)).map(node => (
                <tr key={node.id} className="border-b border-cn-border/50 hover:bg-cn-border/20 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/node/${encodeURIComponent(node.title)}`}
                      className="text-cn-accent hover:underline"
                    >
                      {node.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-cn-muted capitalize">{node.type}</td>
                  <td className="px-4 py-3 text-sm text-cn-muted">{node.scope || 'public'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(node.tags || []).map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 text-xs bg-cn-border/50 text-cn-muted rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
