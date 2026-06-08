document.addEventListener('DOMContentLoaded', () => {
    // Estado de la aplicación
    let botRunning = false;
    let portfolioInterval = null;
    let logsInterval = null;

    // Elementos del DOM - Navegación
    const navDashboard = document.getElementById('nav-dashboard');
    const navManualTrade = document.getElementById('nav-manual-trade');
    const navConfig = document.getElementById('nav-config');
    const navLogs = document.getElementById('nav-logs');

    // Paneles de Formulario
    const panelBotConfig = document.getElementById('panel-bot-config');
    const panelManualTrade = document.getElementById('panel-manual-trade');
    const rightFormPanel = document.getElementById('right-form-panel');
    const headerMainTitle = document.getElementById('header-main-title');
    const headerSubTitle = document.getElementById('header-sub-title');

    // Botones de control del Bot
    const btnToggleBot = document.getElementById('btn-toggle-bot');
    const botStatusIndicator = document.getElementById('bot-status-indicator');
    const botStatusText = document.getElementById('bot-status-text');

    // Métricas del portafolio
    const valCredit = document.getElementById('val-credit');
    const valEquity = document.getElementById('val-equity');
    const valPnl = document.getElementById('val-pnl');
    const valPnlPercent = document.getElementById('val-pnl-percent');
    const pnlMetricCard = document.getElementById('pnl-metric-card');
    const pnlIcon = document.getElementById('pnl-icon');

    // Entorno eToro
    const envBadgeContainer = document.getElementById('env-badge-container');
    const envText = document.getElementById('env-text');

    // Tabla de posiciones
    const tablePositionsBody = document.querySelector('#table-positions tbody');
    const btnRefreshPortfolio = document.getElementById('btn-refresh-portfolio');

    // Formulario de configuración del bot
    const formBotSettings = document.getElementById('form-bot-settings');
    const inputStrategy = document.getElementById('input-strategy');
    const inputCandleInterval = document.getElementById('input-candle-interval');
    const inputAmount = document.getElementById('input-amount');
    const inputLeverage = document.getElementById('input-leverage');
    const inputInterval = document.getElementById('input-interval');
    const inputSymbols = document.getElementById('input-symbols');

    // Formulario de trading manual
    const formManualTrade = document.getElementById('form-manual-trade');
    const manualSymbol = document.getElementById('manual-symbol');
    const manualAmount = document.getElementById('manual-amount');
    const manualLeverage = document.getElementById('manual-leverage');
    const manualDirection = document.getElementById('manual-direction');
    const btnVerifySymbol = document.getElementById('btn-verify-symbol');
    const symbolVerifyStatus = document.getElementById('symbol-verify-status');

    // Logs Terminal
    const logsOutput = document.getElementById('logs-output');
    const btnRefreshLogs = document.getElementById('btn-refresh-logs');

    /* ==========================================================================
       0. SISTEMA DE TOAST NOTIFICATIONS (Alertas Visuales Premium)
       ========================================================================== */
    function showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let icon = 'info';
        if (type === 'success') icon = 'check_circle';
        if (type === 'error') icon = 'error_outline';
        
        toast.innerHTML = `
            <span class="material-icons-round">${icon}</span>
            <span>${message}</span>
        `;
        
        toastContainer.appendChild(toast);
        
        // Auto remover
        setTimeout(() => {
            toast.classList.add('toast-fadeout');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 4500);
    }

    /* ==========================================================================
       1. SISTEMA DE NAVEGACIÓN Y PESTAÑAS (TABS)
       ========================================================================== */
    function switchTab(activeNav, title, subtitle, showBotConfig = true) {
        // Remover clase activa de todos los navs
        [navDashboard, navManualTrade, navConfig, navLogs].forEach(nav => {
            if (nav) nav.classList.remove('active');
        });
        
        // Agregar clase activa
        activeNav.classList.add('active');
        headerMainTitle.textContent = title;
        headerSubTitle.textContent = subtitle;

        if (showBotConfig) {
            panelBotConfig.classList.remove('hidden');
            panelManualTrade.classList.add('hidden');
        } else {
            panelBotConfig.classList.add('hidden');
            panelManualTrade.classList.remove('hidden');
        }
    }

    if (navDashboard) {
        navDashboard.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab(navDashboard, "Panel de Control General", "Monitoreo de algoritmo de trading en tiempo real.", true);
        });
    }

    if (navConfig) {
        navConfig.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab(navConfig, "Ajustes del Algoritmo", "Configure los parámetros operativos de la estrategia del bot.", true);
            formBotSettings.scrollIntoView({ behavior: 'smooth' });
        });
    }

    if (navManualTrade) {
        navManualTrade.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab(navManualTrade, "Operación Manual", "Coloque órdenes instantáneas directamente en la cuenta de eToro.", false);
        });
    }

    if (navLogs) {
        navLogs.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab(navLogs, "Terminal de Registros", "Historial de acciones y diagnósticos del bot.", true);
            logsOutput.scrollIntoView({ behavior: 'smooth' });
        });
    }

    /* ==========================================================================
       1.5 CHIPS DE SELECCIÓN RÁPIDA (UX PREMIUM)
       ========================================================================== */
    document.querySelectorAll('.quick-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const symbol = chip.getAttribute('data-symbol');
            manualSymbol.value = symbol;
            
            // Simular verificación del símbolo seleccionado
            btnVerifySymbol.click();
            showToast(`Activo ${symbol} seleccionado automáticamente.`, 'info');
        });
    });

    /* ==========================================================================
       2. CARGAR Y ACTUALIZAR CONFIGURACIÓN DEL BOT
       ========================================================================== */
    async function loadBotStatus() {
        try {
            const res = await fetch('/api/status');
            const data = await res.json();
            
            // Sincronizar estado del bot
            botRunning = data.is_running;
            updateBotStatusUI(botRunning);

            // Sincronizar entorno eToro
            const isDemo = data.env === 'demo';
            envText.textContent = isDemo ? "DEMO MODE" : "REAL ACCOUNT";
            if (isDemo) {
                envBadgeContainer.classList.remove('real');
            } else {
                envBadgeContainer.classList.add('real');
            }

            // Cargar configuración en inputs
            inputStrategy.value = data.strategy;
            inputCandleInterval.value = data.candle_interval || 'OneHour';
            inputAmount.value = data.amount_per_trade;
            inputLeverage.value = data.leverage;
            inputInterval.value = data.interval;
            inputSymbols.value = data.symbols.join(', ');

        } catch (err) {
            console.error("Error cargando estado del bot:", err);
            showToast("No se pudo conectar con el servidor local. ¿Está corriendo server.py?", "error");
        }
    }

    function updateBotStatusUI(running) {
        const friendlyStatus = document.getElementById('bot-friendly-status');
        
        if (running) {
            botStatusIndicator.classList.remove('inactive');
            botStatusIndicator.classList.add('active');
            botStatusText.textContent = "Activo";
            btnToggleBot.innerHTML = `<span class="material-icons-round">stop</span><span>Detener Bot</span>`;
            btnToggleBot.classList.remove('btn-primary');
            btnToggleBot.classList.add('btn-primary', 'btn-stop');
            if (friendlyStatus) friendlyStatus.textContent = "Iniciando análisis del mercado...";
        } else {
            botStatusIndicator.classList.remove('active');
            botStatusIndicator.classList.add('inactive');
            botStatusText.textContent = "Inactivo";
            btnToggleBot.innerHTML = `<span class="material-icons-round">play_arrow</span><span>Iniciar Bot</span>`;
            btnToggleBot.classList.remove('btn-stop');
            btnToggleBot.classList.add('btn-primary');
            if (friendlyStatus) friendlyStatus.textContent = "Bot inactivo. Esperando inicio...";
        }
    }

    // Toggle Bot Button Click
    btnToggleBot.addEventListener('click', async () => {
        const endpoint = botRunning ? '/api/bot/stop' : '/api/bot/start';
        const actionText = botRunning ? "deteniendo" : "iniciando";
        
        showToast(`Procesando solicitud: ${actionText} bot...`, 'info');
        
        try {
            const res = await requestsPost(endpoint);
            if (res.success) {
                botRunning = res.is_running;
                updateBotStatusUI(botRunning);
                showToast(botRunning ? "¡El Bot se ha iniciado correctamente!" : "El Bot se ha detenido.", botRunning ? 'success' : 'info');
                fetchLogs();
            }
        } catch (err) {
            showToast("Fallo al cambiar el estado del bot: " + err.message, "error");
        }
    });

    // Guardar Configuración del Bot
    formBotSettings.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            strategy: inputStrategy.value,
            candle_interval: inputCandleInterval.value,
            amount_per_trade: parseFloat(inputAmount.value),
            leverage: parseInt(inputLeverage.value),
            interval: parseInt(inputInterval.value),
            symbols: inputSymbols.value.split(',').map(s => s.trim()).filter(Boolean)
        };

        try {
            const res = await requestsPost('/api/status/update', payload);
            if (res.success) {
                showToast("¡Configuración guardada y aplicada con éxito!", "success");
                fetchLogs();
            }
        } catch (err) {
            showToast("Error al guardar la configuración: " + err.message, "error");
        }
    });

    /* ==========================================================================
       3. RETROALIMENTACIÓN Y DATOS DEL PORTAFOLIO
       ========================================================================== */
    async function fetchPortfolio() {
        try {
            const res = await fetch('/api/portfolio');
            if (!res.ok) throw new Error("Fallo al conectar con eToro");
            const data = await res.json();

            // Actualizar métricas generales
            const credit = data.credit || 0.0;
            const equity = data.equity || credit;
            
            // Calcular PnL neto de las posiciones
            let totalPnl = 0.0;
            let totalCost = 0.0;
            data.positions.forEach(pos => {
                totalPnl += pos.pnl;
                totalCost += pos.amount;
            });

            valCredit.textContent = formatUSD(credit);
            valEquity.textContent = formatUSD(equity);
            valPnl.textContent = formatUSD(totalPnl, true);
            
            const pnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0.0;
            valPnlPercent.textContent = `${totalPnl >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}% de retorno`;

            // Aplicar colores de PnL a la tarjeta métrica
            pnlMetricCard.classList.remove('pnl-positive', 'pnl-negative');
            valPnl.classList.remove('pnl-positive', 'pnl-negative', 'pnl-neutral');
            
            if (totalPnl > 0) {
                pnlMetricCard.classList.add('pnl-positive');
                valPnl.classList.add('pnl-positive');
                pnlIcon.textContent = "trending_up";
                pnlIcon.className = "material-icons-round pnl-positive";
            } else if (totalPnl < 0) {
                pnlMetricCard.classList.add('pnl-negative');
                valPnl.classList.add('pnl-negative');
                pnlIcon.textContent = "trending_down";
                pnlIcon.className = "material-icons-round pnl-negative";
            } else {
                valPnl.classList.add('pnl-neutral');
                pnlIcon.textContent = "trending_flat";
                pnlIcon.className = "material-icons-round";
            }

            // Construir la tabla de posiciones
            renderPositions(data.positions);

        } catch (err) {
            console.error("Error al obtener portafolio:", err);
            tablePositionsBody.innerHTML = `
                <tr class="table-empty">
                    <td colspan="8" style="color: var(--color-red); font-weight: 500;">
                        No se pudo conectar a eToro. Verifica tu conexión a internet o tus credenciales en el archivo .env
                    </td>
                </tr>
            `;
        }
    }

    function renderPositions(positions) {
        if (!positions || positions.length === 0) {
            tablePositionsBody.innerHTML = `
                <tr class="table-empty">
                    <td colspan="8">No hay posiciones abiertas en tu cuenta.</td>
                </tr>
            `;
            return;
        }

        tablePositionsBody.innerHTML = "";
        positions.forEach(pos => {
            const tr = document.createElement('tr');
            
            const directionClass = pos.isBuy ? 'badge-buy' : 'badge-sell';
            const directionText = pos.isBuy ? 'COMPRA' : 'VENTA';
            const pnlClass = pos.pnl > 0 ? 'pnl-positive' : (pos.pnl < 0 ? 'pnl-negative' : '');
            const pnlPrefix = pos.pnl > 0 ? '+' : '';

            tr.innerHTML = `
                <td>
                    <div style="font-weight: 600;">${pos.symbol}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${pos.displayName}</div>
                </td>
                <td><span class="table-badge ${directionClass}">${directionText}</span></td>
                <td>${formatUSD(pos.amount)}</td>
                <td style="font-weight: 500;">${pos.leverage}x</td>
                <td>${pos.openRate.toFixed(4)}</td>
                <td>${pos.currentRate.toFixed(4)}</td>
                <td class="${pnlClass}" style="font-weight: 600;">
                    <div>${pnlPrefix}${formatUSD(pos.pnl)}</div>
                    <div style="font-size: 0.75rem;">${pnlPrefix}${pos.pnlPercent.toFixed(2)}%</div>
                </td>
                <td>
                    <button class="btn btn-danger btn-close-pos" data-pos-id="${pos.positionID}" data-inst-id="${pos.instrumentID}" data-symbol="${pos.symbol}">
                        Cerrar
                    </button>
                </td>
            `;

            // Agregar evento al botón de cerrar posición
            tr.querySelector('.btn-close-pos').addEventListener('click', async (e) => {
                const button = e.currentTarget;
                const posId = button.getAttribute('data-pos-id');
                const instId = button.getAttribute('data-inst-id');
                const sym = button.getAttribute('data-symbol');

                if (confirm(`¿Estás seguro de que deseas vender y cerrar tu posición de ${sym} (ID: ${posId})?`)) {
                    button.disabled = true;
                    button.textContent = "Cerrando...";
                    showToast(`Cerrando posición de ${sym}...`, 'info');
                    try {
                        const res = await requestsPost('/api/close', { positionID: posId, instrumentID: instId });
                        if (res.success) {
                            showToast(`¡Posición de ${sym} cerrada con éxito!`, 'success');
                            fetchPortfolio();
                        }
                    } catch (err) {
                        showToast(`No se pudo cerrar la posición: ${err.message}`, "error");
                        button.disabled = false;
                        button.textContent = "Cerrar";
                    }
                }
            });

            tablePositionsBody.appendChild(tr);
        });
    }

    if (btnRefreshPortfolio) {
        btnRefreshPortfolio.addEventListener('click', () => {
            showToast("Actualizando portafolio...", 'info');
            fetchPortfolio();
        });
    }

    /* ==========================================================================
       4. TRADING MANUAL
       ========================================================================== */
    // Verificar si existe un Símbolo
    btnVerifySymbol.addEventListener('click', async () => {
        const symbol = manualSymbol.value.trim().toUpperCase();
        if (!symbol) {
            symbolVerifyStatus.textContent = "Por favor ingresa un símbolo.";
            symbolVerifyStatus.className = "input-helper symbol-invalid";
            return;
        }

        symbolVerifyStatus.textContent = "Verificando en eToro...";
        symbolVerifyStatus.className = "input-helper";

        try {
            const res = await fetch(`/api/search?symbol=${symbol}`);
            const data = await res.json();
            
            if (data.instrumentId) {
                symbolVerifyStatus.textContent = `Disponible en eToro. ID: ${data.instrumentId}`;
                symbolVerifyStatus.className = "input-helper symbol-valid";
                showToast(`Activo ${symbol} verificado correctamente. Listo para operar.`, 'success');
            } else {
                symbolVerifyStatus.textContent = `Activo no encontrado o no disponible en eToro.`;
                symbolVerifyStatus.className = "input-helper symbol-invalid";
                showToast(`El símbolo ${symbol} no está disponible en la API de eToro.`, 'error');
            }
        } catch (err) {
            symbolVerifyStatus.textContent = `No se pudo encontrar el símbolo.`;
            symbolVerifyStatus.className = "input-helper symbol-invalid";
            showToast(`Error de conexión al buscar el activo ${symbol}.`, 'error');
        }
    });

    // Enviar Orden de Compra/Venta Manual
    formManualTrade.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const symbol = manualSymbol.value.trim().toUpperCase();
        const amount = parseFloat(manualAmount.value);
        const leverage = parseInt(manualLeverage.value);
        const transaction = manualDirection.value;
        const dirText = transaction === 'buy' ? 'COMPRA' : 'VENTA CORTA';

        if (confirm(`¿Deseas enviar una orden de mercado real para ${dirText} ${symbol} por un valor de $${amount} USD?`)) {
            const btnSubmit = document.getElementById('btn-submit-manual-trade');
            btnSubmit.disabled = true;
            btnSubmit.textContent = "Enviando Orden...";
            showToast(`Colocando orden en mercado: ${dirText} ${symbol}...`, 'info');

            try {
                const res = await requestsPost('/api/trade', {
                    symbol,
                    amount,
                    leverage,
                    transaction
                });

                if (res.success) {
                    showToast(`¡Orden de ${dirText} ${symbol} ejecutada con éxito!`, 'success');
                    formManualTrade.reset();
                    symbolVerifyStatus.textContent = "Selecciona un activo o ingresa su símbolo.";
                    symbolVerifyStatus.className = "input-helper";
                    fetchPortfolio();
                }
            } catch (err) {
                // Traducir mensajes técnicos del servidor a descripciones amigables
                let friendlyMsg = err.message;
                if (friendlyMsg.includes("validation errors")) {
                    friendlyMsg = "Error de validación: Asegúrate de que el monto o parámetros sean válidos.";
                }
                showToast(`Fallo al ejecutar la orden: ${friendlyMsg}`, "error");
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = `<span class="material-icons-round">shopping_cart</span><span>Ejecutar Orden en Mercado</span>`;
            }
        }
    });

    /* ==========================================================================
       5. TERMINAL DE LOGS Y TRADUCCIÓN A ESTADOS AMIGABLES (UX)
       ========================================================================== */
    async function fetchLogs() {
        try {
            const res = await fetch('/api/logs');
            const data = await res.json();
            
            if (data.logs) {
                logsOutput.textContent = data.logs;
                logsOutput.scrollTop = logsOutput.scrollHeight;
                
                // Traducir las líneas de logs de depuración técnicas a estados legibles para usuarios no técnicos
                parseLogsForFriendlyStatus(data.logs);
            }
        } catch (err) {
            console.error("Error al leer logs:", err);
        }
    }

    function parseLogsForFriendlyStatus(logsText) {
        const friendlyStatusEl = document.getElementById('bot-friendly-status');
        if (!friendlyStatusEl) return;
        
        if (!botRunning) {
            friendlyStatusEl.textContent = "Bot inactivo. Esperando inicio...";
            return;
        }
        
        if (!logsText) {
            friendlyStatusEl.textContent = "Ejecutando algoritmo de análisis...";
            return;
        }
        
        const lines = logsText.trim().split('\n').reverse();
        
        // Buscar líneas clave en orden de prioridad de lo más reciente a lo antiguo
        for (const line of lines) {
            if (line.includes('EJECUTANDO COMPRA')) {
                const match = line.match(/EJECUTANDO COMPRA de \$([0-9.]+) USD en ([A-Z]+)/);
                if (match) {
                    friendlyStatusEl.innerHTML = `<strong style="color: var(--color-green)">Comprando ${match[2]} ($${match[1]} USD)</strong>`;
                    return;
                }
                friendlyStatusEl.textContent = "Colocando orden de compra en mercado...";
                return;
            }
            if (line.includes('Cerrando posición')) {
                const match = line.match(/Cerrando posición ID ([0-9]+) de ([A-Z]+)/);
                if (match) {
                    friendlyStatusEl.innerHTML = `<strong style="color: var(--color-red)">Cerrando y vendiendo posición de ${match[2]}</strong>`;
                    return;
                }
                friendlyStatusEl.textContent = "Cerrando posición abierta...";
                return;
            }
            if (line.includes('Señal:')) {
                const match = line.match(/Precio actual ([A-Z0-9]+): \$([0-9.,]+) \| Señal: ([A-Z]+) \| Motivo: (.+)/);
                if (match) {
                    const asset = match[1];
                    const price = match[2];
                    const signal = match[3];
                    const reason = match[4];
                    
                    let signalColoredText = signal;
                    if (signal === 'BUY') {
                        signalColoredText = `<span style="color: var(--color-green); font-weight:700;">COMPRAR (BUY)</span>`;
                    } else if (signal === 'SELL') {
                        signalColoredText = `<span style="color: var(--color-red); font-weight:700;">VENDER (SELL)</span>`;
                    } else {
                        signalColoredText = `MANTENER (HOLD)`;
                    }
                    
                    friendlyStatusEl.innerHTML = `Analizado <strong>${asset}</strong> ($${price}) | Decisión: <strong>${signalColoredText}</strong>`;
                    return;
                }
            }
            if (line.includes('Iniciando iteración')) {
                friendlyStatusEl.textContent = "Analizando lista de activos configurados...";
                return;
            }
            if (line.includes('ERROR') || line.includes('Error')) {
                friendlyStatusEl.innerHTML = `<span style="color: var(--color-red)">Ocurrió un error en el último análisis.</span>`;
                return;
            }
        }
        
        friendlyStatusEl.textContent = "Algoritmo activo. Analizando precios en tiempo real...";
    }

    if (btnRefreshLogs) {
        btnRefreshLogs.addEventListener('click', () => {
            showToast("Actualizando terminal...", 'info');
            fetchLogs();
        });
    }

    /* ==========================================================================
       6. FUNCIONES AUXILIARES (HELPERS)
       ========================================================================== */
    async function requestsPost(url, payload = {}) {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || "Fallo en la petición");
        }
        return data;
    }

    function formatUSD(num, showSign = false) {
        const value = Number(num);
        const formatted = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(Math.abs(value));
        
        if (showSign) {
            return (value >= 0 ? '+' : '-') + formatted;
        }
        return (value < 0 ? '-' : '') + formatted;
    }

    /* ==========================================================================
       7. CARGAR DATOS AL INICIAR E INTERVALOS DE ACTUALIZACIÓN
       ========================================================================== */
    loadBotStatus();
    fetchPortfolio();
    fetchLogs();

    // Consultar el portafolio cada 5 segundos
    portfolioInterval = setInterval(fetchPortfolio, 5000);
    // Consultar logs cada 3 segundos
    logsInterval = setInterval(fetchLogs, 3000);
});
