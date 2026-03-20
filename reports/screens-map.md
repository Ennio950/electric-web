# Screens Map

## Legacy -> Mobile

| Legacy web | Estado movil | Ruta movil |
| --- | --- | --- |
| `index.html` | Migrado | `app/index.tsx` + homes por rol |
| `login-gateway.html` | Migrado parcial | `app/(auth)/login.tsx` |
| `login-empleado.html` | Parcial | `app/(auth)/login.tsx` |
| `login-jefe.html` | Parcial | `app/(auth)/login.tsx` |
| `panel-cliente.html` | Migrado parcial | `app/(client)/index.tsx` |
| `client-requests.html` | Migrado parcial | `app/(client)/requests/index.tsx` |
| `emergency.html` | Migrado parcial | `app/(client)/emergency/*`, `app/(employee)/emergency/*` |
| `panel-empleado.html` | Migrado parcial | `app/(employee)/index.tsx` |
| `panel-jefe.html` | Migrado parcial | `app/(boss)/index.tsx` |
| `materials.html` | Migrado parcial | `app/(builder)/materials.tsx` |
| `schedule.html` | Gap pendiente | rutas `builder/jobs` y backlog de calendario |
| `estimate-form.html` | Gap pendiente | backlog builder / estimator |
| `estimate-history.html` | Gap pendiente | backlog boss/builder |
| `estimate-template.html` | Gap pendiente | backlog builder |

## Cobertura actual detectada en `apps/mobile/app`

- Auth: `login`, `signup-client`, `magic-client`, `apply-employee`
- Client: home, requests list/detail/new, emergency list/detail/new
- Employee: home, requests list/detail, emergency detail/new, profile
- Boss: home, queue list/detail, payments list/detail, admin, settings
- Builder: home, materials, recipes, job detail

## Lectura del mapa

- La base movil ya cubre la mayoria del portal operativo.
- Lo que falta no es una app nueva; es parity funcional, refinamiento visual y endurecimiento de contratos.
- El backlog inicial debe priorizar auth, cliente, employee, boss y builder antes de inventar nuevas pantallas.
