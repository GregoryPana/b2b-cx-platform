type MsalAccount = {
  idToken?: string;
};

export function getTokenExpiryMs(account?: MsalAccount | null) {
  if (!account?.idToken) return null;
  try {
    const payload = JSON.parse(atob(account.idToken.split(".")[1]));
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

export function isTokenExpired(account?: MsalAccount | null, bufferMs = 5 * 60 * 1000) {
  const exp = getTokenExpiryMs(account);
  if (!exp) return false;
  return Date.now() > exp - bufferMs;
}
