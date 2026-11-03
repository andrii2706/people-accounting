/** Where the app runs and who signs in. Never point this at production data. */
export const APP = process.env.PERF_APP ?? 'http://localhost:4000';
export const API = process.env.PERF_API ?? 'http://localhost:3000/api';
export const EMAIL = process.env.PERF_EMAIL ?? 'admin@example.com';
export const PASSWORD = process.env.PERF_PASSWORD ?? 'ChangeMe123!';

export async function signIn() {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Sign-in failed: ${res.status}`);
  return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
}
