import { expect, test, type Browser, type BrowserContext, type Page, type Route } from "@playwright/test";

const MOBILE_VIEWPORT = { width: 430, height: 932 };

const COMPANY_CONFIG = {
  displayName: "Straight Wire Electric",
  legalName: "Straight Wire Electric LLC",
  tagline: "Service Portal",
  logoUrl: "assets/images/logo.webp",
  backgroundImageUrl: "assets/images/bg-electric.webp",
  backgrounds: {
    default: { url: "assets/images/bg-electric.webp", fit: "cover" },
  },
};

const NOTIFICATION_SETTINGS = {
  whatsapp: {
    transport: "noop",
    webhookUrl: "",
    webhookToken: "",
  },
  telegram: {
    transport: "disabled",
    botToken: "",
    defaultChatId: "",
  },
};

const NOTIFICATION_CHANNELS = {
  whatsapp: {
    state: "idle",
    label: "Listo",
    ready: true,
    active: false,
  },
  telegram: {
    state: "idle",
    label: "Listo",
    ready: true,
    active: false,
  },
};

const BOSS_USER = {
  uid: "boss-user-1",
  email: "boss@straightwireelectric.com",
  displayName: "Boss Mock",
  role: "boss",
};

const EMPLOYEE_USER = {
  uid: "employee-user-1",
  email: "tech@straightwireelectric.com",
  displayName: "Tech Mock",
  role: "employee",
};

const CLIENT_USER = {
  uid: "client-user-1",
  email: "cliente@straightwireelectric.com",
  displayName: "Cliente Mock",
  role: "client",
};

const EMPLOYEE_PROFILE = {
  id: EMPLOYEE_USER.uid,
  name: EMPLOYEE_USER.displayName,
  displayName: EMPLOYEE_USER.displayName,
  email: EMPLOYEE_USER.email,
  age: 31,
  address: "742 Very Long Responsive Boulevard, Los Angeles, CA 90037, apartamento 18, edificio principal, acceso lateral con referencia adicional para comprobar wrapping.",
  photoUrl: "assets/images/logo.webp",
  profilePhoto: "assets/images/logo.webp",
  portfolio: [
    { url: "assets/images/logo.webp" },
    { url: "assets/images/logo.webp" },
    { url: "assets/images/logo.webp" },
  ],
  rating: {
    average: 4.7,
    totalRatings: 18,
  },
};

const BOSS_REQUESTS = [
  {
    id: "boss-req-1",
    clientNickname: "Cliente Norte",
    clientEmail: "norte@example.com",
    category: "electricidad residencial",
    urgencia: "alta",
    status: "EN_ESPERA",
    description: "Instalacion completa de panel y revision de una descripcion bastante larga para comprobar saltos de linea sin romper el layout.",
    address: "742 Evergreen Terrace, Los Angeles, CA 90037, apartamento 18, edificio con acceso lateral y patio trasero.",
    assignedEmployeeId: "",
    employeeName: "",
    createdAt: "2026-03-09T15:00:00.000Z",
  },
  {
    id: "boss-req-2",
    clientNickname: "Cliente Centro",
    clientEmail: "centro@example.com",
    category: "comercial",
    urgencia: "media",
    status: "ASIGNADO",
    description: "Revision de circuito para restaurante con cocina industrial y tablero secundario.",
    address: "101 Main Street, Los Angeles, CA 90011",
    assignedEmployeeId: EMPLOYEE_USER.uid,
    employeeName: EMPLOYEE_USER.displayName,
    createdAt: "2026-03-09T13:20:00.000Z",
  },
  {
    id: "boss-req-3",
    clientNickname: "Cliente Sur",
    clientEmail: "sur@example.com",
    category: "mantenimiento",
    urgencia: "baja",
    status: "PAGO_PENDIENTE_REVISION",
    description: "Trabajo finalizado con comprobante pendiente de revisar.",
    address: "22 Sunset Blvd, Los Angeles, CA 90008",
    assignedEmployeeId: EMPLOYEE_USER.uid,
    employeeName: EMPLOYEE_USER.displayName,
    paymentProofUrl: "assets/images/logo.webp",
    createdAt: "2026-03-08T19:30:00.000Z",
  },
  {
    id: "boss-req-4",
    clientNickname: "Cliente Este",
    clientEmail: "este@example.com",
    category: "emergencia",
    urgencia: "alta",
    status: "EN_PROCESO",
    description: "Restablecer servicio tras corto en linea principal.",
    address: "55 Hill Road, Los Angeles, CA 90044",
    assignedEmployeeId: EMPLOYEE_USER.uid,
    employeeName: EMPLOYEE_USER.displayName,
    createdAt: "2026-03-07T10:15:00.000Z",
  },
];

