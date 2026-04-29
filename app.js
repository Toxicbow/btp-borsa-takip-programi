// BTP Dashboard Logic - V1.4.2
// --- App State ---
let portfolio = [];
let analysis = [];
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
};

const loadFromLocalStorage = () => {
    const pData = localStorage.getItem('portfolio_premium') || localStorage.getItem('portfolio');
    if (pData) { try { portfolio = JSON.parse(pData); } catch (e) { portfolio = []; } }

    const aData = localStorage.getItem('analysis_v1');
    if (aData) { try { analysis = JSON.parse(aData); } catch (e) { analysis = []; } }

    renderTable();
    renderAnalysisTable();
    renderAssetMiniList();
};

// --- Core Logic ---
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
    listEl.innerHTML = '';
    
    // Sort all by total value descending and show up to 6
    const sorted = [...portfolio].sort((a, b) => {
        const valA = parseFloat(a.lots) * parseFloat(a.currentPrice);
        const valB = parseFloat(b.lots) * parseFloat(b.currentPrice);
        return valB - valA;
    }).slice(0, 6);
    
    sorted.forEach(s => {
        const currentVal = parseFloat(s.lots) * parseFloat(s.currentPrice);
        const prof = (parseFloat(s.currentPrice) - parseFloat(s.avgCost)) / parseFloat(s.avgCost) * 100;
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
                    { label: 'Piyasa Değeri', data: [1200, 900, 800, 700], backgroundColor: '#ffffff', borderRadius: 4 },
                    { label: 'Defter Değeri', data: [800, 700, 600, 400], backgroundColor: '#64748b', borderRadius: 4 }
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
                labels: ['1 ay', '2 ay', '3 ay', '4 ay', '5 ay', '6 ay'],
                datasets: [
                    { label: 'Portföy', data: [0, 5, 12, 8, 15, 20], borderColor: '#d4af37', borderWidth: 2, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#d4af37' },
                    { label: 'BIST100', data: [0, 3, 7, 5, 10, 14], borderColor: '#64748b', borderWidth: 2, tension: 0.4, pointRadius: 0 },
                    { label: 'ALTIN', data: [0, 2, 4, 6, 8, 9], borderColor: '#ffb74d', borderWidth: 2, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#ffb74d' }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false } },
                    y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { callback: v => '%' + v } }
                }
            }
        });
    }
};

const updateCharts = () => {
    if (distributionChart) {
        const sorted = [...portfolio].sort((a, b) => (parseFloat(b.lots) * parseFloat(b.currentPrice)) - (parseFloat(a.lots) * parseFloat(a.currentPrice)));
        distributionChart.data.labels = sorted.map(s => s.ticker.toUpperCase());
        distributionChart.data.datasets[0].data = sorted.map(s => parseFloat(s.lots) * parseFloat(s.currentPrice));
        distributionChart.update();
    }
    
    // For the main chart, we simulate a trend if there's portfolio
    if (mainAreaChart && portfolio.length > 0) {
        const total = portfolio.reduce((a, b) => a + (b.lots * b.currentPrice), 0);
        const baseData = [total * 0.85, total * 0.9, total * 0.88, total * 0.95, total * 0.92, total * 0.98, total];
        mainAreaChart.data.datasets[0].data = baseData;
        mainAreaChart.update();
    }
};

// --- Tab Switching ---
const initTabs = () => {
    const navItems = document.querySelectorAll('.nav-item');
    const dashboardBody = document.querySelector('.dashboard-body');
    const portfolioSection = document.getElementById('portfolioSection');
    const analysisSection = document.getElementById('analysisSection');

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

    document.getElementById('openAddStockBtn')?.addEventListener('click', () => { addStockForm.reset(); document.getElementById('addStockModal').classList.add('show'); });
    document.getElementById('addAnalysisBtn')?.addEventListener('click', () => { analysisModal.classList.add('show'); });
    document.getElementById('openSyncModalBtn')?.addEventListener('click', (e) => { e.preventDefault(); syncModal.classList.add('show'); });
});
