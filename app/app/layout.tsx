import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import { getAllNodes } from '@/lib/vault';

export const metadata: Metadata = {
  title: 'ContextNest',
  description: 'AI Context Control Plane — Browse and query your context vault',
};

function groupByType(nodes: { type: string; title: string }[]) {
  const groups: Record<string, string[]> = {};
  for (const n of nodes) {
    if (!groups[n.type]) groups[n.type] = [];
    groups[n.type].push(n.title);
  }
  return groups;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nodes = await getAllNodes();
  const grouped = groupByType(nodes);
  const typeIcons: Record<string, string> = {
    document: 'doc',
    snippet: 'snip',
    glossary: 'gloss',
    persona: 'persona',
    policy: 'policy',
    prompt: 'prompt',
    tool: 'tool',
    reference: 'ref',
  };

  return (
    <html lang="en">
      <body className="flex h-screen overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-64 bg-cn-surface border-r border-cn-border flex flex-col shrink-0 overflow-y-auto">
          <div className="p-4 border-b border-cn-border">
            <Link href="/" className="text-lg font-bold text-white hover:text-cn-accent transition-colors">
              ContextNest
            </Link>
            <p className="text-xs text-cn-muted mt-1">Context Control Plane</p>
          </div>

          <nav className="flex-1 p-3 space-y-4">
            <Link
              href="/query"
              className="block px-3 py-2 rounded-md text-sm text-cn-accent bg-cn-accent/10 hover:bg-cn-accent/20 transition-colors"
            >
              Query Builder
            </Link>

            {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([type, titles]) => (
              <div key={type}>
                <h3 className="text-xs font-semibold uppercase text-cn-muted px-2 mb-1">
                  {typeIcons[type] || type} ({titles.length})
                </h3>
                <ul className="space-y-0.5">
                  {titles.sort().map(title => (
                    <li key={title}>
                      <Link
                        href={`/node/${encodeURIComponent(title)}`}
                        className="block px-3 py-1.5 rounded text-sm text-cn-text hover:bg-cn-border/50 truncate transition-colors"
                        title={title}
                      >
                        {title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-cn-bg">
          {children}
        </main>
      </body>
    </html>
  );
}
