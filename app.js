// --- App State ---
let portfolio = [];
let analysis = [];
let distributionChart = null;
let performanceChart = null;

// --- DOM Elements ---
const addStockForm = document.getElementById('addStockForm');
const tableBody = document.getElementById('tableBody');
const emptyState = document.getElementById('emptyState');
const portfolioTable = document.getElementById('portfolioTable');

const analysisTableBody = document.getElementById('analysisTableBody');
const emptyAnalysisState = document.getElementById('emptyAnalysisState');
const analysisTable = document.getElementById('analysisTable');
const analysisForm = document.getElementById('analysisForm');

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
const formatPercent = (val) => new Intl.NumberFormat('tr-TR', { style: 'percent', minimumFractionDigits: 2 }).format(val / 100);
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

// --- Encryption ---
const encryptData = (data, pass) => pass ? CryptoJS.AES.encrypt(JSON.stringify(data), pass).toString() : data;
const decryptData = (str, pass) => {
    try {
        if (!pass) return JSON.parse(str);
        const bytes = CryptoJS.AES.decrypt(str, pass);
        return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    } catch (e) { return null; }
};

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
};

// --- Portfolio Core ---
const calculateTotals = () => {
    let cost = 0, current = 0;
    portfolio.forEach(s => { cost += (parseFloat(s.lots) * parseFloat(s.avgCost)); current += (parseFloat(s.lots) * parseFloat(s.currentPrice)); });
    const profit = current - cost;
    const percent = cost > 0 ? (profit / cost) * 100 : 0;

    if (currentValueEl) currentValueEl.textContent = formatCurrency(current);
    if (totalCostEl) totalCostEl.textContent = formatCurrency(cost);
    if (totalProfitEl) {
        totalProfitEl.textContent = (profit >= 0 ? '+' : '') + formatCurrency(profit);
        totalProfitEl.style.color = profit >= 0 ? 'var(--up)' : 'var(--down)';
    }
    if (totalProfitPercentEl) {
        totalProfitPercentEl.textContent = (profit >= 0 ? '+' : '') + formatPercent(percent);
        totalProfitPercentEl.className = `badge ${profit >= 0 ? 'up' : 'down'}`;
    }

    // Insights
    try {
        const gainerListEl = document.getElementById('gainerList');
        const loserListEl = document.getElementById('loserList');

        if (gainerListEl && loserListEl) {
            gainerListEl.innerHTML = '';
            loserListEl.innerHTML = '';

            if (portfolio && portfolio.length > 0) {
                const calculated = portfolio.map(s => {
                    const c = (parseFloat(s.lots) * parseFloat(s.avgCost));
                    const v = (parseFloat(s.lots) * parseFloat(s.currentPrice));
                    const p = v - c;
                    const per = c > 0 ? (p / c * 100) : 0;
                    return { ...s, per };
                });

                const gainers = calculated.filter(s => s.per >= 0).sort((a, b) => b.per - a.per);
                const losers = calculated.filter(s => s.per < 0).sort((a, b) => a.per - b.per);

                gainers.forEach(s => {
                    const row = document.createElement('div');
                    row.className = 'insight-row up';
                    row.innerHTML = `<span>${s.ticker.toUpperCase()}</span> <span>%${s.per.toFixed(2)}</span>`;
                    gainerListEl.appendChild(row);
                });

                losers.forEach(s => {
                    const row = document.createElement('div');
                    row.className = 'insight-row down';
                    row.innerHTML = `<span>${s.ticker.toUpperCase()}</span> <span>%${s.per.toFixed(2)}</span>`;
                    loserListEl.appendChild(row);
                });

                if (gainers.length === 0) gainerListEl.innerHTML = '<div style="font-size:0.8rem; color:var(--text-muted); padding:5px;">Yükselen yok.</div>';
                if (losers.length === 0) loserListEl.innerHTML = '<div style="font-size:0.8rem; color:var(--text-muted); padding:5px;">Düşen yok.</div>';
            } else {
                gainerListEl.innerHTML = '<div style="font-size:0.8rem; color:var(--text-muted); padding:5px;">Veri yok.</div>';
                loserListEl.innerHTML = '<div style="font-size:0.8rem; color:var(--text-muted); padding:5px;">Veri yok.</div>';
            }
        }
    } catch (e) { console.error("Insights Error:", e); }
};

