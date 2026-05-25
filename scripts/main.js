
// ── DATA STORE (Firestore — see firebase-ops.js)
let atencionData = [];
let pensionadosData = [];
let editAtenId = null;
let editPensId = null;

// ── SAVE GUARDS (previenen doble submit)
let isSavingAten = false;
let isSavingPens = false;

// ── PAGINATION STATE 
const PAGE_SIZE = 20;
let atenPage = 1;
let pensPage = 1;

// ── UTILS 
function uuid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
function fmt_date(d) {
    if (!d) return '—';
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
}
function getMes(dateStr) {
    if (!dateStr) return '';
    const months = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    return months[new Date(dateStr + 'T00:00:00').getMonth()];
}
function servTag(s) {
    const map = {
        AFILIACION: ['tag-afil', 'Afiliación'],
        PRESTACIONES: ['tag-prest', 'Prestaciones'],
        RECAUDACION_COBRANZA: ['tag-recaud', 'Recaud. Cobranza'],
        ATENCION_CESANTE: ['tag-cesante', 'At. Cesante'],
        FISCALIZACION: ['tag-fisc', 'Fiscalización'],
        OTRAS_ATENCIONES: ['tag-otras', 'Otras Atenciones'],
    };
    const [cls, label] = map[s] || ['tag-otras', s];
    return `<span class="tag ${cls}">${label}</span>`;
}
function genTag(g) {
    return g === 'M'
        ? `<span class="tag tag-m">Masc.</span>`
        : g === 'F' ? `<span class="tag tag-f">Fem.</span>` : '—';
}

function getLocalDateStr() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function setPhoneFields(prefId, telId, rawPhone) {
    const prefEl = document.getElementById(prefId);
    const telEl = document.getElementById(telId);
    if (!prefEl || !telEl) return;
    if (!rawPhone) {
        prefEl.value = prefEl.options[0].value;
        telEl.value = '';
        return;
    }
    const clean = rawPhone.replace(/\D/g, '');
    if (clean.length >= 11) {
        prefEl.value = clean.slice(0, 4);
        telEl.value = clean.slice(4);
    } else {
        prefEl.value = prefEl.options[0].value;
        telEl.value = clean;
    }
}

