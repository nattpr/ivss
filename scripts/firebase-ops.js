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
    document.getElementById('btn-logout').style.display = 'none';
}

function hideLoginScreen() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('topbar-user').style.display = 'flex';
    document.getElementById('btn-logout').style.display = 'flex';
}

// ── AUTH ACTIONS ─────────────────────────────────────
async function handleLogin() {
    const user = (document.getElementById('login-user').value || '').trim();
    const pass = document.getElementById('login-pass').value;
    if (!user || !pass) { showLoginError('Complete usuario y contraseña.'); return; }
    document.getElementById('login-error').classList.add('hidden');
    setLoginLoading(true);
    try {
        await auth.signInWithEmailAndPassword(user + '@ivss.gob.ve', pass);
        // onAuthStateChanged handles the rest
    } catch (e) {
        setLoginLoading(false);
        const msgs = {
            'auth/user-not-found': 'Usuario no encontrado.',
            'auth/wrong-password': 'Contraseña incorrecta.',
            'auth/invalid-credential': 'Credenciales inválidas.',
            'auth/invalid-email': 'Formato de usuario incorrecto.',
            'auth/too-many-requests': 'Demasiados intentos. Espere un momento.',
        };
        showLoginError(msgs[e.code] || 'Error de autenticación (' + e.code + ').');
    }
}

