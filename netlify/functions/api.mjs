import { getStore } from '@netlify/blobs';
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

const store = () => getStore({ name: 'taskboard', consistency: 'strong' });
const J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const err = (m, s = 400) => J({ error: m }, s);
const today = () => new Date().toISOString().slice(0, 10);
const hp = (pw, salt) => scryptSync(pw, salt, 64).toString('hex');
const same = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
const pub = u => ({ id: u.id, username: u.username, name: u.name, role: u.role, active: u.active, created: u.created, mustChange: !!u.mustChange });
const UN = /^[a-z0-9_.-]{3,30}$/;

async function getUsers(st) {
  let u = await st.get('users', { type: 'json' });
  if (!u || !u.length) { // first run: default admin
    const salt = randomBytes(8).toString('hex');
    u = [{ id: 'u_admin', username: 'admin', name: 'Administrator', role: 'admin', active: true, salt, hash: hp('admin123', salt), mustChange: true, created: today() }];
    await st.setJSON('users', u);
  }
  return u;
}
const activeAdmins = us => us.filter(u => u.role === 'admin' && u.active).length;

export default async (req) => {
  const st = store();
  const path = new URL(req.url).pathname.replace(/^\/api/, '').replace(/\/$/, '');
  const m = req.method;
  let body = {};
  if (m === 'POST' || m === 'PUT') { try { body = await req.json(); } catch (e) { return err('Bad JSON'); } }

  if (path === '/login' && m === 'POST') {
    const us = await getUsers(st);
    const u = us.find(x => x.username === String(body.username || '').trim().toLowerCase());
    if (!u || !u.active || !same(u.hash, hp(String(body.password || ''), u.salt))) {
      await new Promise(r => setTimeout(r, 600));
      return err('Wrong username or password, or account disabled.', 401);
    }
    const token = randomBytes(24).toString('hex');
    await st.setJSON('sess:' + token, { id: u.id, exp: Date.now() + 30 * 864e5 });
    return J({ token, user: pub(u) });
  }

  // ---- everything below needs a valid session ----
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
  const sess = token ? await st.get('sess:' + token, { type: 'json' }) : null;
  if (!sess || sess.exp < Date.now()) return err('Not logged in', 401);
  let us = await getUsers(st);
  const me = us.find(x => x.id === sess.id && x.active);
  if (!me) return err('Not logged in', 401);

  if (path === '/logout' && m === 'POST') { await st.delete('sess:' + token); return J({ ok: 1 }); }
  if (path === '/me' && m === 'GET') return J({ user: pub(me), board: await st.get('board:' + me.id, { type: 'json' }) });
  if (path === '/board' && m === 'PUT') {
    if (!body || !Array.isArray(body.tasks) || JSON.stringify(body).length > 1e6) return err('Invalid board');
    await st.setJSON('board:' + me.id, body); return J({ ok: 1 });
  }

  // ---- admin only ----
  if (me.role !== 'admin') return err('Admins only', 403);

  if (path === '/users' && m === 'GET') return J({ users: us.map(pub) });
  if (path === '/users' && m === 'POST') {
    const un = String(body.username || '').trim().toLowerCase();
    if (!UN.test(un)) return err('Username: 3–30 letters, numbers, . _ -');
    if (us.some(x => x.username === un)) return err('Username already exists.');
    if (String(body.password || '').length < 6) return err('Password must be at least 6 characters.');
    const salt = randomBytes(8).toString('hex');
    us.push({ id: 'u_' + randomBytes(6).toString('hex'), username: un, name: String(body.name || '').trim() || un, role: body.role === 'admin' ? 'admin' : 'user', active: body.active !== false, salt, hash: hp(body.password, salt), created: today() });
    await st.setJSON('users', us); return J({ ok: 1 });
  }
  const um = path.match(/^\/users\/([\w-]+)$/);
  if (um) {
    const u = us.find(x => x.id === um[1]);
    if (!u) return err('User not found', 404);
    if (m === 'PUT') {
      const role = body.role === 'admin' ? 'admin' : 'user', active = body.active !== false;
      if (u.role === 'admin' && u.active && (role !== 'admin' || !active) && activeAdmins(us) < 2) return err('Keep at least one active admin.');
      if (u.id === me.id && !active) return err("You can't disable your own account.");
      u.name = String(body.name || '').trim() || u.username; u.role = role; u.active = active;
      if (body.password) {
        if (String(body.password).length < 6) return err('Password must be at least 6 characters.');
        u.salt = randomBytes(8).toString('hex'); u.hash = hp(body.password, u.salt); delete u.mustChange;
      }
      await st.setJSON('users', us); return J({ ok: 1 });
    }
    if (m === 'DELETE') {
      if (u.id === me.id) return err("You can't delete your own account.");
      if (u.role === 'admin' && u.active && activeAdmins(us) < 2) return err('Keep at least one active admin.');
      await st.setJSON('users', us.filter(x => x.id !== u.id)); await st.delete('board:' + u.id);
      return J({ ok: 1 });
    }
  }
  if (path === '/backup' && m === 'GET') {
    const boards = {};
    for (const u of us) { const b = await st.get('board:' + u.id, { type: 'json' }); if (b) boards[u.id] = b; }
    return J({ version: 3, exportedAt: new Date().toISOString(), users: us, boards });
  }
  if (path === '/backup' && m === 'POST') {
    if (body.version !== 3 || !Array.isArray(body.users) || !body.users.some(u => u.role === 'admin' && u.active)) return err('Invalid backup file');
    for (const u of us) await st.delete('board:' + u.id);
    await st.setJSON('users', body.users);
    for (const [id, b] of Object.entries(body.boards || {})) await st.setJSON('board:' + id, b);
    return J({ ok: 1 });
  }
  return err('Not found', 404);
};

export const config = { path: '/api/*' };
