// BTP Dashboard Logic - V1.4.2
// --- App State ---
let portfolio = [];
let analysis = [];
let portfolioHistory = [];
let distributionChart = null;
let performanceChart = null;
let mainAreaChart = null;
let valuationBarChart = null;

// --- DOM Elements ---
const addStockForm = document.getElementById('addStockForm');
const tableBody = document.getElementById('tableBody');
const analysisTableBody = document.getElementById('analysisTableBody');

const totalCostEl = document.getElementById('totalCost');
const currentValueEl = document.getElementById('currentValue');
const totalProfitEl = document.getElementById('totalProfit');
const totalProfitPercentEl = document.getElementById('totalProfitPercent');

const editModal = document.getElementById('editModal');
const editStockForm = document.getElementById('editStockForm');
const syncModal = document.getElementById('syncModal');
const analysisModal = document.getElementById('analysisModal');

// --- Utility Functions ---
const formatCurrency = (val) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
const formatPercent = (val) => {
    const res = (val / 100).toLocaleString('tr-TR', { style: 'percent', minimumFractionDigits: 2 });
    return (val >= 0 ? '+' : '') + res;
};
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

// --- Storage ---
const saveToLocalStorage = () => {
    localStorage.setItem('portfolio_premium', JSON.stringify(portfolio));
    localStorage.setItem('analysis_v1', JSON.stringify(analysis));
    localStorage.setItem('history_v1', JSON.stringify(portfolioHistory));
    updateCharts();
};

const loadFromLocalStorage = () => {
    const pData = localStorage.getItem('portfolio_premium') || localStorage.getItem('portfolio');
    if (pData) { try { portfolio = JSON.parse(pData); } catch (e) { portfolio = []; } }

    const aData = localStorage.getItem('analysis_v1');
    if (aData) { try { analysis = JSON.parse(aData); } catch (e) { analysis = []; } }

    const hData = localStorage.getItem('history_v1');
    if (hData) { try { portfolioHistory = JSON.parse(hData); } catch (e) { portfolioHistory = []; } }

    trackDailyValue();
    renderTable();
    renderAnalysisTable();
    renderAssetMiniList();
    updateCharts();
};

const trackDailyValue = () => {
    const { currentTotal } = calculateProjectionData();
    if (currentTotal === 0) return;
    
    const today = new Date().toLocaleDateString('tr-TR');
    const existingIndex = portfolioHistory.findIndex(h => h.date === today);
    
    if (existingIndex !== -1) {
        portfolioHistory[existingIndex].value = currentTotal;
    } else {
        portfolioHistory.push({ date: today, value: currentTotal });
    }
    
    // Keep last 30 snapshots
    if (portfolioHistory.length > 30) portfolioHistory.shift();
    localStorage.setItem('history_v1', JSON.stringify(portfolioHistory));
};

