const KEY = "nycelo_voter_token";

/** Anonymous voter identity: random token, generated once, kept in localStorage. */
export function getVoterToken(): string {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing && /^[A-Za-z0-9_-]{8,128}$/.test(existing)) return existing;
    const token = crypto.randomUUID().replace(/-/g, "");
    localStorage.setItem(KEY, token);
    return token;
  } catch {
    // Storage unavailable (private mode etc.) — session-scoped fallback.
    return sessionToken;
  }
}

const sessionToken = crypto.randomUUID().replace(/-/g, "");