// ── TOAST 
function toast(msg, type = 'success') {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

// ── NAVIGATION 
let currentView = 'dashboard';
function navigate(view) {
    currentView = view;
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const idx = { dashboard: 0, atencion: 1, pensionados: 2, reportes: 3 };
    document.querySelectorAll('.nav-item')[idx[view]]?.classList.add('active');
    const titles = { dashboard: 'Panel de Control', atencion: 'Atención al Público', pensionados: 'Censo de Pensionados', reportes: 'Reportes y Estadísticas' };
    document.getElementById('topbar-title').textContent = titles[view];
    renderView(view);
}

function renderView(view) {
    const content = document.getElementById('content');
    const tpl = document.getElementById(`tpl-${view}`);
    content.innerHTML = tpl.innerHTML;
    if (view === 'dashboard') renderDashboard();
    else if (view === 'atencion') initAtencion();
    else if (view === 'pensionados') initPensionados();
    else if (view === 'reportes') renderReportes();
}

// ── DATE DISPLAY 
function updateDate() {
    const now = new Date();
    document.getElementById('topbar-date').textContent =
        now.toLocaleDateString('es-VE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// Dashboard
function renderDashboard() {
    const totalAten = atencionData.length;
    const totalPens = pensionadosData.length;
    const mesActual = getMes(new Date().toISOString().split('T')[0]);
    const atenMes = atencionData.filter(r => getMes(r.fecha) === mesActual).length;
    const pensMes = pensionadosData.filter(r => r.mes === mesActual).length;

    const dailyStats = getDailyStats();
    document.getElementById('dash-stats').innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Total Atención Al Público</div>
      <div class="stat-value">${totalAten}</div>
      <div class="stat-sub-text">Registros este año</div>
    </div>
    <div class="stat-card gold">
      <div class="stat-label">Pensionados Registrados</div>
      <div class="stat-value">${totalPens}</div>
      <div class="stat-sub-text">Registros este año</div>
    </div>
    <div class="stat-card green">
      <div class="stat-label">Atención Al Público Este Mes</div>
      <div class="stat-value">${atenMes}</div>
      <div class="stat-sub-text">${mesActual || 'Mes actual'}</div>
    </div>
    <div class="stat-card red">
      <div class="stat-label">Pensionados Este Mes</div>
      <div class="stat-value">${pensMes}</div>
      <div class="stat-sub-text">${mesActual || 'Mes actual'}</div>
    </div>
    <div class="stat-card dark">
      <div class="stat-label">Atendidos Hoy (Total)</div>
      <div class="stat-value" style="color: var(--gold-light, #e8b04a);">${dailyStats.total}</div>
      <div class="stat-sub-text">${dailyStats.atencion} Atención + ${dailyStats.pensionados} Censo</div>
    </div>
  `;
    drawDashCharts();
}

const MONTHS = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
const NAVY = '#002d5e', GOLD = '#c8922a';
const PALETTE = ['#002d5e', '#1a4a8a', '#c8922a', '#e8b04a', '#1a7a4a', '#c0392b'];

function drawDashCharts() {
    // Monthly attendance
    const monthCounts = MONTHS.map(m => atencionData.filter(r => getMes(r.fecha) === m).length);
    new Chart(document.getElementById('chart-monthly'), {
        type: 'bar',
        data: {
            labels: MONTHS.map(m => m.slice(0, 3)),
            datasets: [{ label: 'Atendidos', data: monthCounts, backgroundColor: NAVY, borderRadius: 6 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: '#eef2f8' } }, x: { grid: { display: false } } } }
    });

    // Services pie
    const servKeys = ['AFILIACION', 'PRESTACIONES', 'RECAUDACION_COBRANZA', 'ATENCION_CESANTE', 'FISCALIZACION', 'OTRAS_ATENCIONES'];
    const servLabels = ['Afiliación', 'Prestaciones', 'Recaud.', 'At. Cesante', 'Fiscalización', 'Otras'];
    const servCounts = servKeys.map(k => atencionData.filter(r => r.servicio === k).length);
    new Chart(document.getElementById('chart-services'), {
        type: 'doughnut',
        data: { labels: servLabels, datasets: [{ data: servCounts, backgroundColor: PALETTE, borderWidth: 2 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { font: { size: 12 } } } } }
    });

    // Gender
    const gM = pensionadosData.filter(r => r.genero === 'M').length;
    const gF = pensionadosData.filter(r => r.genero === 'F').length;
    new Chart(document.getElementById('chart-gender'), {
        type: 'pie',
        data: { labels: ['Masculino', 'Femenino'], datasets: [{ data: [gM, gF], backgroundColor: [NAVY, '#be185d'], borderWidth: 2 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
    });

    // Pension type
    const ptypes = {};
    pensionadosData.forEach(r => { const k = r.tipoPension || 'Sin datos'; ptypes[k] = (ptypes[k] || 0) + 1; });
    const ptLabels = Object.keys(ptypes), ptVals = Object.values(ptypes);
    new Chart(document.getElementById('chart-pension'), {
        type: 'bar',
        data: {
            labels: ptLabels,
            datasets: [{ label: 'Pensionados', data: ptVals, backgroundColor: GOLD, borderRadius: 6 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: '#eef2f8' } }, x: { grid: { display: false }, ticks: { maxRotation: 30 } } } }
    });
}

// ATENCIÓN AL PÚBLICO
function initAtencion() {
    // populate month filter
    const sel = document.getElementById('aten-filter-mes');
    MONTHS.forEach(m => { const o = document.createElement('option'); o.value = m; o.textContent = m; sel.appendChild(o); });
    renderAtencionTable();
}

function getFilteredAten() {
    const search = (document.getElementById('aten-search')?.value || '').toLowerCase();
    const mes = document.getElementById('aten-filter-mes')?.value || '';
    const serv = document.getElementById('aten-filter-servicio')?.value || '';
    return atencionData.filter(r => {
        const matchS = !search || r.nombre.toLowerCase().includes(search) || r.cedula.includes(search);
        const matchM = !mes || getMes(r.fecha) === mes;
        const matchSv = !serv || r.servicio === serv;
        return matchS && matchM && matchSv;
    }).sort((a, b) => b.fecha.localeCompare(a.fecha));
}

function renderAtencionTable() {
    const filtered = getFilteredAten();
    const total = filtered.length;
    const pages = Math.ceil(total / PAGE_SIZE);
    if (atenPage > pages) atenPage = 1;
    const slice = filtered.slice((atenPage - 1) * PAGE_SIZE, atenPage * PAGE_SIZE);

    const tbody = document.getElementById('aten-tbody');
    if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#b0b8d0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg></div><div class="empty-title">Sin registros</div><div class="empty-sub">No hay atenciones que coincidan con los filtros aplicados.</div></div></td></tr>`;
    } else {
        tbody.innerHTML = slice.map((r, i) => `
      <tr>
        <td style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--text-muted)">${(atenPage - 1) * PAGE_SIZE + i + 1}</td>
        <td>${fmt_date(r.fecha)}</td>
        <td><strong>${r.nombre}</strong></td>
        <td style="font-family:'IBM Plex Mono',monospace">${r.cedula}</td>
        <td>${r.telefono || '—'}</td>
        <td>${servTag(r.servicio)}</td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="editAtencion('${r.id}')">Editar</button>
          <button class="btn btn-danger btn-sm" style="margin-left:6px" onclick="deleteAtencion('${r.id}')">Eliminar</button>
        </td>
      </tr>`).join('');
    }
    document.getElementById('aten-count').textContent = `${total} registro${total !== 1 ? 's' : ''}`;
    renderPagination('aten', pages, atenPage, p => { atenPage = p; renderAtencionTable(); });
}

function renderPagination(prefix, pages, current, onPage) {
    const el = document.getElementById(`${prefix}-pagination`);
    if (!el) return;
    if (pages <= 1) { el.innerHTML = ''; return; }
    let html = '';
    if (current > 1) html += `<button class="page-btn" onclick="(${onPage})(${current - 1})"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>`;
    for (let p = Math.max(1, current - 2); p <= Math.min(pages, current + 2); p++) {
        html += `<button class="page-btn ${p === current ? 'active' : ''}" onclick="(${onPage})(${p})">${p}</button>`;
    }
    if (current < pages) html += `<button class="page-btn" onclick="(${onPage})(${current + 1})"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>`;
    el.innerHTML = html;
}

function openAtencionModal(id = null) {
    editAtenId = id;
    document.getElementById('modal-aten-title').textContent = id ? 'Editar Registro' : 'Registrar Atención';
    if (id) {
        const r = atencionData.find(x => x.id === id);
        document.getElementById('af-fecha').value = r.fecha;
        document.getElementById('af-servicio').value = r.servicio;
        document.getElementById('af-nombre').value = r.nombre;
        document.getElementById('af-cedula').value = r.cedula;
        // Cargamos el prefijo y número por separado
        setPhoneFields('af-prefijo', 'af-telefono', r.telefono);
    } else {
        document.getElementById('af-fecha').value = getLocalDateStr(); // CAMBIO AQUÍ
        document.getElementById('af-servicio').value = '';
        document.getElementById('af-nombre').value = '';
        document.getElementById('af-cedula').value = '';
        // Limpiamos los campos
        setPhoneFields('af-prefijo', 'af-telefono', '');
    }
    document.getElementById('modal-atencion').classList.remove('hidden');
}

function closeAtencionModal() {
    document.getElementById('modal-atencion').classList.add('hidden');
    const st = document.getElementById('af-cedula-status');
    if (st) st.textContent = '';
}

// Busca la cédula al salir del campo y pre-llena nombre/teléfono si ya existe
function lookupCedulaAten() {
    if (editAtenId) return; // no aplica al editar
    const cedula = document.getElementById('af-cedula').value.trim();
    const status = document.getElementById('af-cedula-status');
    if (!cedula) { if (status) status.textContent = ''; return; }

    // Buscar en atenciones previas (registro más reciente de esa cédula)
    const prevAten = atencionData.find(r => r.cedula === cedula);
    // Buscar en pensionados
    const prevPens = pensionadosData.find(r => r.cedula === cedula);
    const match = prevAten || prevPens;

    if (match) {
        document.getElementById('af-nombre').value = match.nombre || '';
        setPhoneFields('af-prefijo', 'af-telefono', match.telefono);
        if (status) {
            status.textContent = '✓ Ciudadano registrado — datos pre-cargados';
            status.style.color = '#1a7a4a';
        }
    } else {
        document.getElementById('af-nombre').value = '';
        document.getElementById('af-telefono').value = '';
        if (status) {
            status.textContent = '• Ciudadano nuevo — complete los datos';
            status.style.color = 'var(--text-secondary, #6b7a99)';
        }
    }
}

async function saveAtencion() {
    if (isSavingAten) return;          // bloquear doble clic
    const fecha = document.getElementById('af-fecha').value;
    const servicio = document.getElementById('af-servicio').value;
    const nombre = document.getElementById('af-nombre').value.trim();
    const cedula = document.getElementById('af-cedula').value.trim();
    const prefijo = document.getElementById('af-prefijo').value;
    const telCuerpo = document.getElementById('af-telefono').value.trim();
    const telefono = telCuerpo ? (prefijo + telCuerpo) : '';
    if (!fecha || !servicio || !nombre || !cedula) { toast('Complete los campos obligatorios (*)', 'error'); return; }

    isSavingAten = true;
    try {
        if (editAtenId) {
            await fsUpdateAten(editAtenId, { fecha, servicio, nombre, cedula, telefono });
            toast('Registro actualizado ✓');
        } else {
            await fsAddAten({ fecha, servicio, nombre, cedula, telefono });
            toast('Atención registrada ✓');
        }
        // Sincronizar datos personales con el resto de registros
        await fsSyncCiudadano(cedula, { nombre, telefono });

        closeAtencionModal();
        renderAtencionTable();
    } catch (e) {
        toast('Error al guardar: ' + e.message, 'error');
    } finally {
        isSavingAten = false;
    }
}

function editAtencion(id) { openAtencionModal(id); }

async function deleteAtencion(id) {
    const ok = await customConfirm({ title: '¿Eliminar registro?', msg: 'Se eliminará esta atención permanentemente.', okLabel: 'Sí, eliminar', okClass: 'btn-danger', icon: `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#c0392b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`, iconClass: 'danger' });
    if (!ok) return;
    try {
        await fsDeleteAten(id);
        toast('Registro eliminado', 'error');
        renderAtencionTable();
    } catch (e) { toast('Error al eliminar', 'error'); }
}

//  PENSIONADOS
function togglePatolFields(show) {
    document.getElementById('pf-patol-tipo-group').style.opacity = show ? '1' : '.4';
    document.getElementById('pf-tratam-group').style.opacity = show ? '1' : '.4';
}
function toggleMedsField(show) {
    const g = document.getElementById('pf-meds-tipo-group');
    if (g) g.style.opacity = show ? '1' : '.4';
}

function initPensionados() {
    const sel = document.getElementById('pens-filter-mes');
    MONTHS.forEach(m => { const o = document.createElement('option'); o.value = m; o.textContent = m; sel.appendChild(o); });
    renderPensTable();
}

function getFilteredPens() {
    const search = (document.getElementById('pens-search')?.value || '').toLowerCase();
    const mes = document.getElementById('pens-filter-mes')?.value || '';
    const genero = document.getElementById('pens-filter-genero')?.value || '';
    const pension = document.getElementById('pens-filter-pension')?.value || '';
    return pensionadosData.filter(r => {
        const matchS = !search || r.nombre.toLowerCase().includes(search) || (r.cedula || '').includes(search);
        const matchM = !mes || r.mes === mes;
        const matchG = !genero || r.genero === genero;
        const matchP = !pension || (r.tipoPension || '').includes(pension);
        return matchS && matchM && matchG && matchP;
     }).sort((a, b) => {
        const fA = a.fecha || a.fechaRegistro || '';
        const fB = b.fecha || b.fechaRegistro || '';
        if (fB !== fA) {
            return fB.localeCompare(fA); // Más reciente primero
        }
         const tA = a.timestamp || 0;
        const tB = b.timestamp || 0;
        if (tB !== tA) {
            return tB - tA; // Coloca el más reciente arriba
        }
        
        // 3. Fallback: Orden alfabético si no tienen marca de tiempo
        return (a.nombre || '').localeCompare(b.nombre || '');
    });
}

function renderPensTable() {
    const filtered = getFilteredPens();
    const total = filtered.length;
    const pages = Math.ceil(total / PAGE_SIZE);
    if (pensPage > pages) pensPage = 1;
    const slice = filtered.slice((pensPage - 1) * PAGE_SIZE, pensPage * PAGE_SIZE);
    const tbody = document.getElementById('pens-tbody');
    if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="9"><div class="empty"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#b0b8d0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/></svg></div><div class="empty-title">Sin pensionados registrados</div><div class="empty-sub">Use el botón "Registrar Pensionado" para agregar registros.</div></div></td></tr>`;
    } else {
        tbody.innerHTML = slice.map((r, i) => `
      <tr>
        <td style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--text-muted)">${(pensPage - 1) * PAGE_SIZE + i + 1}</td>
        <td>${fmt_date(r.fecha || r.fechaRegistro || new Date().toLocaleDateString('sv-SE'))}</td> 
       <td title="${r.nombre}">
                    <div style="max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        <strong>${r.nombre}</strong>
                    </div>
                </td>
        <td style="font-family:'IBM Plex Mono',monospace">${r.cedula}</td>
        <td>${r.edad || '—'}</td>
        <td>${genTag(r.genero)}</td>
        <td>${r.tipoPension ? `<span class="tag tag-otras">${r.tipoPension}</span>` : '—'}</td>
        <td>${r.banco || '—'}</td>
        <td><span class="badge">${r.mes}</span></td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="viewPensionado('${r.id}')">Ver</button>
          <button class="btn btn-outline btn-sm" style="margin-left:4px" onclick="editPensionado('${r.id}')">Editar</button>
          <button class="btn btn-danger btn-sm" style="margin-left:4px" onclick="deletePensionado('${r.id}')"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </td>
      </tr>`).join('');
    }
    document.getElementById('pens-count').textContent = `${total} pensionado${total !== 1 ? 's' : ''}`;
    renderPagination('pens', pages, pensPage, p => { pensPage = p; renderPensTable(); });
}

function openPensionadoModal(id = null) {
    editPensId = id;
    document.getElementById('modal-pens-title').textContent = id ? 'Editar Pensionado' : 'Registrar Pensionado';
    // reset 
    ['pf-nombre', 'pf-cedula', 'pf-analista', 'pf-estado', 'pf-municipio', 'pf-parroquia', 'pf-direccion',
        'pf-centro-votacion', 'pf-tipo-pension', 'pf-banco', 'pf-consejo', 'pf-patol-tipo', 'pf-tratamiento',
        'pf-meds-tipo', 'pf-club', 'pf-num-solic', 'pf-tipo-solic'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = id === 'pf-estado' ? 'ZULIA' : id === 'pf-municipio' ? 'CABIMAS' : '';
        });
    document.getElementById('pf-edad').value = '';
    document.getElementById('pf-fnac').value = '';
    document.getElementById('pf-genero').value = '';
    document.getElementById('pf-mes').value = '';

    if (id) {
        const r = pensionadosData.find(x => x.id === id);
        document.getElementById('pf-fecha').value = r.fecha || r.fechaRegistro || new Date().toLocaleDateString('sv-SE');
    } else {
        document.getElementById('pf-fecha').value = new Date().toLocaleDateString('sv-SE');
    }

    setPhoneFields('pf-prefijo', 'pf-telefono', ''); // Resetea prefijo y número
    document.querySelectorAll('[name="pf-cne"],[name="pf-ivss"],[name="pf-alim"],[name="pf-inass"],[name="pf-patol"],[name="pf-meds"],[name="pf-venapp"],[name="pf-solic-esp"]').forEach(r => r.checked = false);
    if (id) {
        const r = pensionadosData.find(x => x.id === id);
        document.getElementById('pf-nombre').value = r.nombre || '';
        document.getElementById('pf-cedula').value = r.cedula || '';
        document.getElementById('pf-fnac').value = r.fechaNac || '';
        if (r.fechaNac) calcEdad();
        else document.getElementById('pf-edad').value = r.edad || '';
        document.getElementById('pf-genero').value = r.genero || '';
        // Cargar el teléfono separando el prefijo y los dígitos
        setPhoneFields('pf-prefijo', 'pf-telefono', r.telefono);
        document.getElementById('pf-mes').value = r.mes || '';
        document.getElementById('pf-analista').value = r.analista || '';
        document.getElementById('pf-estado').value = r.estado || 'ZULIA';
        document.getElementById('pf-municipio').value = r.municipio || 'CABIMAS';
        document.getElementById('pf-parroquia').value = r.parroquia || '';
        document.getElementById('pf-direccion').value = r.direccion || '';
        document.getElementById('pf-centro-votacion').value = r.centroVotacion || '';
        document.getElementById('pf-tipo-pension').value = r.tipoPension || '';
        document.getElementById('pf-banco').value = r.banco || '';
        document.getElementById('pf-consejo').value = r.consejo || '';
        document.getElementById('pf-patol-tipo').value = r.tipoPatologia || '';
        document.getElementById('pf-tratamiento').value = r.tratamiento || '';
        document.getElementById('pf-meds-tipo').value = r.tipoMeds || '';
        document.getElementById('pf-club').value = r.club || '';
        document.getElementById('pf-num-solic').value = r.numSolicitud || '';
        document.getElementById('pf-tipo-solic').value = r.tipoSolicitud || '';
        // radio buttons
        const setRadio = (name, val) => { if (val) { const el = document.querySelector(`[name="${name}"][value="${val}"]`); if (el) el.checked = true; } };
        setRadio('pf-cne', r.cne); setRadio('pf-ivss', r.esIvss); setRadio('pf-alim', r.alimentos);
        toggleCentroVotacion(r.cne === 'SI');
        setRadio('pf-inass', r.inass); setRadio('pf-patol', r.tienePatol);
        setRadio('pf-meds', r.tieneMeds); setRadio('pf-venapp', r.venapp); setRadio('pf-solic-esp', r.solicEsp);
    }
    document.getElementById('modal-pensionado').classList.remove('hidden');
}

