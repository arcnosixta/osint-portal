import { isIP } from "node:net";

/**
 * Target allow-list for tool execution.
 *
 * No segment may run against a target that is not inside this allow-list.
 * Defaults to loopback + private/link-local ranges only; operators extend it
 * with `OSINT_ALLOWED_TARGETS` (comma-separated CIDRs, IPs or domains) to
 * cover exactly the assets they own or are authorized to test.
 */

export interface Cidr {
  family: 4 | 6;
  bits: number;
  int: bigint;
}

function ipv4ToInt(ip: string): bigint | null {
  if (isIP(ip) !== 4) return null;
  const o = ip.split(".").map(Number);
  return BigInt(((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0);
}

/** Parse an IPv6 address (incl. `::` compression and embedded IPv4) to a 128-bit int. */
export function ipv6ToBigInt(ip: string): bigint | null {
  if (isIP(ip) !== 6) return null;

  const split = ip.split("::");
  if (split.length > 2) return null;

  const head = split[0];
  const tail = split.length === 2 ? split[1] : undefined;
  const expanded = split.length === 2;
  const headGroups = head ? groupsFromHexPart(head) : [];
  const tailGroups = tail ? groupsFromHexPart(tail) : [];

  if (!headGroups || !tailGroups) return null;

  const groups = expanded
    ? [...headGroups, ...new Array<number>(8 - headGroups.length - tailGroups.length).fill(0), ...tailGroups]
    : headGroups;

  if (groups.length !== 8) return null;

  let int = 0n;
  for (const g of groups) int = (int << 16n) | BigInt(g);
  return int;
}

/** Split an IPv6 hex part into 16-bit groups, resolving an embedded IPv4 tail. */
function groupsFromHexPart(part: string): number[] | null {
  const segs = part.split(":");
  const out: number[] = [];
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (s.includes(".")) {
      if (i !== segs.length - 1) return null;
      const v4 = ipv4ToInt(s);
      if (v4 === null) return null;
      out.push(Number((v4 >> 16n) & 0xffffn), Number(v4 & 0xffffn));
    } else {
      if (s.length === 0) return null;
      const g = parseInt(s, 16);
      if (Number.isNaN(g) || g > 0xffff) return null;
      out.push(g);
    }
  }
  return out;
}

/** `10.0.0.0/8` -> { family, bits, int } or null. */
export function parseCidr(input: string): Cidr | null {
  const m = /^([0-9a-f.:]+)\/(\d{1,3})$/i.exec(input.trim());
  if (!m) return null;
  const [, addr, bitsStr] = m;
  const bits = Number(bitsStr);

  if (isIP(addr) === 4) {
    if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(addr) || bits > 32) return null;
    const int = ipv4ToInt(addr);
    return int === null ? null : { family: 4, bits, int };
  }
  if (isIP(addr) === 6) {
    if (bits > 128) return null;
    const int = ipv6ToBigInt(addr);
    return int === null ? null : { family: 6, bits, int };
  }
  return null;
}

const DEFAULT_V4: Cidr[] = [
  parseCidr("127.0.0.0/8")!,
  parseCidr("10.0.0.0/8")!,
  parseCidr("172.16.0.0/12")!,
  parseCidr("192.168.0.0/16")!,
  parseCidr("169.254.0.0/16")!,
];
const DEFAULT_V6: Cidr[] = [
  parseCidr("::1/128")!,
  parseCidr("fc00::/7")!,
  parseCidr("fe80::/10")!,
];
const DEFAULT_HOSTS = new Set(["localhost", "localhost.localdomain"]);

export class AllowList {
  private readonly v4: Cidr[];
  private readonly v6: Cidr[];
  private readonly hosts: Set<string>;

  constructor(entries: string[]) {
    this.v4 = [...DEFAULT_V4];
    this.v6 = [...DEFAULT_V6];
    this.hosts = new Set(DEFAULT_HOSTS);

    for (const raw of entries) {
      const e = raw.trim();
      if (!e) continue;
      const cidr = parseCidr(e);
      if (cidr) {
        if (cidr.family === 4) this.v4.push(cidr);
        else this.v6.push(cidr);
        continue;
      }
      if (/^[a-z0-9.-]+$/i.test(e)) {
        this.hosts.add(e.replace(/\.$/, "").toLowerCase());
      }
    }
  }

  /**
   * Target eligibility. By default only explicitly allow-listed IPs, CIDRs and
   * hostnames pass. When `publicHostnames` is true, any well-formed hostname
   * (public or local) is also allowed — used by read-only DNS/registry segments
   * (dig, host, whois) where the query itself is the intent. Raw IP/CIDR
   * targets are still strictly gated, so the portal never becomes an open
   * scanning relay.
   */
  contains(target: string, opts?: { publicHostnames?: boolean }): boolean {
    const t = target.trim();
    if (!t) return false;

    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(t)) return this.containsIpv4(t);
    if (t.includes(":") && isIP(t) === 6) return this.containsIpv6(t);

    if (t.includes("/")) {
      const cidr = parseCidr(t);
      if (cidr) {
        const blocks = cidr.family === 4 ? this.v4 : this.v6;
        return blocks.some((b) => cidrContains(b, cidr));
      }
      return false;
    }

    const host = t.replace(/\.$/, "").toLowerCase();
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/.test(host)) return false;
    if (opts?.publicHostnames) return true;
    for (const allowed of this.hosts) {
      if (host === allowed || host.endsWith("." + allowed)) return true;
    }
    return false;
  }

  describe(): string {
    const v4 = this.v4.map((c) => formatCidr(c)).join(", ");
    return `allowed: ${v4 || "none"}`;
  }

  private containsIpv4(ip: string): boolean {
    const int = ipv4ToInt(ip);
    if (int === null) return false;
    return this.v4.some((b) => blockContainsInt(b, int));
  }

  private containsIpv6(ip: string): boolean {
    const int = ipv6ToBigInt(ip);
    if (int === null) return false;
    return this.v6.some((b) => blockContainsInt(b, int));
  }
}

function cidrContains(superBlock: Cidr, sub: Cidr): boolean {
  if (superBlock.family !== sub.family) return false;
  if (sub.bits < superBlock.bits) return false;
  return blockContainsInt(superBlock, sub.int);
}

function blockContainsInt(block: Cidr, int: bigint): boolean {
  if (block.bits === 0) return true;
  const width = block.family === 4 ? 32 : 128;
  const shift = BigInt(width) - BigInt(block.bits);
  return (int >> shift) === (block.int >> shift);
}

function formatCidr(c: Cidr): string {
  // best-effort pretty-print for error messages
  if (c.family === 4) {
    const b = (c.int & 0xffffffffn);
    return `${Number((b >> 24n) & 0xffn)}.${Number((b >> 16n) & 0xffn)}.${Number((b >> 8n) & 0xffn)}.${Number(b & 0xffn)}/${c.bits}`;
  }
  return `::<${c.bits}>`;
}

let singleton: AllowList | null = null;

/** Process-wide allow-list built from `OSINT_ALLOWED_TARGETS`. */
export function getAllowList(): AllowList {
  if (singleton) return singleton;
  const raw = (process.env.OSINT_ALLOWED_TARGETS ?? "").split(",").filter(Boolean);
  singleton = new AllowList(raw);
  return singleton;
}

/** Allow-list source string for diagnostics. */
export function allowListSource(): string {
  return process.env.OSINT_ALLOWED_TARGETS ?? "<defaults>";
}