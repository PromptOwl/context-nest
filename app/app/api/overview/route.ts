import { NextResponse } from 'next/server';
import { getAllNodes } from '@/lib/vault';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const nodes = await getAllNodes();
    const types: Record<string, number> = {};
    const tags: Record<string, number> = {};

    for (const n of nodes) {
      types[n.type] = (types[n.type] || 0) + 1;
      for (const t of n.tags || []) {
        tags[t] = (tags[t] || 0) + 1;
      }
    }

    return NextResponse.json({
      total: nodes.length,
      types,
      tags,
      nodes: nodes.map(n => ({
        title: n.title,
        type: n.type,
        tags: n.tags,
        snippet: (n.content || '').slice(0, 120).replace(/\n/g, ' '),
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to build overview' }, { status: 500 });
  }
}
