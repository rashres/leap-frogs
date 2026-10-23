/**
 * Messages the API sends back in English, so `translate` can show them in the
 * chosen language. Exact messages only need listing here so the checker asks
 * for a translation; messages with numbers in them are matched by pattern.
 */

/** Same marker as `tk` in i18n.service.ts (not imported, to keep the two files independent). */
const tk = <T extends string>(text: T): T => text;

export const SERVER_MESSAGES: readonly string[] = [
  tk('A reason is required when freezing an account'),
  tk('Account is frozen; new orders are not allowed'),
  tk('An account cannot copy its own trades'),
  tk('An account with that email already exists'),
  tk('Cannot freeze the Super Admin account'),
  tk('GTC is only allowed on a LIMIT order'),
  tk('Invalid username or password'),
  tk('Not a Super Admin account'),
  tk('Not allowed to access analytics'),
  tk('Not allowed to access audit logs'),
  tk('Not allowed to access this account'),
  tk('Not allowed to freeze or unfreeze accounts'),
  tk('Not allowed to list all accounts'),
  tk('Not allowed to trade on this account'),
  tk('Order is no longer pending (filled, failed, expired or already cancelled)'),
  tk('Sign in required'),
  tk('startDate must be before or equal to endDate'),
  tk('That username is taken'),
  tk('This copy has already lost more than its stop-loss; lower or clear the stop-loss to resume'),
  tk('Unknown user'),
  tk('Use the Super Admin sign-in page'),
];

/** API messages with values in them: the pattern, and the dictionary key it maps to. */
const PATTERNS: readonly { re: RegExp; key: string; names: readonly string[] }[] = [
  { re: /^Insufficient cash: required (\S+), available (\S+)$/, key: tk('Insufficient cash: required {need}, available {have}'), names: ['need', 'have'] },
  { re: /^Insufficient shares: required (\S+), available (\S+)$/, key: tk('Insufficient shares: required {need}, available {have}'), names: ['need', 'have'] },
];

/** The dictionary key and values for an API message with numbers in it, or null. */
export function matchServerMessage(text: string): { key: string; values: Record<string, string> } | null {
  for (const p of PATTERNS) {
    const m = p.re.exec(text);
    if (m) return { key: p.key, values: Object.fromEntries(p.names.map((name, i) => [name, m[i + 1]])) };
  }
  return null;
}
