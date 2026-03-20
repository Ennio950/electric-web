function createOptionNode(option) {
  const normalized = typeof option === 'object' && option
    ? { value: String(option.value ?? ''), label: String(option.label ?? option.value ?? '') }
    : { value: String(option ?? ''), label: String(option ?? '') };

  const node = document.createElement('option');
  node.value = normalized.value;
  node.textContent = normalized.label;
  return node;
}

function ensureInputState(template, inputState) {
  (template.inputs || []).forEach((field) => {
    if (!inputState[field.id]) {
      inputState[field.id] = {
        value: String(field.default ?? ''),
        unit: field.unit || ''
      };
    }
    if (!inputState[field.id].unit) {
      inputState[field.id].unit = field.unit || '';
    }
  });
}

function buildInputCard(field, stateValue) {
  const row = document.createElement('article');
  row.className = 'input-row';

  const label = document.createElement('label');
  label.className = 'input-label';
  label.textContent = field.label;
  if (field.required) {
    const req = document.createElement('span');
    req.className = 'required-mark';
    req.textContent = ' *';
    label.appendChild(req);
  }

  row.appendChild(label);

  if (field.type === 'number') {
    const wrap = document.createElement('div');
    wrap.className = 'input-inline';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'field-control';
    input.value = stateValue.value ?? '';
    input.placeholder = field.default != null ? String(field.default) : '0';
    input.dataset.fieldId = field.id;
    input.dataset.fieldType = 'number';

    if (field.min != null) input.dataset.min = String(field.min);
    if (field.max != null) input.dataset.max = String(field.max);

    wrap.appendChild(input);

    if (Array.isArray(field.unitOptions) && field.unitOptions.length) {
      const unitSelect = document.createElement('select');
      unitSelect.className = 'field-unit';
      unitSelect.dataset.fieldId = field.id;
      unitSelect.dataset.fieldType = 'unit';
      field.unitOptions.forEach((unit) => {
        const option = document.createElement('option');
        option.value = String(unit);
        option.textContent = String(unit);
        unitSelect.appendChild(option);
      });
      unitSelect.value = stateValue.unit || field.unitOptions[0];
      wrap.appendChild(unitSelect);
    } else if (field.unit) {
      const unitTag = document.createElement('span');
      unitTag.className = 'field-unit-tag';
      unitTag.textContent = field.unit;
      wrap.appendChild(unitTag);
    }

    row.appendChild(wrap);
  } else if (field.type === 'select') {
    const select = document.createElement('select');
    select.className = 'field-control';
    select.dataset.fieldId = field.id;
    select.dataset.fieldType = 'select';

    const options = Array.isArray(field.options) ? field.options : [];
    options.forEach((option) => {
      select.appendChild(createOptionNode(option));
    });

    if (!select.value && options.length) {
      const first = typeof options[0] === 'object' && options[0] ? options[0].value : options[0];
      select.value = String(first);
    }
    select.value = stateValue.value ?? select.value;
    row.appendChild(select);
  } else {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'field-control';
    input.dataset.fieldId = field.id;
    input.dataset.fieldType = 'text';
    input.value = stateValue.value ?? '';
    row.appendChild(input);
  }

  if (field.help) {
    const help = document.createElement('p');
    help.className = 'field-help';
    help.textContent = field.help;
    row.appendChild(help);
  }

  return row;
}

export function renderInputs({
  container,
  template,
  inputState,
  onChange
}) {
  if (!container) return;
  ensureInputState(template, inputState);

  container.innerHTML = '';

  (template.inputs || []).forEach((field) => {
    const stateValue = inputState[field.id] || { value: '', unit: field.unit || '' };
    container.appendChild(buildInputCard(field, stateValue));
  });

  container.oninput = (event) => {
    const target = event.target;
    if (!target?.dataset?.fieldId) return;

    const fieldId = target.dataset.fieldId;
    const fieldType = target.dataset.fieldType;

    if (!inputState[fieldId]) {
      inputState[fieldId] = { value: '', unit: '' };
    }

    if (fieldType === 'unit') {
      inputState[fieldId].unit = target.value;
    } else {
      inputState[fieldId].value = target.value;
    }

    if (typeof onChange === 'function') {
      onChange(fieldId, inputState[fieldId], inputState);
    }
  };

  container.onchange = container.oninput;
}

export function collectInputState(template, inputState) {
  ensureInputState(template, inputState);
  return inputState;
}
