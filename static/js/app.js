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
            // Hacer scroll hasta el formulario
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
        }
    }

    function updateBotStatusUI(running) {
        if (running) {
            botStatusIndicator.classList.remove('inactive');
            botStatusIndicator.classList.add('active');
            botStatusText.textContent = "Activo";
            btnToggleBot.innerHTML = `<span class="material-icons-round">stop</span><span>Detener Bot</span>`;
            btnToggleBot.classList.remove('btn-primary');
            btnToggleBot.classList.add('btn-primary', 'btn-stop');
        } else {
            botStatusIndicator.classList.remove('active');
            botStatusIndicator.classList.add('inactive');
            botStatusText.textContent = "Inactivo";
            btnToggleBot.innerHTML = `<span class="material-icons-round">play_arrow</span><span>Iniciar Bot</span>`;
            btnToggleBot.classList.remove('btn-stop');
            btnToggleBot.classList.add('btn-primary');
        }
    }

    // Toggle Bot Button Click
    btnToggleBot.addEventListener('click', async () => {
        const endpoint = botRunning ? '/api/bot/stop' : '/api/bot/start';
        try {
            const res = await requestsPost(endpoint);
            if (res.success) {
                botRunning = res.is_running;
                updateBotStatusUI(botRunning);
                fetchLogs();
            }
        } catch (err) {
            alert("Error al cambiar el estado del bot: " + err.message);
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
                alert("Configuración guardada exitosamente.");
                fetchLogs();
            }
        } catch (err) {
            alert("Error al guardar configuración: " + err.message);
        }
    });

    /* ==========================================================================
       3. RETROALIMENTACIÓN Y DATOS DEL PORTAFOLIO
       ========================================================================== */
    async function fetchPortfolio() {
        try {
            const res = await fetch('/api/portfolio');
            if (!res.ok) throw new Error("Fallo de red al consultar portafolio");
            const data = await res.json();

            // Actualizar métricas generales
            const credit = data.credit || 0.0;
            const equity = data.equity || credit;
            const pnl = equity - credit; // Si no hay posiciones, PnL es 0
            
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
            // Mostrar mensaje de error en la tabla
            tablePositionsBody.innerHTML = `
                <tr class="table-empty">
                    <td colspan="8" style="color: var(--color-red);">Error al conectar con la API de eToro. Verifica tus credenciales.</td>
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
                    <button class="btn btn-danger btn-close-pos" data-pos-id="${pos.positionID}" data-inst-id="${pos.instrumentID}">
                        Cerrar
                    </button>
                </td>
            `;

            // Agregar evento al botón de cerrar posición
            tr.querySelector('.btn-close-pos').addEventListener('click', async (e) => {
                const button = e.currentTarget;
                const posId = button.getAttribute('data-pos-id');
                const instId = button.getAttribute('data-inst-id');

                if (confirm(`¿Estás seguro de que deseas cerrar la posición ID ${posId}?`)) {
                    button.disabled = true;
                    button.textContent = "Cerrando...";
                    try {
                        const res = await requestsPost('/api/close', { positionID: posId, instrumentID: instId });
                        if (res.success) {
                            alert(`Posición ${posId} cerrada correctamente.`);
                            fetchPortfolio();
                        }
                    } catch (err) {
                        alert("Error al cerrar la posición: " + err.message);
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

        symbolVerifyStatus.textContent = "Verificando...";
        symbolVerifyStatus.className = "input-helper";

        try {
            const res = await fetch(`/api/search?symbol=${symbol}`);
            const data = await res.json();
            
            if (data.instrumentId) {
                symbolVerifyStatus.textContent = `Instrumento VÁLIDO. ID eToro: ${data.instrumentId}`;
                symbolVerifyStatus.className = "input-helper symbol-valid";
            } else {
                symbolVerifyStatus.textContent = `Símbolo no encontrado en eToro.`;
                symbolVerifyStatus.className = "input-helper symbol-invalid";
            }
        } catch (err) {
            symbolVerifyStatus.textContent = `No se pudo encontrar el símbolo.`;
            symbolVerifyStatus.className = "input-helper symbol-invalid";
        }
    });

    // Enviar Orden de Compra/Venta Manual
    formManualTrade.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const symbol = manualSymbol.value.trim().toUpperCase();
        const amount = parseFloat(manualAmount.value);
        const leverage = parseInt(manualLeverage.value);
        const transaction = manualDirection.value;

        if (confirm(`¿Deseas enviar una orden de mercado para ${transaction.toUpperCase()} ${symbol} por $${amount} USD a apalancamiento ${leverage}x?`)) {
            const btnSubmit = document.getElementById('btn-submit-manual-trade');
            btnSubmit.disabled = true;
            btnSubmit.textContent = "Enviando Orden...";

            try {
                const res = await requestsPost('/api/trade', {
                    symbol,
                    amount,
                    leverage,
                    transaction
                });

                if (res.success) {
                    alert(`Orden colocada con éxito. ID Orden: ${res.result.orderId}`);
                    formManualTrade.reset();
                    symbolVerifyStatus.textContent = "Ingresa un símbolo para verificar su InstrumentID.";
                    symbolVerifyStatus.className = "input-helper";
                    fetchPortfolio();
                }
            } catch (err) {
                alert("Error al colocar orden manual: " + err.message);
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = `<span class="material-icons-round">shopping_cart</span><span>Ejecutar Orden en Mercado</span>`;
            }
        }
    });

    /* ==========================================================================
       5. TERMINAL DE LOGS EN VIVO
       ========================================================================== */
    async function fetchLogs() {
        try {
            const res = await fetch('/api/logs');
            const data = await res.json();
            
            if (data.logs) {
                // Actualizar log en pantalla
                logsOutput.textContent = data.logs;
                
                // Hacer auto-scroll hacia abajo si el usuario no ha scrolleado arriba
                logsOutput.scrollTop = logsOutput.scrollHeight;
            } else if (data.error) {
                logsOutput.textContent = `Error del sistema: ${data.error}`;
            }
        } catch (err) {
            logsOutput.textContent = `Error de conexión con la terminal de logs.`;
        }
    }

    if (btnRefreshLogs) {
        btnRefreshLogs.addEventListener('click', () => {
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
