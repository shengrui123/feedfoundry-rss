// Next.js/Vercel build compatibility. The production Sites build resolves
// `cloudflare:workers` normally and does not use this module.
export const env: Cloudflare.Env = {
  DB: undefined as unknown as D1Database,
};
