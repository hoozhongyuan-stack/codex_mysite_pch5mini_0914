import assert from 'node:assert/strict';
const base = 'http://localhost:3001';
const login = await fetch(base + '/signin-with-chatgpt?return_to=%2F', {
  redirect: 'manual',
});
const cookie = login.headers
  .getSetCookie()
  .map((c) => c.split(';')[0])
  .join('; ');
console.log(
  'Local sign-in:',
  login.status,
  'cookie available:',
  Boolean(cookie),
);
const response = await fetch(base + '/api/admin', { headers: { cookie } });
console.log('Admin snapshot:', response.status);
if (!response.ok) console.log(await response.text());
const publicPage = await fetch(base + '/en');
console.log('English homepage:', publicPage.status);
if (!publicPage.ok) console.log((await publicPage.text()).slice(0, 1500));
