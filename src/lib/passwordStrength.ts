// Top 200 most common / breached passwords — reject these regardless of length.
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123', 'password1234',
  '123456', '12345678', '123456789', '1234567890', '12345',
  'qwerty', 'qwerty123', 'qwertyuiop', 'qwerty1', 'qwerty12',
  'abc123', 'abc1234', 'abcdefgh', 'iloveyou', 'letmein',
  'welcome', 'welcome1', 'monkey', 'dragon', 'master',
  'sunshine', 'princess', 'shadow', 'superman', 'batman',
  'trustno1', 'football', 'baseball', 'soccer', 'hockey',
  'admin', 'admin123', 'administrator', 'root', 'login',
  'passw0rd', 'p@ssword', 'p@ssw0rd', 'pa$$word', 'pa$$w0rd',
  'qazwsx', 'zxcvbnm', 'asdfghjkl', 'asdfgh', 'aaaaaa',
  '111111', '1111111', '11111111', '000000', '123123',
  '696969', '654321', '666666', '7777777', '987654321',
  'michael', 'jessica', 'thomas', 'charlie', 'andrew',
  'daniel', 'jordan', 'harley', 'ranger', 'dakota',
  'passpass', 'passw', 'p@ss', 'pass123', 'pass1234',
  'changeme', 'changeit', 'temp', 'temp1', 'temp123',
  'default', 'guest', 'test', 'test1', 'test123',
  'google', 'facebook', 'twitter', 'linkedin', 'instagram',
  'mypassword', 'mypass', 'mypassword1', 'password!', 'password!!',
  'spring2024', 'summer2024', 'autumn2024', 'winter2024', 'fall2024',
  'spring2023', 'summer2023', 'autumn2023', 'winter2023', 'fall2023',
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
  'qweasdzxc', 'qweqweqwe', '123qwe', '1q2w3e4r', '1qaz2wsx',
  'zaq12wsx', 'q1w2e3r4', '1q2w3e', '1234abcd', 'abcd1234',
  'letmein1', 'letmein!', 'login123', 'enter', 'access',
  'security', 'secure', 'secret', 'secret1', 'secret123',
  'cheese', 'butter', 'cookie', 'cream', 'sugar',
  'hello', 'hello1', 'hello123', 'hello1234', 'hell0',
  'love', 'love1', 'love123', 'lover', 'lovely',
  'sex', 'sexy', 'boobs', 'fuck', 'shit',
  'apple', 'apple1', 'iphone', 'android', 'windows',
  'matrix', 'hacker', 'hack', 'cyber', 'ninja',
  'corvette', 'mustang', 'ferrari', 'porsche', 'lamborghini',
  'pokemon', 'nintendo', 'playstation', 'xbox', 'minecraft',
  'starwars', 'batman1', 'spiderman', 'ironman', 'captain',
  'pepper', 'pepper1', 'ginger', 'buster', 'tigger',
  'maggie', 'molly', 'bailey', 'sophie', 'fluffy',
]);

export interface PasswordCheckResult {
  valid: boolean;
  score: number;        // 0-4
  label: 'Too short' | 'Weak' | 'Fair' | 'Good' | 'Strong';
  color: string;        // tailwind color class
  errors: string[];
  suggestions: string[];
}

export function checkPassword(password: string): PasswordCheckResult {
  const errors: string[] = [];
  const suggestions: string[] = [];

  // ── Hard requirements ──────────────────────────────────────────────────────
  if (password.length < 12) {
    errors.push(`At least 12 characters required (${password.length} so far).`);
  }

  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) {
    errors.push('This password is too common and has appeared in data breaches.');
  }

  // Check for repeated characters (aaaaaaaaaaaaa)
  if (/^(.)\1+$/.test(password)) {
    errors.push('Password cannot be a single repeated character.');
  }

  // ── Scoring ────────────────────────────────────────────────────────────────
  let score = 0;

  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  // Penalise common patterns
  if (COMMON_PASSWORDS.has(lower)) score = 0;
  if (/^(.)\1+$/.test(password)) score = Math.min(score, 1);

  // Cap at 4
  score = Math.min(score, 4);

  // ── Suggestions ───────────────────────────────────────────────────────────
  if (password.length < 16) suggestions.push('Use 16+ characters or a passphrase for extra security.');
  if (!/[A-Z]/.test(password)) suggestions.push('Add uppercase letters.');
  if (!/[0-9]/.test(password)) suggestions.push('Mix in some numbers.');
  if (!/[^a-zA-Z0-9]/.test(password)) suggestions.push('Include a symbol (!, @, #, …).');

  const labels: PasswordCheckResult['label'][] = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = [
    'text-red-500',
    'text-orange-500',
    'text-yellow-500',
    'text-emerald-500',
    'text-emerald-500',
  ];
  const barColors = [
    'bg-red-500',
    'bg-orange-500',
    'bg-yellow-500',
    'bg-emerald-400',
    'bg-emerald-500',
  ];

  return {
    valid: errors.length === 0 && score >= 2,
    score,
    label: labels[score],
    color: colors[score],
    errors,
    suggestions,
    // expose bar color for the UI
    ...{ barColor: barColors[score] },
  } as PasswordCheckResult & { barColor: string };
}

export function passwordMeetsPolicy(password: string): boolean {
  return checkPassword(password).valid;
}
