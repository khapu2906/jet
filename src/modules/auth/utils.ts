import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const SALT_LEN = 16;
const KEY_LEN = 64;

export function hashPassword(password: string): string {
	const salt = randomBytes(SALT_LEN).toString("hex");
	const hash = scryptSync(password, salt, KEY_LEN).toString("hex");
	return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
	const [salt, hash] = stored.split(":");
	const incoming = scryptSync(password, salt, KEY_LEN);
	return timingSafeEqual(incoming, Buffer.from(hash, "hex"));
}