function closePensionadoModal() {
    document.getElementById('modal-pensionado').classList.add('hidden');
    const st = document.getElementById('pf-cedula-status');
    if (st) st.textContent = '';
}

// Calcula la edad automáticamente según la fecha de nacimiento
function calcEdad() {
    const fnac = document.getElementById('pf-fnac').value;
    const edadInput = document.getElementById('pf-edad');
    if (!fnac) {
        edadInput.value = '';
        return;
    }
    const birthDate = new Date(fnac + 'T00:00:00');
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    edadInput.value = age;
}

// Busca la cédula al salir del campo y pre-llena los datos si ya existe
function lookupCedulaPens() {
    if (editPensId) return; // no aplica al editar
    const cedula = document.getElementById('pf-cedula').value.trim();
    const status = document.getElementById('pf-cedula-status');
    if (!cedula) { if (status) status.textContent = ''; return; }

    const prevPens = pensionadosData.find(r => r.cedula === cedula);
    const prevAten = atencionData.find(r => r.cedula === cedula);
    const match = prevPens || prevAten;

    if (match) {
        document.getElementById('pf-nombre').value = match.nombre || '';
        document.getElementById('pf-fnac').value = match.fechaNac || '';
        if (match.fechaNac) calcEdad();
        else document.getElementById('pf-edad').value = match.edad || '';
        document.getElementById('pf-genero').value = match.genero || '';
        setPhoneFields('pf-prefijo', 'pf-telefono', match.telefono);
        if (match.analista) document.getElementById('pf-analista').value = match.analista;
        if (match.estado) document.getElementById('pf-estado').value = match.estado;
        if (match.municipio) document.getElementById('pf-municipio').value = match.municipio;
        document.getElementById('pf-parroquia').value = match.parroquia || '';
        document.getElementById('pf-direccion').value = match.direccion || '';
        document.getElementById('pf-centro-votacion').value = match.centroVotacion || '';
        document.getElementById('pf-tipo-pension').value = match.tipoPension || '';
        document.getElementById('pf-banco').value = match.banco || '';
        document.getElementById('pf-consejo').value = match.consejo || '';
        document.getElementById('pf-patol-tipo').value = match.tipoPatologia || '';
        document.getElementById('pf-tratamiento').value = match.tratamiento || '';
        document.getElementById('pf-meds-tipo').value = match.tipoMeds || '';
        document.getElementById('pf-club').value = match.club || '';
        document.getElementById('pf-num-solic').value = match.numSolicitud || '';
        document.getElementById('pf-tipo-solic').value = match.tipoSolicitud || '';

        const setRadio = (name, val) => { if (val) { const el = document.querySelector(`[name="${name}"][value="${val}"]`); if (el) el.checked = true; } };
        setRadio('pf-cne', match.cne); setRadio('pf-ivss', match.esIvss); setRadio('pf-alim', match.alimentos);
        toggleCentroVotacion(match.cne === 'SI');
        setRadio('pf-inass', match.inass); setRadio('pf-patol', match.tienePatol);
        togglePatolFields(match.tienePatol === 'SI');
        setRadio('pf-meds', match.tieneMeds);
        toggleMedsField(match.tieneMeds === 'SI');
        setRadio('pf-venapp', match.venapp); setRadio('pf-solic-esp', match.solicEsp);

        if (status) {
            status.textContent = '✓ Ciudadano registrado — datos pre-cargados';
            status.style.color = '#1a7a4a';
        }
    } else {
        document.getElementById('pf-nombre').value = '';
        if (status) {
            status.textContent = '• Ciudadano nuevo — complete los datos';
            status.style.color = 'var(--text-secondary, #6b7a99)';
        }
    }
}

