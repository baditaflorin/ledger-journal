import {
  armor,
  Decrypter,
  Encrypter,
  generateIdentity,
  identityToRecipient,
} from "age-encryption";
import * as ed25519 from "@noble/ed25519";
import { bytesToHex, canonicalJson, hexToBytes, sha256Hex } from "./encoding";
import type {
  AgeKey,
  EncryptedEntryRecord,
  JournalPayload,
  VaultEnvelope,
  VaultSecret,
} from "./types";

const vaultScryptWorkFactor = 15;

export async function createVault(
  passphrase: string,
): Promise<{ envelope: VaultEnvelope; secret: VaultSecret }> {
  const createdAt = new Date().toISOString();
  const ageKey = await generateAgeKey(createdAt);
  const signingKeys = await ed25519.keygenAsync();
  const secret: VaultSecret = {
    schemaVersion: 1,
    createdAt,
    activeAgeKeyId: ageKey.id,
    ageKeys: [ageKey],
    signingSecretKey: bytesToHex(signingKeys.secretKey),
    signingPublicKey: bytesToHex(signingKeys.publicKey),
  };

  return {
    secret,
    envelope: await sealVault(secret, passphrase),
  };
}

export async function unlockVault(
  envelope: VaultEnvelope,
  passphrase: string,
): Promise<VaultSecret> {
  const decrypter = new Decrypter();
  decrypter.addPassphrase(passphrase);
  const plaintext = await decrypter.decrypt(
    armor.decode(envelope.encryptedVaultArmor),
    "text",
  );
  const secret = JSON.parse(plaintext) as VaultSecret;
  if (secret.schemaVersion !== 1)
    throw new Error("Unsupported vault schema version.");
  return secret;
}

export async function sealVault(
  secret: VaultSecret,
  passphrase: string,
): Promise<VaultEnvelope> {
  const encrypter = new Encrypter();
  encrypter.setScryptWorkFactor(vaultScryptWorkFactor);
  encrypter.setPassphrase(passphrase);
  const encrypted = await encrypter.encrypt(canonicalJson(secret));
  const active = getActiveAgeKey(secret);
  return {
    schemaVersion: 1,
    encryptedVaultArmor: armor.encode(encrypted),
    createdAt: secret.createdAt,
    updatedAt: new Date().toISOString(),
    activeRecipient: active.recipient,
    signingPublicKey: secret.signingPublicKey,
  };
}

export async function rotateAgeKey(secret: VaultSecret): Promise<VaultSecret> {
  const ageKey = await generateAgeKey(new Date().toISOString());
  return {
    ...secret,
    activeAgeKeyId: ageKey.id,
    ageKeys: [...secret.ageKeys, ageKey],
  };
}

export async function encryptPayload(
  secret: VaultSecret,
  payload: JournalPayload,
): Promise<string> {
  const encrypter = new Encrypter();
  encrypter.addRecipient(getActiveAgeKey(secret).recipient);
  return armor.encode(await encrypter.encrypt(canonicalJson(payload)));
}

export async function decryptPayload(
  secret: VaultSecret,
  record: EncryptedEntryRecord,
): Promise<JournalPayload> {
  const decrypter = new Decrypter();
  for (const ageKey of secret.ageKeys) decrypter.addIdentity(ageKey.identity);
  const plaintext = await decrypter.decrypt(
    armor.decode(record.ciphertextArmor),
    "text",
  );
  return JSON.parse(plaintext) as JournalPayload;
}

export async function signHash(
  secret: VaultSecret,
  hashHex: string,
): Promise<string> {
  const signature = await ed25519.signAsync(
    hexToBytes(hashHex),
    hexToBytes(secret.signingSecretKey),
  );
  return bytesToHex(signature);
}

export async function verifySignature(
  signatureHex: string,
  hashHex: string,
  publicKeyHex: string,
): Promise<boolean> {
  return ed25519.verifyAsync(
    hexToBytes(signatureHex),
    hexToBytes(hashHex),
    hexToBytes(publicKeyHex),
  );
}

export async function ciphertextHash(ciphertextArmor: string): Promise<string> {
  return sha256Hex(ciphertextArmor);
}

export async function plaintextHash(payload: JournalPayload): Promise<string> {
  return sha256Hex(canonicalJson(payload));
}

export function getActiveAgeKey(secret: VaultSecret): AgeKey {
  const active = secret.ageKeys.find(
    (ageKey) => ageKey.id === secret.activeAgeKeyId,
  );
  if (!active) throw new Error("Active age key is missing.");
  return active;
}

async function generateAgeKey(createdAt: string): Promise<AgeKey> {
  const identity = await generateIdentity();
  const recipient = await identityToRecipient(identity);
  return {
    id: await sha256Hex(`${createdAt}:${recipient}`),
    createdAt,
    identity,
    recipient,
  };
}
