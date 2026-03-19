import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const KEY_HEX = process.env.RFID_ENCRYPTION_KEY ?? '';
  if (!KEY_HEX || KEY_HEX.length !== 64) {
    throw new Error(
      'RFID_ENCRYPTION_KEY must be set as a 64-character hex string (32 bytes). ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  return Buffer.from(KEY_HEX, 'hex');
}

/**
 * Encrypt an RFID card number using AES-256-GCM.
 * Returns a colon-separated string: iv(hex):authTag(hex):ciphertext(hex)
 *
 * Store the full encrypted string in the database.
 * The IV is unique per encryption — identical plaintexts produce different ciphertexts.
 */
export function encryptRfid(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag(); // 128-bit authentication tag
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt an RFID card number encrypted by encryptRfid().
 * Throws if the ciphertext has been tampered with (GCM authentication failure).
 */
export function decryptRfid(ciphertext: string): string {
  const key = getKey();
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted RFID format — expected iv:authTag:ciphertext');
  }
  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
}

/**
 * Check whether a string looks like an encrypted RFID value (iv:authTag:ciphertext).
 * Useful during the migration period when some records may still be plaintext.
 */
export function isEncryptedRfid(value: string): boolean {
  const parts = value.split(':');
  return parts.length === 3 && parts[0].length === 24 && parts[1].length === 32;
}
