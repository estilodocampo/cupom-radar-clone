import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { worker } from '../../../../lib/worker';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Login necessário' }, { status: 401 });
  const data = await worker.qr().catch((e: Error) => ({ connected: false, qr: null, error: e.message }));
  return NextResponse.json(data);
}