// --- Core Logic ---
const calculateRiskScore = () => {
    const scoreValEl = document.getElementById('riskScoreValue');
    const scoreStatusEl = document.getElementById('riskScoreStatus');
    const aiSummaryEl = document.getElementById('riskAiSummary');
    
    if (!portfolio || portfolio.length === 0) {
        if (scoreValEl) scoreValEl.textContent = '0';
        if (scoreStatusEl) scoreStatusEl.textContent = 'Veri Yok';
        if (aiSummaryEl) aiSummaryEl.textContent = 'Analiz için portföyünüze hisse ekleyin.';
        return;
    }

    const BIST30 = ['THYAO', 'EREGL', 'SASA', 'ASELS', 'KCHOL', 'TUPRS', 'SISE', 'BIMAS', 'AKBNK', 'ISCTR', 'YKBNK', 'GARAN', 'ARCLK', 'FROTO', 'TOASO', 'TCELL', 'PETKM', 'HEKTS', 'PGSUS', 'KOZAL', 'KOZAA', 'KRDMD', 'EKGYO', 'HALKB', 'VAKBN', 'ENKAI', 'SAHOL', 'GUBRF', 'ODAS', 'ALARK'];
    
    const SECTORS = {
        'THYAO': 'Ulaşım', 'PGSUS': 'Ulaşım', 'TAVHL': 'Ulaşım',
        'EREGL': 'Metal', 'KRDMD': 'Metal', 'ISDMR': 'Metal',
        'SASA': 'Kimya', 'HEKTS': 'Kimya', 'PETKM': 'Kimya', 'GUBRF': 'Kimya',
        'AKBNK': 'Banka', 'ISCTR': 'Banka', 'YKBNK': 'Banka', 'GARAN': 'Banka', 'HALKB': 'Banka', 'VAKBN': 'Banka',
        'KCHOL': 'Holding', 'SAHOL': 'Holding', 'ALARK': 'Holding', 'AGHOL': 'Holding',
        'ASELS': 'Savunma', 'SDTTR': 'Savunma',
        'TUPRS': 'Enerji', 'ENJSA': 'Enerji', 'ODAS': 'Enerji', 'ZOREN': 'Enerji', 'ASTOR': 'Enerji',
        'BIMAS': 'Perakende', 'MGROS': 'Perakende', 'SOKM': 'Perakende',
        'FROTO': 'Otomotiv', 'TOASO': 'Otomotiv', 'DOAS': 'Otomotiv',
        'TCELL': 'Teknoloji', 'TTKOM': 'Teknoloji', 'MIATK': 'Teknoloji', 'KONTROL': 'Teknoloji'
    };

    let totalVal = 0;
    const weights = {};
    const sectorWeights = {};
    let nonBist30Weight = 0;

    portfolio.forEach(s => {
        const val = parseFloat(s.lots) * parseFloat(s.currentPrice);
        totalVal += val;
        weights[s.ticker] = (weights[s.ticker] || 0) + val;
        
        const sector = SECTORS[s.ticker] || 'Diğer';
        sectorWeights[sector] = (sectorWeights[sector] || 0) + val;
        
        if (!BIST30.includes(s.ticker)) nonBist30Weight += val;
    });

    // 1. Concentration Risk (Max 35 points)
    const maxWeight = Math.max(...Object.values(weights)) / totalVal;
    let concentrationRisk = maxWeight > 0.4 ? 35 : (maxWeight > 0.25 ? 20 : 5);

    // 2. Sector Risk (Max 35 points)
    const maxSectorWeight = Math.max(...Object.values(sectorWeights)) / totalVal;
    let sectorRisk = maxSectorWeight > 0.6 ? 35 : (maxSectorWeight > 0.4 ? 20 : 5);

    // 3. Volatility Risk (BIST30 weight) (Max 30 points)
    const nonBistRatio = nonBist30Weight / totalVal;
    let volaRisk = nonBistRatio > 0.5 ? 30 : (nonBistRatio > 0.2 ? 15 : 5);

    const totalScore = concentrationRisk + sectorRisk + volaRisk;
    
    // UI Update
    if (scoreValEl) {
        scoreValEl.textContent = totalScore;
        scoreValEl.className = `stat-value ${totalScore > 70 ? 'danger' : (totalScore > 40 ? 'warning' : 'success')}`;
    }
    
    if (scoreStatusEl) {
        scoreStatusEl.textContent = totalScore > 70 ? 'Yüksek Risk' : (totalScore > 40 ? 'Orta Risk' : 'Düşük Risk');
        scoreStatusEl.className = `stat-sub ${totalScore > 70 ? 'danger' : (totalScore > 40 ? 'warning' : 'success')}`;
    }

    // AI Summary
    let summary = "";
    if (totalScore <= 40) {
        summary = "Portföyünüz dengeli ve sağlıklı görünüyor. Mevcut yapıyı koruyabilirsiniz.";
    } else {
        if (concentrationRisk >= 20) summary += "Tek hisse ağırlığınız yüksek, çeşitlendirme yapın. ";
        if (sectorRisk >= 20) summary += "Sektörel yoğunlaşma var, farklı alanlara odaklanın. ";
        if (volaRisk >= 20) summary += "BIST 30 dışı ağırlığınız fazla, volatiliteye dikkat.";
    }
    
    if (aiSummaryEl) aiSummaryEl.textContent = "AI Analizi: " + summary;
};

const calculateTotals = () => {
    let cost = 0, current = 0;
    portfolio.forEach(s => { 
        cost += (parseFloat(s.lots) * parseFloat(s.avgCost)); 
        current += (parseFloat(s.lots) * parseFloat(s.currentPrice)); 
    });
    const profit = current - cost;
    const percent = cost > 0 ? (profit / cost) * 100 : 0;

    if (currentValueEl) currentValueEl.textContent = formatCurrency(current);
    if (totalCostEl) totalCostEl.textContent = formatCurrency(cost);
    
    if (totalProfitEl) {
        totalProfitEl.textContent = formatCurrency(profit);
        totalProfitEl.className = `stat-value ${profit >= 0 ? 'success' : 'danger'}`;
        
        // Also update dashboard chart header
        const chartProfitEl = document.querySelector('.chart-total-profit');
        if (chartProfitEl) {
            chartProfitEl.textContent = (profit >= 0 ? '+' : '') + formatCurrency(profit);
            chartProfitEl.className = `chart-total-profit ${profit >= 0 ? 'success' : 'danger'}`;
        }
    }
    
    if (totalProfitPercentEl) {
        totalProfitPercentEl.textContent = formatPercent(percent);
        totalProfitPercentEl.className = `stat-sub ${profit >= 0 ? 'success' : 'danger'}`;

        const chartPercentEl = document.querySelector('.chart-total-percent');
        if (chartPercentEl) {
            chartPercentEl.textContent = formatPercent(percent);
            chartPercentEl.className = `chart-total-percent ${profit >= 0 ? 'success' : 'danger'}`;
        }
    }
    
    calculateRiskScore();
};

