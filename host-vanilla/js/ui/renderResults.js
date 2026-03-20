import { unitSystem } from '../core/unitSystem.js';

function formatCurrency(value, currency = 'Q') {
  return `${currency} ${unitSystem.formatNumber(value, 2)}`;
}

function renderMaterialRows(tbody, rows) {
  if (!tbody) return;

  if (!rows?.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-row">Sin materiales para mostrar.</td></tr>';
    return;
  }

  const fragment = document.createDocumentFragment();

  rows.forEach((row) => {
    const tr = document.createElement('tr');
    const values = [
      String(row.name ?? ''),
      unitSystem.formatNumber(row.qtyFinal, row.precision ?? 2),
      String(row.unit ?? ''),
      `${unitSystem.formatNumber(row.wastePct, 2)}%`,
      unitSystem.formatNumber(row.unitCost, 2),
      unitSystem.formatNumber(row.subtotal, 2),
    ];

    values.forEach((value) => {
      const td = document.createElement('td');
      td.textContent = value;
      tr.appendChild(td);
    });

    fragment.appendChild(tr);
  });

  tbody.replaceChildren(fragment);
}

function clearCanvas(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#071026';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function create3DState(overrides = {}) {
  return {
    rotX: -0.5,
    rotY: 0.6,
    zoom: 1.3,
    dragActive: false,
    lastX: 0,
    lastY: 0,
    ...overrides
  };
}

function projectPoint(point, state, canvas) {
  const sinX = Math.sin(state.rotX);
  const cosX = Math.cos(state.rotX);
  const sinY = Math.sin(state.rotY);
  const cosY = Math.cos(state.rotY);

  const x1 = point.x * cosY - point.z * sinY;
  const z1 = point.x * sinY + point.z * cosY;
  const y1 = point.y;

  const y2 = y1 * cosX - z1 * sinX;
  const z2 = y1 * sinX + z1 * cosX;

  const perspective = 280 * state.zoom;
  const scale = perspective / (z2 + 5);

  return {
    x: canvas.width / 2 + x1 * scale,
    y: canvas.height / 2 - y2 * scale,
    z: z2
  };
}

