type StrengthLabel = 'Empty' | 'Weak' | 'Fair' | 'Good' | 'Strong';

const COMMON = new Set([
  'password',
  '123456',
  'qwerty',
  'letmein',
  'admin',
  'welcome',
  'iloveyou',
  'monkey',
  'dragon',
  'sunshine',
  'princess',
  'football',
  'abc123',
  'password1',
]);

export function scorePassword(p: string): { score: 0 | 1 | 2 | 3 | 4; label: StrengthLabel } {
  if (!p) return { score: 0, label: 'Empty' };
  let score = 0;
  // Length tiers
  if (p.length >= 8) score++;
  if (p.length >= 12) score++;
  if (p.length >= 16) score++;
  // Character classes
  let classes = 0;
  if (/[a-z]/.test(p)) classes++;
  if (/[A-Z]/.test(p)) classes++;
  if (/[0-9]/.test(p)) classes++;
  if (/[^a-zA-Z0-9]/.test(p)) classes++;
  if (classes >= 2) score++;
  if (classes >= 3) score++;
  // Penalize obvious patterns
  if (COMMON.has(p.toLowerCase())) score = Math.min(score, 1);
  if (/^(.)\1+$/.test(p)) score = 0; // all same char
  if (/^(?:0123456789|abcdefghij|qwertyuiop)/i.test(p)) score = Math.min(score, 1);
  // Clamp 0..4
  const s = Math.max(0, Math.min(4, score)) as 0 | 1 | 2 | 3 | 4;
  const labels: Record<number, StrengthLabel> = {
    0: 'Weak',
    1: 'Weak',
    2: 'Fair',
    3: 'Good',
    4: 'Strong',
  };
  return { score: s, label: labels[s] };
}

export function PasswordStrengthMeter({ password }: { password: string }) {
  const { score, label } = scorePassword(password);
  const segs = [0, 1, 2, 3];
  return (
    <div className="q-pw-strength">
      <div className="q-pw-strength-bars">
        {segs.map((i) => (
          <span
            key={i}
            className={'q-pw-bar' + (score > i ? ' on s' + score : '')}
          />
        ))}
      </div>
      <span className="q-pw-label">{label}</span>
    </div>
  );
}
