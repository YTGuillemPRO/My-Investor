import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAb7W-V_7GzAL9zbP_E5tDchiIIE81XjXE",
  authDomain: "my-investor-d0d0a.firebaseapp.com",
  projectId: "my-investor-d0d0a",
  storageBucket: "my-investor-d0d0a.firebasestorage.app",
  messagingSenderId: "760901754992",
  appId: "1:760901754992:web:c491b8e85f3940445394b5",
  measurementId: "G-P0CCDKR21Q"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentBtcPrice = 0;
let priceChart = null;

// --- AUTENTICACIÓN ---
window.login = async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    try { await signInWithEmailAndPassword(auth, email, password); } 
    catch (error) { document.getElementById('auth-message').innerText = "Error: " + error.message; }
};

window.register = async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", userCredential.user.uid), { usd: 10000, btc: 0 });
    } catch (error) { document.getElementById('auth-message').innerText = "Error: " + error.message; }
};

window.logout = async () => { await signOut(auth); };

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('user-email').innerText = user.email;
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('dashboard-container').style.display = 'flex';
        await loadUserData();
        initMarketData();
    } else {
        currentUser = null;
        document.getElementById('auth-container').style.display = 'block';
        document.getElementById('dashboard-container').style.display = 'none';
    }
});

// --- DATOS DEL USUARIO ---
async function loadUserData() {
    const docSnap = await getDoc(doc(db, "users", currentUser.uid));
    if (docSnap.exists()) {
        const data = docSnap.data();
        document.getElementById('usd-balance').innerText = data.usd.toFixed(2);
        document.getElementById('btc-balance').innerText = data.btc.toFixed(6);
        updateTotalBalance(data.usd, data.btc);
    }
}

function updateTotalBalance(usd, btc) {
    const total = usd + (btc * currentBtcPrice);
    document.getElementById('total-balance').innerText = total.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

// --- MERCADO Y GRÁFICO (USANDO API DE BINANCE) ---
async function initMarketData() {
    try {
        // Binance API: Trae el precio y cambio de las últimas 24h de BTC, ETH y SOL
        const response = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbols=["BTCUSDT","ETHUSDT","SOLUSDT"]');
        const data = await response.json();
        
        let marketHtml = '';
        const coinNames = { BTCUSDT: 'Bitcoin', ETHUSDT: 'Ethereum', SOLUSDT: 'Solana' };
        const coinSymbols = { BTCUSDT: 'BTC', ETHUSDT: 'ETH', SOLUSDT: 'SOL' };

        data.forEach(coin => {
            const price = parseFloat(coin.lastPrice);
            const change = parseFloat(coin.priceChangePercent);
            
            if(coin.symbol === 'BTCUSDT') {
                currentBtcPrice = price;
                document.getElementById('btc-price').innerText = price.toLocaleString('en-US', {maximumFractionDigits: 2});
            }
            
            const changeClass = change >= 0 ? 'change-up' : 'change-down';
            marketHtml += `
                <div class="market-item">
                    <div>
                        <div class="name">${coinSymbols[coin.symbol]} <span style="color:#848e9c; font-weight:400;">${coinNames[coin.symbol]}</span></div>
                        <div class="price">$${price.toLocaleString('en-US', {maximumFractionDigits: 2})}</div>
                    </div>
                    <div class="${changeClass}">${change.toFixed(2)}%</div>
                </div>
            `;
        });
        document.getElementById('crypto-list').innerHTML = marketHtml;
        
        await loadUserData(); // Recalcular capital total
        fetchChartData(); // Cargar gráfico

    } catch (error) { 
        console.error("Error mercado Binance:", error); 
    }
}

async function fetchChartData() {
    try {
        // Binance API: Historial de velas diarias de BTC de los últimos 7 días
        const response = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=7');
        const data = await response.json();
        
        const labels = data.map(candle => {
            let d = new Date(candle[0]); // El primer elemento es el timestamp
            return d.toLocaleDateString('es-ES', {day: 'numeric', month: 'short'});
        });
        const prices = data.map(candle => parseFloat(candle[4])); // El indice 4 es el precio de cierre

        renderChart(labels, prices);
    } catch (error) { console.error("Error gráfico:", error); }
}

function renderChart(labels, prices) {
    const ctx = document.getElementById('priceChart').getContext('2d');
    
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(46, 189, 133, 0.4)');
    gradient.addColorStop(1, 'rgba(46, 189, 133, 0)');

    if (priceChart) priceChart.destroy();
    
    priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Precio BTC',
                data: prices,
                borderColor: '#2ebd85',
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: '#1e2329' }, ticks: { color: '#848e9c' } },
                x: { grid: { display: false }, ticks: { color: '#848e9c', maxTicksLimit: 6 } }
            }
        }
    });
}

// --- TRADING: COMPRAR Y VENDER ---
window.buyBitcoin = async () => {
    const amountUsd = parseFloat(document.getElementById('trade-amount').value);
    const messageEl = document.getElementById('trade-message');
    
    if (isNaN(amountUsd) || amountUsd <= 0) {
        messageEl.innerText = "Ingresa una cantidad válida.";
        messageEl.style.color = "#f6465d";
        return;
    }

    const docRef = doc(db, "users", currentUser.uid);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
        let userUsd = docSnap.data().usd;
        let userBtc = docSnap.data().btc;

        if (amountUsd > userUsd) {
            messageEl.innerText = "Saldo USD insuficiente.";
            messageEl.style.color = "#f6465d";
            return;
        }

        let btcPurchased = amountUsd / currentBtcPrice;
        userUsd -= amountUsd;
        userBtc += btcPurchased;

        await updateDoc(docRef, { usd: userUsd, btc: userBtc });

        document.getElementById('usd-balance').innerText = userUsd.toFixed(2);
        document.getElementById('btc-balance').innerText = userBtc.toFixed(6);
        updateTotalBalance(userUsd, userBtc);
        
        messageEl.innerText = `¡Compra exitosa! +${btcPurchased.toFixed(6)} BTC`;
        messageEl.style.color = "#2ebd85";
        document.getElementById('trade-amount').value = '';
    }
};

window.sellBitcoin = async () => {
    const amountUsd = parseFloat(document.getElementById('trade-amount').value);
    const messageEl = document.getElementById('trade-message');
    
    if (isNaN(amountUsd) || amountUsd <= 0) {
        messageEl.innerText = "Ingresa una cantidad válida.";
        messageEl.style.color = "#f6465d";
        return;
    }

    const docRef = doc(db, "users", currentUser.uid);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
        let userUsd = docSnap.data().usd;
        let userBtc = docSnap.data().btc;

        // Calcular cuánto BTC hay que vender para obtener esa cantidad de USD
        let btcToSell = amountUsd / currentBtcPrice;

        if (btcToSell > userBtc) {
            messageEl.innerText = "No tienes suficientes BTC para vender.";
            messageEl.style.color = "#f6465d";
            return;
        }

        userUsd += amountUsd; // Sumamos los dólares
        userBtc -= btcToSell; // Restamos el BTC vendido

        await updateDoc(docRef, { usd: userUsd, btc: userBtc });

        document.getElementById('usd-balance').innerText = userUsd.toFixed(2);
        document.getElementById('btc-balance').innerText = userBtc.toFixed(6);
        updateTotalBalance(userUsd, userBtc);
        
        messageEl.innerText = `¡Venta exitosa! +$${amountUsd.toFixed(2)} USD`;
        messageEl.style.color = "#2ebd85";
        document.getElementById('trade-amount').value = '';
    }
};