const REVIEW_QUEUE = [
  {
    recordId: "boss-req-3",
    sourceType: "request",
    sourceLabel: "Solicitud",
    amount: 980,
    proofDateRaw: "2026-03-08T21:00:00.000Z",
    proofUrl: "assets/images/logo.webp",
    employeeName: EMPLOYEE_USER.displayName,
    clientName: "Cliente Sur",
    description: "Pago final del servicio comercial",
    address: "22 Sunset Blvd, Los Angeles, CA 90008",
  },
];

const EMERGENCY_CALLS = [
  {
    id: "emergency-1",
    assignedEmployeeId: EMPLOYEE_USER.uid,
    employeeName: EMPLOYEE_USER.displayName,
    clientName: "Cliente Emergencia",
    issue: "Corto principal con chispas en medidor exterior",
    location: "900 Emergency Ave, Los Angeles, CA 90003",
    amount: 420,
    status: "accepted",
    createdAt: "2026-03-09T12:10:00.000Z",
  },
];

const EMPLOYEE_AVAILABLE_REQUESTS = [
  {
    id: "employee-available-1",
    clientNickname: "Casa Rivera",
    category: "panel upgrade",
    urgencia: "alta",
    status: "EN_ESPERA",
    description: "Cambio de panel principal con acometida antigua y espacio de maniobra reducido.",
    address: "871 Long Responsive Street, Los Angeles, CA 90016",
    createdAt: "2026-03-09T09:00:00.000Z",
  },
  {
    id: "employee-available-2",
    clientNickname: "Cafe Downtown",
    category: "iluminacion",
    urgencia: "media",
    status: "EN_ESPERA",
    description: "Sistema de luminarias LED con varias zonas y horario programable.",
    address: "12 Market Street, Los Angeles, CA 90021",
    createdAt: "2026-03-08T15:15:00.000Z",
  },
];

const EMPLOYEE_MY_REQUESTS = [
  {
    id: "employee-mine-1",
    clientNickname: "Oficina Delta",
    category: "comercial",
    urgencia: "media",
    status: "EN_PROCESO",
    description: "Canalizacion y toma dedicada para equipo HVAC.",
    address: "88 Industry Road, Los Angeles, CA 90058",
    assignedEmployeeId: EMPLOYEE_USER.uid,
    employeeName: EMPLOYEE_USER.displayName,
    createdAt: "2026-03-08T10:00:00.000Z",
  },
];