const renderTable = () => {
    if (!tableBody) return;
    tableBody.innerHTML = '';
    if (portfolio.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        if (portfolioTable) portfolioTable.style.display = 'none';
        calculateTotals();
        return;
    }
    if (emptyState) emptyState.style.display = 'none';
    if (portfolioTable) portfolioTable.style.display = 'table';

    portfolio.forEach((s) => {
        const val = parseFloat(s.lots) * parseFloat(s.currentPrice);
        const prof = val - (parseFloat(s.lots) * parseFloat(s.avgCost));
        const pPer = (parseFloat(s.lots) * parseFloat(s.avgCost)) > 0 ? (prof / (parseFloat(s.lots) * parseFloat(s.avgCost)) * 100) : 0;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong style="color:var(--gold);">${s.ticker.toUpperCase()}</strong></td>
            <td>${s.lots}</td>
            <td>${formatCurrency(s.avgCost)}</td>
            <td>${formatCurrency(s.currentPrice)}</td>
            <td style="font-weight:600;">${formatCurrency(val)}</td>
            <td class="${prof >= 0 ? 'up' : 'down'}">${prof >= 0 ? '+' : ''}${formatCurrency(prof)}</td>
            <td class="${prof >= 0 ? 'up' : 'down'}">${prof >= 0 ? '▲' : '▼'} ${Math.abs(pPer).toFixed(2)}%</td>
            <td style="text-align:right;">
                <button class="btn-icon" onclick="openEditModal('${s.id}')"><i class="fa-solid fa-pen-to-square"></i></button>
                <button class="btn-icon delete" onclick="deleteStock('${s.id}')"><i class="fa-solid fa-trash-can"></i></button>
            </td>
        `;
        tableBody.appendChild(row);
    });
    calculateTotals();
    updateCharts();
};

const renderAnalysisTable = () => {
    if (!analysisTableBody) return;
    analysisTableBody.innerHTML = '';
    if (analysis.length === 0) {
        if (emptyAnalysisState) emptyAnalysisState.style.display = 'block';
        if (analysisTable) analysisTable.style.display = 'none';
        return;
    }
    if (emptyAnalysisState) emptyAnalysisState.style.display = 'none';
    if (analysisTable) analysisTable.style.display = 'table';

    analysis.forEach(a => {
        const pot = ((parseFloat(a.targetPrice) / parseFloat(a.currentPrice)) - 1) * 100;
        const isc = (1 - (parseFloat(a.currentPrice) / parseFloat(a.targetPrice))) * 100;
        const totalPuan = (parseFloat(a.balance) + parseFloat(a.debt) + parseFloat(a.story) + parseFloat(a.margin)).toFixed(1);

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong style="color:var(--gold);">${a.ticker.toUpperCase()}</strong></td>
            <td><span style="font-size:0.85rem; color:var(--text-muted);">${a.sector}</span></td>
            <td class="up">%${pot.toFixed(1)}</td>
            <td class="up">%${isc.toFixed(1)}</td>
            <td>${formatCurrency(a.currentPrice)}</td>
            <td style="color:var(--gold); font-weight:600;">${formatCurrency(a.targetPrice)}</td>
            <td>${a.balance}</td>
            <td>${a.debt}</td>
            <td>${a.story}</td>
            <td>${a.margin}</td>
            <td><span class="badge ${totalPuan >= 2 ? 'up' : 'down'}">${totalPuan}</span></td>
            <td style="text-align:right;">
                <button class="btn-icon" onclick="openEditAnalysis('${a.id}')"><i class="fa-solid fa-pen-to-square"></i></button>
                <button class="btn-icon delete" onclick="deleteAnalysis('${a.id}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        analysisTableBody.appendChild(row);
    });
};

// --- Charts ---
const initCharts = () => {
    const dCtx = document.getElementById('distributionChart')?.getContext('2d');
    const pCtx = document.getElementById('performanceChart')?.getContext('2d');
    if (!dCtx || !pCtx) return;

    if (distributionChart) distributionChart.destroy();
    if (performanceChart) performanceChart.destroy();

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: { color: '#888', font: { family: 'Inter', size: 10 } }
            }
        }
    };

    distributionChart = new Chart(dCtx, {
        type: 'doughnut',
        data: { labels: [], datasets: [{ data: [], backgroundColor: ['#d4af37', '#e0e0e0', '#444', '#b8860b', '#888', '#222'], borderWidth: 0 }] },
        options: { ...chartOptions, cutout: '75%' }
    });

    performanceChart = new Chart(pCtx, {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'Maliyet', data: [], backgroundColor: 'rgba(212, 175, 55, 0.05)', borderRadius: 4 }, { label: 'Değer', data: [], backgroundColor: '#d4af37', borderRadius: 4 }] },
        options: { ...chartOptions, scales: { y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#888' } }, x: { grid: { display: false }, ticks: { color: '#888' } } } }
    });
};

const updateCharts = () => {
    if (!distributionChart || !performanceChart) return;
    const labels = portfolio.map(s => s.ticker.toUpperCase());
    const vals = portfolio.map(s => parseFloat(s.lots) * parseFloat(s.currentPrice));
    const costs = portfolio.map(s => parseFloat(s.lots) * parseFloat(s.avgCost));
    distributionChart.data.labels = labels; distributionChart.data.datasets[0].data = vals; distributionChart.update();
    performanceChart.data.labels = labels; performanceChart.data.datasets[0].data = costs; performanceChart.data.datasets[1].data = vals; performanceChart.update();
};

// --- Global Actions ---
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
    document.getElementById('analysisModalTitle').textContent = 'Analiz Düzenle';
    analysisModal.classList.add('show');
};

window.closeModal = (id) => document.getElementById(id).classList.remove('show');

// --- Cloud Sync & Restore ---
document.getElementById('backupBtn')?.addEventListener('click', async () => {
    const data = { portfolio, analysis };
    const btn = document.getElementById('backupBtn');

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Buluta Yükleniyor...';

    try {
        const res = await fetch('https://bytebin.lucko.me/post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify(data)
        });

        if (!res.ok) throw new Error("API Hatası");

        const result = await res.json();

        if (result.key) {
            document.getElementById('walletIdDisplay').textContent = result.key;
            document.getElementById('walletBox').style.display = 'block';
            btn.innerHTML = '<i class="fa-solid fa-check"></i> BAŞARILI';
            setTimeout(() => {
                btn.innerHTML = '<i class="fa-solid fa-plus-circle"></i> BULUTA YEDEKLE';
            }, 3000);
        } else {
            throw new Error("Kod alınamadı");
        }
    } catch (e) {
        alert("Bulut bağlantısında hata oluştu. Lütfen tekrar deneyin.");
        btn.innerHTML = '<i class="fa-solid fa-plus-circle"></i> BULUTA YEDEKLE';
    }
});

document.getElementById('restoreBtn')?.addEventListener('click', async () => {
    const code = document.getElementById('restoreInput').value.trim();

    if (!code) {
        alert("Lütfen sistemin verdiği kısa kodu girin.");
        return;
    }

    const btn = document.getElementById('restoreBtn');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> İndiriliyor...';

    try {
        const res = await fetch(`https://bytebin.lucko.me/${code}`);
        if (!res.ok) throw new Error("Bulunamadı");

        const result = await res.json();

        if (result && typeof result === 'object') {
            portfolio = result.portfolio || [];
            analysis = result.analysis || [];
            saveToLocalStorage();
            renderTable();
            renderAnalysisTable();
            closeModal('syncModal');
            alert("Veriler buluttan başarıyla yüklendi.");
        } else {
            alert("Cüzdan verisi geçerli değil.");
        }
    } catch (err) {
        alert("Bağlantı hatası veya geçersiz kod. Lütfen kodu doğru girdiğinizden emin olun.");
    } finally {
        btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-down" style="margin-right: 8px;"></i>CÜZDANI İNDİR';
    }
});

document.getElementById('copyBtn')?.addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('walletIdDisplay').textContent);
    alert("Kısa kod kopyalandı.");
});

// --- Events ---
document.addEventListener('DOMContentLoaded', () => {
    initCharts();
    loadFromLocalStorage();

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

    analysisForm?.addEventListener('submit', (e) => {
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
    document.getElementById('addAnalysisBtn')?.addEventListener('click', () => { analysisForm.reset(); document.getElementById('analysisId').value = ''; document.getElementById('analysisModalTitle').textContent = 'Yeni Analiz Ekle'; analysisModal.classList.add('show'); });
    document.getElementById('deleteAllBtn')?.addEventListener('click', () => { if (confirm('Tüm portföyü silmek istediğinize emin misiniz?')) { portfolio = []; saveToLocalStorage(); renderTable(); } });
    document.getElementById('deleteAnalysisBtn')?.addEventListener('click', () => { if (confirm('Tüm analizleri temizlemek istediğinize emin misiniz?')) { analysis = []; saveToLocalStorage(); renderAnalysisTable(); } });
    document.getElementById('openSyncModalBtn')?.addEventListener('click', () => syncModal.classList.add('show'));
});
