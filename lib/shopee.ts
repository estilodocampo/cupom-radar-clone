import { createHash } from 'crypto';

const ENDPOINT = 'https://open-api.affiliate.shopee.com.br/graphql';

export async function shopeeShortLink(
  originUrl: string,
  subIds: string[],
  creds: { appId: string; secret: string }
): Promise<string> {
  const payload = JSON.stringify({
    query: 'mutation { generateShortLink(input: { originUrl: "__URL__", subIds: __SUBS__ }) { shortLink } }'
      .replace('__URL__', originUrl.replace(/\\/g, '\\\\').replace(/"/g, '\\"'))
      .replace('__SUBS__', JSON.stringify(subIds.slice(0, 5))),
  });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHash('sha256').update(creds.appId + timestamp + payload + creds.secret).digest('hex');
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `SHA256 Credential=${creds.appId}, Timestamp=${timestamp}, Signature=${signature}`,
    },
    body: payload,
  });
  const data = (await res.json().catch(() => ({}))) as {
    data?: { generateShortLink?: { shortLink?: string } };
    errors?: { message?: string }[];
  };
  if (!res.ok || data.errors?.length) {
    throw new Error(data.errors?.[0]?.message || `Shopee API ${res.status}`);
  }
  const link = data.data?.generateShortLink?.shortLink;
  if (!link) throw new Error('Shopee: sem shortLink na resposta');
  return link;
}
