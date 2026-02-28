import { NextResponse } from 'next/server';
import { getContextMd } from '@/lib/vault';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const content = await getContextMd();
    return NextResponse.json({ content });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read CONTEXT.md' }, { status: 500 });
  }
}
