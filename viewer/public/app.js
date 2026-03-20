const refreshChip = document.getElementById('refresh-chip');
const openPreviewLink = document.getElementById('open-preview-link');
const agentGrid = document.getElementById('agent-grid');
const progressValue = document.getElementById('progress-value');
const progressStats = document.getElementById('progress-stats');
const backlogTable = document.getElementById('backlog-table');
const locksList = document.getElementById('locks-list');
const handoffsList = document.getElementById('handoffs-list');
const errorsList = document.getElementById('errors-list');
const activityFeed = document.getElementById('activity-feed');
const progressList = document.getElementById('progress-list');
const previewFrame = document.getElementById('preview-frame');
const previewMode = document.getElementById('preview-mode');
const selectedEvent = document.getElementById('selected-event');

let selectedEventId = null;

function formatDateTime(value) {
  if (!value) {
    return 'sin actividad';
  }

  return new Intl.DateTimeFormat('es-GT', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function badgeClass(value) {
  return `badge badge-${String(value || 'idle').toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
}

function renderAgentCard(agentState) {
  return `
    <article class="agent-card agent-${agentState.agent}">
      <div class="agent-card-top">
        <span class="agent-name">${agentState.agent.toUpperCase()}</span>
        <span class="${badgeClass(agentState.status)}">${escapeHtml(agentState.status)}</span>
      </div>
      <h3>${escapeHtml(agentState.title || agentState.taskId || 'Sin tarea activa')}</h3>
      <p>${escapeHtml(agentState.lastFile || 'Sin archivo reciente')}</p>
      <div class="agent-meta">
        <span>${escapeHtml(formatDateTime(agentState.lastActivityAt))}</span>
        <span>${escapeHtml(agentState.lastStatus || 'sin ejecucion')}</span>
      </div>
    </article>
  `;
}

function renderBacklogRows(backlog) {
  if (!backlog.length) {
    return `
      <tr>
        <td colspan="4" class="empty-cell">No hay tareas activas ni pendientes.</td>
      </tr>
    `;
  }

  return backlog
    .map((task) => `
      <tr>
        <td><span class="${badgeClass(task.status)}">${escapeHtml(task.status)}</span></td>
        <td>
          <strong>${escapeHtml(task.title)}</strong>
          <span class="table-subtitle">${escapeHtml(task.id)}</span>
        </td>
        <td>${escapeHtml(task.assignedAgent)}</td>
        <td>${escapeHtml(task.priority)}</td>
      </tr>
    `)
    .join('');
}

function renderStackList(items, renderItem, emptyCopy) {
  if (!items.length) {
    return `<div class="empty-state">${escapeHtml(emptyCopy)}</div>`;
  }

  return items.map(renderItem).join('');
}

function renderLock(lock) {
  return `
    <article class="stack-item">
      <div class="stack-title-row">
        <strong>${escapeHtml(lock.taskId)}</strong>
        <span class="${badgeClass(lock.agent)}">${escapeHtml(lock.agent)}</span>
      </div>
      <p>${escapeHtml(lock.lockedPaths.join(', ') || 'sin rutas')}</p>
      <small>${escapeHtml(formatDateTime(lock.acquiredAt))}</small>
    </article>
  `;
}

function renderHandoff(handoff) {
  return `
    <article class="stack-item">
      <div class="stack-title-row">
        <strong>${escapeHtml(handoff.sourceTaskId)}</strong>
        <span class="${badgeClass(handoff.status)}">${escapeHtml(handoff.status)}</span>
      </div>
      <p>${escapeHtml(`${handoff.fromAgent} -> ${handoff.toAgent}`)}</p>
      <small>${escapeHtml(handoff.reason || 'Sin motivo')}</small>
    </article>
  `;
}

function renderError(entry) {
  return `
    <article class="stack-item stack-item-error">
      <div class="stack-title-row">
        <strong>${escapeHtml(entry.title)}</strong>
        <span class="${badgeClass('failed')}">failed</span>
      </div>
      <p>${escapeHtml(entry.body)}</p>
    </article>
  `;
}

function renderProgressEntry(entry) {
  return `
    <article class="stack-item">
      <div class="stack-title-row">
        <strong>${escapeHtml(entry.title)}</strong>
      </div>
      <p>${escapeHtml(entry.body)}</p>
    </article>
  `;
}

function renderActivity(events) {
  if (!events.length) {
    return '<div class="empty-state">Sin eventos instrumentados.</div>';
  }

  return events
    .map((event) => {
      const isSelected = event.eventId === selectedEventId;
      return `
        <button class="feed-item ${isSelected ? 'feed-item-selected' : ''}" data-event-id="${escapeHtml(event.eventId)}">
          <div class="feed-top">
            <span class="${badgeClass(event.agent)}">${escapeHtml(event.agent)}</span>
            <span class="${badgeClass(event.status)}">${escapeHtml(event.status)}</span>
          </div>
          <strong>${escapeHtml(event.taskId)}</strong>
          <p>${escapeHtml(event.lastFile || event.files[0] || 'sin archivos')}</p>
          <small>${escapeHtml(formatDateTime(event.timestamp))}</small>
        </button>
      `;
    })
    .join('');
}

function renderSelectedEvent(event) {
  if (!event) {
    return '<div class="empty-state">Selecciona un cambio para anclar el preview.</div>';
  }

  return `
    <div class="selected-event-inner">
      <div class="selected-event-header">
        <span class="${badgeClass(event.agent)}">${escapeHtml(event.agent)}</span>
        <span class="${badgeClass(event.status)}">${escapeHtml(event.status)}</span>
      </div>
      <strong>${escapeHtml(event.taskId)}</strong>
      <p>${escapeHtml(event.lastFile || event.files[0] || 'sin archivo asociado')}</p>
      <small>${escapeHtml(formatDateTime(event.timestamp))}</small>
    </div>
  `;
}

async function loadDashboard() {
  const response = await fetch('/api/dashboard', {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Viewer API failed with status ${response.status}.`);
  }

  return response.json();
}