const renderTable = () => {
    if (!tableBody) return;
    tableBody.innerHTML = '';
    portfolio.forEach((s) => {
        const val = parseFloat(s.lots) * parseFloat(s.currentPrice);
        const prof = val - (parseFloat(s.lots) * parseFloat(s.avgCost));
        const pPer = (parseFloat(s.lots) * parseFloat(s.avgCost)) > 0 ? (prof / (parseFloat(s.lots) * parseFloat(s.avgCost)) * 100) : 0;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong style="color:var(--accent);">${s.ticker.toUpperCase()}</strong></td>
            <td>${s.lots}</td>
            <td>${formatCurrency(s.avgCost)}</td>
            <td>${formatCurrency(s.currentPrice)}</td>
            <td style="font-weight:600;">${formatCurrency(val)}</td>
            <td class="${prof >= 0 ? 'success' : 'danger'}">${prof >= 0 ? '+' : ''}${formatCurrency(prof)}</td>
            <td class="${prof >= 0 ? 'success' : 'danger'}">${prof >= 0 ? '▲' : '▼'} ${Math.abs(pPer).toFixed(2)}%</td>
            <td style="text-align:right;">
                <button class="icon-btn mini" onclick="openEditModal('${s.id}')"><i class="fa-solid fa-pen"></i></button>
                <button class="icon-btn mini" onclick="deleteStock('${s.id}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tableBody.appendChild(row);
    });
    calculateTotals();
    updateCharts();
    renderAssetMiniList();
};

const renderAssetMiniList = () => {
    const listEl = document.getElementById('assetMiniList');
    if (!listEl) return;
    
    // Hard clear
    listEl.innerHTML = '';
    
    // Sort and slice to EXACTLY 3
    const sorted = [...portfolio].sort((a, b) => {
        const valA = parseFloat(a.lots) * parseFloat(a.currentPrice);
        const valB = parseFloat(b.lots) * parseFloat(b.currentPrice);
        return valB - valA;
    });
    
    const top3 = sorted.slice(0, 3);
    
    top3.forEach(s => {
        const currentVal = parseFloat(s.lots) * parseFloat(s.currentPrice);
        const costVal = parseFloat(s.lots) * parseFloat(s.avgCost);
        const prof = costVal > 0 ? ((currentVal - costVal) / costVal * 100) : 0;
        
        const item = document.createElement('div');
        item.className = 'asset-item';
        item.innerHTML = `
            <div class="asset-icon">${s.ticker.substring(0, 2).toUpperCase()}</div>
            <div class="asset-info">
                <div class="asset-name">${s.ticker.toUpperCase()}</div>
                <div class="asset-count">${s.lots} Adet</div>
            </div>
            <div class="asset-price-box">
                <div class="asset-price">${formatCurrency(currentVal)}</div>
                <div class="asset-change ${prof >= 0 ? 'success' : 'danger'}">${prof >= 0 ? '+' : ''}${prof.toFixed(1)}%</div>
            </div>
        `;
        listEl.appendChild(item);
    });
};

window.openAllAssetsModal = () => {
    console.log("Opening All Assets Modal...");
    const listEl = document.getElementById('allAssetsList');
    const modal = document.getElementById('allAssetsModal');
    if (!listEl || !modal) return;
    
    listEl.innerHTML = '';

    const sorted = [...portfolio].sort((a, b) => {
        const valA = parseFloat(a.lots) * parseFloat(a.currentPrice);
        const valB = parseFloat(b.lots) * parseFloat(b.currentPrice);
        return valB - valA;
    });

    sorted.forEach(s => {
        const currentVal = parseFloat(s.lots) * parseFloat(s.currentPrice);
        const costVal = parseFloat(s.lots) * parseFloat(s.avgCost);
        const prof = costVal > 0 ? ((currentVal - costVal) / costVal * 100) : 0;

        const item = document.createElement('div');
        item.className = 'asset-item';
        item.style.marginBottom = "15px";
        item.innerHTML = `
            <div class="asset-icon">${s.ticker.substring(0, 2).toUpperCase()}</div>
            <div class="asset-info">
                <div class="asset-name">${s.ticker.toUpperCase()}</div>
                <div class="asset-count">${s.lots} Adet</div>
            </div>
            <div class="asset-price-box">
                <div class="asset-price">${formatCurrency(currentVal)}</div>
                <div class="asset-change ${prof >= 0 ? 'success' : 'danger'}">${prof >= 0 ? '+' : ''}${prof.toFixed(1)}%</div>
            </div>
        `;
        listEl.appendChild(item);
    });

    modal.classList.add('show');
};

