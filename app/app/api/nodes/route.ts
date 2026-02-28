import { NextRequest, NextResponse } from 'next/server';
import { getAllNodes, getNodeByTitle, createNode, updateNode, searchNodes } from '@/lib/vault';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title');
    const search = searchParams.get('search');

    if (title) {
      const node = await getNodeByTitle(title);
      if (!node) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ node });
    }

    if (search) {
      const nodes = await searchNodes(search);
      return NextResponse.json({ count: nodes.length, nodes });
    }

    const nodes = await getAllNodes();
    return NextResponse.json({ count: nodes.length, nodes });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load nodes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, content, type, tags, scope } = body;

    if (!title || !content) {
      return NextResponse.json({ error: 'title and content are required' }, { status: 400 });
    }

    const node = await createNode({ title, content, type, tags, scope });
    return NextResponse.json({ node }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create node' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, content, append, tags, scope } = body;

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const node = await updateNode(title, { content, append, tags, scope });
    if (!node) return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    return NextResponse.json({ node });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update node' }, { status: 500 });
  }
}
