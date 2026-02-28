import { NextRequest, NextResponse } from 'next/server';
import { queryNodes } from '@/lib/vault';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "query" field' },
        { status: 400 }
      );
    }

    const nodes = await queryNodes(query);

    return NextResponse.json({
      query,
      count: nodes.length,
      nodes: nodes.map(n => ({
        id: n.id,
        title: n.title,
        type: n.type,
        scope: n.scope,
        tags: n.tags,
        snippet: n.content ? n.content.slice(0, 200) : undefined,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Query failed' },
      { status: 500 }
    );
  }
}
