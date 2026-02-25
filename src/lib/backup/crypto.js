import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from "node:crypto";

const ENVELOPE_VERSION = 1;
const ENVELOPE_ALGORITHM = "aes-256-gcm+scrypt";
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keyLen: 32 };

function toBase64(value) {
  return Buffer.from(value).toString("base64");
}

function fromBase64(value, fieldName) {
  if (typeof value !== "string" || !value) {
    throw new Error(`Invalid encrypted backup field: ${fieldName}`);
  }
  return Buffer.from(value, "base64");
}

function getPassphrase() {
  const passphrase = process.env.DB_BACKUP_ENCRYPTION_PASSPHRASE;
  if (!passphrase || !passphrase.trim()) {
    throw new Error("Missing DB_BACKUP_ENCRYPTION_PASSPHRASE environment variable");
  }
  return passphrase;
}

function deriveKey(passphrase, salt) {
  return scryptSync(passphrase, salt, SCRYPT_PARAMS.keyLen, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
  });
}

export function encryptBackupPayload(payload) {
  const passphrase = getPassphrase();
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = deriveKey(passphrase, salt);

  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  const envelope = {
    version: ENVELOPE_VERSION,
    algorithm: ENVELOPE_ALGORITHM,
    kdf: {
      name: "scrypt",
      N: SCRYPT_PARAMS.N,
      r: SCRYPT_PARAMS.r,
      p: SCRYPT_PARAMS.p,
      keyLen: SCRYPT_PARAMS.keyLen,
      salt: toBase64(salt),
    },
    iv: toBase64(iv),
    tag: toBase64(tag),
    ciphertext: toBase64(encrypted),
    createdAt: new Date().toISOString(),
  };

  return Buffer.from(JSON.stringify(envelope), "utf8");
}

export function decryptBackupPayload(encryptedBuffer) {
  const passphrase = getPassphrase();
  const raw = Buffer.isBuffer(encryptedBuffer)
    ? encryptedBuffer.toString("utf8")
    : String(encryptedBuffer || "");

  let envelope;
  try {
    envelope = JSON.parse(raw);
  } catch {
    throw new Error("Encrypted backup format is invalid JSON");
  }

  if (!envelope || typeof envelope !== "object") {
    throw new Error("Encrypted backup format is invalid");
  }

  if (envelope.version !== ENVELOPE_VERSION || envelope.algorithm !== ENVELOPE_ALGORITHM) {
    throw new Error("Unsupported encrypted backup format version");
  }

  const salt = fromBase64(envelope.kdf?.salt, "kdf.salt");
  const iv = fromBase64(envelope.iv, "iv");
  const tag = fromBase64(envelope.tag, "tag");
  const ciphertext = fromBase64(envelope.ciphertext, "ciphertext");

  const key = deriveKey(passphrase, salt);

  let decrypted;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error("Failed to decrypt backup. Check DB_BACKUP_ENCRYPTION_PASSPHRASE");
  }

  try {
    return JSON.parse(decrypted.toString("utf8"));
  } catch {
    throw new Error("Decrypted backup payload is invalid JSON");
  }
}
