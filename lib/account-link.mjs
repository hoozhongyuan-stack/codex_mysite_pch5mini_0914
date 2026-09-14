// URL fragments stay local to the browser; never move account tokens into queries.
export function accountLink(hash) {
  const params = new URLSearchParams(String(hash || '').replace(/^#/, ''));
  const modes = ['verify', 'reset'].filter(mode => params.has(mode));
  if (modes.length !== 1) return null;
  const mode = modes[0], tokens = params.getAll(mode);
  if (tokens.length !== 1 || !/^[A-Za-z0-9_-]{43}$/.test(tokens[0])) return null;
  return {mode, token: tokens[0]};
}