const CLIENT_REQUESTS = [
  {
    id: "client-req-1",
    status: "NEGOCIANDO",
    description: "Instalacion de alimentacion y control de carga para equipo de cocina industrial con varios circuitos secundarios.",
    address: "4910 Long Client Avenue, Los Angeles, CA 90019, local B, segundo nivel",
    createdAt: "2026-03-09T08:45:00.000Z",
    assignedEmployeeId: EMPLOYEE_USER.uid,
    employeeName: EMPLOYEE_USER.displayName,
    employeeEmail: EMPLOYEE_USER.email,
    clientNickname: "Cliente Principal",
    proposal: {
      amount: 1450,
      notes: "Incluye materiales base y visita de seguimiento.",
      estimatePdfUrl: "assets/images/logo.webp",
    },
  },
  {
    id: "client-req-2",
    status: "EN_ESPERA",
    description: "Revision general del tablero y tomacorrientes.",
    address: "12 Simple Street, Los Angeles, CA 90012",
    createdAt: "2026-03-07T17:30:00.000Z",
    clientNickname: "Cliente Secundario",
  },
  {
    id: "client-req-3",
    status: "COMPLETADO",
    description: "Cambio de interruptores y cierre final.",
    address: "99 Final Road, Los Angeles, CA 90045",
    createdAt: "2026-03-01T11:15:00.000Z",
    clientNickname: "Cliente Historico",
    finalAmount: 680,
    clientRating: 5,
  },
];

const CHAT_MESSAGES: Record<string, Array<Record<string, unknown>>> = {
  "client-req-1": [
    {
      id: "chat-1",
      senderId: EMPLOYEE_USER.uid,
      senderRole: "employee",
      text: "Voy en camino con el material base.",
      createdAt: "2026-03-09T10:00:00.000Z",
    },
    {
      id: "chat-2",
      senderId: CLIENT_USER.uid,
      senderRole: "client",
      text: "Perfecto, te espero en el local principal.",
      createdAt: "2026-03-09T10:05:00.000Z",
    },
  ],
  "boss-req-1": [
    {
      id: "boss-chat-1",
      senderId: CLIENT_USER.uid,
      senderRole: "client",
      text: "Tengo un tablero antiguo con una etiqueta extremadamente larga para comprobar wrapping y estabilidad en el chat del jefe sin provocar overflow horizontal.",
      createdAt: "2026-03-09T10:12:00.000Z",
    },
    {
      id: "boss-chat-2",
      senderId: EMPLOYEE_USER.uid,
      senderRole: "employee",
      text: "Recibido. Llevaré protección adicional y revisaré la acometida antes de preparar la propuesta.",
      createdAt: "2026-03-09T10:14:00.000Z",
    },
  ],
  "employee-mine-1": [
    {
      id: "employee-chat-1",
      senderId: CLIENT_USER.uid,
      senderRole: "client",
      text: "Te espero en recepción. La entrada de carga está por el costado norte y la puerta principal tiene el código 4421.",
      createdAt: "2026-03-09T09:20:00.000Z",
    },
    {
      id: "employee-chat-2",
      senderId: EMPLOYEE_USER.uid,
      senderRole: "employee",
      text: "Perfecto, llegaré con herramienta y revisaré el área antes de empezar.",
      createdAt: "2026-03-09T09:24:00.000Z",
    },
  ],
};

function attachErrorCapture(page: Page) {
  const errors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  page.on("pageerror", (error) => {
    errors.push(String(error));
  });

  return errors;
}

async function getHorizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return Math.max(
      (doc?.scrollWidth || 0) - (doc?.clientWidth || 0),
      (body?.scrollWidth || 0) - (body?.clientWidth || 0),
    );
  });
}

async function getViewportFit(page: Page, selector: string) {
  return page.locator(selector).evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return {
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      width: rect.width,
      height: rect.height,
      overflowY: style.overflowY,
      maxHeight: style.maxHeight,
    };
  });
}

async function fulfillJson(route: Route, payload: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(payload),
  });
}

