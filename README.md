# electric-web

Portal web + backend para Straight Wire Electric.

## Desarrollo

Modo recomendado:

```bash
npm install
npm run dev
```

Modo multiagente con viewer live:

```bash
npm run workflow:bootstrap:git
npm run dev:all
```

Esto deja:

- Backend + portal legacy en `http://127.0.0.1:8081`
- Builder React compilado en watch y servido por el backend en `/builder-react/dist/index.html`

Modo completo con Vite standalone y host estatico adicional:

```bash
npm run dev:full
```

Puertos esperados:

- `8081`: backend + html legacy + builder compilado
- `5173+`: Vite builder standalone
- `5500`: host estatico opcional

## Variables locales

- Copia/ajusta [straight-wire-backend/.env.example](straight-wire-backend/.env.example) como `straight-wire-backend/.env.local`
- Para producción usa [straight-wire-backend/.env.production.example](straight-wire-backend/.env.production.example) como base
- Coloca la credencial Firebase en `straight-wire-backend/serviceAccount.local.json`
- El portal legacy y el builder React comparten una sesion de acceso via cookie `HttpOnly` emitida por el backend
- Usa `CORS_ALLOWED_ORIGINS` y `CSRF_ALLOWED_ORIGINS` para limitar orígenes fuera del set local por defecto
- `LOG_FORMAT=json` deja logs estructurados en producción; `pretty` mantiene salida legible en desarrollo
- Los assets remotos del portal legacy quedaron vendorized en `assets/vendor/` para poder mantener una CSP mas estricta

Los archivos locales sensibles estan ignorados en [.gitignore](.gitignore).

## Tests

```bash
npm test
npm run test:e2e
```

Pruebas E2E con login real opcional:

```bash
$env:E2E_ENABLE_REAL_AUTH='1'
$env:E2E_EMPLOYEE_EMAIL='employee@example.com'
$env:E2E_EMPLOYEE_PASSWORD='secret'
$env:E2E_BOSS_EMAIL='boss@example.com'
$env:E2E_BOSS_PASSWORD='secret'
npm run test:e2e
```

Si esas variables no existen, las pruebas de login real se omiten.

## Deploy propio

Para desplegarlo en tu propio dominio/VPS:

```bash
npm ci
npm --prefix builder-react ci
npm --prefix straight-wire-backend ci
npm run build
npm run start:prod
```

Guía completa:

- [deploy/DEPLOY_SELF_HOST.md](deploy/DEPLOY_SELF_HOST.md)

Archivos de apoyo:

- [deploy/nginx/straight-wire-electric.conf](deploy/nginx/straight-wire-electric.conf)
- [deploy/systemd/straight-wire-electric.service](deploy/systemd/straight-wire-electric.service)
- [deploy/pm2/ecosystem.config.cjs](deploy/pm2/ecosystem.config.cjs)
