/**
 * Extension identifiers.
 *
 * Both browser families gate native messaging on the id of the extension that
 * may talk to the host, so the installer has to know the id before the user has
 * opened any settings page. There are two ways to get one, and they differ in a
 * way that matters:
 *
 *  - Chromium, unpacked, without a `key` in the manifest: the id is a hash of
 *    the absolute path. Move the folder and the id changes, so the manifest the
 *    installer wrote stops matching and the extension silently loses the host.
 *  - With a `key` in the manifest: the id is a hash of the public key and never
 *    changes. This is why the manifest pins a key, and why the id is computed
 *    here from that key rather than from a path.
 *
 * Firefox uses a different scheme entirely: an add-on id from
 * `browser_specific_settings.gecko.id`, and the native messaging manifest spells
 * it `allowed_extensions` rather than `allowed_origins`.
 */

import crypto from "node:crypto";
import path from "node:path";

/** Chromium maps a digest onto a-p by nibble, two letters per byte. */
function nibblesToId(digest: Buffer): string {
  return digest
    .subarray(0, 16)
    .toString("hex")
    .split("")
    .map((c) => String.fromCharCode(97 + Number.parseInt(c, 16)))
    .join("");
}

/**
 * The id Chromium derives from an unpacked extension that pins a key.
 *
 * It hashes the DER SubjectPublicKeyInfo, exactly as `openssl rsa -pubout
 * -outform DER` produces it, and takes the first 16 bytes.
 */
export function chromiumIdFromPublicKey(der: Buffer): string {
  return nibblesToId(crypto.createHash("sha256").update(der).digest());
}

export function chromiumIdFromPublicKeyBase64(base64: string): string {
  return chromiumIdFromPublicKey(Buffer.from(base64, "base64"));
}

/**
 * The id Chromium derives from an unpacked directory that has no key.
 *
 * Kept for the case where someone strips `key` from the manifest; it is a
 * fallback, not the plan, because it breaks as soon as the folder moves.
 */
export function extensionIdFromPath(extensionDir: string): string {
  const digest = crypto.createHash("sha256").update(path.resolve(extensionDir), "utf8").digest("hex");
  return digest
    .slice(0, 32)
    .split("")
    .map((c) => String.fromCharCode(97 + Number.parseInt(c, 16)))
    .join("");
}

export interface ExtensionManifestIds {
  chromium: string;
  gecko: string | null;
}

/**
 * Read the ids out of a built manifest, so the manifest stays the one place the
 * answer lives and the installer cannot disagree with what the browser will do.
 */
export function idsFromManifest(manifest: unknown): ExtensionManifestIds {
  const record = (manifest ?? {}) as {
    key?: unknown;
    browser_specific_settings?: { gecko?: { id?: unknown } };
  };

  const gecko = record.browser_specific_settings?.gecko?.id;
  return {
    chromium:
      typeof record.key === "string" && record.key.length > 0
        ? chromiumIdFromPublicKeyBase64(record.key)
        : "",
    gecko: typeof gecko === "string" && gecko.length > 0 ? gecko : null,
  };
}