async function installFirebaseMocks(
  context: BrowserContext,
  options: {
    role: "boss" | "employee" | "client";
    user: typeof BOSS_USER | typeof EMPLOYEE_USER | typeof CLIENT_USER;
    firestoreRequests?: Array<Record<string, unknown>>;
  },
) {
  const userJson = JSON.stringify(options.user);
  const roleJson = JSON.stringify(options.role);
  const firestoreJson = JSON.stringify(options.firestoreRequests || []);

  await context.route(/\/assets\/js\/firebase\.js(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      contentType: "application/javascript",
      body: `
        const rawUser = ${userJson};
        const role = ${roleJson};
        function buildUser() {
          return {
            ...rawUser,
            async getIdToken() { return "mock-token"; },
            async getIdTokenResult() { return { claims: { role } }; },
          };
        }
        export const app = {};
        export const auth = { currentUser: buildUser() };
        export const db = {};
        export const onAuthStateChanged = (_auth, callback) => {
          queueMicrotask(() => callback(auth.currentUser));
          return () => {};
        };
      `,
    });
  });

  await context.route(/\/assets\/vendor\/firebase\/firebase-auth\.js(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      contentType: "application/javascript",
      body: `
        const rawUser = ${userJson};
        const role = ${roleJson};
        function buildUser() {
          return {
            ...rawUser,
            async getIdToken() { return "mock-token"; },
            async getIdTokenResult() { return { claims: { role } }; },
          };
        }
        export const browserLocalPersistence = {};
        export function getAuth() {
          return { currentUser: buildUser() };
        }
        export async function setPersistence() { return true; }
        export function onAuthStateChanged(auth, callback) {
          const user = buildUser();
          if (auth && typeof auth === "object") auth.currentUser = user;
          queueMicrotask(() => callback(user));
          return () => {};
        }
        export async function signOut(auth) {
          if (auth && typeof auth === "object") auth.currentUser = null;
          return true;
        }
        export async function getIdTokenResult(user) {
          return user?.getIdTokenResult ? user.getIdTokenResult() : { claims: { role } };
        }
        export async function signInWithEmailAndPassword() {
          return { user: buildUser() };
        }
      `,
    });
  });

  await context.route(/\/assets\/vendor\/firebase\/firebase-firestore\.js(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      contentType: "application/javascript",
      body: `
        const rawDocs = ${firestoreJson};

        function revive(value) {
          if (!value || typeof value !== "object") return value;
          if (Array.isArray(value)) return value.map(revive);
          const out = {};
          for (const [key, entry] of Object.entries(value)) {
            if (key === "createdAt" && typeof entry === "string") {
              out[key] = {
                toDate: () => new Date(entry),
              };
              continue;
            }
            out[key] = revive(entry);
          }
          return out;
        }

        function makeSnapshot(docs) {
          const entries = docs.map((item) => {
            const data = revive(item.data || {});
            return {
              id: item.id,
              data: () => data,
            };
          });

          return {
            docs: entries,
            size: entries.length,
            forEach(callback) {
              entries.forEach(callback);
            },
          };
        }

        function applyConstraints(target, constraints = []) {
          let docs = Array.isArray(target) ? target.slice() : [];

          for (const constraint of constraints) {
            if (!constraint || typeof constraint !== "object") continue;

            if (constraint.type === "where" && constraint.op === "==") {
              docs = docs.filter((doc) => (doc.data || {})[constraint.field] === constraint.value);
            }

            if (constraint.type === "orderBy") {
              docs.sort((left, right) => {
                const leftValue = new Date((left.data || {})[constraint.field] || 0).getTime();
                const rightValue = new Date((right.data || {})[constraint.field] || 0).getTime();
                return constraint.direction === "desc" ? rightValue - leftValue : leftValue - rightValue;
              });
            }

            if (constraint.type === "limit") {
              docs = docs.slice(0, constraint.value);
            }
          }

          return docs;
        }

        export function collection(_db, name) {
          return { name };
        }

        export function where(field, op, value) {
          return { type: "where", field, op, value };
        }

        export function orderBy(field, direction = "asc") {
          return { type: "orderBy", field, direction };
        }

        export function limit(value) {
          return { type: "limit", value };
        }

        export function query(ref, ...constraints) {
          return { ref, constraints };
        }

        export function onSnapshot(q, onNext, onError) {
          queueMicrotask(() => {
            try {
              onNext(makeSnapshot(applyConstraints(rawDocs, q?.constraints)));
            } catch (error) {
              if (onError) onError(error);
            }
          });
          return () => {};
        }

        export async function getDocs(q) {
          return makeSnapshot(applyConstraints(rawDocs, q?.constraints));
        }

        export function doc(_db, collectionName, id) {
          return { collectionName, id };
        }

        export async function getDoc(ref) {
          return {
            exists: () => true,
            data: () => ({
              role: "boss",
              name: ref?.id === ${JSON.stringify(EMPLOYEE_USER.uid)} ? ${JSON.stringify(EMPLOYEE_USER.displayName)} : "Usuario Mock",
              displayName: ref?.id === ${JSON.stringify(EMPLOYEE_USER.uid)} ? ${JSON.stringify(EMPLOYEE_USER.displayName)} : "Usuario Mock",
            }),
          };
        }

        export async function runTransaction(_db, callback) {
          return callback({
            async get() {
              return {
                exists: () => false,
                data: () => ({}),
              };
            },
            set() {},
            update() {},
          });
        }

        export async function addDoc(_collectionRef, data) {
          return {
            id: "mock-audit-log-1",
            data,
          };
        }

        export function serverTimestamp() {
          return new Date().toISOString();
        }
      `,
    });
  });
}

