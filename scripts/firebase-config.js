// ── FIREBASE CONFIG ─ IVSS OA Cabimas
const firebaseConfig = {
    apiKey: "AIzaSyDGIIKQHYSQlUp9S0sbqPpNv0bWVnDkyjY",
    authDomain: "ivss-cabimas.firebaseapp.com",
    projectId: "ivss-cabimas",
    storageBucket: "ivss-cabimas.firebasestorage.app",
    messagingSenderId: "283388928591",
    appId: "1:283388928591:web:a0f85c41800d3812a9c03a"
};

// Instancia Principal
firebase.initializeApp(firebaseConfig);
const db   = firebase.firestore();

// Activar la Persistencia y Caché Local de Firestore
db.enablePersistence({ synchronizeTabs: true })
    .then(() => {
        console.log("Persistencia offline habilitada correctamente en Firestore (IndexedDB).");
    })
    .catch((err) => {
        if (err.code === 'failed-precondition') {
            console.warn("La persistencia falló: Múltiples pestañas abiertas.");
        } else if (err.code === 'unimplemented') {
            console.warn("El navegador actual no soporta persistencia offline.");
        }
    });

const auth = firebase.auth();

// Instancia Secundaria (para gestión de usuarios sin perder sesión)
const secondaryApp = firebase.initializeApp(firebaseConfig, "Secondary");
const secondaryAuth = secondaryApp.auth();

// Mantener sesión entre recargas; sólo cierra con signOut() manual
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
