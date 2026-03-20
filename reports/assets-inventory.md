# Assets Inventory

## Branding base

- `assets/images/logo.webp`
- `assets/images/bg-electric.webp`
- `assets/images/google.svg`
- `assets/js/company-branding-bootstrap.js`
- `assets/js/company-branding.js`
- `assets/js/company-config.js`

## CSS y visual legacy

- `assets/css/portal-hub.css`
- `assets/css/portal-auth.css`
- `assets/css/estimate-form.css`
- `assets/css/boss-master.css`
- `assets/css/panel-contrast.css`
- `assets/css/style.css`

## JavaScript funcional legacy

- `assets/js/api.js`
- `assets/js/auth.js`
- `assets/js/auth-boss.js`
- `assets/js/auth-apply.js`
- `assets/js/boss-panel.js`
- `assets/js/client-requests.js`
- `assets/js/login-gateway.js`
- `assets/js/portal-session.js`
- `assets/js/runtime-config.js`
- `assets/js/firebase-config.js`
- `assets/js/firebase.js`

## Vendorized libs utiles

- Firebase web modules en `assets/vendor/firebase/`
- Leaflet en `assets/vendor/leaflet/`
- html2pdf en `assets/vendor/html2pdf/`
- face-api en `assets/vendor/face-api/`
- three.js en `assets/vendor/three/`

## Assets moviles

- `apps/mobile/assets/images/`
- temas y tokens en `apps/mobile/src/theme/`

## Uso recomendado en migracion

- Reusar logo, naming y company config desde la web actual.
- Reinterpretar estilos visuales legacy en tokens React Native, no copiar CSS literalmente.
- Mantener vendorized assets solo donde tengan equivalente movil o sirvan como referencia funcional.
