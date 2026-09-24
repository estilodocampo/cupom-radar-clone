import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { PLANS, PlanId } from '../../../lib/plans';

const PRICE_CENTS: Record<Exclude<PlanId, 'gratuito'>, number> = {
  premium: 15990,
  diamante: 29990,
  master: 69700,
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: 'Login necessário' }, { status: 401 });

  const { plan } = (await req.json().catch(() => ({}))) as { plan?: PlanId };
  if (!plan || plan === 'gratuito' || !PRICE_CENTS[plan]) {
    return NextResponse.json({ error: 'Plano inválido' }, { status: 400 });
  }

  if (!process.env.ABACATEPAY_API_KEY) {
    return NextResponse.json({ error: 'Pagamento não configurado (ABACATEPAY_API_KEY)' }, { status: 503 });
  }

  const { default: AbacatePay } = await import('abacatepay-nodejs-sdk');
  const abacate = AbacatePay(process.env.ABACATEPAY_API_KEY);
  const planInfo = PLANS.find((p) => p.id === plan)!;
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

  const response = await abacate.billing.create({
    frequency: 'ONE_TIME',
    methods: ['PIX'],
    products: [
      { externalId: plan.toUpperCase(), name: `Cupom Radar Clone - ${planInfo.name} anual`, quantity: 1, price: PRICE_CENTS[plan] },
    ],
    returnUrl: `${baseUrl}/dashboard?plan=${plan}`,
    completionUrl: `${baseUrl}/dashboard?paid=1&plan=${plan}`,
    customer: { name: 'Cliente', email },
  });

  if (!response.data) {
    return NextResponse.json({ error: 'Falha ao criar cobrança' }, { status: 502 });
  }
  const billing = response.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    await prisma.subscription.upsert({
      where: { userId: user.id },
      update: { plan, status: 'pending', abacateBillingId: billing.id },
      create: { userId: user.id, plan, status: 'pending', abacateBillingId: billing.id },
    });
  }

  return NextResponse.json({ url: billing.url, id: billing.id });
}
