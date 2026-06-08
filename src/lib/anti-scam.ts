// Block phone numbers, links and platform names from new/unverified accounts.
const PATTERNS = [
  /\b\d{3,}[\s.-]?\d{3,}[\s.-]?\d{3,}\b/, // phone-ish
  /https?:\/\/|www\.|\.com|\.net|\.org|\.br|t\.me\//i,
  /\b(whats?app|whatsapp|zap|telegram|tele|tlg|insta(gram)?|snap(chat)?|tiktok|onlyfans|of)\b/i,
  /\b@[a-z0-9._]{2,}\b/i,
];

export function detectScamSignals(text: string): string | null {
  for (const p of PATTERNS) {
    if (p.test(text)) return "Mensagem contém telefone, link ou rede externa — bloqueado para contas novas/não verificadas.";
  }
  return null;
}

export function accountIsTrusted(opts: { verified: boolean; createdAt: string }) {
  if (opts.verified) return true;
  const days = (Date.now() - new Date(opts.createdAt).getTime()) / 86400000;
  return days >= 7;
}
