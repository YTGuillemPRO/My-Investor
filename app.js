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
    document.getElementById('total-balance').innerText = total.toFixed(2);
}

// --- MERCADO Y GRÁFICO ---
async function initMarketData() {
    try {
        // Traer precio de BTC, ETH y SOL
        const response = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana');
        const data = await response.json();
        
        let marketHtml = '';
        data.forEach(coin => {
            if(coin.id === 'bitcoin') {
                currentBtcPrice = coin.current_price;
                document.getElementById('btc-price').innerText = currentBtcPrice.toLocaleString();
            }
            const changeClass = coin.price_change_percentage_24h >= 0 ? 'change-up' : 'change-down';
            marketHtml += `
                <div class="market-item">
                    <div>
                        <div class="name">${coin.symbol.toUpperCase()} <span style="color:#848e9c; font-weight:400;">${coin.name}</span></div>
                        <div class="price">$${coin.current_price.toLocaleString()}</div>
                    </div>
                    <div class="${changeClass}">${coin.price_change_percentage_24h.toFixed(2)}%</div>
                </div>
            `;
        });
        document.getElementById('crypto-list').innerHTML = marketHtml;
        
        await loadUserData(); // Actualizar balance total con el nuevo precio
        fetchChartData(); // Cargar gráfico

    } catch (error) { console.error("Error mercado:", error); }
}

async function fetchChartData() {
    try {
        // Historial de BTC de los últimos 7 días
        const response = await fetch('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=7');
        const data = await response.json();
        
        const labels = data.prices.map(p => {
            let d = new Date(p[0]);
            return d.toLocaleDateString('es-ES', {day: 'numeric', month: 'short'});
        });
        const prices = data.prices.map(p => p[1]);

        renderChart(labels, prices);
    } catch (error) { console.error("Error gráfico:", error); }
}

function renderChart(labels, prices) {
    const ctx = document.getElementById('priceChart').getContext('2d');
    
    // Degradado para el área bajo la línea
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(46, 189, 133, 0.4)');
    gradient.addColorStop(1, 'rgba(46, 189, 133, 0)');

    if (priceChart) priceChart.destroy(); // Limpiar gráfico anterior
    
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
                tension: 0.4, // Curva suave
                borderWidth: 2,
                pointRadius: 0 // Sin puntos en la línea
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

// --- TRADING ---
window.buyBitcoin = async () => {
    const amountUsd = parseFloat(document.getElementById('buy-amount').value);
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
            messageEl.innerText = "Saldo insuficiente.";
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
        document.getElementById('buy-amount').value = '';
    }
};
