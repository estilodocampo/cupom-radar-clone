import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
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

function verifySignature(raw: string, req: NextRequest): boolean {
  const secret = process.env.ABACATEPAY_WEBHOOK_SECRET;
  if (!secret) return true;
  const headerNames = ['x-webhook-signature', 'x-abacate-signature', 'abacatepay-signature', 'x-signature'];
  let provided: string | null = null;
  for (const h of headerNames) {
    const v = req.headers.get(h);
    if (v) {
      provided = v;
      break;
    }
  }
  if (!provided) return true;
  const clean = provided.replace(/^sha256=/i, '').trim();
  for (const digest of ['hex', 'base64'] as const) {
    const expected = createHmac('sha256', secret).update(raw).digest(digest);
    try {
      if (clean.length === expected.length && timingSafeEqual(Buffer.from(clean), Buffer.from(expected))) {
        return true;
      }
    } catch {
      // continua
    }
  }
  return false;
}

export async function POST(req: NextRequest) {
  const raw = await req.text().catch(() => '');
  if (!raw) return NextResponse.json({ ok: false }, { status: 400 });
  if (!verifySignature(raw, req)) return NextResponse.json({ ok: false }, { status: 401 });

  const body = JSON.parse(raw) as Record<string, unknown>;
  const event = String((body.event ?? body.type ?? '')).toUpperCase();
  const data = (body.data ?? body.billing ?? body) as Record<string, unknown>;
  const billingId = String(
    data?.id ?? data?.billingId ?? (data?.billing as Record<string, unknown> | undefined)?.id ?? data?.externalId ?? ''
  );
  const status = String(data?.status ?? '').toUpperCase();
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
