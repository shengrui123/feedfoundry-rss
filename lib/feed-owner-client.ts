const ownerTokenKey = 'feedfoundry-owner-token';
const ownerReadyKey = 'feedfoundry-owner-ready-v1';

export function feedOwnerHeaders(): Record<string, string> {
  let token = window.localStorage.getItem(ownerTokenKey);
  if (!token) {
    token = crypto.randomUUID();
    window.localStorage.setItem(ownerTokenKey, token);
  }
  const headers: Record<string, string> = { 'x-feed-owner-token': token };
  if (window.localStorage.getItem(ownerReadyKey) !== '1') headers['x-feed-owner-new'] = '1';
  return headers;
}

export function markFeedOwnerReady() {
  window.localStorage.setItem(ownerReadyKey, '1');
}