function getRadio(name) {
    const el = document.querySelector(`[name="${name}"]:checked`);
    return el ? el.value : '';
}

async function savePensionado() {
    if (isSavingPens) return;          // bloquear doble clic
    const nombre = document.getElementById('pf-nombre').value.trim();
    const cedula = document.getElementById('pf-cedula').value.trim();
    const mes = document.getElementById('pf-mes').value;
    const fecha = document.getElementById('pf-fecha').value;
    if (!nombre || !cedula || !mes || !fecha) { toast('Complete los campos obligatorios (*)', 'error'); return; }
    const pfPrefijo = document.getElementById('pf-prefijo').value;
    const pfTelCuerpo = document.getElementById('pf-telefono').value.trim();
    const pfTelefono = pfTelCuerpo ? (pfPrefijo + pfTelCuerpo) : '';

    const data = {
        fecha,
        nombre, cedula,
        edad: document.getElementById('pf-edad').value,
        fechaNac: document.getElementById('pf-fnac').value,
        genero: document.getElementById('pf-genero').value,
        telefono: pfTelefono, // Guardamos el teléfono completo unido
        mes, analista: document.getElementById('pf-analista').value,
        estado: document.getElementById('pf-estado').value,
        municipio: document.getElementById('pf-municipio').value,
        parroquia: document.getElementById('pf-parroquia').value,
        direccion: document.getElementById('pf-direccion').value,
        cne: getRadio('pf-cne'),
        centroVotacion: document.getElementById('pf-centro-votacion').value,
        esIvss: getRadio('pf-ivss'),
        tipoPension: document.getElementById('pf-tipo-pension').value,
        banco: document.getElementById('pf-banco').value,
        alimentos: getRadio('pf-alim'),
        inass: getRadio('pf-inass'),
        consejo: document.getElementById('pf-consejo').value,
        tienePatol: getRadio('pf-patol'),
        tipoPatologia: document.getElementById('pf-patol-tipo').value,
        tratamiento: document.getElementById('pf-tratamiento').value,
        tieneMeds: getRadio('pf-meds'),
        tipoMeds: document.getElementById('pf-meds-tipo').value,
        club: document.getElementById('pf-club').value,
        venapp: getRadio('pf-venapp'),
        numSolicitud: document.getElementById('pf-num-solic').value,
        solicEsp: getRadio('pf-solic-esp'),
        tipoSolicitud: document.getElementById('pf-tipo-solic').value,
    };

    isSavingPens = true;
    try {
        if (editPensId) {
            await fsUpdatePens(editPensId, data);
            toast('Pensionado actualizado ✓');
        } else {
            await fsAddPens({ oficina: 'OA CABIMAS', fechaRegistro: new Date().toISOString().split('T')[0], ...data });
            toast('Pensionado registrado ✓');
        }
        // Sincronizar datos personales con el resto de registros
        await fsSyncCiudadano(cedula, data);

        closePensionadoModal();
        renderPensTable();
    } catch (e) {
        toast('Error al guardar: ' + e.message, 'error');
    } finally {
        isSavingPens = false;
    }
}

