'use strict';

/* =========================================================
   КОНСТАНТЫ И СОСТОЯНИЕ
   ========================================================= */
const KALUGA = { name: 'Калуга', lat: 54.5293, lon: 36.2754 };
const LS_TRIPS = 'fieldTripsTracker.trips.v1';
const LS_SETTINGS = 'fieldTripsTracker.settings.v1';

const MONTHS_NOM = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const MONTHS_SHORT = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];

let trips = [];
let settings = { theme: 'light', lastCar: '', fuelConsumption: '', fuelPrice: '' };
let editingId = null;
let currentTripType = 'city';
let collapsedMonths = new Set();
let firstMonthsRender = true;

let monthlyChartInstance = null;
let typeChartInstance = null;

/* =========================================================
   DOM REFERENCES
   ========================================================= */
const themeToggleBtn = document.getElementById('themeToggleBtn');
const reminderBanner = document.getElementById('reminderBanner');
const reminderText = document.getElementById('reminderText');
const reminderCloseBtn = document.getElementById('reminderCloseBtn');

const summaryMonthKm = document.getElementById('summaryMonthKm');
const summaryMonthDelta = document.getElementById('summaryMonthDelta');
const platePreview = document.getElementById('platePreview');

const searchInput = document.getElementById('searchInput');
const filterYear = document.getElementById('filterYear');
const filterMonth = document.getElementById('filterMonth');
const tripsListEl = document.getElementById('tripsList');
const emptyState = document.getElementById('emptyState');

const fuelConsumptionInput = document.getElementById('fuelConsumption');
const fuelPriceInput = document.getElementById('fuelPrice');
const fuelLitersMonth = document.getElementById('fuelLitersMonth');
const fuelCostMonth = document.getElementById('fuelCostMonth');
const avgPerDay = document.getElementById('avgPerDay');
const avgPerWeek = document.getElementById('avgPerWeek');
const avgPerMonth = document.getElementById('avgPerMonth');
const topRoutesList = document.getElementById('topRoutesList');

const exportXlsxBtn = document.getElementById('exportXlsxBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const pdfYear = document.getElementById('pdfYear');
const pdfMonth = document.getElementById('pdfMonth');
const backupJsonBtn = document.getElementById('backupJsonBtn');
const restoreJsonInput = document.getElementById('restoreJsonInput');

const fabAdd = document.getElementById('fabAdd');

const tripModal = document.getElementById('tripModal');
const tripModalTitle = document.getElementById('tripModalTitle');
const tripModalCloseBtn = document.getElementById('tripModalCloseBtn');
const tripForm = document.getElementById('tripForm');
const tripDate = document.getElementById('tripDate');
const tripTypeSegmented = document.getElementById('tripTypeSegmented');
const cityFields = document.getElementById('cityFields');
const countryFields = document.getElementById('countryFields');
const cityStreetInput = document.getElementById('cityStreetInput');
const cityStreetAutocomplete = document.getElementById('cityStreetAutocomplete');
const waypointsContainer = document.getElementById('waypointsContainer');
const addWaypointBtn = document.getElementById('addWaypointBtn');
const tripCar = document.getElementById('tripCar');
const calcRouteBtn = document.getElementById('calcRouteBtn');
const routeCalcStatus = document.getElementById('routeCalcStatus');
const tripKm = document.getElementById('tripKm');
const tripNotes = document.getElementById('tripNotes');
const tripCancelBtn = document.getElementById('tripCancelBtn');
const tripSaveBtn = document.getElementById('tripSaveBtn');

const confirmModal = document.getElementById('confirmModal');
const confirmText = document.getElementById('confirmText');
const confirmOkBtn = document.getElementById('confirmOkBtn');
const confirmCancelBtn = document.getElementById('confirmCancelBtn');

const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const toastContainer = document.getElementById('toastContainer');

/* =========================================================
   УТИЛИТЫ
   ========================================================= */
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
function debounce(fn, delay) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}
// Polls for a CDN-loaded global (e.g. window.XLSX) instead of assuming it has
// either already loaded or never will. Resolves as soon as it appears, rejects
// on timeout so the caller can show a real error instead of an endless "loading".
function waitForGlobal(name, timeout = 6000, interval = 200) {
  return new Promise((resolve, reject) => {
    if (window[name]) return resolve(window[name]);
    const start = Date.now();
    const timer = setInterval(() => {
      if (window[name]) { clearInterval(timer); resolve(window[name]); }
      else if (Date.now() - start > timeout) { clearInterval(timer); reject(new Error(`${name} unavailable`)); }
    }, interval);
  });
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function round1(n) { return Math.round((n || 0) * 10) / 10; }
function formatDateRu(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}
function formatMoney(n) {
  return `${Math.round(n || 0).toLocaleString('ru-RU')} ₽`;
}
function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function firstPart(name) {
  return String(name || '').split(',')[0].trim();
}
function shortAddress(displayName) {
  const parts = String(displayName || '').split(',').map(s => s.trim()).filter(Boolean);
  return parts.slice(0, Math.min(3, parts.length)).join(', ');
}
function pluralizeTrip(n) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'поездка';
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'поездки';
  return 'поездок';
}
function routeFullText(t) {
  if (t.type === 'city') return `Калуга → ${firstPart(t.points[0].name)} → Калуга`;
  return `Калуга → ${t.points.map(p => firstPart(p.name)).join(' → ')} → Калуга`;
}
function isoWeekKey(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}
function parsePlate(raw) {
  if (!raw) return { main: '—', region: '—' };
  let s = String(raw).trim().toUpperCase().replace(/\s+/g, ' ');
  if (!s) return { main: '—', region: '—' };
  if (s.includes(' ')) {
    const idx = s.lastIndexOf(' ');
    return { main: s.slice(0, idx), region: s.slice(idx + 1) };
  }
  const m = s.match(/^([А-ЯЁ]\d{3}[А-ЯЁ]{2})(\d{2,3})$/);
  if (m) return { main: m[1], region: m[2] };
  return { main: s, region: '—' };
}
function plateMiniHtml(raw) {
  const { main, region } = parsePlate(raw);
  return `<div class="plate plate-sm" title="${escapeHtml(raw || 'Номер не указан')}">
    <span class="plate-number">${escapeHtml(main)}</span>
    <div class="plate-region">
      <span class="plate-region-num">${escapeHtml(region)}</span>
      <span class="plate-rus-flag"><span class="flag-stripe flag-white"></span><span class="flag-stripe flag-blue"></span><span class="flag-stripe flag-red"></span></span>
      <span class="plate-rus-text">RUS</span>
    </div>
  </div>`;
}

