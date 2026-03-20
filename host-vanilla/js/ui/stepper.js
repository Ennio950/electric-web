const STEP_DEFINITIONS = [
  { id: 'step-1', title: '1. Elegir plantilla' },
  { id: 'step-2', title: '2. Preparar' },
  { id: 'step-3', title: '3. Calcular' },
  { id: 'step-4', title: '4. Revisar resultados' }
];

function buildStepState({ hasTemplate, connectionReady, inputsValid, hasResult }) {
  return [
    {
      ...STEP_DEFINITIONS[0],
      status: hasTemplate ? 'completed' : 'current'
    },
    {
      ...STEP_DEFINITIONS[1],
      status: !hasTemplate ? 'blocked' : connectionReady ? 'completed' : 'current'
    },
    {
      ...STEP_DEFINITIONS[2],
      status: !hasTemplate || !connectionReady ? 'blocked' : inputsValid ? 'completed' : 'current'
    },
    {
      ...STEP_DEFINITIONS[3],
      status: !hasTemplate || !connectionReady || !inputsValid
        ? 'blocked'
        : hasResult
          ? 'completed'
          : 'current'
    }
  ];
}

function renderStepper(container, steps) {
  if (!container) return;

  container.innerHTML = '';
  steps.forEach((step) => {
    const item = document.createElement('div');
    item.className = `step-item step-${step.status}`;
    item.dataset.step = step.id;

    const badge = document.createElement('span');
    badge.className = 'step-badge';
    badge.textContent = step.status === 'completed' ? 'OK' : step.status === 'blocked' ? 'LOCK' : 'GO';

    const title = document.createElement('span');
    title.className = 'step-title';
    title.textContent = step.title;

    item.appendChild(badge);
    item.appendChild(title);
    container.appendChild(item);
  });
}

export const stepper = {
  definitions: STEP_DEFINITIONS,
  buildStepState,
  renderStepper
};