// Mostrar/Ocultar contraseña en el Login
function inicializarEventosLogin() {
    const togglePassBtn = document.getElementById('login-toggle-pass');
    if (togglePassBtn) {
        togglePassBtn.addEventListener('click', function (e) {
            e.preventDefault();
            const passInput = document.getElementById('login-pass');
            const eyeOpen = document.getElementById('eye-open');
            const eyeClosed = document.getElementById('eye-closed');
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
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarEventosLogin);
} else {
    inicializarEventosLogin();
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
    atencionData = aSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    pensionadosData = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // NUEVO: Ordenar localmente de más reciente a más antiguo al cargar
    pensionadosData.sort((a, b) => {
        const fA = a.fecha || a.fechaRegistro || '';
        const fB = b.fecha || b.fechaRegistro || '';
        return fB.localeCompare(fA);
    });
}

function getDailyStats() {
    const hoy = new Date().toLocaleDateString('sv-SE');
    const atencionesHoy = atencionData.filter(r => r.fecha === hoy).length;
    const pensionadosHoy = pensionadosData.filter(r => r.fecha === hoy).length;
    return {
        atencion: atencionesHoy,
        pensionados: pensionadosHoy,
        total: atencionesHoy + pensionadosHoy
    };
}

// ── FIRESTORE CRUD · ATENCIÓN ─────────────────────────
async function fsAddAten(data) {
    const dataConTime = {
        timestamp: Date.now(),
        ...data
    };
    const ref = await db.collection('atencion').add(dataConTime);
    atencionData.unshift({ id: ref.id, ...dataConTime });
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
    const hoy = new Date().toLocaleDateString('sv-SE');
    const fechaReg = data.fecha || hoy;
    const dataConFecha = {
        fechaRegistro: fechaReg,
        timestamp: Date.now(),
        ...data
    };
    const ref = await db.collection('pensionados').add(dataConFecha);
    pensionadosData.unshift({ id: ref.id, ...dataConFecha });
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

// ── FIRESTORE CRUD · SYNC CIUDADANO ──────────────────────
async function fsSyncCiudadano(cedula, dataToSync) {
    if (!cedula || !dataToSync) return;

    const batch = db.batch();
    let hasUpdates = false;

    const cleanData = {};
    const allowedKeys = ['nombre', 'fechaNac', 'edad', 'genero', 'telefono', 'nacionalidad'];
    
    allowedKeys.forEach(key => {
        if (dataToSync[key] !== undefined && dataToSync[key] !== null) {
            cleanData[key] = dataToSync[key];
        }
    });
    if (Object.keys(cleanData).length === 0) return;

    const needsUpdate = (record, newData) => {
        for (const key in newData) {
            if (record[key] !== newData[key]) return true;
        }
        return false;
    };

    const atenDocs = await db.collection('atencion').where('cedula', '==', cedula).get();
    atenDocs.forEach(doc => {
        batch.update(doc.ref, cleanData);
        hasUpdates = true;
    });

    const penDocs = await db.collection('pensionados').where('cedula', '==', cedula).get();
    penDocs.forEach(doc => {
        batch.update(doc.ref, cleanData);
        hasUpdates = true;
    });

    if (hasUpdates) {
        await batch.commit();
    }
}

// ── AUTH STATE LISTENER (app boot) ────────────────────
document.getElementById('login-screen').style.display = 'none';

let currentUserRole = 'operador'; // default role

auth.onAuthStateChanged(async (user) => {
    if (user) {
        setLoginLoading(true);
        currentUserRole = 'operador'; // Reset por defecto para evitar fugas de rol previo
        try {
            // Fetch user role
            const userDoc = await db.collection('usuarios').doc(user.email).get();
            if (userDoc.exists) {
                currentUserRole = userDoc.data().role || 'operador';
            } else {
                // Si es el admin por defecto y no existe en Firestore, lo creamos
                if (user.email === 'admin@ivss.gob.ve') {
                    currentUserRole = 'admin';
                    await db.collection('usuarios').doc(user.email).set({
                        username: 'admin',
                        email: 'admin@ivss.gob.ve',
                        role: 'admin',
                        timestamp: Date.now()
                    });
                }
            }
        } catch (e) {
            console.warn('Error cargando rol de Firestore, usando operador:', e);
            currentUserRole = 'operador';
        }

        // Aplicar restricciones de UI según el rol (siempre se ejecuta fuera del try/catch de Firestore)
        applyRoleRestrictions();

        try {
            await loadAllData();
        } catch (e) {
            console.error('Error cargando datos de colecciones:', e);
        }
        hideLoginScreen();
        setLoginLoading(false);

        // Show user chip in topbar
        const activeName = user.displayName || user.email.split('@')[0];
        const display = activeName.charAt(0).toUpperCase() + activeName.slice(1);
        document.getElementById('user-display-name').textContent = display;
        document.getElementById('user-avatar').textContent = activeName.charAt(0).toUpperCase();
        updateDate();
        navigate('dashboard');
    } else {
        // Sin sesión activa → limpiar rol, aplicar restricciones y mostrar login con campos vacíos
        currentUserRole = 'operador';
        if (typeof applyRoleRestrictions === 'function') {
            applyRoleRestrictions();
        }
        showLoginScreen();
        setLoginLoading(false);
    }
});

async function fsUpdateAdminProfile(nuevoUser, nuevaPass) {
    const user = auth.currentUser;
    if (!user) throw new Error("No hay usuario autenticado.");
    const emailOriginal = user.email;
    const nuevoEmail = nuevoUser + "@ivss.gob.ve";
    if (nuevoEmail !== emailOriginal) {
        await user.updateEmail(nuevoEmail);
        
        const oldDoc = await db.collection('usuarios').doc(emailOriginal).get();
        if (oldDoc.exists) {
            const data = oldDoc.data();
            data.email = nuevoEmail;
            data.username = nuevoUser;
            await db.collection('usuarios').doc(nuevoEmail).set(data);
            await db.collection('usuarios').doc(emailOriginal).delete();
        }
    }
    if (nuevaPass) {
        await user.updatePassword(nuevaPass);
    }
}

// ── FIRESTORE CRUD · USUARIOS (Admin Only) ──────────────────────

async function fsGetUsuarios() {
    const snap = await db.collection('usuarios').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function fsCreateOperador(username, password) {
    const email = username + "@ivss.gob.ve";
    
    await db.collection('usuarios').doc(email).set({
        username: username,
        email: email,
        password: password,
        role: 'operador',
        timestamp: Date.now()
    });

    await secondaryAuth.createUserWithEmailAndPassword(email, password);
    await secondaryAuth.signOut();
}

async function fsUpdateOperadorPassword(username, oldPassword, newPassword) {
    const email = username + "@ivss.gob.ve";
    
    await secondaryAuth.signInWithEmailAndPassword(email, oldPassword);
    const secUser = secondaryAuth.currentUser;
    await secUser.updatePassword(newPassword);
    await secondaryAuth.signOut();

    await db.collection('usuarios').doc(email).update({
        password: newPassword
    });
}

async function fsDeleteOperador(username, oldPassword) {
    const email = username + "@ivss.gob.ve";
    
    try {
        await secondaryAuth.signInWithEmailAndPassword(email, oldPassword);
        const secUser = secondaryAuth.currentUser;
        if (secUser) await secUser.delete();
    } catch(e) {
        console.warn("Usuario no encontrado en Auth o contraseña incorrecta, se procederá a borrar en BD", e);
    }
    
    await db.collection('usuarios').doc(email).delete();
}


