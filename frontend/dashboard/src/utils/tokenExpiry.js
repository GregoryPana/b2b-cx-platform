/**
 * Token expiry utilities for Entra ID tokens
 */

export function getTokenExpiryMs(account) {
  if (!account || !account.idToken) return null;
  try {
    const payload = JSON.parse(atob(account.idToken.split('.')[1]));
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

export function isTokenExpired(account, bufferMs = 5 * 60 * 1000) {
  const exp = getTokenExpiryMs(account);
  if (!exp) return false;
  return Date.now() > (exp - bufferMs);
}
