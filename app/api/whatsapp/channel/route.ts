import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { worker, normSlot } from '../../../../lib/worker';

// Resolve convite de Canal (https://whatsapp.com/channel/XXXX) -> JID @newsletter
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Login necessário' }, { status: 401 });
  const invite = req.nextUrl.searchParams.get('invite') || '';
  const jid = req.nextUrl.searchParams.get('jid') || '';
  if (!invite.trim() && !jid.endsWith('@newsletter')) return NextResponse.json({ error: 'Convite ou JID obrigatório' }, { status: 400 });
  const data = await worker.channel({ invite: invite.trim(), jid: jid.trim() }, normSlot(req.nextUrl.searchParams.get('slot'))).catch((e: Error) => ({ error: e.message }));
  return NextResponse.json(data);
}
