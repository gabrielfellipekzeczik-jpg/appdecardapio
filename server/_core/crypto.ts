import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { ENV } from "./env";

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const raw = ENV.integrationsEncryptionKey;
  if (!raw) throw new Error("INTEGRATIONS_ENCRYPTION_KEY is not configured");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("INTEGRATIONS_ENCRYPTION_KEY must decode to 32 bytes (base64)");
  return key;
}

/** Encrypts a JSON-serializable value into a single base64 payload: iv + authTag + ciphertext. */
export function encryptJson(value: unknown): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf-8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decryptJson<T = unknown>(payload: string): T {
  const key = getKey();
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString("utf-8")) as T;
}
