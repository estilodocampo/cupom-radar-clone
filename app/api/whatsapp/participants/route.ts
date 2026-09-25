import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { worker } from '../../../../lib/worker';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Login necessário' }, { status: 401 });
  const groupJid = req.nextUrl.searchParams.get('groupJid') || '';
  if (!groupJid.endsWith('@g.us')) return NextResponse.json({ error: 'groupJid inválido' }, { status: 400 });
  const data = await worker.participants(groupJid).catch((e: Error) => ({ participants: [], error: e.message }));
  return NextResponse.json(data);
}