async function installCommonNetworkMocks(
  context: BrowserContext,
  scenario: {
    role: "boss" | "employee" | "client";
    clientRequests?: Array<Record<string, unknown>>;
    employeeAvailableRequests?: Array<Record<string, unknown>>;
    employeeMyRequests?: Array<Record<string, unknown>>;
    bossReviewQueue?: Array<Record<string, unknown>>;
    bossEmergencies?: Array<Record<string, unknown>>;
    chatByRequest?: Record<string, Array<Record<string, unknown>>>;
  },
) {
  const detailedClientRequests = new Map(
    (scenario.clientRequests || []).map((request) => [String(request.id || ""), request]),
  );

  await context.route(/\/auth\/portal-session(?:\?.*)?$/, async (route) => {
    await fulfillJson(route, {
      ok: true,
      role: scenario.role,
      authAt: Date.now(),
    });
  });

  await context.route(/\/public\/company-config(?:\?.*)?$/, async (route) => {
    await fulfillJson(route, {
      data: COMPANY_CONFIG,
    });
  });

  await context.route(/\/api\/.*$/, async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path === "/api/client/me") {
      await fulfillJson(route, {
        data: {
          id: CLIENT_USER.uid,
          email: CLIENT_USER.email,
        },
      });
      return;
    }

    if (path === "/api/marketplace/requests") {
      await fulfillJson(route, {
        data: scenario.clientRequests || [],
      });
      return;
    }

    if (path === "/api/marketplace/requests/available") {
      await fulfillJson(route, {
        data: scenario.employeeAvailableRequests || [],
      });
      return;
    }

    if (path === "/api/marketplace/employee/my-requests") {
      await fulfillJson(route, {
        data: scenario.employeeMyRequests || [],
      });
      return;
    }

    if (path === "/api/marketplace/emergency-calls") {
      await fulfillJson(route, {
        data: scenario.bossEmergencies || [],
      });
      return;
    }

    if (path === "/api/marketplace/boss/review-queue") {
      await fulfillJson(route, {
        data: scenario.bossReviewQueue || [],
      });
      return;
    }

    if (path === "/api/boss/company-config") {
      await fulfillJson(route, {
        data: COMPANY_CONFIG,
      });
      return;
    }

    if (path === "/api/boss/notifications/settings") {
      await fulfillJson(route, {
        data: NOTIFICATION_SETTINGS,
      });
      return;
    }

    if (path === "/api/boss/notifications/channels") {
      await fulfillJson(route, {
        data: NOTIFICATION_CHANNELS,
      });
      return;
    }

    if (path === "/api/employees/me/photo-change") {
      await fulfillJson(route, {
        success: true,
        data: {
          status: "approved",
        },
      });
      return;
    }

    if (path === "/api/employees/me") {
      await fulfillJson(route, {
        success: true,
        data: EMPLOYEE_PROFILE,
      });
      return;
    }

    if (/^\/api\/employees\/[^/]+\/profile$/.test(path)) {
      const employeeId = path.split("/")[3] || "";
      await fulfillJson(route, {
        data: {
          ...(employeeId === EMPLOYEE_USER.uid ? EMPLOYEE_PROFILE : {
            id: employeeId,
            name: "Usuario Mock",
            displayName: "Usuario Mock",
            email: "mock@example.com",
            address: "Direccion mock",
            photoUrl: "assets/images/logo.webp",
          }),
        },
      });
      return;
    }

    const requestMatch = path.match(/^\/api\/marketplace\/requests\/([^/]+)$/);
    if (requestMatch) {
      const requestId = decodeURIComponent(requestMatch[1] || "");
      await fulfillJson(route, {
        data: detailedClientRequests.get(requestId) || null,
      });
      return;
    }

    const chatMatch = path.match(/^\/api\/marketplace\/requests\/([^/]+)\/chat$/);
    if (chatMatch) {
      const requestId = decodeURIComponent(chatMatch[1] || "");
      await fulfillJson(route, {
        data: scenario.chatByRequest?.[requestId] || [],
      });
      return;
    }

    const estimateUrlMatch = path.match(/^\/api\/marketplace\/requests\/([^/]+)\/estimate-url$/);
    if (estimateUrlMatch) {
      await fulfillJson(route, {
        ok: true,
        url: "assets/images/logo.webp",
      });
      return;
    }

    await fulfillJson(route, { data: {} });
  });
}

