import { getNodeByTitle, getAllNodes } from '@/lib/vault';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';

export const dynamic = 'force-dynamic';

export default async function NodePage({ params }: { params: { title: string } }) {
  const decodedTitle = decodeURIComponent(params.title);
  const node = await getNodeByTitle(decodedTitle);

  if (!node) {
    notFound();
  }

  // Find backlinks: nodes whose content references this node's title
  const allNodes = await getAllNodes();
  const backlinks = allNodes.filter(
    n => n.id !== node.id && n.content?.toLowerCase().includes(node.title.toLowerCase())
  );

  return (
    <div className="flex h-full">
      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          {/* Breadcrumb */}
          <div className="mb-6">
            <Link href="/" className="text-sm text-cn-muted hover:text-cn-accent transition-colors">
              Home
            </Link>
            <span className="text-cn-muted mx-2">/</span>
            <span className="text-sm text-cn-text">{node.title}</span>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-white mb-6">{node.title}</h1>

          {/* Content */}
          {node.content ? (
            <div className="prose">
              <ReactMarkdown>{node.content}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-cn-muted italic">No content available.</p>
          )}
        </div>
      </div>

      {/* Right Sidebar — Metadata */}
      <aside className="w-72 border-l border-cn-border bg-cn-surface p-5 overflow-y-auto shrink-0 space-y-6">
        {/* Type */}
        <div>
          <h3 className="text-xs font-semibold uppercase text-cn-muted mb-2">Type</h3>
          <span className="px-2.5 py-1 text-sm bg-cn-accent/10 text-cn-accent rounded capitalize">
            {node.type}
          </span>
        </div>

        {/* ID */}
        <div>
          <h3 className="text-xs font-semibold uppercase text-cn-muted mb-2">ID</h3>
          <code className="text-xs text-cn-muted break-all">{node.id}</code>
        </div>

        {/* Scope */}
        <div>
          <h3 className="text-xs font-semibold uppercase text-cn-muted mb-2">Scope</h3>
          <span className="text-sm text-cn-text">{node.scope || 'public'}</span>
        </div>

        {/* Owners */}
        <div>
          <h3 className="text-xs font-semibold uppercase text-cn-muted mb-2">Owners</h3>
          <div className="space-y-1">
            {node.owners.map(owner => (
              <div key={owner} className="text-sm text-cn-text">{owner}</div>
            ))}
          </div>
        </div>

        {/* Tags */}
        {node.tags && node.tags.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase text-cn-muted mb-2">Tags</h3>
            <div className="flex flex-wrap gap-1.5">
              {node.tags.map(tag => (
                <Link
                  key={tag}
                  href={`/query?q=${encodeURIComponent(tag)}`}
                  className="px-2 py-0.5 text-xs bg-cn-accent/10 text-cn-accent rounded-full hover:bg-cn-accent/20 transition-colors"
                >
                  {tag}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Dates */}
        {(node.created_at || node.updated_at) && (
          <div>
            <h3 className="text-xs font-semibold uppercase text-cn-muted mb-2">Dates</h3>
            {node.created_at && (
              <div className="text-xs text-cn-muted">Created: {node.created_at}</div>
            )}
            {node.updated_at && (
              <div className="text-xs text-cn-muted">Updated: {node.updated_at}</div>
            )}
          </div>
        )}

        {/* Backlinks */}
        {backlinks.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase text-cn-muted mb-2">
              Backlinks ({backlinks.length})
            </h3>
            <ul className="space-y-1">
              {backlinks.map(bl => (
                <li key={bl.id}>
                  <Link
                    href={`/node/${encodeURIComponent(bl.title)}`}
                    className="text-sm text-cn-accent hover:underline"
                  >
                    {bl.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}
