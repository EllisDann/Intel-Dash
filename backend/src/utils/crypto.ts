import crypto from 'crypto';

const algorithm = 'aes-256-gcm';
const ivLength = 12;
const keyMaterial = process.env.ENCRYPTION_KEY || 'default-encryption-key-please-change';

const deriveKey = (secret: string) => {
  return crypto.createHash('sha256').update(secret).digest();
};

const key = deriveKey(keyMaterial);

export const encrypt = (plainText: string) => {
  const iv = crypto.randomBytes(ivLength);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
};

export const decrypt = (encryptedText: string) => {
  const [ivHex, authTagHex, dataHex] = encryptedText.split(':');
  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error('Invalid encrypted payload');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(dataHex, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
};