function editPensionado(id) { openPensionadoModal(id); }

async function deletePensionado(id) {
    const ok = await customConfirm({ title: '¿Eliminar pensionado?', msg: 'Se eliminará este registro del censo permanentemente.', okLabel: 'Sí, eliminar', okClass: 'btn-danger', icon: `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#c0392b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`, iconClass: 'danger' });
    if (!ok) return;
    try {
        await fsDeletePens(id);
        toast('Registro eliminado', 'error');
        renderPensTable();
    } catch (e) { toast('Error al eliminar', 'error'); }
}

function viewPensionado(id) {
    const r = pensionadosData.find(x => x.id === id);
    if (!r) return;
    const field = (label, val) => val ? `
    <div class="detail-field">
      <div class="detail-field-label">${label}</div>
      <div class="detail-field-value">${val}</div>
    </div>` : '';

    document.getElementById('pens-detail-body').innerHTML = `
    <div class="detail-header">
      <div class="detail-name">${r.nombre}</div>
      <div class="detail-meta">
        <div class="detail-meta-item">CI: <span>${r.cedula}</span></div>
        <div class="detail-meta-item">Edad: <span>${r.edad || '—'}</span></div>
        <div class="detail-meta-item">Género: <span>${r.genero === 'M' ? 'Masculino' : r.genero === 'F' ? 'Femenino' : '—'}</span></div>
        <div class="detail-meta-item">Mes: <span>${r.mes}</span></div>
        <div class="detail-meta-item">Analista: <span>${r.analista || '—'}</span></div>
      </div>
    </div>
    <div class="detail-grid">
      ${field('Teléfono', r.telefono)}
      ${field('Fecha de Nacimiento', r.fechaNac ? fmt_date(r.fechaNac) : '')}
      ${field('Oficina Administrativa', r.oficina)}
      ${field('Estado', r.estado)}
      ${field('Municipio', r.municipio)}
      ${field('Parroquia', r.parroquia)}
      ${field('Dirección', r.direccion)}
      ${field('Inscrito en el CNE', r.cne)}
      ${field('Centro de Votación', r.centroVotacion)}
      ${field('Es Pensionado del IVSS', r.esIvss)}
      ${field('Tipo de Pensión', r.tipoPension)}
      ${field('Banco donde Cobra', r.banco)}
      ${field('Recibe Beneficio Alimentación', r.alimentos)}
      ${field('INASS o IVSS', r.inass)}
      ${field('Consejo Comunal', r.consejo)}
      ${field('Padece Patología', r.tienePatol)}
      ${field('Tipo de Patología', r.tipoPatologia)}
      ${field('Tratamiento Crónico', r.tratamiento)}
      ${field('Requiere Medicamentos', r.tieneMeds)}
      ${field('Tipo de Medicamentos', r.tipoMeds)}
      ${field('Club de Abuelos', r.club)}
      ${field('Solicitud VenApp 1x10', r.venapp)}
      ${field('N° Solicitud', r.numSolicitud)}
      ${field('Solicitud Especial', r.solicEsp)}
      ${field('Tipo de Solicitud', r.tipoSolicitud)}
    </div>
    <div style="padding:16px 0 0;display:flex;gap:10px;justify-content:flex-end">
      <button class="btn btn-outline" onclick="document.getElementById('modal-pens-detail').classList.add('hidden')">Cerrar</button>
      <button class="btn btn-primary" onclick="document.getElementById('modal-pens-detail').classList.add('hidden');editPensionado('${r.id}')">Editar Registro</button>
    </div>
  `;
    document.getElementById('modal-pens-detail').classList.remove('hidden');
}