async function createMockedContext(
  browser: Browser,
  options: {
    role: "boss" | "employee" | "client";
    user: typeof BOSS_USER | typeof EMPLOYEE_USER | typeof CLIENT_USER;
    firestoreRequests?: Array<Record<string, unknown>>;
    clientRequests?: Array<Record<string, unknown>>;
    employeeAvailableRequests?: Array<Record<string, unknown>>;
    employeeMyRequests?: Array<Record<string, unknown>>;
    bossReviewQueue?: Array<Record<string, unknown>>;
    bossEmergencies?: Array<Record<string, unknown>>;
    chatByRequest?: Record<string, Array<Record<string, unknown>>>;
  },
) {
  const context = await browser.newContext({
    viewport: MOBILE_VIEWPORT,
  });

  await context.addInitScript(() => {
    window.alert = () => {};
    window.confirm = () => true;
    window.open = () => null;
  });

  await installFirebaseMocks(context, {
    role: options.role,
    user: options.user,
    firestoreRequests: options.firestoreRequests,
  });

  await installCommonNetworkMocks(context, options);
  return context;
}

test("panel-jefe mantiene dashboard y detalle accesibles en mobile con data mockeada", async ({ browser }) => {
  const context = await createMockedContext(browser, {
    role: "boss",
    user: BOSS_USER,
    firestoreRequests: BOSS_REQUESTS.map((request) => ({ id: request.id, data: request })),
    bossReviewQueue: REVIEW_QUEUE,
    bossEmergencies: EMERGENCY_CALLS,
  });
  const page = await context.newPage();
  const runtimeErrors = attachErrorCapture(page);

  await page.goto("/panel-jefe.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".boss-dashboard-card")).toBeVisible();
  await expect(page.locator("#list .mini-card").first()).toBeVisible();
  expect(await getHorizontalOverflow(page)).toBeLessThanOrEqual(2);

  await page.locator("#list .mini-card").first().click();
  await expect(page.locator("#detailView")).toBeVisible();
  await expect(page.locator("#detailView h2")).toContainText("Cliente Norte");
  await expect(page.locator("#detailView")).toContainText("Acciones de Sistema");

  const detailDisplay = await page.locator(".detail-panel").evaluate((node) => getComputedStyle(node).display);
  expect(detailDisplay).not.toBe("none");
  expect(runtimeErrors).toEqual([]);

  await context.close();
});

test("client-requests mantiene el detalle disponible en mobile con auth y data mockeada", async ({ browser }) => {
  const context = await createMockedContext(browser, {
    role: "employee",
    user: EMPLOYEE_USER,
    employeeAvailableRequests: EMPLOYEE_AVAILABLE_REQUESTS,
    employeeMyRequests: EMPLOYEE_MY_REQUESTS,
  });
  const page = await context.newPage();
  const runtimeErrors = attachErrorCapture(page);

  await page.goto("/client-requests.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#list .mini-card").first()).toBeVisible();
  expect(await getHorizontalOverflow(page)).toBeLessThanOrEqual(2);

  await page.locator("#list .mini-card").first().click();
  await expect(page.locator("#detailView")).toBeVisible();
  await expect(page.locator("#detailView")).toContainText("RECLAMAR CASO");

  const detailDisplay = await page.locator(".detail-panel").evaluate((node) => getComputedStyle(node).display);
  expect(detailDisplay).not.toBe("none");
  expect(runtimeErrors).toEqual([]);

  await context.close();
});