const renderAnalysisTable = () => {
    if (!analysisTableBody) return;
    analysisTableBody.innerHTML = '';
    analysis.forEach(a => {
        const pot = ((parseFloat(a.targetPrice) / parseFloat(a.currentPrice)) - 1) * 100;
        const totalPuan = (parseFloat(a.balance) + parseFloat(a.debt) + parseFloat(a.story) + parseFloat(a.margin)).toFixed(1);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong style="color:var(--accent);">${a.ticker.toUpperCase()}</strong></td>
            <td><span style="font-size:0.85rem; color:var(--text-muted);">${a.sector}</span></td>
            <td class="success">%${pot.toFixed(1)}</td>
            <td class="success">%${(100 - (a.currentPrice/a.targetPrice*100)).toFixed(1)}</td>
            <td>${formatCurrency(a.currentPrice)}</td>
            <td style="color:var(--accent); font-weight:600;">${formatCurrency(a.targetPrice)}</td>
            <td><span class="badge ${totalPuan >= 2 ? 'success' : 'danger'}">${totalPuan}</span></td>
            <td style="text-align:right;">
                <button class="icon-btn mini" onclick="openEditAnalysis('${a.id}')"><i class="fa-solid fa-pen"></i></button>
                <button class="icon-btn mini" onclick="deleteAnalysis('${a.id}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        analysisTableBody.appendChild(row);
    });
};

// --- Charts ---
const initCharts = () => {
    Chart.defaults.color = '#64748b';
    Chart.defaults.font.family = "'Inter', sans-serif";

    // Main Area Chart
    const mainCtx = document.getElementById('mainAreaChart')?.getContext('2d');
    if (mainCtx) {
        const gradient = mainCtx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(0, 200, 83, 0.2)');
        gradient.addColorStop(1, 'rgba(0, 200, 83, 0)');

        mainAreaChart = new Chart(mainCtx, {
            type: 'line',
            data: {
                labels: ['1 Nis', '5 Nis', '10 Nis', '15 Nis', '20 Nis', '25 Nis', 'Bugün'],
                datasets: [{
                    label: 'Net Kar',
                    data: [1000, 1200, 1100, 1400, 1350, 1600, 1800],
                    borderColor: '#00c853',
                    borderWidth: 3,
                    fill: true,
                    backgroundColor: gradient,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: '#00c853',
                    pointHoverBorderColor: '#fff',
                    pointHoverBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                hover: {
                    mode: 'index',
                    intersect: false
                },
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(17, 18, 22, 0.95)',
                        titleColor: '#94a3b8',
                        bodyColor: '#ffffff',
                        bodyFont: { weight: '600', size: 14 },
                        padding: 12,
                        cornerRadius: 10,
                        displayColors: false,
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        callbacks: {
                            label: (context) => 'Net Kâr/Zarar: ' + formatCurrency(context.raw)
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false }, border: { display: false } },
                    y: { grid: { color: 'rgba(255,255,255,0.03)' }, border: { display: false }, ticks: { display: false } }
                }
            },
            plugins: [{
                id: 'crosshairLine',
                afterDraw: (chart) => {
                    if (chart.tooltip?._active?.length) {
                        const activePoint = chart.tooltip._active[0];
                        const ctx = chart.ctx;
                        const x = activePoint.element.x;
                        const topY = chart.scales.y.top;
                        const bottomY = chart.scales.y.bottom;

                        ctx.save();
                        ctx.beginPath();
                        ctx.moveTo(x, topY);
                        ctx.lineTo(x, bottomY);
                        ctx.lineWidth = 1;
                        ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
                        ctx.setLineDash([5, 5]);
                        ctx.stroke();
                        ctx.restore();
                    }
                }
            }]
        });
    }

    // Distribution Chart (Donut)
    const distCtx = document.getElementById('distributionChart')?.getContext('2d');
    if (distCtx) {
        distributionChart = new Chart(distCtx, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: ['#d4af37', '#64748b', '#ffb74d', '#00c853', '#ff5252'],
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                plugins: { legend: { display: false } }
            }
        });
    }

    // Valuation Bar Chart
    const valCtx = document.getElementById('valuationBarChart')?.getContext('2d');
    if (valCtx) {
        valuationBarChart = new Chart(valCtx, {
            type: 'bar',
            data: {
                labels: ['THYAO', 'SASA', 'EREGL', 'ASELS'],
                datasets: [
                    { label: 'Hedef Fiyat', data: [], backgroundColor: '#ffffff', borderRadius: 4 },
                    { label: 'Güncel Fiyat', data: [], backgroundColor: '#64748b', borderRadius: 4 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false } },
                    y: { grid: { color: 'rgba(255,255,255,0.03)' } }
                }
            }
        });
    }

    // Performance Chart
    const perfCtx = document.getElementById('performanceChart')?.getContext('2d');
    if (perfCtx) {
        performanceChart = new Chart(perfCtx, {
            type: 'line',
            data: {
                labels: ['Başlangıç', 'Vade 1', 'Vade 2', 'Vade 3', 'Hedef'],
                datasets: [
                    { 
                        label: 'Mevcut Değer', 
                        data: [], 
                        borderColor: '#d4af37', 
                        borderWidth: 3, 
                        tension: 0.4, 
                        pointRadius: 4, 
                        pointBackgroundColor: '#d4af37',
                        fill: false
                    },
                    { 
                        label: 'AI Hedeflenen Değer', 
                        data: [], 
                        borderColor: 'rgba(255,255,255,0.2)', 
                        borderWidth: 2, 
                        borderDash: [5, 5],
                        tension: 0.4, 
                        pointRadius: 0,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(17, 18, 22, 0.95)',
                        callbacks: {
                            label: (context) => context.dataset.label + ': ' + formatCurrency(context.raw)
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false }, border: { display: false } },
                    y: { grid: { color: 'rgba(255,255,255,0.03)' }, border: { display: false }, ticks: { callback: v => formatCurrency(v) } }
                }
            },
            plugins: [{
                id: 'crosshairLine',
                afterDraw: (chart) => {
                    if (chart.tooltip?._active?.length) {
                        const activePoint = chart.tooltip._active[0];
                        const ctx = chart.ctx;
                        const x = activePoint.element.x;
                        const topY = chart.scales.y.top;
                        const bottomY = chart.scales.y.bottom;
                        ctx.save();
                        ctx.beginPath();
                        ctx.moveTo(x, topY);
                        ctx.lineTo(x, bottomY);
                        ctx.lineWidth = 1;
                        ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
                        ctx.setLineDash([5, 5]);
                        ctx.stroke();
                        ctx.restore();
                    }
                }
            }]
        });
    }
};

