#!/usr/bin/env node

function normalizeBaseUrl(rawValue) {
  const value = rawValue || 'http://ollama-cpu:11434';
  return value.startsWith('http://') || value.startsWith('https://')
    ? value.replace(/\/$/, '')
    : `http://${value}`.replace(/\/$/, '');
}

function buildGeneratePayload(model, prompt) {
  const keepAlive = (process.env.OLLAMA_REQUEST_KEEP_ALIVE || '').trim();
  const payload = {
    model,
    prompt,
    stream: false,
  };

  if (keepAlive) {
    payload.keep_alive = keepAlive;
  }

  return payload;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ollama proxy fallo (${response.status}): ${body}`);
  }
  return response.json();
}

async function listModels(baseUrl) {
  const payload = await requestJson(`${baseUrl}/api/tags`);
  const models = Array.isArray(payload.models) ? payload.models : [];

  if (!models.length) {
    console.log('No models found.');
    return;
  }

  for (const model of models) {
    console.log(model.name);
  }
}

async function runModel(baseUrl, model, prompt) {
  if (!model || !prompt) {
    throw new Error('Uso: ollama run <model> <prompt> o ollama run <prompt> si OLLAMA_MODEL esta definido');
  }

  const payload = await requestJson(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildGeneratePayload(model, prompt)),
  });

  if (typeof payload.response === 'string') {
    process.stdout.write(payload.response);
    if (!payload.response.endsWith('\n')) {
      process.stdout.write('\n');
    }
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const baseUrl = normalizeBaseUrl(process.env.OLLAMA_HOST);
  const defaultModel = (process.env.OLLAMA_MODEL || '').trim();

  if (!command || command === '--help' || command === 'help') {
    console.log('Uso: ollama list | ollama run <model> <prompt> | ollama run <prompt>');
    return;
  }

  if (command === '--version' || command === 'version') {
    console.log('ollama-proxy 0.1.0');
    return;
  }

  if (command === 'list' || command === 'ls') {
    await listModels(baseUrl);
    return;
  }

  if (command === 'run') {
    const hasExplicitModel = args.length > 1;
    const model = hasExplicitModel ? args[0] : defaultModel;
    const promptParts = hasExplicitModel ? args.slice(1) : args;
    await runModel(baseUrl, model, promptParts.join(' ').trim());
    return;
  }

  throw new Error(`Comando ollama no soportado por el proxy: ${command}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