test("panel-cliente renderiza solicitudes largas y detalle sin romper mobile", async ({ browser }) => {
  const context = await createMockedContext(browser, {
    role: "client",
    user: CLIENT_USER,
    clientRequests: CLIENT_REQUESTS,
    chatByRequest: CHAT_MESSAGES,
  });
  const page = await context.newPage();
  const runtimeErrors = attachErrorCapture(page);

  await page.goto("/panel-cliente.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#mainContent")).toBeVisible();
  await expect(page.locator("#requestList .request-card").first()).toBeVisible();
  expect(await getHorizontalOverflow(page)).toBeLessThanOrEqual(2);

  await page.locator("#requestList .request-card").first().click();
  await expect(page.locator("#detailPanel")).toContainText("Propuesta del técnico");
  await expect(page.locator("#detailPanel")).toContainText("Chat con técnico");
  expect(runtimeErrors).toEqual([]);

  await context.close();
});

test("panel-empleado mantiene el modal de perfil usable en mobile", async ({ browser }) => {
  const context = await createMockedContext(browser, {
    role: "employee",
    user: EMPLOYEE_USER,
    firestoreRequests: EMPLOYEE_AVAILABLE_REQUESTS.map((request) => ({
      id: request.id,
      data: request,
    })),
  });
  const page = await context.newPage();
  const runtimeErrors = attachErrorCapture(page);

  await page.goto("/panel-empleado.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#todayPill")).toBeVisible();
  await expect(page.locator("#kpiPending")).toBeVisible();
  expect(await getHorizontalOverflow(page)).toBeLessThanOrEqual(2);

  await page.getByRole("button", { name: /Editar Perfil/i }).click();
  await expect(page.locator("#profileModal .modal")).toBeVisible();
  await expect(page.locator("#profileModal")).toContainText("Mi Perfil de Empleado");

  const modalFit = await getViewportFit(page, "#profileModal .modal");
  expect(modalFit.top).toBeGreaterThanOrEqual(-1);
  expect(modalFit.bottom).toBeLessThanOrEqual(MOBILE_VIEWPORT.height + 1);
  expect(modalFit.overflowY).toBe("auto");
  expect(runtimeErrors).toEqual([]);

  await context.close();
});

