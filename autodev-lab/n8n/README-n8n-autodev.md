# AutoDev + n8n

## Que hace este bootstrap

Este directorio deja listo un primer punto de integracion entre n8n y el laboratorio AutoDev sin tocar la UI de n8n automaticamente y sin depender todavia de credenciales o endpoints externos.

Archivos incluidos:

- `autodev-next-safe-workflow.json`: workflow importable de n8n llamado `AutoDev Next Safe Runner`.
- `autodev-runner.ps1`: script PowerShell auxiliar para ejecutar AutoDev desde el host Windows.
- `docker-compose.n8n.yml`: compose de ejemplo para levantar n8n con `N8N_ENABLE_EXECUTE_COMMAND=true`.
- `docker-notes.md`: notas operativas para despliegues donde n8n corre dentro de Docker.

Scripts validados en este repo:

- `autodev-lab/scripts/run-task.js`: presente.
- `autodev-lab/scripts/list-tasks.js`: presente.

## Compose de ejemplo para Docker

Si quieres que el contenedor de n8n arranque ya con la variable pedida, usa:

```bash
docker compose -f autodev-lab/n8n/docker-compose.n8n.yml up -d
```

Ese compose deja configurado:

- `N8N_ENABLE_EXECUTE_COMMAND=true`
- `NODES_EXCLUDE=[]`

La segunda variable tambien se incluye porque la documentacion actual de n8n indica que `Execute Command` puede quedar bloqueado por defecto aunque la primera variable este presente.

## Flujo del workflow

El workflow hace esto:

1. `Schedule Trigger` cada 10 minutos.
2. `Execute Command` para correr `node autodev-lab/scripts/run-task.js --next-safe`.
3. `Execute Command` para correr `node autodev-lab/scripts/list-tasks.js`.

El workflow queda importable pero inactivo por defecto.

## Como importarlo en n8n

1. Abre n8n.
2. Ve a `Workflows`.
3. Usa la opcion de importar un workflow desde archivo.
4. Selecciona `autodev-lab/n8n/autodev-next-safe-workflow.json`.
5. Revisa que los dos nodos `Execute Command` mantengan la ruta correcta del repo.

## Como activarlo

1. Importa el workflow.
2. Confirma que la ruta del proyecto es correcta para donde corre n8n.
3. Guarda el workflow.
4. Activalo.

Cuando este activo, n8n ejecutara el flujo segun el `Schedule Trigger`.

## Como probarlo manualmente

La prueba mas confiable, sin depender de la UI de n8n, es ejecutar el script auxiliar directamente en el host:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\ennio\OneDrive\Desktop\electric-web copia\autodev-lab\n8n\autodev-runner.ps1"
```

Eso valida:

- que el repo existe,
- que `node` esta disponible,
- que `run-task.js --next-safe` funciona,
- que `list-tasks.js` funciona.

Despues puedes importar y activar el workflow en n8n para automatizar la misma secuencia.

## Como cambiar la frecuencia

Opciones:

- Editar el workflow importado en n8n y cambiar el `Schedule Trigger`.
- Editar `autodev-next-safe-workflow.json` antes de importarlo.

La configuracion actual usa:

- intervalo de `10` minutos,
- campo `minutes`,
- `minutesInterval = 10`.

## Como revisar ejecuciones

Revisa estos puntos:

- la seccion `Executions` de n8n,
- la salida de cada nodo `Execute Command`,
- `autodev-lab/logs/`,
- `autodev-lab/reports/`.

## Advertencias importantes

- `Execute Command` corre en el entorno donde vive n8n.
- Algunas instalaciones de n8n pueden tener el nodo `Execute Command` deshabilitado por politica de seguridad.
- En n8n recientes, `N8N_ENABLE_EXECUTE_COMMAND=true` por si sola puede no bastar si `NODES_EXCLUDE` sigue bloqueando el nodo.
- Si n8n corre como proceso normal en el host Windows, la ruta del workflow puede funcionar tal como esta.
- Si n8n corre en Docker, el comando se ejecuta dentro del contenedor, no en tu escritorio Windows.
- Si el repo no esta montado dentro del contenedor, el comando fallara.
- Si el contenedor no tiene `node`, el comando fallara.
- Si el contenedor no tiene `powershell.exe` o `pwsh`, el workflow de ejemplo no correra tal cual.

## Si n8n corre en Docker

Puntos criticos:

- `Execute Command` usa el filesystem del contenedor.
- La ruta `C:\Users\ennio\OneDrive\Desktop\electric-web copia` no existe dentro de un contenedor Linux.
- Debes montar el repo dentro del contenedor y ajustar la ruta de trabajo en el workflow o en el script auxiliar.
- El archivo `docker-compose.n8n.yml` ya monta este repo en `/workspace/electric-web`.

Ejemplos de rutas internas alternativas:

- `/workspace/electric-web`
- `/data/repos/electric-web`

Si usas Docker, revisa tambien `docker-notes.md`.

## Como ajustar la ruta de trabajo

Debes actualizar la ruta en dos lugares si cambias el checkout:

1. `autodev-lab/n8n/autodev-next-safe-workflow.json`
2. `autodev-lab/n8n/autodev-runner.ps1`

Busca esta ruta:

```text
C:\Users\ennio\OneDrive\Desktop\electric-web copia
```

y reemplazala por la ubicacion real que vea n8n.

## Como desactivar temporalmente el flujo

Opciones seguras:

- desactivar el workflow en n8n,
- cambiar el `Schedule Trigger` a un intervalo mas largo,
- dejar el workflow importado pero inactivo,
- ejecutar solo `autodev-runner.ps1` manualmente cuando lo necesites.

## Limitaciones actuales

- no hay credenciales ni webhooks externos,
- no hay notificaciones de exito o fallo,
- no hay control remoto por chat,
- no hay reconciliacion de ejecuciones concurrentes,
- el workflow depende de que el nodo `Execute Command` este disponible en tu version de n8n,
- si `Execute Command` esta bloqueado en tu instalacion, tendras que habilitarlo antes de usar este workflow.

## Siguiente paso recomendado

Agregar notificaciones y control remoto sobre el mismo backlog seguro, por ejemplo:

- alerta por Discord, Slack o email,
- webhook interno para disparar `--next-safe`,
- aprobacion manual antes de tareas semiautomaticas.
