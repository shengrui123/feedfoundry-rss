import NextAuth, { type NextAuthConfig } from 'next-auth';
import Apple from 'next-auth/providers/apple';
import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import { getUserByEmail } from './db';
import { verifyPassword } from './lib/password';

const providers: NextAuthConfig['providers'] = [Credentials({
  name: '電子郵箱',
  credentials: {
    email: { label: '電子郵箱', type: 'email' },
    password: { label: '密碼', type: 'password' },
  },
  async authorize(credentials) {
    const email = typeof credentials.email === 'string' ? credentials.email.trim().toLowerCase() : '';
    const password = typeof credentials.password === 'string' ? credentials.password : '';
    if (!email || !password) return null;
    const user = await getUserByEmail(email);
    if (!user || !(await verifyPassword(password, user.password_hash, user.password_salt, user.password_iterations))) return null;
    return { id: user.id, email: user.email, name: user.name || user.email.split('@')[0] };
  },
})];

if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
  providers.push(GitHub({ clientId: process.env.AUTH_GITHUB_ID, clientSecret: process.env.AUTH_GITHUB_SECRET }));
}
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(Google({ clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET }));
}
if (process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET) {
  providers.push(Apple({ clientId: process.env.AUTH_APPLE_ID, clientSecret: process.env.AUTH_APPLE_SECRET }));
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.userId = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user) (session.user as typeof session.user & { id: string }).id = String(token.userId || token.sub || '');
      return session;
    },
  },
});
