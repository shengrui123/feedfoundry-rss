import { createUser, getUserByEmail } from '../../../../db';
import { hashPassword } from '../../../../lib/password';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: unknown; password?: unknown; name?: unknown };
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const name = String(body.name || '').trim().slice(0, 80);
    if (!emailPattern.test(email) || email.length > 254) return Response.json({ error: '請輸入有效的電子郵箱' }, { status: 400 });
    if (password.length < 8 || password.length > 128) return Response.json({ error: '密碼需要 8–128 個字元' }, { status: 400 });
    if (await getUserByEmail(email)) return Response.json({ error: '這個電子郵箱已經註冊，請直接登入' }, { status: 409 });
    const passwordData = await hashPassword(password);
    const user = await createUser({
      id: crypto.randomUUID(),
      email,
      name,
      password_hash: passwordData.hash,
      password_salt: passwordData.salt,
      password_iterations: passwordData.iterations,
    });
    return Response.json({ user: { id: user.id, email: user.email, name: user.name } }, { status: 201 });
  } catch (cause) {
    const message = cause instanceof Error && /unique/i.test(cause.message) ? '這個電子郵箱已經註冊，請直接登入' : '暫時無法建立帳號，請稍後再試';
    return Response.json({ error: message }, { status: 400 });
  }
}
