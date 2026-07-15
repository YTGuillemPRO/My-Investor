let saldoActual = 10000;

function transferir() {
    const montoInput = document.getElementById('monto');
    const mensaje = document.getElementById('mensaje');
    const monto = parseFloat(montoInput.value);

    if (isNaN(monto) || monto <= 0) {
        mensaje.style.color = 'red';
        mensaje.textContent = 'Por favor ingresa un monto válido.';
        return;
    }

    if (monto > saldoActual) {
        mensaje.style.color = 'red';
        mensaje.textContent = 'Fondos insuficientes.';
    } else {
        saldoActual -= monto;
        document.getElementById('saldo').textContent = saldoActual.toLocaleString('es-MX');
        mensaje.style.color = 'green';
        mensaje.textContent = `Transferencia de $${monto} exitosa.`;
        montoInput.value = '';
    }
}
