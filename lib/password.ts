const PASSWORD_ITERATIONS = 210_000;
const encoder = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fromHex(value: string): Uint8Array {
  if (!/^[a-f0-9]+$/i.test(value) || value.length % 2) return new Uint8Array();
  return new Uint8Array(value.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) || []);
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const saltBuffer = new Uint8Array(salt).buffer;
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: saltBuffer, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, PASSWORD_ITERATIONS);
  return { hash: toHex(hash), salt: toHex(salt), iterations: PASSWORD_ITERATIONS };
}

export async function verifyPassword(password: string, expectedHash: string, saltHex: string, iterations: number): Promise<boolean> {
  const expected = fromHex(expectedHash);
  const salt = fromHex(saltHex);
  if (expected.length !== 32 || salt.length !== 16 || iterations < 100_000) return false;
  const actual = await derive(password, salt, iterations);
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) difference |= actual[index] ^ expected[index];
  return difference === 0;
}
