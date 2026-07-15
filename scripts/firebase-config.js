// ── FIREBASE CONFIG ─ IVSS OA Cabimas
const firebaseConfig = {
    apiKey: "AIzaSyDGIIKQHYSQlUp9S0sbqPpNv0bWVnDkyjY",
    authDomain: "ivss-cabimas.firebaseapp.com",
    projectId: "ivss-cabimas",
    storageBucket: "ivss-cabimas.firebasestorage.app",
    messagingSenderId: "283388928591",
    appId: "1:283388928591:web:a0f85c41800d3812a9c03a"
};


firebase.initializeApp(firebaseConfig);
const db   = firebase.firestore();


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

// gestión secundaria de usuarios sin perder sesión
const secondaryApp = firebase.initializeApp(firebaseConfig, "Secondary");
const secondaryAuth = secondaryApp.auth();

auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