//  REPORTES
function renderReportes() {
    const grid = document.getElementById('rep-month-grid');
    const tbody = document.getElementById('rep-tbody');

    grid.innerHTML = '';
    let rows = '';
    MONTHS.forEach((m, i) => {
        const pensCount = pensionadosData.filter(r => r.mes === m).length;
        const card = document.createElement('div');
        card.className = 'month-card';
        card.innerHTML = `<div class="month-name">${m.slice(0, 3)}</div><div class="month-count">${pensCount}</div>`;
        grid.appendChild(card);
        const atenMes = atencionData.filter(r => getMes(r.fecha) === m);
        const count = atenMes.length;
        const countS = k => atenMes.filter(r => r.servicio === k).length;
        const af = countS('AFILIACION'), pr = countS('PRESTACIONES'), rc = countS('RECAUDACION_COBRANZA'),
            ce = countS('ATENCION_CESANTE'), fi = countS('FISCALIZACION'), ot = countS('OTRAS_ATENCIONES');
        const bg = count > 0 ? 'var(--gold-pale)' : '';
        rows += `<tr style="background:${bg}">
      <td><strong>${m}</strong></td>
      <td><strong>${count}</strong></td>
      <td>${af}</td><td>${pr}</td><td>${rc}</td><td>${ce}</td><td>${fi}</td><td>${ot}</td>
    </tr>`;
    });
    tbody.innerHTML = rows;
    // Ejecuta las gráficas que se quedan tal cual
    drawReporteCharts();
}

function drawReporteCharts() {
    const servKeys = ['AFILIACION', 'PRESTACIONES', 'RECAUDACION_COBRANZA', 'ATENCION_CESANTE', 'FISCALIZACION', 'OTRAS_ATENCIONES'];
    const servLabels = ['Afiliación', 'Prestaciones', 'Recaud.', 'At. Cesante', 'Fiscalización', 'Otras'];
    const datasets = servKeys.map((k, i) => ({
        label: servLabels[i],
        data: MONTHS.map(m => atencionData.filter(r => getMes(r.fecha) === m && r.servicio === k).length),
        backgroundColor: PALETTE[i], borderRadius: 3, stack: 'stack'
    }));

    new Chart(document.getElementById('rep-chart-stacked'), {
        type: 'bar',
        data: { labels: MONTHS.map(m => m.slice(0, 3)), datasets },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: '#eef2f8' } } } }
    });

    const pensCounts = MONTHS.map(m => pensionadosData.filter(r => r.mes === m).length);
    new Chart(document.getElementById('rep-chart-pens'), {
        type: 'line',
        data: {
            labels: MONTHS.map(m => m.slice(0, 3)),
            datasets: [{ label: 'Pensionados', data: pensCounts, borderColor: GOLD, backgroundColor: '#fef3dd', fill: true, tension: .35, pointRadius: 5, pointBackgroundColor: GOLD }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: '#eef2f8' } } } }
    });
}

// ── CNE TOGGLE
function toggleCentroVotacion(enabled) {
    const el = document.getElementById('pf-centro-votacion');
    if (!el) return;
    el.disabled = !enabled;
    el.style.opacity = enabled ? '1' : '.45';
    el.style.cursor = enabled ? '' : 'not-allowed';
    if (!enabled) el.value = '';
}

// ── CUSTOM CONFIRM
function customConfirm({ title = '¿Estás seguro?', msg = 'Esta acción no se puede deshacer.', okLabel = 'Eliminar', okClass = 'btn-danger', icon = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#c0392b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`, iconClass = 'danger' } = {}) {
    return new Promise(resolve => {
        const dialog = document.getElementById('confirm-dialog');
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-msg').textContent = msg;
        document.getElementById('confirm-icon').innerHTML = icon;
        document.getElementById('confirm-icon').className = `confirm-icon ${iconClass}`;
        const okBtn = document.getElementById('confirm-ok-btn');
        okBtn.textContent = okLabel;
        okBtn.className = `btn ${okClass}`;
        dialog.style.display = 'flex';

        const cleanup = (result) => {
            dialog.style.display = 'none';
            okBtn.replaceWith(okBtn.cloneNode(true)); // remove old listeners
            document.getElementById('confirm-cancel-btn').replaceWith(document.getElementById('confirm-cancel-btn').cloneNode(true));
            resolve(result);
        };

        // Re-query after clone
        document.getElementById('confirm-ok-btn').addEventListener('click', () => cleanup(true), { once: true });
        document.getElementById('confirm-cancel-btn').addEventListener('click', () => cleanup(false), { once: true });
        dialog.addEventListener('click', e => { if (e.target === dialog) cleanup(false); }, { once: true });
    });
}

// ── INIT: gestionado por auth.onAuthStateChanged en firebase-ops.js

// ── EXCEL EXPORTS (ExcelJS) ─────────────────────────
function styleWorksheet(worksheet) {
    // Style Header Row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a7a4a' } }; // IVSS Green
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add Borders and alternating colors
    worksheet.eachRow({ includeEmpty: false }, function (row, rowNumber) {
        row.eachCell({ includeEmpty: true }, function (cell, colNumber) {
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };
            if (rowNumber > 1) {
                cell.alignment = { vertical: 'middle' };
                if (rowNumber % 2 === 0) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                }
            }
        });
    });
}

