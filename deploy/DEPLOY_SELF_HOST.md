# Despliegue en Host Propio

Este proyecto puede desplegarse como una sola app Node:

- El backend Express sirve la API
- También sirve los HTML legacy
- También sirve el builder compilado en `/builder-react/dist/index.html`

## Requisitos

- Ubuntu/Debian o VPS Linux similar
- Node.js 20+
- Nginx
- Dominio apuntando al servidor
- Certificado TLS
- Credenciales reales de Firebase / Cloudinary

## 1. DNS

Apunta tu dominio al VPS:

- `A @ -> IP_DEL_SERVIDOR`
- `A www -> IP_DEL_SERVIDOR`

## 2. Copiar proyecto e instalar

```bash
git clone <tu-repo> /var/www/electric-web
cd /var/www/electric-web
npm ci
npm --prefix builder-react ci
npm --prefix straight-wire-backend ci
npm run build
```

## 3. Variables de producción

Usa [straight-wire-backend/.env.production.example](../straight-wire-backend/.env.production.example) como base y crea:

- `straight-wire-backend/.env.local`
- `straight-wire-backend/serviceAccount.local.json`

Variables mínimas clave:

```env
PORT=8081
NODE_ENV=production
APP_BASE_URL=https://tu-dominio.com
CORS_ALLOWED_ORIGINS=https://tu-dominio.com,https://www.tu-dominio.com
CSRF_ALLOWED_ORIGINS=https://tu-dominio.com,https://www.tu-dominio.com
LOG_FORMAT=json
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.local.json
```

## 4. Firebase

En Firebase Console debes agregar tu dominio en:

- Authentication
- Settings
- Authorized domains

Agrega al menos:

- `tu-dominio.com`
- `www.tu-dominio.com`

Si no haces esto, el login web puede fallar aunque el servidor esté bien configurado.

## 5. Ejecutar app

Opción A: `systemd`

```bash
sudo cp deploy/systemd/straight-wire-electric.service /etc/systemd/system/straight-wire-electric.service
sudo systemctl daemon-reload
sudo systemctl enable straight-wire-electric
sudo systemctl start straight-wire-electric
sudo systemctl status straight-wire-electric
```

Opción B: `pm2`

```bash
npm install -g pm2
pm2 start deploy/pm2/ecosystem.config.cjs
pm2 save
pm2 startup
```

## 6. Nginx

Copia y ajusta el archivo:

- [deploy/nginx/straight-wire-electric.conf](./nginx/straight-wire-electric.conf)

Luego:

```bash
sudo cp deploy/nginx/straight-wire-electric.conf /etc/nginx/sites-available/straight-wire-electric.conf
sudo ln -s /etc/nginx/sites-available/straight-wire-electric.conf /etc/nginx/sites-enabled/straight-wire-electric.conf
sudo nginx -t
sudo systemctl reload nginx
```

## 7. TLS

Si usas Certbot:

```bash
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tu-dominio.com -d www.tu-dominio.com
```

## 8. Verificación

```bash
curl -I https://tu-dominio.com/health
curl -I https://tu-dominio.com/login-gateway.html
curl -I https://tu-dominio.com/panel-empleado.html
```

Debe responder:

- `200` en `/health`
- `200` en páginas HTML

## 9. Actualizar despliegue

```bash
cd /var/www/electric-web
git pull
npm ci
npm --prefix builder-react ci
npm --prefix straight-wire-backend ci
npm run build
sudo systemctl restart straight-wire-electric
```

Si usas `pm2`:

```bash
pm2 restart straight-wire-electric
```
