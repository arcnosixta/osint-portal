import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";

import { chromiumIdFromPublicKey, extensionIdFromPath, idsFromManifest } from "./extension-id.ts";
import { projectPath } from "./root.ts";

/** The public key pinned in manifest.chromium.json, as DER. */
const PINNED_KEY = Buffer.from(
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtDYxHJF2o4mzeNgrufzM7zzt3n1jKpDp9MIsiXfgR4EU+X8Vzxz/jhphGl21mn984zRb6D3JPQPCnSyCczh/4mlEMiJt6Kvs2r2y1d2exowHif/+C6STQrBHSBBsB1jSymnAs0lmmwPyjfmjo8Jm6BAFezff4lMoE4Imp6gHXJQvfOgl2LU2RvDxQf1h7u+dbLa/cH8Sp37mdBVo2BT1prrjROptA45MGpCntozdFEGb/XABRz+BP5hiEbc1bpm4QtO09qXJsJ4yYNm0scXBgzT/WUtG0ZLlrcjqWqO87ktzQNVJLsh/5KwZIZaa5MqlnOZzxrCWslDIzbK1Dhx4OQIDAQAB",
  "base64",
);

describe("chromiumIdFromPublicKey", () => {
  it("derives the id the browser will use from the pinned key", () => {
    // Regression guard: this exact id is what the installer writes into
    // allowed_origins, and the site stops working if the manifest key and the
    // registered id ever disagree.
    assert.equal(chromiumIdFromPublicKey(PINNED_KEY), "mogbkoolkaapdejniedklkdkkcegdlbd");
  });

  it("uses the a-p alphabet Chromium uses", () => {
    const id = chromiumIdFromPublicKey(PINNED_KEY);
    assert.equal(id.length, 32);
    assert.ok(/^[a-p]{32}$/.test(id), id);
  });

  it("gives a different id for a different key", () => {
    const other = Buffer.concat([PINNED_KEY, Buffer.from([0])]);
    assert.notEqual(chromiumIdFromPublicKey(other), chromiumIdFromPublicKey(PINNED_KEY));
  });
});

describe("extensionIdFromPath", () => {
  it("is only a fallback: it changes when the folder moves", () => {
    const a = extensionIdFromPath("/tmp/one");
    const b = extensionIdFromPath("/tmp/two");
    assert.notEqual(a, b);
    assert.ok(/^[a-p]{32}$/.test(a));
  });
});

describe("idsFromManifest", () => {
  it("reads both ids out of the extension sources in this repo", () => {
    const chrome = JSON.parse(fs.readFileSync(projectPath("extension", "manifest.chromium.json"), "utf8"));
    const firefox = JSON.parse(fs.readFileSync(projectPath("extension", "manifest.firefox.json"), "utf8"));

    assert.equal(idsFromManifest(chrome).chromium, "mogbkoolkaapdejniedklkdkkcegdlbd");
    assert.equal(idsFromManifest(firefox).gecko, "osint-portal@local.tools");
  });

  it("reports no Chromium id when the manifest has no key", () => {
    assert.equal(idsFromManifest({}).chromium, "");
    assert.equal(idsFromManifest({}).gecko, null);
  });

  it("does not invent a Gecko id from a Chromium-shaped manifest", () => {
    assert.equal(idsFromManifest({ key: PINNED_KEY.toString("base64") }).gecko, null);
  });
});
