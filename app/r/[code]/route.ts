import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: { code: string } }) {
  const link = await prisma.shortLink.findUnique({ where: { code: params.code } }).catch(() => null);
  if (!link) return NextResponse.json({ error: 'Link não encontrado' }, { status: 404 });
  await prisma.shortLink.update({ where: { code: params.code }, data: { clicks: { increment: 1 } } }).catch(() => null);
  return NextResponse.redirect(link.url, 302);
}
