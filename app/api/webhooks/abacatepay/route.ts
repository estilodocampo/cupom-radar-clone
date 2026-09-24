import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

// Webhook AbacatePay v2: configure URL https://seu-dominio/api/webhooks/abacatepay
// Evento recomendado: transparent.completed (cobrança via API paga).
// Opcional: checkout.completed + subscription.completed / subscription.cancelled.
const PAID_EVENTS = new Set([
  'TRANSPARENT.COMPLETED',
  'CHECKOUT.COMPLETED',
  'SUBSCRIPTION.COMPLETED',
  'BILLING.PAID',
]);

const CANCEL_EVENTS = new Set([
  'SUBSCRIPTION.CANCELLED',
  'CHECKOUT.REFUNDED',
  'TRANSPARENT.REFUNDED',
]);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false }, { status: 400 });

  const event = (body.event || body.type || '').toString().toUpperCase();
  const data = body.data ?? body.billing ?? body;
  const billingId: string | undefined =
    data?.id || data?.billingId || data?.billing?.id || data?.externalId;
  const status: string = (data?.status || '').toString().toUpperCase();
  const isPaid =
    PAID_EVENTS.has(event) ||
    event.includes('PAID') ||
    status === 'PAID' ||
    status === 'COMPLETED' ||
    status === 'APPROVED';
  const isCancel = CANCEL_EVENTS.has(event);

  if (billingId && (isPaid || isCancel)) {
    const sub = await prisma.subscription
      .findFirst({ where: { abacateBillingId: billingId } })
      .catch(() => null);
    if (sub) {
      await prisma.subscription
        .update({
          where: { id: sub.id },
          data: isPaid
            ? { status: 'active', currentPeriodEnd: new Date(Date.now() + 365 * 24 * 3600 * 1000) }
            : { status: 'canceled', plan: 'gratuito' },
        })
        .catch(() => null);
    }
  }

  return NextResponse.json({ ok: true });
}
