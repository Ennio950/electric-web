# Docker notes for AutoDev + n8n

## Como verificar si n8n corre en Docker

Revision rapida:

- busca un `docker-compose.yml` o `compose.yaml` para n8n,
- ejecuta `docker ps` y revisa si existe un contenedor de n8n,
- revisa si n8n se arranca con una imagen como `n8nio/n8n`.

## Que pasa con Execute Command dentro de un contenedor

El nodo `Execute Command` corre dentro del contenedor de n8n. Eso significa:

- usa el filesystem del contenedor,
- usa los binarios disponibles dentro del contenedor,
- no ve automaticamente tu escritorio Windows ni tu repo local.

Si quieres arrancar n8n con el nodo habilitado desde este repo, revisa tambien:

- `autodev-lab/n8n/docker-compose.n8n.yml`

Ese compose incluye:

- `N8N_ENABLE_EXECUTE_COMMAND=true`
- `NODES_EXCLUDE=[]`

El segundo ajuste es importante porque en versiones recientes de n8n `Execute Command` puede seguir oculto si permanece excluido.

## Montaje del repo

Si quieres ejecutar AutoDev desde n8n en Docker, debes montar el repo dentro del contenedor.

Ejemplos de rutas internas posibles:

- `/workspace/electric-web`
- `/data/repos/electric-web`

Despues de montar el repo, actualiza:

- `autodev-lab/n8n/autodev-next-safe-workflow.json`
- `autodev-lab/n8n/autodev-runner.ps1` o una variante shell propia del contenedor

## Ejemplos de rutas internas alternativas

En un host Windows puedes tener:

```text
C:\Users\ennio\OneDrive\Desktop\electric-web copia
```

Dentro del contenedor eso podria verse como:

```text
/workspace/electric-web
```

## Como validar si el comando existe dentro del contenedor

Ejemplos utiles:

```bash
docker exec -it <n8n-container> sh
pwd
ls -la /workspace/electric-web
node --version
```

Si quieres seguir usando PowerShell dentro del contenedor, tendrias que tener `pwsh` instalado. En la mayoria de imagenes Linux de n8n eso no viene por defecto.

## Riesgo operativo principal en Docker

El workflow JSON de este paso usa comandos PowerShell y una ruta Windows. Eso funciona solo si n8n corre en un entorno compatible con esa ruta y ese shell. En Docker Linux debes adaptar ambos.