function render(data) {
  refreshChip.textContent = `Actualizado ${formatDateTime(data.generatedAt)}`;
  refreshChip.className = 'meta-chip';

  agentGrid.innerHTML = [data.agents.codex, data.agents.claude].map(renderAgentCard).join('');

  progressValue.style.width = `${data.summary.completionPct}%`;
  progressStats.innerHTML = `
    <strong>${data.summary.completionPct}% completado</strong>
    <span>${data.summary.completedTasks}/${data.summary.totalTasks} done</span>
    <span>${data.summary.pendingTasks} pending</span>
    <span>${data.summary.failedTasks} failed</span>
  `;

  backlogTable.innerHTML = renderBacklogRows(data.backlog);
  locksList.innerHTML = renderStackList(data.locks, renderLock, 'No hay locks activos.');
  handoffsList.innerHTML = renderStackList(
    data.handoffs.filter((handoff) => handoff.status !== 'done'),
    renderHandoff,
    'No hay handoffs abiertos.',
  );

  const errorEntries = [
    ...data.failedTasks.map((task) => ({
      title: task.title,
      body: `${task.id} | ${task.assignedAgent} | ${task.updatedAt || 'sin fecha'}`,
    })),
    ...data.conflictEntries,
  ].slice(0, 8);
  errorsList.innerHTML = renderStackList(errorEntries, renderError, 'Sin errores recientes.');

  if (!selectedEventId && data.changeEvents.length) {
    selectedEventId = data.changeEvents[0].eventId;
  }

  const currentEvent =
    data.changeEvents.find((event) => event.eventId === selectedEventId) || data.changeEvents[0] || null;
  selectedEvent.innerHTML = renderSelectedEvent(currentEvent);

  activityFeed.innerHTML = renderActivity(data.changeEvents);
  previewMode.textContent = data.preview.liveReachable ? 'Preview live' : 'Preview static dist';
  openPreviewLink.href = data.preview.embedUrl;
  if (previewFrame.dataset.src !== data.preview.embedUrl) {
    previewFrame.dataset.src = data.preview.embedUrl;
    previewFrame.src = data.preview.embedUrl;
  }

  progressList.innerHTML = renderStackList(
    [...data.progressEntries, ...data.checkpoints.map((checkpoint) => ({
      title: checkpoint.label,
      body: `${checkpoint.createdAt} | ${JSON.stringify(checkpoint.details)}`,
    }))].slice(0, 10),
    renderProgressEntry,
    'Sin progreso instrumentado.',
  );

  activityFeed.querySelectorAll('[data-event-id]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedEventId = button.dataset.eventId;
      render(data);
    });
  });
}

async function refresh() {
  try {
    const data = await loadDashboard();
    render(data);
  } catch (error) {
    refreshChip.textContent = error instanceof Error ? error.message : 'No se pudo cargar el viewer';
    refreshChip.className = 'meta-chip meta-chip-error';
  }
}

refresh().catch(() => undefined);
setInterval(() => {
  refresh().catch(() => undefined);
}, 4000);
