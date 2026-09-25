import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { worker } from '../../../../lib/worker';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Login necessário' }, { status: 401 });
  const data = await worker.groups().catch((e: Error) => ({ groups: [], error: e.message }));
  return NextResponse.json(data);
}
