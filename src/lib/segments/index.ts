import { runNmapSegment } from "./nmap";
import { runNetcatSegment } from "./netcat";
import { runDigSegment } from "./dig";
import { runHostSegment } from "./host";
import { runWhoisSegment } from "./whois";
import { runSherlockSegment } from "./sherlock";
import { runCurlSegment } from "./curl";
import { runOpensslSegment } from "./openssl";
import { runTracerouteSegment } from "./traceroute";
import { runJqSegment } from "./jq";
import { runMasscanSegment } from "./masscan";
import { runGobusterSegment } from "./gobuster";
import { runDnsreconSegment } from "./dnsrecon";
import { runSublist3rSegment } from "./sublist3r";
import { runTheHarvesterSegment } from "./theHarvester";
import { runMaigretSegment } from "./maigret";
import { runPython3Segment } from "./python3";

/** Shape of a run request as seen by segment runners. */
export interface SegmentRequest {
  tool?: string;
  target?: string;
  args?: string[];
}

/**
 * Segment output: a `message` plus optional structured fields that the executor
 * spreads into ToolRunResult (status, blocked, data, stdout, exitCode, ...).
 */
export type SegmentRunResult = { message: string } & Record<string, unknown>;

/** Segment contract: every runner resolves to a partial ToolRunResult. */
export type SegmentRunner = (req: SegmentRequest) => Promise<SegmentRunResult>;

export const SEGMENTS: Record<string, SegmentRunner> = {
  nmap: (req) => runNmapSegment(req.target, req.args ?? []),
  netcat: (req) => runNetcatSegment(req.target, req.args ?? []),
  dig: (req) => runDigSegment(req.target, req.args ?? []),
  host: (req) => runHostSegment(req.target, req.args ?? []),
  whois: (req) => runWhoisSegment(req.target, req.args ?? []),
  sherlock: (req) => runSherlockSegment(req.target, req.args ?? []),
  curl: (req) => runCurlSegment(req.target, req.args ?? []),
  openssl: (req) => runOpensslSegment(req.target, req.args ?? []),
  traceroute: (req) => runTracerouteSegment(req.target, req.args ?? []),
  jq: (req) => runJqSegment(req.target, req.args ?? []),
  masscan: (req) => runMasscanSegment(req.target, req.args ?? []),
  gobuster: (req) => runGobusterSegment(req.target, req.args ?? []),
  dnsrecon: (req) => runDnsreconSegment(req.target, req.args ?? []),
  sublist3r: (req) => runSublist3rSegment(req.target, req.args ?? []),
  theHarvester: (req) => runTheHarvesterSegment(req.target, req.args ?? []),
  maigret: (req) => runMaigretSegment(req.target, req.args ?? []),
  python3: (req) => runPython3Segment(req.target, req.args ?? []),
};

export function isSegmentConnected(toolId: string): boolean {
  return Object.prototype.hasOwnProperty.call(SEGMENTS, toolId);
}