#!/bin/sh
set -eu

OLLAMA_MODEL="${OLLAMA_MODEL:-deepseek-coder-v2:16b}"
OLLAMA_FALLBACK_MODEL="${OLLAMA_FALLBACK_MODEL:-qwen2.5-coder:7b}"
AI_LAB_TEST_COMMAND="${AI_LAB_TEST_COMMAND:-npm run test:engine && npm run test:shared && npm run test:mobile}"
AI_LAB_SKIP_OPENCLAW="${AI_LAB_SKIP_OPENCLAW:-0}"
AI_LAB_SKIP_OLLAMA="${AI_LAB_SKIP_OLLAMA:-0}"
AI_LAB_SKIP_CODEX="${AI_LAB_SKIP_CODEX:-0}"
AI_LAB_SKIP_CLAUDE="${AI_LAB_SKIP_CLAUDE:-0}"
AI_LAB_SKIP_GIT_COMMIT="${AI_LAB_SKIP_GIT_COMMIT:-0}"
AI_LAB_SKIP_GIT_PUSH="${AI_LAB_SKIP_GIT_PUSH:-0}"

CODEX_PROMPT="${CODEX_PROMPT:-Analiza el repositorio actual y aplica fixes pequenos, seguros y reversibles. No hagas cambios destructivos ni toques credenciales. Resume los cambios al final.}"
CLAUDE_PROMPT="${CLAUDE_PROMPT:-Haz una revision breve del estado actual del repositorio. Enumera riesgos, regresiones posibles y pruebas faltantes. No hagas cambios.}"
OLLAMA_PROMPT="${OLLAMA_PROMPT:-analiza errores del proyecto actual y sugiere fixes pequenos y seguros}"

for tool in openclaw ollama codex claude git npm; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Falta el comando requerido: $tool" >&2
    exit 1
  fi
done

run_openclaw_scan() {
  if [ "$AI_LAB_SKIP_OPENCLAW" = "1" ]; then
    echo "Saltando OpenClaw por configuracion"
    return 0
  fi

  echo "Escaneando con OpenClaw..."
  if timeout 60 openclaw models scan; then
    return 0
  fi

  echo "OpenClaw no pudo completar models scan en este entorno. Continuando..." >&2
  return 0
}

run_ollama_analysis() {
  if [ "$AI_LAB_SKIP_OLLAMA" = "1" ]; then
    echo "Saltando Ollama por configuracion"
    return 0
  fi

  echo "Analizando errores con Ollama usando $OLLAMA_MODEL..."
  if ollama run "$OLLAMA_MODEL" "$OLLAMA_PROMPT"; then
    return 0
  fi

  echo "Fallo $OLLAMA_MODEL. Probando fallback $OLLAMA_FALLBACK_MODEL..." >&2
  ollama run "$OLLAMA_FALLBACK_MODEL" "$OLLAMA_PROMPT"
}

run_codex_fix() {
  if [ "$AI_LAB_SKIP_CODEX" = "1" ]; then
    echo "Saltando Codex por configuracion"
    return 0
  fi

  echo "Codex generando fixes..."
  codex exec \
    --dangerously-bypass-approvals-and-sandbox \
    --skip-git-repo-check \
    "$CODEX_PROMPT"
}

run_claude_review() {
  if [ "$AI_LAB_SKIP_CLAUDE" = "1" ]; then
    echo "Saltando Claude por configuracion"
    return 0
  fi

  echo "Claude revisando codigo..."
  if claude -p "$CLAUDE_PROMPT"; then
    return 0
  fi

  echo "Claude no pudo completar la revision. Verifica ~/.claude.json y la autenticacion." >&2
  return 0
}

run_tests() {
  echo "Ejecutando tests..."
  sh -lc "$AI_LAB_TEST_COMMAND"
}

commit_and_push() {
  if [ "$AI_LAB_SKIP_GIT_COMMIT" = "1" ]; then
    echo "Commit y push omitidos por configuracion"
    return 0
  fi

  git add .

  if git diff --cached --quiet; then
    echo "No hubo cambios para commit"
    return 0
  fi

  echo "Tests pasaron. Haciendo commit..."
  git commit -m "auto fix by ai lab"

  if [ "$AI_LAB_SKIP_GIT_PUSH" = "1" ]; then
    echo "Push omitido por configuracion"
    return 0
  fi

  git push
}

run_openclaw_scan
run_ollama_analysis
run_codex_fix
run_claude_review

if run_tests; then
  commit_and_push
else
  echo "Tests fallaron"
  exit 1
fi
