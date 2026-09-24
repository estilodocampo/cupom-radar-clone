import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

// Webhook AbacatePay: configure URL https://seu-dominio/api/webhooks/abacatepay
// Eventos de cobrança paga ativam o plano. Payload tratado de forma defensiva.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false }, { status: 400 });

  const event = (body.event || body.type || '').toString().toUpperCase();
  const data = body.data ?? body.billing ?? body;
  const billingId: string | undefined = data?.id || data?.billingId || data?.billing?.id;
  const status: string = (data?.status || '').toString().toUpperCase();
  const isPaid = event.includes('PAID') || status === 'PAID' || status === 'COMPLETED' || status === 'APPROVED';

  if (billingId && isPaid) {
    const sub = await prisma.subscription.findFirst({ where: { abacateBillingId: billingId } }).catch(() => null);
    if (sub) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'active', currentPeriodEnd: new Date(Date.now() + 365 * 24 * 3600 * 1000) },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
