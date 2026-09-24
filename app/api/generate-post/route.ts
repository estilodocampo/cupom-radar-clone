import { NextRequest, NextResponse } from 'next/server';
import { detectStore, toAffiliateLink, buildPost } from '../../../lib/shopee-parser';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { url, title, priceFrom, priceTo, coupon, affiliateId = 'SEU_ID' } = body;
  if (!url || !title || !priceTo) {
    return NextResponse.json({ error: 'url, title, priceTo obrigatórios' }, { status: 400 });
  }
  const store = detectStore(url);
  const affLink = toAffiliateLink(url, affiliateId, store);
  const text = buildPost(store, { title, priceFrom, priceTo, link: affLink, coupon });
  return NextResponse.json({ store, affiliateLink: affLink, text });
}