/* =========================================================
   ХРАНИЛИЩЕ
   ========================================================= */
function loadTrips() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_TRIPS));
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }
}
function saveTrips() { localStorage.setItem(LS_TRIPS, JSON.stringify(trips)); }
function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_SETTINGS)) || {};
    return Object.assign({ theme: 'light', lastCar: '', fuelConsumption: '', fuelPrice: '' }, raw);
  } catch { return { theme: 'light', lastCar: '', fuelConsumption: '', fuelPrice: '' }; }
}
function saveSettings() { localStorage.setItem(LS_SETTINGS, JSON.stringify(settings)); }

/* =========================================================
   TOAST / МОДАЛЬНЫЕ ОКНА / ЗАГРУЗКА
   ========================================================= */
function showToast(message, type = 'info', duration = 3200) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icon = type === 'success' ? 'fa-circle-check' : (type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info');
  el.innerHTML = `<i class="fa-solid ${icon}"></i><span>${escapeHtml(message)}</span>`;
  toastContainer.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .25s ease'; setTimeout(() => el.remove(), 260); }, duration);
}
function showLoading(text) { loadingText.textContent = text || 'Загрузка…'; loadingOverlay.classList.remove('hidden'); }
function hideLoading() { loadingOverlay.classList.add('hidden'); }
function openModal(el) { el.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
function closeModal(el) { el.classList.add('hidden'); document.body.style.overflow = ''; }
function showConfirm(message) {
  return new Promise(resolve => {
    confirmText.textContent = message;
    openModal(confirmModal);
    function cleanup(result) {
      closeModal(confirmModal);
      confirmOkBtn.removeEventListener('click', onOk);
      confirmCancelBtn.removeEventListener('click', onCancel);
      resolve(result);
    }
    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }
    confirmOkBtn.addEventListener('click', onOk);
    confirmCancelBtn.addEventListener('click', onCancel);
  });
}

/* =========================================================
   ТЕМА
   ========================================================= */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeToggleBtn.querySelector('i').className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  if (window.Chart) {
    Chart.defaults.color = theme === 'dark' ? '#B6BDC9' : '#43474E';
    Chart.defaults.borderColor = theme === 'dark' ? '#384152' : '#E1E5EC';
  }
}

/* =========================================================
   ТАБЫ
   ========================================================= */
function switchTab(tabId) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === tabId));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
  if (tabId === 'tab-stats') renderStats();
}

/* =========================================================
   АВТОКОМПЛИТ (Nominatim)
   ========================================================= */