const updateCharts = () => {
    const { currentTotal, targetTotal } = calculateProjectionData();

    if (distributionChart) {
        const sorted = [...portfolio].sort((a, b) => (parseFloat(b.lots) * parseFloat(b.currentPrice)) - (parseFloat(a.lots) * parseFloat(a.currentPrice)));
        distributionChart.data.labels = sorted.map(s => s.ticker.toUpperCase());
        distributionChart.data.datasets[0].data = sorted.map(s => parseFloat(s.lots) * parseFloat(s.currentPrice));
        distributionChart.update();
    }
    
    if (mainAreaChart && portfolio.length > 0) {
        const baseData = [currentTotal * 0.85, currentTotal * 0.9, currentTotal * 0.88, currentTotal * 0.95, currentTotal * 0.92, currentTotal * 0.98, currentTotal];
        mainAreaChart.data.datasets[0].data = baseData;
        mainAreaChart.update();
    }

    if (valuationBarChart && analysis.length > 0) {
        const sorted = [...analysis].sort((a, b) => parseFloat(b.targetPrice) - parseFloat(a.targetPrice)).slice(0, 5);
        valuationBarChart.data.labels = sorted.map(a => a.ticker.toUpperCase());
        valuationBarChart.data.datasets[0].data = sorted.map(a => parseFloat(a.targetPrice));
        valuationBarChart.data.datasets[1].data = sorted.map(a => parseFloat(a.currentPrice));
        valuationBarChart.update();
    }

    if (performanceChart && portfolio.length > 0) {
        // Simple projection simulation
        const steps = 5;
        const currentData = [];
        const targetData = [];
        
        for(let i=0; i<steps; i++) {
            const ratio = i / (steps - 1);
            currentData.push(currentTotal * (0.95 + (Math.random() * 0.1))); // Simulate recent volatility
            targetData.push(currentTotal + (targetTotal - currentTotal) * ratio);
        }
        // Correct last points
        currentData[steps-1] = currentTotal;
        
        performanceChart.data.datasets[0].data = currentData;
        performanceChart.data.datasets[1].data = targetData;
        performanceChart.update();
    }
};

const calculateProjectionData = () => {
    let currentTotal = 0;
    let targetTotal = 0;
    
    portfolio.forEach(p => {
        const cPrice = parseFloat(p.currentPrice) || 0;
        const lots = parseFloat(p.lots) || 0;
        currentTotal += lots * cPrice;
        
        // 1. Check AI Original Data (Global AI Analysis)
        const aiMatch = aiOriginalData.find(a => a.ticker.toUpperCase() === p.ticker.toUpperCase());
        // 2. Check Manual Analysis
        const ana = analysis.find(a => a.ticker.toUpperCase() === p.ticker.toUpperCase());
        
        if (aiMatch) {
            targetTotal += lots * aiMatch.aiTarget;
        } else if (ana) {
            targetTotal += lots * (parseFloat(ana.targetPrice) || cPrice);
        } else {
            // Fallback: 15% estimated AI growth if no data
            targetTotal += lots * (cPrice * 1.15);
        }
    });
    return { currentTotal, targetTotal };
};

