/**
 * Capture source configuration and dispatching.
 * Supports "camera", "upload", and "synthetic" capture modes.
 */

export type CaptureMode = "camera" | "upload" | "synthetic";

export const DEFAULT_CAPTURE_MODE: CaptureMode =
  (import.meta.env.VITE_CAPTURE_MODE as CaptureMode) || "upload";

export interface CaptureSourceHandler {
  getSourceImage(): Promise<Blob>;
}