function attachAutocomplete(input, listEl, opts = {}) {
  input.addEventListener('input', () => {
    delete input.dataset.lat; delete input.dataset.lon; delete input.dataset.name;
    clearTimeout(input._acTimer);
    const q = input.value.trim();
    if (q.length < 2) { listEl.classList.remove('open'); listEl.innerHTML = ''; return; }
    input._acTimer = setTimeout(() => runAutocompleteSearch(input, listEl, q, opts), 300);
  });
}
async function runAutocompleteSearch(input, listEl, q, opts) {
  if (!navigator.onLine) {
    listEl.innerHTML = '<div class="autocomplete-empty">Нет интернета — можно ввести название вручную, километраж указывается вручную.</div>';
    listEl.classList.add('open');
    return;
  }
  if (input._acController) input._acController.abort();
  const controller = new AbortController();
  input._acController = controller;
  const params = new URLSearchParams({ format: 'json', addressdetails: '1', limit: '8', countrycodes: 'ru' });

  if (opts.cityMode) {
    // Улица (+ опционально номер дома) строго в Калуге: структурированный запрос
    // точнее фильтрует по городу, чем свободный текст, и не путает номер дома с улицей.
    const houseMatch = q.match(/^(.*?)[,\s]+(\d+[а-яА-Я\/]*)\s*$/);
    if (houseMatch) {
      params.set('street', `${houseMatch[2]} ${houseMatch[1].trim()}`);
      params.set('city', 'Калуга');
    } else {
      params.set('q', `Калуга, ${q}`);
    }
    // левая,верхняя,правая,нижняя граница (lon_min,lat_max,lon_max,lat_min) — сама Калуга
    params.set('viewbox', '36.05,54.65,36.45,54.40');
    params.set('bounded', '1');
  } else {
    // Населённые пункты Калужской области: жёсткая привязка к границам региона,
    // чтобы мелкие деревни не терялись среди тёзок из других областей.
    params.set('q', `${q}, Калужская область`);
    params.set('viewbox', '33.50,55.35,37.55,53.30');
    params.set('bounded', '1');
  }

  listEl.innerHTML = '<div class="autocomplete-empty">Поиск…</div>';
  listEl.classList.add('open');
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, { signal: controller.signal });
    if (!res.ok) throw new Error('bad response');
    const items = await res.json();
    renderAutocompleteResults(input, listEl, items);
  } catch (e) {
    if (e.name === 'AbortError') return;
    listEl.innerHTML = '<div class="autocomplete-empty">Ошибка поиска. Проверьте интернет-соединение.</div>';
    listEl.classList.add('open');
  }
}
function renderAutocompleteResults(input, listEl, items) {
  if (!items || !items.length) {
    listEl.innerHTML = '<div class="autocomplete-empty">Ничего не найдено</div>';
    listEl.classList.add('open');
    return;
  }
  listEl.innerHTML = items.map((it, i) => `<div class="autocomplete-item" data-idx="${i}">${escapeHtml(shortAddress(it.display_name))}</div>`).join('');
  listEl.classList.add('open');
  listEl.querySelectorAll('.autocomplete-item').forEach((el, i) => {
    el.addEventListener('click', () => {
      const it = items[i];
      const label = shortAddress(it.display_name);
      input.value = label;
      input.dataset.lat = it.lat;
      input.dataset.lon = it.lon;
      input.dataset.name = label;
      listEl.classList.remove('open');
      listEl.innerHTML = '';
      autoCalcRoute();
    });
  });
}
document.addEventListener('click', (e) => {
  document.querySelectorAll('.autocomplete-list.open').forEach(list => {
    if (!list.parentElement.contains(e.target)) list.classList.remove('open');
  });
});
attachAutocomplete(cityStreetInput, cityStreetAutocomplete, { cityMode: true });

/* =========================================================
   ДИНАМИЧЕСКИЕ ПУНКТЫ МАРШРУТА (за город)
   ========================================================= */
function createWaypointRow(index) {
  const row = document.createElement('div');
  row.className = 'waypoint-row';
  row.innerHTML = `
    <div class="waypoint-input-wrap">
      <span class="waypoint-label">Пункт</span>
      <input type="text" class="waypoint-input" placeholder="Населённый пункт" autocomplete="off">
      <div class="autocomplete-list"></div>
    </div>
    <button type="button" class="waypoint-remove" aria-label="Удалить пункт"><i class="fa-solid fa-trash"></i></button>`;
  const input = row.querySelector('.waypoint-input');
  const list = row.querySelector('.autocomplete-list');
  attachAutocomplete(input, list, { cityMode: false });
  row.querySelector('.waypoint-remove').addEventListener('click', () => {
    row.remove();
    updateWaypointRemoveVisibility();
    autoCalcRoute();
  });
  return row;
}
function updateWaypointRemoveVisibility() {
  const rows = waypointsContainer.querySelectorAll('.waypoint-row');
  rows.forEach(r => { r.querySelector('.waypoint-remove').style.visibility = rows.length > 1 ? 'visible' : 'hidden'; });
}
function ensureAtLeastOneWaypoint() {
  if (!waypointsContainer.querySelector('.waypoint-row')) {
    waypointsContainer.appendChild(createWaypointRow());
  }
  updateWaypointRemoveVisibility();
}
addWaypointBtn.addEventListener('click', () => {
  waypointsContainer.appendChild(createWaypointRow());
  updateWaypointRemoveVisibility();
});

/* =========================================================
   МОДАЛЬНОЕ ОКНО ПОЕЗДКИ
   ========================================================= */
function setTripType(type) {
  currentTripType = type;
  document.querySelectorAll('#tripTypeSegmented .segmented-btn').forEach(b => b.classList.toggle('active', b.dataset.type === type));
  cityFields.classList.toggle('hidden', type !== 'city');
  countryFields.classList.toggle('hidden', type !== 'country');
  if (type === 'country') ensureAtLeastOneWaypoint();
}
tripTypeSegmented.addEventListener('click', (e) => {
  const btn = e.target.closest('.segmented-btn');
  if (btn) setTripType(btn.dataset.type);
});

function clearCityField() {
  cityStreetInput.value = '';
  delete cityStreetInput.dataset.lat; delete cityStreetInput.dataset.lon; delete cityStreetInput.dataset.name;
  cityStreetAutocomplete.classList.remove('open'); cityStreetAutocomplete.innerHTML = '';
}

