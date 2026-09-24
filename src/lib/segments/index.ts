import { runNmapSegment } from "./nmap";

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
};

export function isSegmentConnected(toolId: string): boolean {
  return Object.prototype.hasOwnProperty.call(SEGMENTS, toolId);
}