async function exportAtencionExcel() {
    const dDesde = document.getElementById('export-desde').value;
    const dHasta = document.getElementById('export-hasta').value;

    let list = atencionData;
    if (dDesde) list = list.filter(r => r.fecha >= dDesde);
    if (dHasta) list = list.filter(r => r.fecha <= dHasta);

    if (list.length === 0) {
        toast('No hay datos en este rango de fechas', 'error');
        return;
    }

    list.sort((a, b) => {
        const fA = a.fecha || '';
        const fB = b.fecha || '';
        return fA.localeCompare(fB);
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Atención");

    worksheet.columns = [
        { header: 'N°', key: 'n', width: 6 },
        { header: 'Fecha', key: 'fecha', width: 15 },
        { header: 'Servicio', key: 'servicio', width: 35 },
        { header: 'Cédula', key: 'cedula', width: 15 },
        { header: 'Nombres y Apellidos', key: 'nombre', width: 45 },
        { header: 'Teléfono', key: 'telefono', width: 20 }
    ];

    list.forEach((r, i) => {
        worksheet.addRow({
            n: i + 1,
            fecha: r.fecha || '-',
            servicio: r.servicio || '-',
            cedula: r.cedula || '-',
            nombre: r.nombre || '-',
            telefono: r.telefono || '-'
        });
    });

    styleWorksheet(worksheet);

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Reporte_Atencion_${dDesde || 'Inicio'}_al_${dHasta || 'Fin'}.xlsx`);
}

async function exportPensionadosExcel() {
    const dDesde = document.getElementById('export-desde').value;
    const dHasta = document.getElementById('export-hasta').value;

    let list = pensionadosData;
    if (dDesde || dHasta) {
        list = list.filter(r => {
            const f = r.fecha || r.fechaRegistro; // Toma la fecha nueva, o la vieja como respaldo
            if (!f) return true;
            if (dDesde && f < dDesde) return false;
            if (dHasta && f > dHasta) return false;
            return true;
        });
    }

    list.sort((a, b) => {
        const fA = a.fecha || a.fechaRegistro || '';
        const fB = b.fecha || b.fechaRegistro || '';
        return fA.localeCompare(fB);
    });

    if (list.length === 0) {
        toast('No hay datos en este rango de fechas', 'error');
        return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Pensionados");

    const headers = [
        { h: 'N°', k: 'n', w: 6 },
        { h: 'Oficina', k: 'oficina', w: 20 },
        { h: 'Nombres y Apellidos', k: 'nombre', w: 45 },
        { h: 'Cédula', k: 'cedula', w: 15 },
        { h: 'Edad', k: 'edad', w: 10 },
        { h: 'Fecha Nacimiento', k: 'fechaNac', w: 18 },
        { h: 'Género', k: 'genero', w: 12 },
        { h: 'Teléfono', k: 'telefono', w: 20 },
        { h: 'Mes', k: 'mes', w: 15 },
        { h: 'Analista', k: 'analista', w: 25 },
        { h: 'Estado', k: 'estado', w: 15 },
        { h: 'Municipio', k: 'municipio', w: 20 },
        { h: 'Parroquia', k: 'parroquia', w: 25 },
        { h: 'Dirección', k: 'direccion', w: 50 },
        { h: 'Inscrito CNE', k: 'cne', w: 15 },
        { h: 'Centro Votación', k: 'centroVotacion', w: 40 },
        { h: 'Pensionado IVSS', k: 'esIvss', w: 20 },
        { h: 'Tipo de Pensión', k: 'tipoPension', w: 25 },
        { h: 'Banco', k: 'banco', w: 30 },
        { h: 'Recibe Alimentos', k: 'alimentos', w: 18 },
        { h: 'Atención INASS', k: 'inass', w: 18 },
        { h: 'Consejo Comunal', k: 'consejo', w: 35 },
        { h: 'Posee Patología', k: 'tienePatol', w: 18 },
        { h: 'Tipo Patología', k: 'tipoPatologia', w: 40 },
        { h: 'Tratamiento', k: 'tratamiento', w: 40 },
        { h: 'Solicita Meds', k: 'tieneMeds', w: 15 },
        { h: 'Tipo Meds', k: 'tipoMeds', w: 40 },
        { h: 'Pertenece Club', k: 'club', w: 40 },
        { h: 'VenApp', k: 'venapp', w: 12 },
        { h: 'N° Solicitud', k: 'numSolicitud', w: 20 },
        { h: 'Solicitud Especial', k: 'solicEsp', w: 20 },
        { h: 'Tipo Solicitud', k: 'tipoSolicitud', w: 30 },
        { h: 'Fecha', k: 'fecha', w: 18 }
    ];

    worksheet.columns = headers.map(x => ({ header: x.h, key: x.k, width: x.w }));

    list.forEach((r, i) => {
        const rowData = {};
        headers.forEach(x => {
            if (x.k === 'n') rowData[x.k] = i + 1;
            else if (x.k === 'fecha') {
                rowData[x.k] = r.fecha || r.fechaRegistro || new Date().toLocaleDateString('sv-SE');
            }
            else {
                rowData[x.k] = r[x.k] || '-';
            }
        });
        worksheet.addRow(rowData);
    });

    styleWorksheet(worksheet);

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Reporte_Pensionados_${dDesde || 'Inicio'}_al_${dHasta || 'Fin'}.xlsx`);
}

// FUNCIONES DE CONTROL DEL PERFIL DE ADMINISTRADOR
function openPerfilModal() {
    const user = auth.currentUser;
    if (!user) return;
    const username = user.email.split('@')[0];
    document.getElementById('perfil-user').value = username;
    document.getElementById('perfil-pass').value = '';
    document.getElementById('perfil-pass-confirm').value = '';
    
    // Rellenar avatar
    const inicial = username.charAt(0).toUpperCase();
    document.getElementById('perfil-avatar-text').textContent = inicial;
    // Resetear segmentos de seguridad
    const segments = ['strength-seg-1', 'strength-seg-2', 'strength-seg-3', 'strength-seg-4'];
    segments.forEach(id => {
        const seg = document.getElementById(id);
        if (seg) seg.style.backgroundColor = '#e2e8f0';
    });
    
    const txt = document.getElementById('pass-strength-text');
    if (txt) {
        txt.textContent = 'Vacía';
        txt.style.color = '#94a3b8';
    }
    document.getElementById('modal-perfil').classList.remove('hidden');
}
function closePerfilModal() {
    document.getElementById('modal-perfil').classList.add('hidden');
}
// Guarda los cambios validados y llama a Firebase
async function savePerfilCredentials() {
    const nuevoUser = document.getElementById('perfil-user').value.trim();
    const nuevaPass = document.getElementById('perfil-pass').value;
    const passConfirm = document.getElementById('perfil-pass-confirm').value;
    const saveBtn = document.getElementById('perfil-save-btn');
    if (!nuevoUser) {
        toast('El campo Usuario no puede estar vacío.', 'error');
        return;
    }
    // Validar límites de caracteres
    if (nuevaPass) {
        if (nuevaPass.length < 7 || nuevaPass.length > 15) {
            toast('La contraseña debe tener entre 7 y 15 caracteres.', 'error');
            return;
        }
        if (nuevaPass !== passConfirm) {
            toast('Las contraseñas no coinciden.', 'error');
            return;
        }
    }
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando...';
    try {
        await fsUpdateAdminProfile(nuevoUser, nuevaPass);
        toast('Perfil actualizado con éxito.', 'success');
        closePerfilModal();
        
        // Actualizar el chip de la barra superior
        const displayName = nuevoUser.charAt(0).toUpperCase() + nuevoUser.slice(1);
        document.getElementById('user-display-name').textContent = displayName;
        document.getElementById('user-avatar').textContent = nuevoUser.charAt(0).toUpperCase();
    } catch (error) {
        console.error(error);
        if (error.code === 'auth/requires-recent-login') {
            toast('Por seguridad, debes cerrar sesión y volver a ingresar para hacer este cambio.', 'warning');
        } else {
            toast('Error al actualizar el perfil: ' + error.message, 'error');
        }
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Guardar Cambios';
    }
}
// Inicializar clics, medidor por segmentos e interacciones
function inicializarEventosPerfil() {
    const topbarUser = document.getElementById('topbar-user');
    if (topbarUser) {
        topbarUser.style.cursor = 'pointer';
        topbarUser.onclick = openPerfilModal; 
    }
    const perfilToggleBtn = document.getElementById('perfil-toggle-pass');
    if (perfilToggleBtn) {
        perfilToggleBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const passInput = document.getElementById('perfil-pass');
            const eyeOpen = document.getElementById('perfil-eye-open');
            const eyeClosed = document.getElementById('perfil-eye-closed');
            
            if (passInput && eyeOpen && eyeClosed) {
                if (passInput.type === 'password') {
                    passInput.type = 'text';
                    eyeOpen.style.display = 'none';
                    eyeClosed.style.display = 'block';
                } else {
                    passInput.type = 'password';
                    eyeOpen.style.display = 'block';
                    eyeClosed.style.display = 'none';
                }
            }
        });
    }
    // Medidor dinámico de seguridad por segmentos de color
    const perfilPass = document.getElementById('perfil-pass');
    if (perfilPass) {
        perfilPass.addEventListener('input', function() {
            const val = this.value;
            const seg1 = document.getElementById('strength-seg-1');
            const seg2 = document.getElementById('strength-seg-2');
            const seg3 = document.getElementById('strength-seg-3');
            const seg4 = document.getElementById('strength-seg-4');
            const txt = document.getElementById('pass-strength-text');
            
            if (!seg1 || !seg2 || !seg3 || !seg4 || !txt) return;
            // Resetear todos a color base gris
            [seg1, seg2, seg3, seg4].forEach(seg => seg.style.backgroundColor = '#e2e8f0');
            if (!val) {
                txt.textContent = 'Vacía';
                txt.style.color = '#94a3b8';
                return;
            }
            
            if (val.length < 7) {
                seg1.style.backgroundColor = '#ef4444'; // Solo se enciende el primero en rojo
                txt.textContent = 'Corta (Mínimo 7)';
                txt.style.color = '#ef4444';
                return;
            }
            
            // Evaluar los factores
            let score = 0;
            if (/[0-9]/.test(val)) score++;             // números
            if (/[A-Z]/.test(val)) score++;             // mayúsculas
            if (/[a-z]/.test(val)) score++;             // minúsculas
            if (/[^A-Za-z0-9]/.test(val)) score++;       // caracteres especiales
            if (score <= 1) {
                // Naranja (Débil)
                seg1.style.backgroundColor = '#f97316';
                seg2.style.backgroundColor = '#f97316';
                txt.textContent = 'Débil';
                txt.style.color = '#f97316';
            } else if (score === 2 || score === 3) {
                // Amarillo (Media)
                seg1.style.backgroundColor = '#eab308';
                seg2.style.backgroundColor = '#eab308';
                seg3.style.backgroundColor = '#eab308';
                txt.textContent = 'Media';
                txt.style.color = '#eab308';
            } else {
                // Verde (Segura)
                [seg1, seg2, seg3, seg4].forEach(seg => seg.style.backgroundColor = '#22c55e');
                txt.textContent = 'Segura';
                txt.style.color = '#22c55e';
            }
        });
    }
}
// Inicialización segura del perfil
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarEventosPerfil);
} else {
    inicializarEventosPerfil();
}
