/**
 * Utility for building shareable URLs compatible with any device (Android / iOS / Desktop).
 * Uses the active origin where the application is live and accessible.
 */

export function getShareableAppUrl(customOrigin?: string): string {
  if (typeof window === 'undefined') return '';
  const origin = customOrigin || window.location.origin;
  return origin.replace(/\/+$/, '');
}

export function buildShareableRoomLink(roomId: string, accessKey?: string, channelId?: string): string {
  const base = getShareableAppUrl();
  const keyPart = accessKey ? `&key=${encodeURIComponent(accessKey)}` : '';
  const chatPart = channelId ? `&chat=${encodeURIComponent(channelId)}` : '';
  return `${base}/?room=${encodeURIComponent(roomId)}${keyPart}${chatPart}`;
}

export function buildShareableVoucherLink(token: string): string {
  const base = getShareableAppUrl();
  return `${base}/?voucher=${encodeURIComponent(token)}`;
}

export function buildShareableSiteLink(): string {
  return getShareableAppUrl();
}
