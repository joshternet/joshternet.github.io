/**
 * Goal & Constraints:
 * Authoritative content-addressed source blobs survive Actions runners and are
 * never Git-tracked by default. Persist+verify before any source_hash ref.
 * GC may delete only unreferenced blobs. Fail closed when unavailable.
 */

import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  writeFile,
  access,
  readdir,
  unlink,
} from "node:fs/promises";
import path from "node:path";

import { hashSourceBody } from "./resource-observation.mjs";

/**
 * @typedef {object} SourceStore
 * @property {(body: string|Uint8Array|Buffer) => Promise<{ source_hash: string, bytes: number }>} put
 * @property {(sourceHash: string) => Promise<Buffer>} get
 * @property {(sourceHash: string) => Promise<boolean>} has
 * @property {(sourceHash: string) => Promise<boolean>} verify
 * @property {(keepHashes: Iterable<string>) => Promise<{ deleted: number }>} garbageCollect
 */

/**
 * Filesystem-backed content-addressed source store for local/test and configured
 * durable paths (e.g. mounted volume or synced object-store mirror).
 * @param {{ rootDir: string }} options
 * @returns {SourceStore}
 */
export function createFilesystemSourceStore(options) {
  const rootDir = path.resolve(String(options?.rootDir || ""));
  if (!rootDir) {
    throw new Error("source store rootDir is required");
  }

  /**
   * @param {string} sourceHash
   * @returns {string}
   */
  function objectPath(sourceHash) {
    const hash = String(sourceHash || "").toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(hash)) {
      throw new Error(`invalid source_hash: ${sourceHash}`);
    }
    return path.join(rootDir, hash.slice(0, 2), hash.slice(2, 4), hash);
  }

  const store = {
    /**
     * @param {string|Uint8Array|Buffer} body
     * @returns {Promise<{ source_hash: string, bytes: number }>}
     */
    async put(body) {
      const sourceHash = hashSourceBody(body);
      const target = objectPath(sourceHash);
      await mkdir(path.dirname(target), { recursive: true });
      const buffer =
        typeof body === "string" ? Buffer.from(body) : Buffer.from(body);
      let exists = false;
      try {
        await access(target);
        exists = true;
      } catch {
        exists = false;
      }
      if (exists) {
        const ok = await store.verify(sourceHash);
        if (!ok) {
          throw new Error(`corrupt existing source blob: ${sourceHash}`);
        }
        return { source_hash: sourceHash, bytes: buffer.byteLength };
      }
      await writeFile(target, buffer);
      const ok = await store.verify(sourceHash);
      if (!ok) {
        throw new Error(
          `source blob failed read-after-write verify: ${sourceHash}`,
        );
      }
      return { source_hash: sourceHash, bytes: buffer.byteLength };
    },

    /**
     * @param {string} sourceHash
     * @returns {Promise<Buffer>}
     */
    async get(sourceHash) {
      return readFile(objectPath(sourceHash));
    },

    /**
     * @param {string} sourceHash
     * @returns {Promise<boolean>}
     */
    async has(sourceHash) {
      try {
        await access(objectPath(sourceHash));
        return true;
      } catch {
        return false;
      }
    },

    /**
     * @param {string} sourceHash
     * @returns {Promise<boolean>}
     */
    async verify(sourceHash) {
      try {
        const body = await store.get(sourceHash);
        const actual = createHash("sha256").update(body).digest("hex");
        return actual === String(sourceHash).toLowerCase();
      } catch {
        return false;
      }
    },

    /**
     * @param {Iterable<string>} keepHashes
     * @returns {Promise<{ deleted: number }>}
     */
    async garbageCollect(keepHashes) {
      const keep = new Set(
        [...keepHashes].map((value) => String(value).toLowerCase()),
      );
      let deleted = 0;
      /**
       * @param {string} dir
       * @returns {Promise<void>}
       */
      async function walk(dir) {
        let entries = [];
        try {
          entries = await readdir(dir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await walk(full);
            continue;
          }
          const hash = path.basename(full);
          if (!/^[a-f0-9]{64}$/.test(hash)) {
            continue;
          }
          if (!keep.has(hash)) {
            await unlink(full);
            deleted += 1;
          }
        }
      }
      await walk(rootDir);
      return { deleted };
    },
  };
  return store;
}

/**
 * Persists a body then returns its hash only after verification.
 * @param {SourceStore} store
 * @param {string|Uint8Array|Buffer} body
 * @returns {Promise<string>}
 */
export async function persistVerifiedSourceBlob(store, body) {
  if (!store || typeof store.put !== "function") {
    throw new Error("source store unavailable");
  }
  const { source_hash: sourceHash } = await store.put(body);
  const ok = await store.verify(sourceHash);
  if (!ok) {
    throw new Error(`source store verify failed for ${sourceHash}`);
  }
  return sourceHash;
}

/**
 * Asserts a source_hash is present and intact before observation persistence.
 * @param {SourceStore} store
 * @param {string} sourceHash
 * @returns {Promise<void>}
 */
export async function assertSourceBlobReady(store, sourceHash) {
  if (!store) {
    throw new Error("source store unavailable");
  }
  const ok = await store.verify(sourceHash);
  if (!ok) {
    throw new Error(`missing or corrupt source blob: ${sourceHash}`);
  }
}
