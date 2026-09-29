import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { EvidenceBackend, EvidenceItem } from "../src/lib/evidence.ts";

/**
 * Disk-backed case file for the local runner.
 *
 * Writes are atomic (temp file + rename) so a crash mid-write can never leave a
 * truncated case file behind. Reads are lazy and cached by the evidence module,
 * so this only touches the filesystem on boot and after each recorded run.
 */
export function createFileBackend(file: string): EvidenceBackend {
  let tmpCounter = 0;

  const ensureDir = () => {
    const dir = dirname(file);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  };

  return {
    read(): EvidenceItem[] {
      if (!existsSync(file)) return [];
      try {
        const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(
          (i): i is EvidenceItem =>
            !!i &&
            typeof i === "object" &&
            typeof (i as EvidenceItem).id === "string" &&
            typeof (i as EvidenceItem).tool === "string",
        );
      } catch {
        return [];
      }
    },

    write(items: EvidenceItem[]): void {
      ensureDir();
      const tmp = `${file}.${process.pid}.${++tmpCounter}.tmp`;
      writeFileSync(tmp, JSON.stringify(items, null, 2), "utf8");
      renameSync(tmp, file);
    },

    reset(): void {
      if (existsSync(file)) writeFileSync(file, "[]", "utf8");
    },
  };
}

/** Default case-file location, overridable with `OSINT_CASE_FILE`. */
export function defaultCaseFile(): string {
  const fromEnv = process.env.OSINT_CASE_FILE?.trim();
  if (fromEnv) return fromEnv;
  return join(process.cwd(), ".osint-portal", "evidence.json");
}