function openTripModal(id) {
  editingId = id || null;
  tripForm.reset();
  clearCityField();
  waypointsContainer.innerHTML = '';
  routeCalcStatus.textContent = ''; routeCalcStatus.className = 'route-calc-status';

  if (editingId) {
    const trip = trips.find(t => t.id === editingId);
    if (!trip) { editingId = null; }
  }

  if (editingId) {
    const trip = trips.find(t => t.id === editingId);
    tripModalTitle.textContent = 'Редактировать поездку';
    tripDate.value = trip.date;
    setTripType(trip.type);
    tripCar.value = trip.car || '';
    tripNotes.value = trip.notes || '';
    tripKm.value = trip.km || '';
    if (trip.type === 'city') {
      const p = trip.points[0];
      cityStreetInput.value = p.name;
      cityStreetInput.dataset.lat = p.lat; cityStreetInput.dataset.lon = p.lon; cityStreetInput.dataset.name = p.name;
    } else {
      trip.points.forEach(p => {
        const row = createWaypointRow();
        const inp = row.querySelector('.waypoint-input');
        inp.value = p.name;
        inp.dataset.lat = p.lat; inp.dataset.lon = p.lon; inp.dataset.name = p.name;
        waypointsContainer.appendChild(row);
      });
      updateWaypointRemoveVisibility();
    }
  } else {
    tripModalTitle.textContent = 'Новая поездка';
    tripDate.value = todayStr();
    setTripType('city');
    tripCar.value = settings.lastCar || '';
  }
  openModal(tripModal);
}
function closeTripModal() {
  closeModal(tripModal);
  editingId = null;
}
fabAdd.addEventListener('click', () => openTripModal(null));
tripModalCloseBtn.addEventListener('click', closeTripModal);
tripCancelBtn.addEventListener('click', closeTripModal);