// Period functionality
const initPeriodButtons = () => {
    const buttons = document.querySelectorAll('.btn-period');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Adjust labels based on period
            if (performanceChart) {
                if (btn.id === 'btn1m') performanceChart.data.labels = ['1 Hf', '2 Hf', '3 Hf', 'Güncel', 'Hedef'];
                if (btn.id === 'btn3m') performanceChart.data.labels = ['1 Ay', '2 Ay', 'Güncel', 'Hedef 1', 'Hedef 2'];
                if (btn.id === 'btn1y') performanceChart.data.labels = ['3 Ay', '6 Ay', '9 Ay', 'Güncel', 'Hedef'];
                performanceChart.update();
            }
        });
    });
};

// --- AI Analysis State ---
let aiData = [];
let aiFilteredData = [];
let aiCurrentPage = 1;
const aiItemsPerPage = 12;

const fetchAIData = async () => {
    const overlay = document.getElementById('aiLoadingOverlay');
    if (overlay) overlay.style.display = 'flex';

    try {
        // Fetch BIST 500 data (using most active and top market cap as proxy for BIST 500)
        const response = await fetch('https://scanner.tradingview.com/turkey/scan', {
            method: 'POST',
            body: JSON.stringify({
                "filter": [
                    { "left": "name", "operation": "nempty" }
                ],
                "options": { "lang": "tr" },
                "markets": ["turkey"],
                "symbols": { "query": { "types": ["stock"] }, "tickers": [] },
                "columns": [
                    "base_currency_logoid", "name", "description", "close", "high", "low", 
                    "change", "volume", "RSI", "EMA10", "EMA20", "Volatility.D", "average_volume_10d_calc"
                ],
                "sort": { "sortBy": "market_cap_basic", "sortOrder": "desc" },
                "range": [0, 999] // Fetch all BIST stocks
            })
        });

        const result = await response.json();
        if (result.data) {
            aiData = result.data.map(item => calculateAIInsights(item));
            aiFilteredData = [...aiData];
            renderAITable();
        }
    } catch (e) {
        console.error("AI Data fetch error", e);
    } finally {
        if (overlay) overlay.style.display = 'none';
    }
};

const calculateAIInsights = (raw) => {
    const d = raw.d;
    const ticker = raw.s.split(':')[1];
    const name = d[2];
    const close = d[3];
    const high = d[4];
    const low = d[5];
    const change = d[6];
    const rsi = d[8] || 50;
    const ema10 = d[9] || close;
    const ema20 = d[10] || close;
    const vola = d[11] || 2;

    // AI Algoritması: Teknik Skor ve Hedef Fiyat Belirleme
    let techScore = 0;
    if (rsi < 40) techScore += 2;
    if (rsi > 70) techScore -= 1;
    if (close > ema10) techScore += 1.5;
    if (ema10 > ema20) techScore += 1;
    
    const sentiment = techScore > 2 ? 'GÜÇLÜ AL' : (techScore > 0 ? 'AL' : (techScore < -1 ? 'SAT' : 'TUT'));
    
    // Tahmini Hedef (Basit bir volatilite + trend projeksiyonu)
    const multiplier = 1 + (Math.abs(techScore) * 0.05) + (vola / 50);
    const aiTarget = close * multiplier;
    const potential = ((aiTarget / close) - 1) * 100;

    // Vade Öngörüsü
    let vade = 'ORTA';
    if (vola > 4) vade = 'KISA';
    else if (vola < 1.5) vade = 'UZUN';

    const analysisDate = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    return {
        ticker, name, close, change, rsi, techScore, sentiment, aiTarget, potential, vade, analysisDate
    };
};

const renderAITable = () => {
    const tbody = document.getElementById('aiTableBody');
    const totalCountEl = document.getElementById('aiTotalCount');
    if (!tbody) return;

    totalCountEl.textContent = aiFilteredData.length;

    const start = (aiCurrentPage - 1) * aiItemsPerPage;
    const end = start + aiItemsPerPage;
    const pageItems = aiFilteredData.slice(start, end);

    tbody.innerHTML = pageItems.map(item => `
        <tr>
            <td style="padding: 1.2rem 1rem;">
                <div style="font-weight: 700; color: var(--text-primary); font-size: 1rem;">${item.ticker}</div>
                <div style="font-size: 0.7rem; color: var(--text-muted);">${item.name.substring(0, 20)}</div>
            </td>
            <td>
                <div class="signal-text" style="color: ${item.techScore > 0 ? 'var(--success)' : (item.techScore < 0 ? 'var(--danger)' : 'var(--warning)')}">
                    ${item.sentiment}
                </div>
                <div style="font-size: 0.7rem; color: var(--text-muted);">RSI: ${item.rsi.toFixed(1)}</div>
            </td>
            <td style="font-family: 'JetBrains Mono', monospace; font-weight: 600;">
                ${item.aiTarget.toFixed(2)} ₺
            </td>
            <td>
                <span class="badge badge-profit" style="background: rgba(0, 230, 118, 0.1); color: #00e676; padding: 4px 8px; border-radius: 4px; font-weight: 700;">
                    +%${item.potential.toFixed(1)}
                </span>
            </td>
            <td>
                <span class="badge-vade vade-${item.vade.toLowerCase()}">${item.vade}</span>
                <div style="font-size: 0.65rem; color: var(--text-muted); margin-top: 4px;">${item.analysisDate}</div>
            </td>
            <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="flex: 1; height: 4px; background: var(--border); border-radius: 2px; overflow: hidden;">
                        <div style="width: ${(item.techScore + 2) * 20}%; height: 100%; background: var(--accent);"></div>
                    </div>
                    <span style="font-size: 0.75rem; font-weight: 700;">${(item.techScore + 2).toFixed(1)}</span>
                </div>
            </td>
        </tr>
    `).join('');

    renderAIPagination();
};

