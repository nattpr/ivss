// ══════════════════════════════════════════════════════
//  FIREBASE OPERATIONS  ·  IVSS OA Cabimas
//  Auth (Firebase Authentication) + DB (Cloud Firestore)
// ══════════════════════════════════════════════════════

// ── AUTH UI HELPERS ──────────────────────────────────
function showLoginError(msg) {
    const el = document.getElementById('login-error');
    el.textContent = msg;
    el.classList.remove('hidden');
}

function setLoginLoading(loading) {
    const btn = document.getElementById('login-btn');
    btn.disabled = loading;
    btn.innerHTML = loading
        ? '<span class="spin"></span> Verificando...'
        : 'Ingresar al Sistema';
}

function showLoginScreen() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('login-error').classList.add('hidden');
    document.getElementById('login-user').value = '';
    document.getElementById('login-pass').value = '';
    document.getElementById('topbar-user').style.display = 'none';
    document.getElementById('btn-logout').style.display  = 'none';
}

function hideLoginScreen() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('topbar-user').style.display  = 'flex';
    document.getElementById('btn-logout').style.display   = 'flex';
}

// ── AUTH ACTIONS ─────────────────────────────────────
async function handleLogin() {
    const user = (document.getElementById('login-user').value || '').trim();
    const pass  = document.getElementById('login-pass').value;
    if (!user || !pass) { showLoginError('Complete usuario y contraseña.'); return; }
    document.getElementById('login-error').classList.add('hidden');
    setLoginLoading(true);
    try {
        await auth.signInWithEmailAndPassword(user + '@ivss.gob.ve', pass);
        // onAuthStateChanged handles the rest
    } catch (e) {
        setLoginLoading(false);
        const msgs = {
            'auth/user-not-found':      'Usuario no encontrado.',
            'auth/wrong-password':      'Contraseña incorrecta.',
            'auth/invalid-credential':  'Credenciales inválidas.',
            'auth/invalid-email':       'Formato de usuario incorrecto.',
            'auth/too-many-requests':   'Demasiados intentos. Espere un momento.',
        };
        showLoginError(msgs[e.code] || 'Error de autenticación (' + e.code + ').');
    }
}

async function handleLogout() {
    await auth.signOut();
}

// ── FIRESTORE LOAD ────────────────────────────────────
async function loadAllData() {
    const [aSnap, pSnap] = await Promise.all([
        db.collection('atencion').orderBy('fecha', 'desc').get(),
        db.collection('pensionados').get()
    ]);
    atencionData    = aSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    pensionadosData = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── FIRESTORE CRUD · ATENCIÓN ─────────────────────────
async function fsAddAten(data) {
    const ref = await db.collection('atencion').add(data);
    atencionData.unshift({ id: ref.id, ...data });
}
async function fsUpdateAten(id, data) {
    await db.collection('atencion').doc(id).update(data);
    const i = atencionData.findIndex(r => r.id === id);
    if (i !== -1) atencionData[i] = { ...atencionData[i], ...data };
}
async function fsDeleteAten(id) {
    await db.collection('atencion').doc(id).delete();
    atencionData = atencionData.filter(r => r.id !== id);
}

// ── FIRESTORE CRUD · PENSIONADOS ──────────────────────
async function fsAddPens(data) {
    const ref = await db.collection('pensionados').add(data);
    pensionadosData.push({ id: ref.id, ...data });
}
async function fsUpdatePens(id, data) {
    await db.collection('pensionados').doc(id).update(data);
    const i = pensionadosData.findIndex(r => r.id === id);
    if (i !== -1) pensionadosData[i] = { ...pensionadosData[i], ...data };
}
async function fsDeletePens(id) {
    await db.collection('pensionados').doc(id).delete();
    pensionadosData = pensionadosData.filter(r => r.id !== id);
}

// ── AUTH STATE LISTENER (app boot) ────────────────────
// Ocultar login de inmediato; Firebase restaurará sesión si existe (no flash en recarga)
document.getElementById('login-screen').style.display = 'none';

auth.onAuthStateChanged(async (user) => {
    if (user) {
        setLoginLoading(true);
        try {
            await loadAllData();
        } catch (e) {
            console.error('Error cargando datos de Firestore:', e);
            toast('Error al cargar datos. Verifique la conexión.', 'error');
        }
        hideLoginScreen();
        setLoginLoading(false);

        // Show user chip in topbar
        const name = user.email.split('@')[0];
        const display = name.charAt(0).toUpperCase() + name.slice(1);
        document.getElementById('user-display-name').textContent = display;
        document.getElementById('user-avatar').textContent = display.charAt(0).toUpperCase();

        updateDate();
        navigate('dashboard');
    } else {
        // Sin sesión activa → mostrar login
        document.getElementById('login-screen').style.display = 'flex';
        setLoginLoading(false);
    }
});