function getRoutePoints() {
  if (currentTripType === 'city') {
    if (!cityStreetInput.dataset.lat) return null;
    return [KALUGA, { name: cityStreetInput.dataset.name || cityStreetInput.value, lat: +cityStreetInput.dataset.lat, lon: +cityStreetInput.dataset.lon }, KALUGA];
  }
  const rows = [...waypointsContainer.querySelectorAll('.waypoint-row')];
  const points = [];
  for (const row of rows) {
    const inp = row.querySelector('.waypoint-input');
    if (!inp.value.trim()) continue;
    if (!inp.dataset.lat) return null;
    points.push({ name: inp.dataset.name || inp.value, lat: +inp.dataset.lat, lon: +inp.dataset.lon });
  }
  if (!points.length) return null;
  return [KALUGA, ...points, KALUGA];
}
function showRouteStatus(msg, cls) {
  routeCalcStatus.textContent = msg;
  routeCalcStatus.className = 'route-calc-status' + (cls ? ' ' + cls : '');
}
async function calcRoute() {
  const points = getRoutePoints();
  if (!points) {
    showRouteStatus(
      navigator.onLine
        ? 'Выберите все пункты маршрута из списка предложений.'
        : 'Нет подключения к интернету — введите километраж вручную.',
      'error'
    );
    return;
  }
  calcRouteBtn.disabled = true;
  showRouteStatus('Расчёт маршрута…', '');
  try {
    const coords = points.map(p => `${p.lon},${p.lat}`).join(';');
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=false`);
    if (!res.ok) throw new Error('network');
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes || !data.routes.length) throw new Error('no route');
    const km = round1(data.routes[0].distance / 1000);
    tripKm.value = km;
    showRouteStatus(`Маршрут рассчитан: ${km} км`, 'success');
  } catch (e) {
    showRouteStatus('Не удалось рассчитать маршрут автоматически. Введите километраж вручную.', 'error');
  } finally {
    calcRouteBtn.disabled = false;
  }
}
calcRouteBtn.addEventListener('click', calcRoute);
const autoCalcRoute = debounce(calcRoute, 350);

// Доп. фикс: если авторасчёт маршрута выдал ошибку, а пользователь начал
// вписывать километраж вручную — не оставляем красный текст ошибки висеть.
tripKm.addEventListener('input', () => {
  if (routeCalcStatus.classList.contains('error')) {
    showRouteStatus('Километраж указан вручную.', '');
  }
});

function saveTrip() {
  const date = tripDate.value;
  if (!date) { showToast('Укажите дату поездки', 'error'); return; }

  let points;
  if (currentTripType === 'city') {
    if (!cityStreetInput.value.trim()) { showToast('Укажите улицу назначения', 'error'); return; }
    if (!cityStreetInput.dataset.lat) {
      if (navigator.onLine) { showToast('Выберите улицу из списка предложений', 'error'); return; }
      points = [{ name: cityStreetInput.value.trim(), lat: null, lon: null }];
    } else {
      points = [{ name: cityStreetInput.dataset.name || cityStreetInput.value, lat: +cityStreetInput.dataset.lat, lon: +cityStreetInput.dataset.lon }];
    }
  } else {
    const rows = [...waypointsContainer.querySelectorAll('.waypoint-row')];
    points = [];
    for (const row of rows) {
      const inp = row.querySelector('.waypoint-input');
      if (!inp.value.trim()) continue;
      if (!inp.dataset.lat) {
        if (navigator.onLine) { showToast('Выберите каждый пункт маршрута из списка предложений', 'error'); return; }
        points.push({ name: inp.value.trim(), lat: null, lon: null });
        continue;
      }
      points.push({ name: inp.dataset.name || inp.value, lat: +inp.dataset.lat, lon: +inp.dataset.lon });
    }
    if (!points.length) { showToast('Добавьте хотя бы один пункт маршрута', 'error'); return; }
  }

  const km = parseFloat(tripKm.value) || 0;
  const car = tripCar.value.trim();
  const notes = tripNotes.value.trim();

  if (editingId) {
    const trip = trips.find(t => t.id === editingId);
    Object.assign(trip, { date, type: currentTripType, points, car, notes, km });
  } else {
    trips.push({ id: uuid(), date, type: currentTripType, points, car, notes, km, createdAt: Date.now() });
  }
  saveTrips();
  settings.lastCar = car;
  saveSettings();
  closeTripModal();
  renderAll();
  showToast(
    navigator.onLine ? 'Поездка сохранена' : 'Поездка сохранена офлайн. Пересчитайте маршрут при подключении к интернету.',
    'success',
    navigator.onLine ? 3200 : 5000
  );
}
tripSaveBtn.addEventListener('click', saveTrip);

async function confirmDeleteTrip(id) {
  const ok = await showConfirm('Удалить эту поездку? Это действие необратимо.');
  if (!ok) return;
  trips = trips.filter(t => t.id !== id);
  saveTrips();
  renderAll();
  showToast('Поездка удалена', 'success');
}

/* =========================================================
   ГЛАВНАЯ: ФИЛЬТРЫ, ПОИСК, СПИСОК ПОЕЗДОК
   ========================================================= */
function populateHomeFilters() {
  const years = [...new Set(trips.map(t => t.date.slice(0, 4)))].sort().reverse();
  const curYear = filterYear.value;
  filterYear.innerHTML = '<option value="">Все годы</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
  if (years.includes(curYear)) filterYear.value = curYear;

  const curMonth = filterMonth.value;
  filterMonth.innerHTML = '<option value="">Все месяцы</option>' + MONTHS_NOM.map((m, i) => `<option value="${String(i + 1).padStart(2, '0')}">${m}</option>`).join('');
  filterMonth.value = curMonth;
}

function getFilteredTrips() {
  const q = searchInput.value.trim().toLowerCase();
  const year = filterYear.value;
  const month = filterMonth.value;
  return trips.filter(t => {
    if (year && t.date.slice(0, 4) !== year) return false;
    if (month && t.date.slice(5, 7) !== month) return false;
    if (q) {
      const hay = [t.notes || '', ...(t.points || []).map(p => p.name), t.car || ''].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
}

function tripCardHtml(t) {
  const badge = t.type === 'city' ? '<span class="badge badge-city">Город</span>' : '<span class="badge badge-country">За город</span>';
  const arrow = '<i class="fa-solid fa-arrow-right-long"></i>';
  const route = t.type === 'city'
    ? `Калуга ${arrow} ${escapeHtml(firstPart(t.points[0].name))} ${arrow} Калуга`
    : `Калуга ${t.points.map(p => `${arrow} ${escapeHtml(firstPart(p.name))}`).join(' ')} ${arrow} Калуга`;
  return `
  <div class="trip-card">
    <div class="trip-card-top">
      <div class="trip-badges">${badge}<span class="trip-date">${formatDateRu(t.date)}</span></div>
      <span class="trip-km">${round1(t.km)} км</span>
    </div>
    <div class="trip-route">${route}</div>
    ${t.notes ? `<div class="trip-notes"><i class="fa-solid fa-note-sticky"></i> ${escapeHtml(t.notes)}</div>` : ''}
    <div class="trip-card-bottom">
      <div class="trip-plate-mini">${plateMiniHtml(t.car)}</div>
      <div class="trip-actions">
        <button class="action-btn edit" data-id="${t.id}" aria-label="Редактировать"><i class="fa-solid fa-pen"></i></button>
        <button class="action-btn danger" data-id="${t.id}" aria-label="Удалить"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>
  </div>`;
}

function renderTripsList() {
  const filtered = getFilteredTrips();
  if (!filtered.length) {
    tripsListEl.innerHTML = '';
    const hasAnyTrips = trips.length > 0;
    emptyState.querySelector('h3').textContent = hasAnyTrips ? 'Ничего не найдено' : 'Поездок пока нет';
    emptyState.querySelector('p').textContent = hasAnyTrips
      ? 'Попробуйте изменить поисковый запрос или сбросить фильтр по месяцу/году.'
      : 'Нажмите «+», чтобы добавить первую поездку.';
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  const map = new Map();
  const order = [];
  filtered.forEach(t => {
    const key = t.date.slice(0, 7);
    if (!map.has(key)) { map.set(key, []); order.push(key); }
    map.get(key).push(t);
  });

  if (firstMonthsRender) {
    order.forEach((k, i) => { if (i > 0) collapsedMonths.add(k); });
    firstMonthsRender = false;
  }

  tripsListEl.innerHTML = order.map(key => {
    const list = map.get(key);
    const totalKm = list.reduce((s, t) => s + (t.km || 0), 0);
    const collapsed = collapsedMonths.has(key);
    const [y, m] = key.split('-');
    const title = `${MONTHS_NOM[+m - 1]} ${y}`;
    return `
    <div class="month-group ${collapsed ? 'collapsed' : ''}">
      <div class="month-header" data-key="${key}">
        <div class="month-header-left">
          <h3>${title}</h3>
          <span class="month-header-badge">${list.length}</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <span class="month-header-km">${round1(totalKm)} км</span>
          <i class="fa-solid fa-chevron-down month-chevron"></i>
        </div>
      </div>
      <div class="month-body">${list.map(tripCardHtml).join('')}</div>
    </div>`;
  }).join('');
}

tripsListEl.addEventListener('click', (e) => {
  const header = e.target.closest('.month-header');
  if (header) {
    const key = header.dataset.key;
    if (collapsedMonths.has(key)) collapsedMonths.delete(key); else collapsedMonths.add(key);
    renderTripsList();
    return;
  }
  const editBtn = e.target.closest('.action-btn.edit');
  if (editBtn) { openTripModal(editBtn.dataset.id); return; }
  const delBtn = e.target.closest('.action-btn.danger');
  if (delBtn) { confirmDeleteTrip(delBtn.dataset.id); return; }
});

searchInput.addEventListener('input', debounce(renderTripsList, 200));
filterYear.addEventListener('change', renderTripsList);
filterMonth.addEventListener('change', renderTripsList);

/* =========================================================
   СВОДКА И ГОСЗНАК
   ========================================================= */
function updatePlateWidget(raw) {
  const { main, region } = parsePlate(raw);
  platePreview.querySelector('.plate-number').textContent = main;
  platePreview.querySelector('.plate-region-num').textContent = region;
}
function renderSummary() {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthTrips = trips.filter(t => t.date.slice(0, 7) === ym);
  const totalKm = monthTrips.reduce((s, t) => s + (t.km || 0), 0);
  summaryMonthKm.textContent = `${round1(totalKm)} км`;
  summaryMonthDelta.textContent = `поездок: ${monthTrips.length}`;

  let lastCar = settings.lastCar || '';
  if (trips.length) {
    const sorted = trips.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    lastCar = sorted[0].car || lastCar;
  }
  updatePlateWidget(lastCar);
}

/* =========================================================
   НАПОМИНАНИЕ
   ========================================================= */
function checkReminder() {
  if (!trips.length) { reminderBanner.classList.add('hidden'); return; }
  const lastDate = trips.reduce((max, t) => (t.date > max ? t.date : max), trips[0].date);
  const diffDays = Math.floor((Date.now() - new Date(lastDate + 'T00:00:00').getTime()) / 86400000);
  const dismissed = sessionStorage.getItem('reminderDismissedDate');
  if (diffDays > 3 && dismissed !== lastDate) {
    reminderText.textContent = `Последняя поездка была ${diffDays} дн. назад (${formatDateRu(lastDate)}). Не забудьте добавить новые поездки.`;
    reminderBanner.dataset.lastDate = lastDate;
    reminderBanner.classList.remove('hidden');
  } else {
    reminderBanner.classList.add('hidden');
  }
}
reminderCloseBtn.addEventListener('click', () => {
  sessionStorage.setItem('reminderDismissedDate', reminderBanner.dataset.lastDate || '');
  reminderBanner.classList.add('hidden');
});

/* =========================================================
   СТАТИСТИКА
   ========================================================= */
function computeMonthlySeries(limitMonths = 12) {
  const map = new Map();
  trips.forEach(t => {
    const key = t.date.slice(0, 7);
    map.set(key, (map.get(key) || 0) + (t.km || 0));
  });
  const keys = [...map.keys()].sort();
  const lastKeys = keys.slice(-limitMonths);
  return {
    labels: lastKeys.map(k => { const [y, m] = k.split('-'); return `${MONTHS_SHORT[+m - 1]} ${y}`; }),
    values: lastKeys.map(k => round1(map.get(k)))
  };
}
function computeTypeSplit() {
  let city = 0, country = 0;
  trips.forEach(t => { if (t.type === 'city') city += (t.km || 0); else country += (t.km || 0); });
  return { city: round1(city), country: round1(country) };
}
function computeTopRoutes(n = 5) {
  const map = new Map();
  trips.forEach(t => {
    const key = t.type === 'city' ? firstPart(t.points[0].name) : t.points.map(p => firstPart(p.name)).join(' → ');
    map.set(key, (map.get(key) || 0) + 1);
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}
function computeAverages() {
  if (!trips.length) return { day: 0, week: 0, month: 0 };
  const totalKm = trips.reduce((s, t) => s + (t.km || 0), 0);
  const dateSet = new Set(), weekSet = new Set(), monthSet = new Set();
  trips.forEach(t => { dateSet.add(t.date); weekSet.add(isoWeekKey(t.date)); monthSet.add(t.date.slice(0, 7)); });
  return { day: totalKm / dateSet.size, week: totalKm / weekSet.size, month: totalKm / monthSet.size };
}

function renderCharts() {
  if (!window.Chart) return;
  const monthly = computeMonthlySeries();
  const ctx1 = document.getElementById('chartMonthly').getContext('2d');
  if (monthlyChartInstance) monthlyChartInstance.destroy();
  monthlyChartInstance = new Chart(ctx1, {
    type: 'bar',
    data: { labels: monthly.labels, datasets: [{ label: 'Км', data: monthly.values, backgroundColor: '#2196F3', borderRadius: 6, maxBarThickness: 36 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.y} км` } } },
      scales: { y: { beginAtZero: true } }
    }
  });

  const split = computeTypeSplit();
  const ctx2 = document.getElementById('chartTypeSplit').getContext('2d');
  if (typeChartInstance) typeChartInstance.destroy();
  typeChartInstance = new Chart(ctx2, {
    type: 'pie',
    data: { labels: ['Город', 'За город'], datasets: [{ data: [split.city, split.country], backgroundColor: ['#2196F3', '#FF4081'] }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
  });
}
function renderTopRoutesList() {
  const top = computeTopRoutes();
  if (!top.length) {
    topRoutesList.innerHTML = '<li style="justify-content:center;color:var(--on-surface-variant);">Пока нет данных</li>';
    return;
  }
  topRoutesList.innerHTML = top.map(([name, count], i) => `
    <li><div class="top-route-name"><span class="top-route-rank">${i + 1}</span>${escapeHtml(name)}</div><span class="top-route-count">${count} ${pluralizeTrip(count)}</span></li>
  `).join('');
}
function renderAverages() {
  const a = computeAverages();
  avgPerDay.textContent = `${round1(a.day)} км`;
  avgPerWeek.textContent = `${round1(a.week)} км`;
  avgPerMonth.textContent = `${round1(a.month)} км`;
}
function currentMonthKm() {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return trips.filter(t => t.date.slice(0, 7) === ym).reduce((s, t) => s + (t.km || 0), 0);
}
function renderFuelCalc() {
  const consumption = parseFloat(fuelConsumptionInput.value) || 0;
  const price = parseFloat(fuelPriceInput.value) || 0;
  const km = currentMonthKm();
  const liters = km * consumption / 100;
  const cost = liters * price;
  fuelLitersMonth.textContent = liters ? liters.toFixed(1) : '0';
  fuelCostMonth.textContent = cost ? formatMoney(cost) : '0 ₽';
}
fuelConsumptionInput.addEventListener('input', debounce(() => { settings.fuelConsumption = fuelConsumptionInput.value; saveSettings(); renderFuelCalc(); }, 300));
fuelPriceInput.addEventListener('input', debounce(() => { settings.fuelPrice = fuelPriceInput.value; saveSettings(); renderFuelCalc(); }, 300));

function renderStats() {
  renderCharts();
  renderTopRoutesList();
  renderAverages();
  renderFuelCalc();
}

/* =========================================================
   ОТЧЁТЫ: EXCEL / PDF / JSON
   ========================================================= */
function populateReportSelects() {
  const now = new Date();
  const years = [...new Set(trips.map(t => t.date.slice(0, 4)))].sort().reverse();
  if (!years.includes(String(now.getFullYear()))) years.unshift(String(now.getFullYear()));
  const curYear = pdfYear.value;
  pdfYear.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
  pdfYear.value = years.includes(curYear) ? curYear : String(now.getFullYear());

  const curMonth = pdfMonth.value;
  pdfMonth.innerHTML = MONTHS_NOM.map((m, i) => `<option value="${String(i + 1).padStart(2, '0')}">${m}</option>`).join('');
  pdfMonth.value = curMonth || String(now.getMonth() + 1).padStart(2, '0');
}

async function exportXlsx() {
  if (!trips.length) { showToast('Нет данных для экспорта', 'error'); return; }
  showLoading('Подготовка файла Excel…');
  try {
    await waitForGlobal('XLSX');
  } catch {
    hideLoading();
    showToast(
      navigator.onLine
        ? 'Не удалось загрузить библиотеку экспорта. Обновите страницу и попробуйте ещё раз.'
        : 'Экспорт в Excel недоступен офлайн при первой загрузке приложения. Подключитесь к интернету и повторите попытку.',
      'error'
    );
    return;
  }
  hideLoading();
  const rows = trips.slice().sort((a, b) => a.date.localeCompare(b.date)).map(t => ({
    'Дата': formatDateRu(t.date),
    'Тип': t.type === 'city' ? 'В городе' : 'За город',
    'Маршрут': routeFullText(t),
    'Км': round1(t.km),
    'Гос. номер': t.car || '',
    'Заметки': t.notes || ''
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 42 }, { wch: 8 }, { wch: 14 }, { wch: 34 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Поездки');
  XLSX.writeFile(wb, `Поездки_${todayStr()}.xlsx`);
  showToast('Файл Excel сохранён', 'success');
}
exportXlsxBtn.addEventListener('click', exportXlsx);

async function exportPdf() {
  const year = pdfYear.value, month = pdfMonth.value;
  const list = trips.filter(t => t.date.slice(0, 4) === year && t.date.slice(5, 7) === month).sort((a, b) => a.date.localeCompare(b.date));
  if (!list.length) { showToast('За выбранный период поездок нет', 'error'); return; }

  showLoading('Формирование PDF…');
  try {
    await waitForGlobal('jspdf');
    await waitForGlobal('html2canvas');
  } catch {
    hideLoading();
    showToast(
      navigator.onLine
        ? 'Не удалось загрузить библиотеку формирования PDF. Обновите страницу и попробуйте ещё раз.'
        : 'Экспорт в PDF недоступен офлайн при первой загрузке приложения. Подключитесь к интернету и повторите попытку.',
      'error'
    );
    return;
  }
  const totalKm = list.reduce((s, t) => s + (t.km || 0), 0);
  const consumption = parseFloat(fuelConsumptionInput.value) || 0;
  const price = parseFloat(fuelPriceInput.value) || 0;
  const liters = totalKm * consumption / 100;
  const cost = liters * price;

  const container = document.createElement('div');
  container.style.cssText = 'position:fixed; left:-9999px; top:0; width:750px; background:#fff; color:#111; font-family:Roboto, Arial, sans-serif; padding:24px;';
  container.innerHTML = `
    <h1 style="font-size:20px;margin:0 0 4px;">Отчёт по поездкам</h1>
    <p style="font-size:13px;color:#555;margin:0 0 16px;">${MONTHS_NOM[+month - 1]} ${year} г. — инженер полевой эксплуатации базовых станций</p>
    <table style="width:100%; border-collapse:collapse; font-size:12px;">
      <thead><tr style="background:#2196F3;color:#fff;">
        <th style="padding:6px;text-align:left;">Дата</th>
        <th style="padding:6px;text-align:left;">Тип</th>
        <th style="padding:6px;text-align:left;">Маршрут</th>
        <th style="padding:6px;text-align:right;">Км</th>
        <th style="padding:6px;text-align:left;">Авто</th>
        <th style="padding:6px;text-align:left;">Заметки</th>
      </tr></thead>
      <tbody>
        ${list.map((t, i) => `<tr style="background:${i % 2 ? '#F4F7FC' : '#fff'};">
          <td style="padding:6px;border-bottom:1px solid #eee;">${formatDateRu(t.date)}</td>
          <td style="padding:6px;border-bottom:1px solid #eee;">${t.type === 'city' ? 'Город' : 'За город'}</td>
          <td style="padding:6px;border-bottom:1px solid #eee;">${escapeHtml(routeFullText(t))}</td>
          <td style="padding:6px;border-bottom:1px solid #eee;text-align:right;">${round1(t.km)}</td>
          <td style="padding:6px;border-bottom:1px solid #eee;">${escapeHtml(t.car || '—')}</td>
          <td style="padding:6px;border-bottom:1px solid #eee;">${escapeHtml(t.notes || '')}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div style="margin-top:16px;font-size:13px;line-height:1.7;">
      <p><b>Всего поездок:</b> ${list.length}</p>
      <p><b>Суммарный пробег:</b> ${round1(totalKm)} км</p>
      ${consumption ? `<p><b>Расход топлива:</b> ${liters.toFixed(1)} л</p>` : ''}
      ${consumption && price ? `<p><b>Стоимость топлива:</b> ${formatMoney(cost)}</p>` : ''}
    </div>`;
  document.body.appendChild(container);

  try {
    // Растеризуем весь отчёт целиком (сохраняет кириллицу, т.к. jsPDF без
    // встроенного кириллического шрифта рисует текст только латиницей),
    // затем нарезаем получившийся канвас на срезы по высоте страницы A4 —
    // это даёт автоматическую разбивку на страницы для отчётов любой длины.
    const canvas = await html2canvas(container, { scale: 2, backgroundColor: '#ffffff' });
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = 20;
    const usableWidth = doc.internal.pageSize.getWidth() - margin * 2;
    const usableHeight = doc.internal.pageSize.getHeight() - margin * 2;
    const pxToPt = usableWidth / canvas.width;
    const pageHeightPx = usableHeight / pxToPt;

    let renderedPx = 0;
    let pageIndex = 0;
    while (renderedPx < canvas.height) {
      const sliceHeightPx = Math.min(pageHeightPx, canvas.height - renderedPx);
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeightPx;
      pageCanvas.getContext('2d').drawImage(
        canvas, 0, renderedPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx
      );
      if (pageIndex > 0) doc.addPage();
      doc.addImage(pageCanvas.toDataURL('image/png'), 'PNG', margin, margin, usableWidth, sliceHeightPx * pxToPt);
      renderedPx += sliceHeightPx;
      pageIndex += 1;
    }

    doc.save(`Отчет_${MONTHS_NOM[+month - 1]}_${year}.pdf`);
    container.remove();
    hideLoading();
    showToast(`PDF отчёт сформирован (${pageIndex} стр.)`, 'success');
  } catch (e) {
    container.remove();
    hideLoading();
    showToast('Ошибка при формировании PDF', 'error');
  }
}
exportPdfBtn.addEventListener('click', exportPdf);

function backupJson() {
  const data = { exportedAt: new Date().toISOString(), trips, settings };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `trips-backup-${todayStr()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  showToast('Резервная копия сохранена', 'success');
}
backupJsonBtn.addEventListener('click', backupJson);

restoreJsonInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data.trips)) throw new Error('bad format');
    const ok = await showConfirm(`Импортировать ${data.trips.length} поездок? Текущие данные будут заменены.`);
    if (!ok) return;
    trips = data.trips;
    settings = Object.assign(settings, data.settings || {});
    saveTrips(); saveSettings();
    applyTheme(settings.theme || 'light');
    firstMonthsRender = true; collapsedMonths = new Set();
    renderAll();
    showToast('Данные успешно восстановлены', 'success');
  } catch (err) {
    showToast('Не удалось прочитать файл. Проверьте формат JSON.', 'error');
  } finally {
    restoreJsonInput.value = '';
  }
});

/* =========================================================
   ТАБЫ / ТЕМА / ГЛОБАЛЬНЫЕ ОБРАБОТЧИКИ
   ========================================================= */
document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
themeToggleBtn.addEventListener('click', () => {
  settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
  saveSettings();
  applyTheme(settings.theme);
});

/* =========================================================
   ОБЩИЙ RENDER
   ========================================================= */
function renderAll() {
  populateHomeFilters();
  renderSummary();
  renderTripsList();
  checkReminder();
  renderStats();
  populateReportSelects();
}

/* =========================================================
   ИНИЦИАЛИЗАЦИЯ
   ========================================================= */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
}
function handleUrlParams() {
  const params = new URLSearchParams(location.search);
  const tab = params.get('tab');
  if (tab && document.getElementById(`tab-${tab}`)) switchTab(`tab-${tab}`);
  if (params.get('action') === 'add') openTripModal(null);
}
function init() {
  trips = loadTrips();
  settings = loadSettings();
  fuelConsumptionInput.value = settings.fuelConsumption || '';
  fuelPriceInput.value = settings.fuelPrice || '';
  applyTheme(settings.theme || 'light');
  renderAll();
  handleUrlParams();
  registerServiceWorker();
}
init();
