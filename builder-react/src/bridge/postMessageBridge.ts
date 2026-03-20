export type MessageType =
  | "READY"
  | "INIT"
  | "LOAD_TEMPLATE"
  | "EXPORT_TEMPLATE"
  | "SAVE_TEMPLATE"
  | "RUN"
  | "RESULT"
  | "ERROR"
  | "PING"
  | "PONG";

export interface BridgeEnvelope<T = unknown> {
  app: "UWC";
  version: 1;
  type: MessageType;
  requestId: string;
  payload: T;
}

const APP_ID = "UWC" as const;
const VERSION = 1 as const;
const ALLOWED_TYPES = new Set<MessageType>([
  "READY",
  "INIT",
  "LOAD_TEMPLATE",
  "EXPORT_TEMPLATE",
  "SAVE_TEMPLATE",
  "RUN",
  "RESULT",
  "ERROR",
  "PING",
  "PONG"
]);

function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function validateEnvelope(raw: unknown): { ok: true; value: BridgeEnvelope } | { ok: false; reason: string } {
  if (!raw || typeof raw !== "object") return { ok: false, reason: "Envelope is not an object." };
  const msg = raw as Record<string, unknown>;
  if (msg.app !== APP_ID) return { ok: false, reason: "Invalid app field." };
  if (msg.version !== VERSION) return { ok: false, reason: "Invalid version." };
  if (typeof msg.type !== "string" || !ALLOWED_TYPES.has(msg.type as MessageType)) {
    return { ok: false, reason: "Invalid message type." };
  }
  if (typeof msg.requestId !== "string" || msg.requestId.length < 4) {
    return { ok: false, reason: "Invalid requestId." };
  }
  if (!("payload" in msg)) return { ok: false, reason: "Missing payload." };
  if (!msg.payload || typeof msg.payload !== "object" || Array.isArray(msg.payload)) {
    return { ok: false, reason: "Invalid payload type." };
  }

  return {
    ok: true,
    value: msg as BridgeEnvelope
  };
}

export interface BridgeOptions {
  hostOrigins: string[];
  targetOrigin: string;
  onMalformed?: (reason: string) => void;
}

export type BridgeMessageHandler = (message: BridgeEnvelope, event: MessageEvent) => void;

export class PostMessageBridge {
  private readonly hostOrigins: Set<string>;
  private readonly targetOrigin: string;
  private readonly handlers = new Set<BridgeMessageHandler>();
  private readonly onMalformed?: (reason: string) => void;

  constructor(options: BridgeOptions) {
    this.hostOrigins = new Set(options.hostOrigins);
    this.targetOrigin = options.targetOrigin;
    this.onMalformed = options.onMalformed;
  }

  start(): void {
    window.addEventListener("message", this.handleIncoming);
  }

  stop(): void {
    window.removeEventListener("message", this.handleIncoming);
    this.handlers.clear();
  }

  subscribe(handler: BridgeMessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  send<T = unknown>(type: MessageType, payload: T, requestId = uuid()): BridgeEnvelope<T> {
    const envelope: BridgeEnvelope<T> = {
      app: APP_ID,
      version: VERSION,
      type,
      requestId,
      payload
    };

    if (!window.parent || window.parent === window) {
      return envelope;
    }

    window.parent.postMessage(envelope, this.targetOrigin);
    return envelope;
  }

  private handleIncoming = (event: MessageEvent): void => {
    if (!this.hostOrigins.has(event.origin)) {
      return;
    }

    if (event.source !== window.parent) {
      return;
    }

    const validated = validateEnvelope(event.data);
    if (!validated.ok) {
      this.onMalformed?.(validated.reason);
      return;
    }

    this.handlers.forEach((handler) => handler(validated.value, event));
  };
}

export function resolveHostOrigins(): { hostOrigins: string[]; targetOrigin: string } {
  const fromQuery = new URLSearchParams(window.location.search).get("hostOrigin");
  const fromReferrer = (() => {
    if (!document.referrer) return null;
    try {
      return new URL(document.referrer).origin;
    } catch {
      return null;
    }
  })();

  const origin = fromQuery || fromReferrer;
  if (!origin) {
    throw new Error("Cannot resolve host origin. Provide ?hostOrigin=<origin>.");
  }

  return {
    hostOrigins: [origin],
    targetOrigin: origin
  };
}