const renderAIPagination = () => {
    const container = document.getElementById('aiPagination');
    if (!container) return;

    const totalPages = Math.ceil(aiFilteredData.length / aiItemsPerPage);
    let html = '';

    // Show only 5 pages around current
    const startPage = Math.max(1, aiCurrentPage - 2);
    const endPage = Math.min(totalPages, startPage + 4);

    if (aiCurrentPage > 1) html += `<button class="page-btn" onclick="setAIPage(${aiCurrentPage - 1})"><i class="fa-solid fa-chevron-left"></i></button>`;
    
    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="page-btn ${i === aiCurrentPage ? 'active' : ''}" onclick="setAIPage(${i})">${i}</button>`;
    }

    if (aiCurrentPage < totalPages) html += `<button class="page-btn" onclick="setAIPage(${aiCurrentPage + 1})"><i class="fa-solid fa-chevron-right"></i></button>`;

    container.innerHTML = html;
};

let aiSortKey = '';
let aiSortDir = 'desc';

window.sortAIData = (key) => {
    if (aiSortKey === key) {
        aiSortDir = aiSortDir === 'desc' ? 'asc' : 'desc';
    } else {
        aiSortKey = key;
        aiSortDir = 'desc';
    }

    aiFilteredData.sort((a, b) => {
        let valA = a[key];
        let valB = b[key];

        // Custom priority for 'vade'
        if (key === 'vade') {
            const priority = { 'KISA': 1, 'ORTA': 2, 'UZUN': 3 };
            valA = priority[a.vade];
            valB = priority[b.vade];
        }

        if (typeof valA === 'string') {
            return aiSortDir === 'desc' ? valB.localeCompare(valA) : valA.localeCompare(valB);
        } else {
            return aiSortDir === 'desc' ? valB - valA : valA - valB;
        }
    });

    aiCurrentPage = 1;
    renderAITable();
};

window.setAIPage = (p) => {
    aiCurrentPage = p;
    renderAITable();
};

// --- Tab Switching ---
const initTabs = () => {
    const navItems = document.querySelectorAll('.nav-item');
    const dashboardBody = document.querySelector('.dashboard-body');
    const portfolioSection = document.getElementById('portfolioSection');
    const analysisSection = document.getElementById('analysisSection');
    const marketsSection = document.getElementById('marketsSection');
    const followSection = document.getElementById('followSection');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            if (item.id === 'openSyncModalBtn') return; // Skip settings button
            e.preventDefault();
            
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            const tab = item.getAttribute('data-tab');
            
            // Hide all
            dashboardBody.children[0].parentElement.querySelectorAll(':scope > div').forEach(c => {
                if (c.classList.contains('summary-grid') || c.classList.contains('main-chart-card') || c.classList.contains('bottom-grid')) {
                    c.style.display = tab === 'dashboard' ? '' : 'none';
                }
            });
            
            if (portfolioSection) portfolioSection.style.display = tab === 'portfolio' ? 'block' : 'none';
            if (analysisSection) analysisSection.style.display = tab === 'analysis' ? 'block' : 'none';
            if (marketsSection) marketsSection.style.display = tab === 'markets' ? 'block' : 'none';
            if (followSection) {
                followSection.style.display = tab === 'follow' ? 'block' : 'none';
                if (tab === 'follow') fetchAIData();
            }
        });
    });
};

// --- Actions ---
window.deleteStock = (id) => { if (confirm('Emin misiniz?')) { portfolio = portfolio.filter(s => s.id !== id); saveToLocalStorage(); renderTable(); } };
window.openEditModal = (id) => {
    const s = portfolio.find(x => x.id === id);
    if (!s) return;
    document.getElementById('editId').value = s.id;
    document.getElementById('editTicker').value = s.ticker;
    document.getElementById('editLots').value = s.lots;
    document.getElementById('editAvgCost').value = s.avgCost;
    document.getElementById('editCurrentPrice').value = s.currentPrice;
    editModal.classList.add('show');
};
window.deleteAnalysis = (id) => { if (confirm('Emin misiniz?')) { analysis = analysis.filter(a => a.id !== id); saveToLocalStorage(); renderAnalysisTable(); } };
window.openEditAnalysis = (id) => {
    const a = analysis.find(x => x.id === id);
    if (!a) return;
    document.getElementById('analysisId').value = a.id;
    document.getElementById('a_ticker').value = a.ticker;
    document.getElementById('a_sector').value = a.sector;
    document.getElementById('a_currentPrice').value = a.currentPrice;
    document.getElementById('a_targetPrice').value = a.targetPrice;
    document.getElementById('a_balance').value = a.balance;
    document.getElementById('a_debt').value = a.debt;
    document.getElementById('a_story').value = a.story;
    document.getElementById('a_margin').value = a.margin;
    analysisModal.classList.add('show');
};
window.closeModal = (id) => document.getElementById(id).classList.remove('show');

// --- Cloud Sync ---
document.getElementById('backupBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('backupBtn');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Yükleniyor...';
    try {
        const res = await fetch('https://bytebin.lucko.me/post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ portfolio, analysis })
        });
        const result = await res.json();
        document.getElementById('walletIdDisplay').textContent = result.key;
        document.getElementById('walletBox').style.display = 'block';
        btn.innerHTML = 'YEDEKLEME BAŞARILI';
    } catch (e) { alert("Hata oluştu."); btn.innerHTML = 'BULUTA YEDEKLE'; }
});

document.getElementById('restoreBtn')?.addEventListener('click', async () => {
    const code = document.getElementById('restoreInput').value.trim();
    if (!code) return;
    try {
        const res = await fetch(`https://bytebin.lucko.me/${code}`);
        const result = await res.json();
        portfolio = result.portfolio || [];
        analysis = result.analysis || [];
        saveToLocalStorage(); renderTable(); renderAnalysisTable();
        closeModal('syncModal');
    } catch (err) { alert("Kod geçersiz."); }
});