test("panel-jefe mantiene el chat visible y estable en mobile", async ({ browser }) => {
  const context = await createMockedContext(browser, {
    role: "boss",
    user: BOSS_USER,
    firestoreRequests: BOSS_REQUESTS.map((request) => ({ id: request.id, data: request })),
    bossReviewQueue: REVIEW_QUEUE,
    bossEmergencies: EMERGENCY_CALLS,
    chatByRequest: CHAT_MESSAGES,
  });
  const page = await context.newPage();
  const runtimeErrors = attachErrorCapture(page);

  await page.goto("/panel-jefe.html", { waitUntil: "domcontentloaded" });
  await page.locator("#list .mini-card").first().click();
  await page.locator('[data-boss-action="open-chat"][data-chat-internal="0"]').click();

  await expect(page.locator("#chatPanel")).toBeVisible();
  await expect(page.locator("#chatMessages")).toContainText("Tengo un tablero antiguo");
  expect(await getHorizontalOverflow(page)).toBeLessThanOrEqual(2);

  const chatFit = await getViewportFit(page, "#chatPanel");
  expect(chatFit.top).toBeGreaterThanOrEqual(-1);
  expect(chatFit.bottom).toBeLessThanOrEqual(MOBILE_VIEWPORT.height + 1);
  expect(chatFit.left).toBeGreaterThanOrEqual(-1);
  expect(chatFit.right).toBeLessThanOrEqual(MOBILE_VIEWPORT.width + 1);
  expect(runtimeErrors).toEqual([]);

  await context.close();
});

test("client-requests mantiene el chat accesible en mobile para casos asignados", async ({ browser }) => {
  const context = await createMockedContext(browser, {
    role: "employee",
    user: EMPLOYEE_USER,
    employeeAvailableRequests: EMPLOYEE_AVAILABLE_REQUESTS,
    employeeMyRequests: EMPLOYEE_MY_REQUESTS,
    chatByRequest: CHAT_MESSAGES,
  });
  const page = await context.newPage();
  const runtimeErrors = attachErrorCapture(page);

  await page.goto("/client-requests.html", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Mis Casos/i }).click();
  await expect(page.locator("#list .mini-card").first()).toContainText("Oficina Delta");

  await page.locator("#list .mini-card").first().click();
  await page.locator('[data-client-action="open-chat"]').click();

  await expect(page.locator("#chatPanel")).toBeVisible();
  await expect(page.locator("#chatMessages")).toContainText("Te espero en recepción");
  expect(await getHorizontalOverflow(page)).toBeLessThanOrEqual(2);

  const chatFit = await getViewportFit(page, "#chatPanel");
  expect(chatFit.top).toBeGreaterThanOrEqual(-1);
  expect(chatFit.bottom).toBeLessThanOrEqual(MOBILE_VIEWPORT.height + 1);
  expect(chatFit.left).toBeGreaterThanOrEqual(-1);
  expect(chatFit.right).toBeLessThanOrEqual(MOBILE_VIEWPORT.width + 1);
  expect(runtimeErrors).toEqual([]);

  await context.close();
});

test("panel-cliente mantiene el modal de perfil del técnico dentro del viewport", async ({ browser }) => {
  const context = await createMockedContext(browser, {
    role: "client",
    user: CLIENT_USER,
    clientRequests: CLIENT_REQUESTS,
    chatByRequest: CHAT_MESSAGES,
  });
  const page = await context.newPage();
  const runtimeErrors = attachErrorCapture(page);

  await page.goto("/panel-cliente.html", { waitUntil: "domcontentloaded" });
  await page.locator("#requestList .request-card").first().click();
  await page.locator('[data-client-detail-action="show-employee-profile"]').click();

  await expect(page.locator("#employeeProfileModal")).toBeVisible();
  await expect(page.locator("#employeeProfileModal")).toContainText("Portafolio de trabajos");
  expect(await getHorizontalOverflow(page)).toBeLessThanOrEqual(2);

  const modalFit = await getViewportFit(page, "#employeeProfileModal > div");
  expect(modalFit.top).toBeGreaterThanOrEqual(-1);
  expect(modalFit.bottom).toBeLessThanOrEqual(MOBILE_VIEWPORT.height + 1);
  expect(modalFit.overflowY).toBe("auto");
  expect(runtimeErrors).toEqual([]);

  await context.close();
});
