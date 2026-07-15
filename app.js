import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. TU CONFIGURACIÓN DE FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyAb7W-V_7GzAL9zbP_E5tDchiIIE81XjXE",
  authDomain: "my-investor-d0d0a.firebaseapp.com",
  projectId: "my-investor-d0d0a",
  storageBucket: "my-investor-d0d0a.firebasestorage.app",
  messagingSenderId: "760901754992",
  appId: "1:760901754992:web:c491b8e85f3940445394b5",
  measurementId: "G-P0CCDKR21Q"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app); // Inicializamos Analytics
const auth = getAuth(app);
const db = getFirestore(app);

// Variables globales para la UI
let currentUser = null;
let currentBtcPrice = 0;

// 2. LÓGICA DE AUTENTICACIÓN
window.login = async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        document.getElementById('auth-message').innerText = "Error: " + error.message;
    }
};

window.register = async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    try {
        // Crear usuario en Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Crear documento en Firestore con saldo inicial de $10,000
        await setDoc(doc(db, "users", user.uid), {
            usd: 10000,
            btc: 0
        });
        
        document.getElementById('auth-message').innerText = "¡Registro exitoso!";
    } catch (error) {
        document.getElementById('auth-message').innerText = "Error: " + error.message;
    }
};

window.logout = async () => {
    await signOut(auth);
};

// 3. DETECTAR SI EL USUARIO ESTÁ LOGUEADO O NO
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Usuario logueado: mostrar dashboard
        currentUser = user;
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('dashboard-container').style.display = 'block';
        
        await loadUserData();
        fetchBitcoinPrice();
    } else {
        // Usuario no logueado: mostrar login
        currentUser = null;
        document.getElementById('auth-container').style.display = 'block';
        document.getElementById('dashboard-container').style.display = 'none';
    }
});

// 4. CARGAR DATOS DEL USUARIO (SALDO Y BTC)
async function loadUserData() {
    const docRef = doc(db, "users", currentUser.uid);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
        document.getElementById('usd-balance').innerText = docSnap.data().usd.toFixed(2);
        document.getElementById('btc-balance').innerText = docSnap.data().btc.toFixed(6);
    }
}

// 5. OBTENER PRECIO REAL DE BITCOIN (API COINGECKO)
async function fetchBitcoinPrice() {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
        const data = await response.json();
        currentBtcPrice = data.bitcoin.usd;
        document.getElementById('btc-price').innerText = currentBtcPrice.toLocaleString();
        
        // Actualizar precio cada 10 segundos
        setTimeout(fetchBitcoinPrice, 10000);
    } catch (error) {
        console.error("Error al obtener precio:", error);
    }
}

// 6. LÓGICA DE COMPRA DE BITCOIN
window.buyBitcoin = async () => {
    const amountUsd = parseFloat(document.getElementById('buy-amount').value);
    const messageEl = document.getElementById('trade-message');
    
    if (isNaN(amountUsd) || amountUsd <= 0) {
        messageEl.innerText = "Ingresa una cantidad válida.";
        messageEl.style.color = "#f87171";
        return;
    }

    const docRef = doc(db, "users", currentUser.uid);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
        let userUsd = docSnap.data().usd;
        let userBtc = docSnap.data().btc;

        if (amountUsd > userUsd) {
            messageEl.innerText = "Saldo insuficiente.";
            messageEl.style.color = "#f87171";
            return;
        }

        // Hacer la compra
        let btcPurchased = amountUsd / currentBtcPrice;
        userUsd -= amountUsd;
        userBtc += btcPurchased;

        // Guardar en Firebase
        await updateDoc(docRef, {
            usd: userUsd,
            btc: userBtc
        });

        // Actualizar interfaz
        document.getElementById('usd-balance').innerText = userUsd.toFixed(2);
        document.getElementById('btc-balance').innerText = userBtc.toFixed(6);
        
        messageEl.innerText = `¡Compra exitosa! +${btcPurchased.toFixed(6)} BTC`;
        messageEl.style.color = "#4ade80";
        document.getElementById('buy-amount').value = '';
    }
};