// --- Events ---
document.addEventListener('DOMContentLoaded', () => {
    initCharts();
    initTabs();
    loadFromLocalStorage();
    initPeriodButtons();
    fetchAIData();
    
    document.getElementById('aiSearchInput')?.addEventListener('input', (e) => {
        const q = e.target.value.toUpperCase();
        aiFilteredData = aiData.filter(d => d.ticker.includes(q) || d.name.toUpperCase().includes(q));
        aiCurrentPage = 1;
        renderAITable();
    });

    // Update update time
    document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString('tr-TR');

    addStockForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        portfolio.push({
            id: generateId(),
            ticker: document.getElementById('ticker').value.toUpperCase(),
            lots: parseFloat(document.getElementById('lots').value),
            avgCost: parseFloat(document.getElementById('avgCost').value),
            currentPrice: parseFloat(document.getElementById('currentPrice').value)
        });
        saveToLocalStorage(); renderTable(); closeModal('addStockModal');
    });

    editStockForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('editId').value;
        const i = portfolio.findIndex(x => x.id === id);
        if (i !== -1) {
            portfolio[i] = { ...portfolio[i], lots: parseFloat(document.getElementById('editLots').value), avgCost: parseFloat(document.getElementById('editAvgCost').value), currentPrice: parseFloat(document.getElementById('editCurrentPrice').value) };
            saveToLocalStorage(); renderTable(); closeModal('editModal');
        }
    });

    document.getElementById('analysisForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('analysisId').value;
        const aObj = {
            id: id || generateId(),
            ticker: document.getElementById('a_ticker').value.toUpperCase(),
            sector: document.getElementById('a_sector').value,
            currentPrice: parseFloat(document.getElementById('a_currentPrice').value),
            targetPrice: parseFloat(document.getElementById('a_targetPrice').value),
            balance: document.getElementById('a_balance').value,
            debt: document.getElementById('a_debt').value,
            story: document.getElementById('a_story').value,
            margin: document.getElementById('a_margin').value
        };
        if (id) {
            const idx = analysis.findIndex(x => x.id === id);
            if (idx !== -1) analysis[idx] = aObj;
        } else { analysis.push(aObj); }
        saveToLocalStorage(); renderAnalysisTable(); closeModal('analysisModal');
    });

    document.getElementById('openAddStockBtn')?.addEventListener('click', () => { 
        document.getElementById('addStockForm').reset(); 
        document.getElementById('addStockModal').classList.add('show'); 
    });
    document.getElementById('addAnalysisBtn')?.addEventListener('click', () => { 
        document.getElementById('analysisForm').reset();
        document.getElementById('analysisId').value = '';
        document.getElementById('analysisModalTitle').textContent = 'Yeni Analiz Ekle';
        analysisModal.classList.add('show'); 
    });
    document.getElementById('openSyncModalBtn')?.addEventListener('click', (e) => { e.preventDefault(); syncModal.classList.add('show'); });
});
