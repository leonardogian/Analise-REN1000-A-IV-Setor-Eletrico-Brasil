/**
 * Script para visualização no Mapa (Leaflet)
 */

document.addEventListener("DOMContentLoaded", async () => {
    // Configurações e Estado
    let dashboardData = null;
    let map = null;
    let circleMarkers = []; // Arrays para manter referências das bolhas no mapa
    let currentTileLayer = null;

    const state = {
        metric: 'valor', // 'valor', 'qtd' ou 'relacao'
        invertRatio: false, // false: R$/Qtd, true: Qtd/R$
        selectedHoldings: Array.from(window.MAJOR_HOLDINGS),
        timeline: [],
        timelineIndex: 0,
        isAccumulated: true,
        isPlaying: false,
        playbackDirection: 1, // 1 forward, -1 backward
        playbackSpeed: 300,
        playbackTimer: null,
    };

    // Cores alinhadas com o design system de app.js (COLORS Iberdrola)
    const colors = {
        neoenergia: '#00C65A', // green
        cpfl:       '#1A8FE3', // blue
        equatorial: '#FF6B1A', // orange
        enel:       '#A8D96B', // lime
        energisa:   '#8b5cf6', // purple
        cemig:      '#ec4899', // rose
        copel:      '#06b6d4', // cyan
        edp:        '#f59e0b', // amber
        celesc:     '#10b981', // emerald
        outros:     '#71717a'  // zinc-500
    };

    // Emojis/Logos de Identificação para as Holdings
    const getLogo = (file, size = "24px") => `<img src="assets/logos/${file}" style="height:${size}; width:auto; vertical-align:middle; margin-right: 6px; border-radius:4px; max-width:40px; object-fit:contain;"/>`;

    const holdingEmojis = {
        neoenergia: "⚡",
        cpfl: "🌿",
        equatorial: "☀️",
        enel: "🔴",
        energisa: "💜",
        cemig: "⛰️",
        copel: "🌲",
        edp: "🔌",
        celesc: "🌊",
        outros: "🏢"
    };

    const holdingLogos = {
        neoenergia: "neoenergia.png",
        cpfl: "cpfl.png",
        equatorial: "equatorial.png",
        enel: "enel.png",
        energisa: "energisa.png",
        cemig: "cemig.png",
        edp: "edp.png",
        celesc: "celesc.png",
        light: "light.png"
    };

    // Coordenadas das Distribuidoras (Aproximado/Capitais dos Estados de Atuação)
    const geoMap = {
        'Amazonas Energia': [-3.1190, -60.0217], // AM
        'Celesc-Dis': [-27.5954, -48.5480],      // SC
        'Cemig-D': [-19.9167, -43.9345],         // MG
        'Copel-Dis': [-25.4284, -49.2733],       // PR
        'CEA Equatorial': [0.0349, -51.0694],    // AP
        'CEEE Equatorial': [-30.0346, -51.2177], // RS
        'Equatorial AL': [-9.6662, -35.7351],    // AL
        'Equatorial MA': [-2.5307, -44.3068],    // MA
        'Equatorial PA': [-1.4550, -48.5024],    // PA
        'Equatorial PI': [-5.0892, -42.8016],    // PI
        'Energisa AC': [-9.9754, -67.8249],      // AC
        'Energisa MT': [-15.6010, -56.0974],     // MT
        'Energisa MS': [-20.4428, -54.6464],     // MS
        'Energisa Minas Rio': [-21.5312, -42.6370], // MG (Cataguases)
        'Energisa PB': [-7.1153, -34.8610],      // PB
        'Energisa RO': [-8.7612, -63.9039],      // RO
        'Energisa SE': [-10.9472, -37.0731],     // SE
        'Energisa Sul-Sudeste': [-22.1256, -51.3889], // SP (Pres. Prudente)
        'Energisa TO': [-10.2128, -48.3601],     // TO
        'Enel RJ': [-22.9068, -43.1729],         // RJ
        'Enel CE': [-3.7184, -38.5434],          // CE
        'Enel SP': [-23.5505, -46.6333],         // SP (Capital)
        'Enel GO': [-16.6869, -49.2648],         // GO
        'Neoenergia Coelba': [-12.9716, -38.5016], // BA
        'Neoenergia Pernambuco': [-8.0476, -34.8770], // PE
        'Neoenergia Cosern': [-5.7945, -35.2110],  // RN
        'Neoenergia Elektro': [-22.8808, -47.0515],// SP (Campinas Interior)
        'Neoenergia Brasília': [-15.7975, -47.8919],// DF
        'CPFL Santa Cruz': [-22.8943, -49.6385], // SP
        'CPFL Paulista': [-22.9056, -47.0608],   // SP
        'CPFL Piratininga': [-23.4988, -47.4587],// SP
        'EDP ES': [-20.3155, -40.3128],          // ES
        'EDP SP': [-23.4900, -46.2238],          // SP
        'Light': [-22.9068, -43.1729],           // RJ
        'RGE': [-29.1678, -51.1794],             // RS (Caxias)
        'Roraima Energia': [2.8235, -60.6758]    // RR
    };

    const UI = {
        metricSelect: document.getElementById('metric-select'),
        holdingSelect: document.getElementById('holding-select'),
        metricLabel: document.getElementById('current-metric-label'),
        invertRatioBtn: document.getElementById('invert-ratio-btn'),
        timelineSlider: document.getElementById('timeline-slider'),
        timelineLabel: document.getElementById('timeline-label'),
        btnPlay: document.getElementById('btn-play-timeline'),
        speedSelect: document.getElementById('speed-select'),
        accumulateToggle: document.getElementById('accumulate-toggle'),
        playIcon: document.getElementById('play-icon'),
        playText: document.getElementById('play-text')
    };

    // Inicialização
    try {
        const response = await fetch('./dashboard_transgressoes.json');
        if (!response.ok) throw new Error("Não foi possível carregar os dados.");
        dashboardData = await response.json();

        initMap();
        initTimelineData();
        initFilters();
        updateMap();
        initThemeToggle();

    } catch (error) {
        console.error("Erro ao inicializar mapa:", error);
        showError(document.getElementById('map'), 'Erro ao carregar dados do mapa: ' + error.message);
    }

    // --- Funções do Mapa ---

    function initMap() {
        // Posição inicial no centro do Brasil
        map = L.map('map', {
            zoomControl: true,
            attributionControl: false
        }).setView([-14.235, -51.925], 4);

        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        setMapTile(currentTheme);
    }

    function setMapTile(theme) {
        if (currentTileLayer) {
            map.removeLayer(currentTileLayer);
        }
        const style = theme === 'light' ? 'light_all' : 'dark_all';
        currentTileLayer = L.tileLayer(`https://{s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}{r}.png`, {
            attribution: '&copy; OpenStreetMap contributors, &copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 10,
            minZoom: 3
        }).addTo(map);
    }

    function removeMarkers() {
        circleMarkers.forEach(marker => map.removeLayer(marker));
        circleMarkers = [];
    }

    function updateMap() {
        removeMarkers();

        // Agrupar dados do series pelas distribuidoras
        const distData = {};

        // Filtrar pelas holdings selecionadas (Se vazio, não mostra nada ou mostra todas? Deixaremos mostrar nada)
        const activeHoldings = state.selectedHoldings;

        let maxValue = 0; // Para normalizar o raio depois

        // Timeline data active
        const currentPeriod = state.timeline.length > 0 ? state.timeline[state.timelineIndex] : null;

        dashboardData.series.forEach(item => {
            if (activeHoldings.length > 0 && !activeHoldings.includes(item.holding)) return;

            // Filtro Temporal
            if (currentPeriod) {
                if (state.isAccumulated) {
                    // <= atual
                    if (item.ano > currentPeriod.ano || (item.ano === currentPeriod.ano && item.mes_num > currentPeriod.mes_num)) {
                        return; // Pula os futuros
                    }
                } else {
                    // Estritamente igual
                    if (item.ano !== currentPeriod.ano || item.mes_num !== currentPeriod.mes_num) {
                        return;
                    }
                }
            }

            const distId = item.distribuidora;
            if (!geoMap[distId]) return; // Somente aquelas que temos coordenadas

            if (!distData[distId]) {
                const holdingLabel = dashboardData.groups.find(g => g.id === item.holding)?.label || item.holding;
                distData[distId] = {
                    id: distId,
                    label: item.distribuidora_label || distId,
                    holdingId: item.holding,
                    holdingLabel: holdingLabel,
                    valor: 0,
                    qtd: 0,
                    coords: geoMap[distId]
                };
            }

            distData[distId].valor += item.valor_pago;
            distData[distId].qtd += item.qtd_transgressoes;
        });

        // Loop novamente para achar o máximo
        Object.values(distData).forEach(d => {
            let val = 0;
            if (state.metric === 'valor') val = d.valor;
            else if (state.metric === 'qtd') val = d.qtd;
            else if (state.metric === 'relacao') {
                if (state.invertRatio) {
                    val = d.valor > 0 ? d.qtd / d.valor : 0;
                } else {
                    val = d.qtd > 0 ? d.valor / d.qtd : 0;
                }
            }
            if (val > maxValue) maxValue = val;
        });

        // Criar Marcadores
        Object.values(distData).forEach(d => {
            let targetVal = 0;
            if (state.metric === 'valor') targetVal = d.valor;
            else if (state.metric === 'qtd') targetVal = d.qtd;
            else if (state.metric === 'relacao') {
                if (state.invertRatio) {
                    targetVal = d.valor > 0 ? d.qtd / d.valor : 0;
                } else {
                    targetVal = d.qtd > 0 ? d.valor / d.qtd : 0;
                }
            }

            if (targetVal === 0 || maxValue === 0) return;

            // Intensidade da métrica (0 até 1)
            const intensity = targetVal / maxValue;

            // Raio proporcional dinâmico (com min/max scale)
            // Agora usando L.circle (escala em Metros na geografia real) -> Ajusta com o Zoom magicamente
            const maxRadius = 800000; // 800 km raio max
            const minRadius = 120000;  // 120 km raio min
            let radius = Math.sqrt(intensity) * maxRadius;
            if (radius < minRadius) radius = minRadius;

            // Radar de Cor (Heatmap color scale: Verde->Amarelo->Vermelho baseado na severidade)
            // Matiz 120 é verde, 0 é vermelho.
            const hue = (1 - intensity) * 120;
            const color = `hsl(${Math.round(hue)}, 90%, 55%)`; // Cor do radar de calor

            const logoFile = holdingLogos[d.holdingId];
            const logoHtml = logoFile ? getLogo(logoFile, "24px") : `<span style="display:inline-block; margin-right: 6px; vertical-align:middle;">${holdingEmojis[d.holdingId] || holdingEmojis['outros']}</span>`;

            // Tooltip Labels: Mostramos sempre Valores Monetários e Qtde.
            const valStr = fmtMoneyFull(d.valor);
            const qtdStr = fmtNum(d.qtd, 0);

            let formattedVal = '';
            let metricNameForTooltip = '';

            if (state.metric === 'relacao') {
                metricNameForTooltip = state.invertRatio ? 'Transgressões por R$' : 'Média R$ por Transgressão';
                formattedVal = state.invertRatio
                    ? fmtNum(targetVal, 6) + ' qtd/R$'
                    : fmtMoneyFull(targetVal) + ' / qtd';
            }

            const popupContent = `
                <div class="custom-popup" style="font-family: 'Inter', sans-serif; min-width: 220px; padding: 4px; background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(16px); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);">
                    <div class="popup-title" style="color: ${color}; text-shadow: 0px 0px 8px ${color}80; font-size: 1.1rem; font-weight: 700; margin-bottom: 2px;">
                        ${logoHtml}
                        <span style="vertical-align:middle;">${escapeHtml(d.label)}</span>
                    </div>
                    <div class="popup-meta" style="color: #cbd5e1; font-size: 0.85rem; padding-left: 2px;">Grupo: <span style="font-weight: 600;">${escapeHtml(d.holdingLabel)}</span></div>
                    <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.1); margin: 10px 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <div style="font-size: 0.85rem; color: #94a3b8;">💰 Financeiro</div>
                        <div style="font-weight: 700; color: #fff; font-family: 'Outfit', sans-serif; font-size: 0.95rem;">${valStr}</div>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="font-size: 0.85rem; color: #94a3b8;">📄 Volume</div>
                        <div style="font-weight: 700; color: #fff; font-family: 'Outfit', sans-serif; font-size: 0.95rem;">${qtdStr}</div>
                    </div>
                    ${state.metric === 'relacao' ? `<hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.1); margin: 10px 0;"><div style="display: flex; justify-content: space-between; align-items: center;"><div style="font-size: 0.85rem; color: #94a3b8;">⚖️ ${metricNameForTooltip}</div><div style="font-weight: 700; color: #00f0ff; font-family: 'Outfit', sans-serif; font-size: 0.95rem; text-shadow: 0 0 5px rgba(0, 240, 255, 0.3);">${formattedVal}</div></div>` : ''}
                </div>
            `;

            // L.circle no lugar de L.circleMarker para mapeamento em metros
            const marker = L.circle(d.coords, {
                radius: radius,
                fillColor: color,
                color: '#ffffff',
                weight: 1.5,
                opacity: 0.8,
                fillOpacity: 0.55
            }).addTo(map);

            marker.bindPopup(popupContent);

            // Adiciona logo ou emoji centralizado
            const centerIconHtml = logoFile
                ? `<div style="text-align: center; line-height: 1;"><img src="assets/logos/${logoFile}" style="width: 36px; height: 36px; object-fit: contain; filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.5)); border-radius: 50%; background: rgba(255,255,255,0.8); padding: 2px;" /></div>`
                : `<div style="font-size: 1.6rem; text-align: center; line-height: 1; filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.5));">${holdingEmojis[d.holdingId] || holdingEmojis['outros']}</div>`;

            const iconMarker = L.marker(d.coords, {
                icon: L.divIcon({
                    className: 'emoji-marker',
                    html: centerIconHtml,
                    iconSize: [40, 40],
                    iconAnchor: [20, 20]
                }),
                interactive: false // Não bloqueia o hover e clique da bolha
            }).addTo(map);

            // Hover states
            marker.on('mouseover', function (e) {
                this.setStyle({ fillOpacity: 0.8, weight: 3, color: '#fff' });
            });
            marker.on('mouseout', function (e) {
                this.setStyle({ fillOpacity: 0.55, weight: 1, color: color });
            });

            // Click to toggle holding filter
            const onClickHandler = function(e) {
                const holdingId = d.holdingId;
                if (state.selectedHoldings.includes(holdingId)) {
                    state.selectedHoldings = state.selectedHoldings.filter(h => h !== holdingId);
                } else {
                    state.selectedHoldings.push(holdingId);
                }
                
                Array.from(UI.holdingSelect.options).forEach(opt => {
                    opt.selected = state.selectedHoldings.includes(opt.value);
                });
                
                if (window.dashboardFilters) {
                    window.dashboardFilters.grupos = new Set(state.selectedHoldings);
                    if (window.saveFilters) window.saveFilters();
                    if (window.dispatchFilterChange) window.dispatchFilterChange();
                }
                updateMap();
            };

            marker.on('click', onClickHandler);
            iconMarker.on('click', onClickHandler);

            circleMarkers.push(marker);
            circleMarkers.push(iconMarker);
        });

        // Update coverage badge
        const totalDists = new Set(dashboardData.series
            .filter(item => activeHoldings.length === 0 || activeHoldings.includes(item.holding))
            .map(item => item.distribuidora)).size;
        const mappedDists = Object.keys(distData).length;
        const badgeEl = document.getElementById('map-coverage-badge');
        if (badgeEl) {
            if (totalDists > mappedDists) {
                badgeEl.textContent = `Exibindo ${mappedDists} de ${totalDists} distribuidoras mapeadas`;
            } else {
                badgeEl.textContent = `Exibindo ${mappedDists} distribuidoras`;
            }
        }
    }

    // --- Tabela de Pequenos (cooperativas sem mapa) ---
    function updatePequenosTable() {
        const container = document.getElementById('pequenos-container');
        const wrapper = document.getElementById('pequenos-table-wrapper');
        if (!container || !wrapper) return;

        const category = window.dashboardFilters ? window.dashboardFilters.category : 'holdings';

        // Show table only when "pequenos" or "all" tab is active
        if (category === 'holdings') {
            container.style.display = 'none';
            return;
        }

        // Aggregate data for selected pequenos that have no geoMap coordinates
        const activeHoldings = state.selectedHoldings;
        const pequenoData = {};

        dashboardData.series.forEach(item => {
            if (activeHoldings.length > 0 && !activeHoldings.includes(item.holding)) return;
            // Only show distributors WITHOUT coordinates
            if (geoMap[item.distribuidora]) return;

            const distId = item.distribuidora;
            if (!pequenoData[distId]) {
                const holdingLabel = dashboardData.groups.find(g => g.id === item.holding)?.label || item.holding;
                pequenoData[distId] = {
                    label: item.distribuidora_label || distId,
                    holding: holdingLabel,
                    valor: 0,
                    qtd: 0
                };
            }
            pequenoData[distId].valor += item.valor_pago;
            pequenoData[distId].qtd += item.qtd_transgressoes;
        });

        const rows = Object.values(pequenoData).sort((a, b) => b.valor - a.valor);

        if (rows.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        wrapper.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Distribuidora</th>
                        <th>Grupo</th>
                        <th style="text-align:right">Compensações (R$)</th>
                        <th style="text-align:right">Transgressões</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(r => `
                        <tr>
                            <td>${escapeHtml(r.label)}</td>
                            <td>${escapeHtml(r.holding)}</td>
                            <td style="text-align:right">${fmtMoneyFull(r.valor)}</td>
                            <td style="text-align:right">${fmtNum(r.qtd, 0)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    // --- Funções de Filtro ---

    function initFilters() {
        // 1. Popular Holdings via buildGroupTabs
        const tabsEl = document.getElementById('group-tabs');
        const allGroups = dashboardData.groups.map(g => ({ id: g.id, label: g.label }));

        if (tabsEl && window.buildGroupTabs) {
            window.buildGroupTabs(tabsEl, UI.holdingSelect, allGroups, {
                onPopulate: function (filtered) {
                    state.selectedHoldings = filtered
                        .filter(g => window.dashboardFilters.grupos.has(g.id))
                        .map(g => g.id);
                    if (state.selectedHoldings.length === 0) {
                        state.selectedHoldings = filtered.map(g => g.id);
                    }
                    updateMap();
                    updatePequenosTable();
                }
            });
        }

        UI.holdingSelect.addEventListener('change', (e) => {
            const selected = Array.from(e.target.selectedOptions).map(opt => opt.value);
            state.selectedHoldings = selected;
            if (window.dashboardFilters) {
                window.dashboardFilters.grupos = new Set(state.selectedHoldings);
                if (window.saveFilters) window.saveFilters();
            }
            updateMap();
            updatePequenosTable();
        });

        // 2. Metrica
        UI.metricSelect.addEventListener('change', (e) => {
            state.metric = e.target.value;

            if (state.metric === 'relacao') {
                UI.invertRatioBtn.style.display = 'block';
                UI.metricLabel.textContent = state.invertRatio ? "Qtd / Valor (R$)" : "Valor (R$) / Qtd";
            } else {
                UI.invertRatioBtn.style.display = 'none';
                UI.metricLabel.textContent = state.metric === 'valor' ? "Valor (R$)" : "Qtd. Transgressões";
            }
            updateMap();
        });

        // 3. Botão Inverter Relação
        UI.invertRatioBtn.addEventListener('click', () => {
            state.invertRatio = !state.invertRatio;
            UI.invertRatioBtn.textContent = state.invertRatio ? "Inverter (R$ / Qtd)" : "Inverter (Qtd / R$)";
            if (state.metric === 'relacao') {
                UI.metricLabel.textContent = state.invertRatio ? "Qtd / Valor (R$)" : "Valor (R$) / Qtd";
                updateMap();
            }
        });

        // 4. Configurar Linha do Tempo
        if (state.timeline.length > 0) {
            UI.timelineSlider.max = state.timeline.length - 1;
            UI.timelineSlider.value = state.timelineIndex;
            updateTimelineLabel();

            UI.timelineSlider.addEventListener('input', (e) => {
                state.timelineIndex = parseInt(e.target.value, 10);
                updateTimelineLabel();
                updateMap();
            });

            UI.accumulateToggle.addEventListener('change', (e) => {
                state.isAccumulated = e.target.checked;
                updateMap();
            });

            UI.speedSelect.addEventListener('change', (e) => {
                state.playbackSpeed = parseInt(e.target.value, 10);
                if (state.isPlaying) {
                    // Restart timer with new speed
                    clearInterval(state.playbackTimer);
                    startPlaybackTimer();
                }
            });

            UI.btnPlay.addEventListener('click', () => {
                state.isPlaying = !state.isPlaying;
                if (state.isPlaying) {
                    UI.playIcon.textContent = "⏸️";
                    UI.playText.textContent = "Pause";

                    // Se estive no final e tava indo pra frente, inverte
                    if (state.timelineIndex >= state.timeline.length - 1 && state.playbackDirection === 1) {
                        state.playbackDirection = -1;
                    }
                    startPlaybackTimer();
                } else {
                    pausePlayback();
                }
            });
        }
    }

    function initTimelineData() {
        const uniquePeriods = {};
        dashboardData.series.forEach(item => {
            const key = `${item.ano}-${String(item.mes_num).padStart(2, '0')}`;
            if (!uniquePeriods[key]) {
                uniquePeriods[key] = {
                    ano: item.ano,
                    mes_num: item.mes_num,
                    label: item.mes
                };
            }
        });

        // Ordenar cronologicamente
        state.timeline = Object.keys(uniquePeriods).sort().map(k => uniquePeriods[k]);

        // Iniciar no último mês habilitado
        if (state.timeline.length > 0) {
            state.timelineIndex = state.timeline.length - 1;
        }
    }

    function updateTimelineLabel() {
        if (!state.timeline[state.timelineIndex]) return;
        const period = state.timeline[state.timelineIndex];
        UI.timelineLabel.textContent = period.label;
    }

    function startPlaybackTimer() {
        state.playbackTimer = setInterval(() => {
            state.timelineIndex += state.playbackDirection;

            // Ping Pong: bate no final, volta. Bate no começo, avança.
            if (state.timelineIndex >= state.timeline.length - 1) {
                state.timelineIndex = state.timeline.length - 1;
                state.playbackDirection = -1;
            } else if (state.timelineIndex <= 0) {
                state.timelineIndex = 0;
                state.playbackDirection = 1;
            }

            UI.timelineSlider.value = state.timelineIndex;
            updateTimelineLabel();
            updateMap();
        }, state.playbackSpeed);
    }

    function pausePlayback() {
        UI.playIcon.textContent = "▶️";
        UI.playText.textContent = "Play";
        clearInterval(state.playbackTimer);
        state.isPlaying = false;
    }

    // --- Integração com filtro global (filters.js) ---
    // O mapa usa timeline própria (slider mês/ano). O evento filters:change carrega
    // o período global ('all' | 'pre_2022' | 'pos_2022') e sincroniza o timelineIndex
    // para o último mês do período selecionado, disparando um re-render.
    window.addEventListener('filters:change', function (e) {
        const period = (e.detail && e.detail.period) ? e.detail.period : 'all';

        if (!state.timeline || state.timeline.length === 0) {
            console.info('[mapa] filters:change recebido (period=' + period + '), timeline ainda não inicializada.');
            return;
        }

        let targetIndex = state.timeline.length - 1; // padrão: último mês (all)

        if (period === 'pre_2022') {
            // Último mês anterior a 2022
            const lastPre = state.timeline.reduce((best, t, idx) => {
                return t.ano < 2022 ? idx : best;
            }, -1);
            if (lastPre >= 0) targetIndex = lastPre;
        } else if (period === 'pos_2022') {
            // Primeiro mês a partir de 2022 (janeiro/2022 em diante → mantém último)
            const firstPos = state.timeline.findIndex(t => t.ano >= 2022);
            if (firstPos >= 0) targetIndex = state.timeline.length - 1;
        }
        // 'all' → usa o último mês (já definido como padrão acima)

        if (state.timelineIndex !== targetIndex) {
            state.timelineIndex = targetIndex;
            if (UI.timelineSlider) UI.timelineSlider.value = targetIndex;
            updateTimelineLabel();
            updateMap();
            console.info('[mapa] filters:change aplicado: period=' + period + ', timelineIndex=' + targetIndex);
        } else {
            console.info('[mapa] filters:change recebido: period=' + period + ' (sem alteração de índice)');
        }

        if (e.detail && e.detail.grupos) {
            if (e.detail.grupos.size > 0) {
                state.selectedHoldings = Array.from(e.detail.grupos);
            } else {
                state.selectedHoldings = Array.from(window.MAJOR_HOLDINGS);
            }
            if (UI.holdingSelect) {
                Array.from(UI.holdingSelect.options).forEach(opt => {
                    opt.selected = state.selectedHoldings.includes(opt.value);
                });
            }
            updateMap();
            updatePequenosTable();
        }
    });

    // --- Tema ---
    function initThemeToggle() {
        // Load saved theme initially
        const savedTheme = localStorage.getItem('theme') || 'dark';
        if (savedTheme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
            if (map && !currentTileLayer) {
                // Failsafe in case initMap was delayed
                setMapTile('light');
            }
        }

        const toggleBtn = document.getElementById('theme-toggle');
        if (!toggleBtn) return;

        const icon = toggleBtn.querySelector('.icon');
        if (icon) {
            icon.textContent = document.documentElement.getAttribute('data-theme') === 'light' ? '☀️' : '🌙';
        }

        toggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';

            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);

            if (icon) icon.textContent = newTheme === 'light' ? '☀️' : '🌙';

            // Switch map tiles
            if (map) {
                setMapTile(newTheme);
            }
        });
    }

});