function drawBox3D(canvas, dims, state, labels = { x: 'X', y: 'Y', z: 'Z' }) {
  if (!canvas || !dims) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.clientWidth || canvas.width;
  const height = canvas.clientHeight || canvas.height;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#071026';
  ctx.fillRect(0, 0, width, height);

  const x = Math.max(0.001, Number(dims.x) || 1);
  const y = Math.max(0.001, Number(dims.y) || 1);
  const z = Math.max(0.001, Number(dims.z) || 1);

  const maxDim = Math.max(x, y, z);
  const sx = (x / maxDim) * 1.9;
  const sy = (y / maxDim) * 1.9;
  const sz = (z / maxDim) * 1.9;

  const points = [
    { x: -sx, y: -sy, z: -sz },
    { x: sx, y: -sy, z: -sz },
    { x: sx, y: sy, z: -sz },
    { x: -sx, y: sy, z: -sz },
    { x: -sx, y: -sy, z: sz },
    { x: sx, y: -sy, z: sz },
    { x: sx, y: sy, z: sz },
    { x: -sx, y: sy, z: sz }
  ];

  const projected = points.map((point) => projectPoint(point, state, canvas));

  const faces = [
    { indices: [0, 1, 2, 3], color: 'rgba(56, 189, 248, 0.22)' },
    { indices: [4, 5, 6, 7], color: 'rgba(59, 130, 246, 0.30)' },
    { indices: [0, 1, 5, 4], color: 'rgba(37, 99, 235, 0.28)' },
    { indices: [2, 3, 7, 6], color: 'rgba(14, 116, 144, 0.26)' },
    { indices: [1, 2, 6, 5], color: 'rgba(30, 64, 175, 0.28)' },
    { indices: [0, 3, 7, 4], color: 'rgba(12, 74, 110, 0.28)' }
  ];

  faces
    .map((face) => ({
      ...face,
      depth: face.indices.reduce((sum, index) => sum + projected[index].z, 0) / face.indices.length
    }))
    .sort((a, b) => a.depth - b.depth)
    .forEach((face) => {
      ctx.beginPath();
      face.indices.forEach((index, idx) => {
        const point = projected[index];
        if (idx === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.closePath();
      ctx.fillStyle = face.color;
      ctx.fill();
    });

  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7]
  ];

  ctx.strokeStyle = '#8dd4ff';
  ctx.lineWidth = 2;
  edges.forEach(([a, b]) => {
    ctx.beginPath();
    ctx.moveTo(projected[a].x, projected[a].y);
    ctx.lineTo(projected[b].x, projected[b].y);
    ctx.stroke();
  });

  ctx.fillStyle = '#cfe9ff';
  ctx.font = '13px Segoe UI';
  ctx.fillText(`${labels.x || 'X'}: ${unitSystem.formatNumber(x, 2)} m`, 14, height - 52);
  ctx.fillText(`${labels.y || 'Y'}: ${unitSystem.formatNumber(y, 2)} m`, 14, height - 34);
  ctx.fillText(`${labels.z || 'Z'}: ${unitSystem.formatNumber(z, 2)} m`, 14, height - 16);
}

function wireCanvasInteraction(canvas, state, redraw) {
  if (!canvas) return () => {};

  const onPointerDown = (event) => {
    state.dragActive = true;
    state.lastX = event.clientX;
    state.lastY = event.clientY;
  };

  const onPointerMove = (event) => {
    if (!state.dragActive) return;
    const dx = event.clientX - state.lastX;
    const dy = event.clientY - state.lastY;
    state.lastX = event.clientX;
    state.lastY = event.clientY;

    state.rotY += dx * 0.01;
    state.rotX += dy * 0.01;
    state.rotX = Math.max(-1.4, Math.min(1.4, state.rotX));
    redraw();
  };

  const onPointerUp = () => {
    state.dragActive = false;
  };

  const onWheel = (event) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.08 : 0.08;
    state.zoom = Math.max(0.6, Math.min(2.8, state.zoom + delta));
    redraw();
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  return () => {
    canvas.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('wheel', onWheel);
  };
}

export function createResultsRenderer(refs) {
  const miniState = create3DState({ rotX: -0.45, rotY: 0.65, zoom: 1.15 });
  const proState = create3DState({ rotX: -0.45, rotY: 0.7, zoom: 1.75 });
  let latestModel = null;
  let detachMini = null;
  let detachPro = null;

  function redrawMini() {
    if (!latestModel || !refs.mini3dCanvas) {
      clearCanvas(refs.mini3dCanvas);
      return;
    }
    drawBox3D(refs.mini3dCanvas, latestModel, miniState, latestModel.labels);
  }

  function redrawPro() {
    if (!latestModel || !refs.pro3dCanvas) {
      clearCanvas(refs.pro3dCanvas);
      return;
    }
    drawBox3D(refs.pro3dCanvas, latestModel, proState, latestModel.labels);
  }

  function ensureInteractions() {
    if (!detachMini && refs.mini3dCanvas) {
      detachMini = wireCanvasInteraction(refs.mini3dCanvas, miniState, redrawMini);
    }
    if (!detachPro && refs.pro3dCanvas) {
      detachPro = wireCanvasInteraction(refs.pro3dCanvas, proState, redrawPro);
    }
  }

  function render(result, template) {
    refs.errorList.replaceChildren();

    if (!result) {
      refs.totalValue.textContent = `${template?.currency || 'Q'} 0.00`;
      refs.materialTableBody.innerHTML = '<tr><td colspan="6" class="empty-row">Calcula para ver resultados.</td></tr>';
      refs.breakdown.innerHTML = '';
      refs.technical.textContent = 'Sin detalle tecnico.';
      latestModel = null;
      redrawMini();
      return;
    }

    if (!result.ok) {
      refs.totalValue.textContent = `${template?.currency || 'Q'} 0.00`;
      refs.materialTableBody.innerHTML = '<tr><td colspan="6" class="empty-row">No se pudo calcular por errores.</td></tr>';
      refs.breakdown.innerHTML = '';
      refs.technical.textContent = 'Corrige los errores para ver detalle tecnico.';
      latestModel = null;
      redrawMini();

      result.errors.forEach((error) => {
        const li = document.createElement('li');
        li.textContent = error;
        refs.errorList.appendChild(li);
      });
      return;
    }

    refs.totalValue.textContent = formatCurrency(result.totals.grandTotal, result.totals.currency);
    renderMaterialRows(refs.materialTableBody, result.materials);

    refs.breakdown.innerHTML = `
      <div class="kpi-item"><span>Subtotal materiales</span><strong>${formatCurrency(result.totals.materialsSubtotal, result.totals.currency)}</strong></div>
      <div class="kpi-item"><span>Mano de obra</span><strong>${formatCurrency(result.totals.labor, result.totals.currency)}</strong></div>
      <div class="kpi-item"><span>Costo fijo</span><strong>${formatCurrency(result.totals.fixedCost, result.totals.currency)}</strong></div>
      <div class="kpi-item"><span>Impuesto</span><strong>${formatCurrency(result.totals.taxAmount, result.totals.currency)}</strong></div>
      <div class="kpi-item"><span>Total general</span><strong>${formatCurrency(result.totals.grandTotal, result.totals.currency)}</strong></div>
      <div class="kpi-item"><span>Costo por unidad base</span><strong>${result.totals.costPerUnit != null ? formatCurrency(result.totals.costPerUnit, result.totals.currency) : 'N/A'}</strong></div>
    `;

    refs.technical.textContent = JSON.stringify(result.technical, null, 2);

    latestModel = result.model3d && result.model3d.enabled
      ? {
          x: result.model3d.x,
          y: result.model3d.y,
          z: result.model3d.z,
          labels: result.model3d.labels || { x: 'X', y: 'Y', z: 'Z' }
        }
      : null;

    if (!latestModel && refs.mini3dCanvas) {
      clearCanvas(refs.mini3dCanvas);
    } else {
      redrawMini();
    }

    ensureInteractions();
  }

  function clear(template) {
    render(null, template || { currency: 'Q' });
  }

  function openPro3D() {
    if (!refs.pro3dModal) return;
    refs.pro3dModal.classList.remove('hidden');
    redrawPro();
  }

  function closePro3D() {
    if (!refs.pro3dModal) return;
    refs.pro3dModal.classList.add('hidden');
  }

  function teardown() {
    if (detachMini) detachMini();
    if (detachPro) detachPro();
  }

  return {
    render,
    clear,
    openPro3D,
    closePro3D,
    teardown
  };
}

