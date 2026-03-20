import { AuditStep } from "./types.js";

export function createAuditStep(
  stage: string,
  message: string,
  level: AuditStep["level"] = "info",
  data?: Record<string, unknown>
): AuditStep {
  return {
    ts: new Date().toISOString(),
    level,
    stage,
    message,
    ...(data ? { data } : {})
  };
}

export function pushAudit(
  audit: AuditStep[],
  stage: string,
  message: string,
  level: AuditStep["level"] = "info",
  data?: Record<string, unknown>
): void {
  audit.push(createAuditStep(stage, message, level, data));
}
