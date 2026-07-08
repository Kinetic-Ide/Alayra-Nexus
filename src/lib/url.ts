/**
 * Strip trailing slashes without a regex. The previous `/\/+$/` form was flagged
 * as a potential polynomial-backtracking (ReDoS) pattern on uncontrolled input;
 * this linear scan removes any ambiguity.
 */
export function stripTrailingSlash(s: string): string {
  let i = s.length;
  while (i > 0 && s[i - 1] === '/') i--;
  return s.slice(0, i);
}

/**
 * Validate a provider base URL and return it as a parsed URL. Rejects anything
 * that is not plain HTTP(S) — blocking `file:`, `gopher:`, and similar schemes
 * that could be abused through the gateway's outbound fetch. Host-level
 * restrictions (e.g. blocking private/link-local ranges) are intentionally left
 * to the operator: a legitimate self-hosted provider may run on localhost or a
 * private network, so blanket-blocking those here would break valid setups.
 */
export function assertHttpUrl(raw: string): URL {
  const u = new URL(raw); // throws on malformed input
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error(`Unsupported URL scheme "${u.protocol}" — provider base URL must be http(s).`);
  }
  return u;
}
