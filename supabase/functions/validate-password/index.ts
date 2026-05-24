import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Supabase Auth Hook — password validation
 * Registered as: auth hook > password validation hook
 * Called by Supabase Auth before accepting a new or updated password.
 *
 * Request body (from Supabase): { "user_id": "...", "password": "..." }
 * Expected response:
 *   allow  → { "is_valid": true }
 *   reject → { "is_valid": false, "message": "Human-readable reason" }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Top common / breached passwords (mirrors client-side list).
const COMMON_PASSWORDS = new Set([
  "password","password1","password12","password123","password1234",
  "123456","12345678","123456789","1234567890","12345",
  "qwerty","qwerty123","qwertyuiop","qwerty1","qwerty12",
  "abc123","abc1234","abcdefgh","iloveyou","letmein",
  "welcome","welcome1","monkey","dragon","master",
  "sunshine","princess","shadow","superman","batman",
  "trustno1","football","baseball","soccer","hockey",
  "admin","admin123","administrator","root","login",
  "passw0rd","p@ssword","p@ssw0rd","pa$$word","pa$$w0rd",
  "qazwsx","zxcvbnm","asdfghjkl","asdfgh","aaaaaa",
  "111111","1111111","11111111","000000","123123",
  "696969","654321","666666","7777777","987654321",
  "michael","jessica","thomas","charlie","andrew",
  "daniel","jordan","harley","ranger","dakota",
  "passpass","passw","p@ss","pass123","pass1234",
  "changeme","changeit","temp","temp1","temp123",
  "default","guest","test","test1","test123",
  "google","facebook","twitter","linkedin","instagram",
  "mypassword","mypass","mypassword1","password!","password!!",
  "spring2024","summer2024","autumn2024","winter2024","fall2024",
  "spring2023","summer2023","autumn2023","winter2023","fall2023",
  "january","february","march","april","may","june",
  "july","august","september","october","november","december",
  "qweasdzxc","qweqweqwe","123qwe","1q2w3e4r","1qaz2wsx",
  "zaq12wsx","q1w2e3r4","1234abcd","abcd1234",
  "letmein1","letmein!","login123","enter","access",
  "security","secure","secret","secret1","secret123",
  "hello","hello1","hello123","hello1234","hell0",
]);

function validatePassword(password: string): { is_valid: boolean; message?: string } {
  if (typeof password !== "string") {
    return { is_valid: false, message: "Invalid password value." };
  }

  if (password.length < 12) {
    return { is_valid: false, message: `Password must be at least 12 characters (got ${password.length}).` };
  }

  const lower = password.toLowerCase();

  if (COMMON_PASSWORDS.has(lower)) {
    return { is_valid: false, message: "This password is too common and has appeared in data breaches. Please choose a different password." };
  }

  if (/^(.)\1+$/.test(password)) {
    return { is_valid: false, message: "Password cannot consist of a single repeated character." };
  }

  // Require at least two distinct character classes for 12-15 char passwords.
  if (password.length < 16) {
    const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) => re.test(password)).length;
    if (classes < 2) {
      return { is_valid: false, message: "Passwords shorter than 16 characters must contain at least two character types (uppercase, lowercase, number, or symbol)." };
    }
  }

  return { is_valid: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const password: string = body?.password ?? "";

    const result = validatePassword(password);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[validate-password] error:", err);
    // On unexpected error, fail open so legitimate users aren't blocked.
    return new Response(JSON.stringify({ is_valid: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
