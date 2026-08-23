const records = () => JSON.parse(localStorage.getItem('ndss-investigations') || '[]');

const areaValues = () => [...new Set(records().flatMap(item => [
  item.subdistrict,
  item.district,
  item.province,
  item.location
]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'th'));

export const installHistoryAreaFilter = root => {
  const actions = root.querySelector('[data-case-history] .history-actions');
  if (!actions) return;

  let select = actions.querySelector('[data-history-area]');
  if (!select) {
    select = document.createElement('select');
    select.dataset.historyArea = '';
    select.setAttribute('aria-label', 'คัดกรองตามพื้นที่');
    actions.append(select);
    const status = document.createElement('small');
    status.className = 'history-area-status';
    status.dataset.historyAreaStatus = '';
    actions.after(status);
  }

  const selected = select.value;
  select.innerHTML = ['<option value="">ทุกพื้นที่</option>', ...areaValues().map(area => `<option value="${area.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}">${area.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</option>`)].join('');
  select.value = selected;
};

export const applyHistoryAreaFilter = root => {
  const selected = root.querySelector('[data-history-area]')?.value || '';
  const status = root.querySelector('[data-history-area-status]');
  const list = records();
  let visible = 0;
  root.querySelectorAll('[data-history-rows] tr').forEach(row => {
    const index = Number(row.querySelector('[data-view-case]')?.dataset.viewCase);
    const item = list[index];
    const inArea = !selected || [item?.subdistrict, item?.district, item?.province, item?.location].filter(Boolean).join(' ').includes(selected);
    row.hidden = !inArea;
    if (inArea && item) visible += 1;
  });
  if (status) status.textContent = selected ? `แสดง ${visible} รายการในพื้นที่: ${selected}` : '';
};

export const enableHistoryAreaFilter = root => {
  const refresh = () => {
    installHistoryAreaFilter(root);
    applyHistoryAreaFilter(root);
  };
  document.addEventListener('click', event => {
    if (event.target.closest('[data-view="investigation"],[data-run-history-search]')) setTimeout(refresh, 0);
  });
  document.addEventListener('input', event => {
    if (event.target.matches('[data-history-search],[data-history-from],[data-history-to]')) setTimeout(applyHistoryAreaFilter.bind(null, root), 0);
  });
  document.addEventListener('change', event => {
    if (event.target.matches('[data-history-area]')) applyHistoryAreaFilter(root);
    if (event.target.matches('[data-history-disease]')) setTimeout(applyHistoryAreaFilter.bind(null, root), 0);
  });
  document.addEventListener('submit', event => {
    if (event.target.matches('[data-investigation-form]')) setTimeout(refresh, 0);
  });
};
