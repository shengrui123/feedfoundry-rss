import { auth } from '../auth';
import { claimFeeds, claimLegacyFeeds } from '../db';

const anonymousTokenPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function anonymousOwnerKey(request: Request): Promise<string | null> {
  const token = request.headers.get('x-feed-owner-token') || '';
  if (!anonymousTokenPattern.test(token)) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `anonymous:${hash}`;
}

export async function resolveFeedOwner(request: Request): Promise<string> {
  const session = await auth();
  const userId = session?.user && 'id' in session.user ? String(session.user.id || '') : '';
  const anonymousKey = await anonymousOwnerKey(request);
  const ownerKey = userId ? `user:${userId}` : anonymousKey;
  if (!ownerKey) throw new Error('瀏覽器無法建立私人 RSS 儲存空間');

  if (userId && anonymousKey) await claimFeeds(anonymousKey, ownerKey);
  if (request.headers.get('x-feed-owner-new') === '1') await claimLegacyFeeds(ownerKey);
  return ownerKey;
}
