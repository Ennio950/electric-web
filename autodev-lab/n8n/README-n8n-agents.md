# n8n Agents: CPU-Only Ollama

## Estado

La integracion local con Ollama quedo movida a un servicio Docker CPU-only.

Eso significa:

- `n8n` ya no depende del Ollama del host en `11434`,
- el modelo local por defecto pasa a ser `qwen2.5-coder:7b`,
- `deepseek-coder-v2:16b` sigue disponible, pero como opcion lenta en CPU.

## Servicios

En `autodev-lab/n8n/docker-compose.n8n.yml`:

- `ollama-cpu`: servicio local de inferencia CPU-only
- `n8n`: consume `OLLAMA_HOST=http://ollama-cpu:11434`

## Defaults

- modelo rapido por defecto: `qwen2.5-coder:7b`
- modelo lento opcional: `deepseek-coder-v2:16b`
- `keep_alive`: `15m`
- contexto por defecto: `4096`
- paralelismo: `1`

## Comandos dentro del contenedor n8n

Modelo rapido por defecto:

```bash
ollama run "Analiza electric-web copia y resume la arquitectura"
```

Modelo explicito:

```bash
ollama run qwen2.5-coder:7b "Resume la arquitectura"
ollama run deepseek-coder-v2:16b "Analiza este proyecto con mas detalle"
```

## Recomendacion practica

Para automatizaciones normales en `n8n`, usa:

- `qwen2.5-coder:7b`

Usa `deepseek-coder-v2:16b` solo cuando aceptes:

- mayor latencia,
- mas consumo de RAM,
- una sola ejecucion a la vez.
