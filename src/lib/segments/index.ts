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
};

export function isSegmentConnected(toolId: string): boolean {
  return Object.prototype.hasOwnProperty.call(SEGMENTS, toolId);
}