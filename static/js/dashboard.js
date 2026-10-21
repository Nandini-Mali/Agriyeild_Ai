document.addEventListener('DOMContentLoaded', () => {
  // The dashboard sits on its own permanent dark analytics canvas
  // (independent of the site-wide light/dark toggle), so chart text
  // and gridlines are fixed to light-on-dark for reliable contrast.
  const ink = () => 'rgba(247,248,243,.85)';
  const grid = () => 'rgba(255,255,255,.08)';
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.color = ink();

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const rainfall = [40,55,70,95,140,260,310,290,190,110,60,35];
  const yieldSeries = rainfall.map(r => +(1.6 + Math.min(r,300)/300*3.2 + (Math.random()*.4-.2)).toFixed(2));

  new Chart(document.getElementById('chart-rainfall'), {
    type: 'line',
    data: {
      labels: months,
      datasets: [
        { label: 'Rainfall (mm)', data: rainfall, yAxisID: 'y', borderColor: '#D4AF37', backgroundColor: 'rgba(212,175,55,.12)', tension: .4, fill: true, pointRadius: 0, borderWidth: 2 },
        { label: 'Predicted Yield (t/ha)', data: yieldSeries, yAxisID: 'y1', borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,.15)', tension: .4, fill: true, pointRadius: 0, borderWidth: 3 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8 } } },
      scales: {
        y: { position: 'left', grid: { color: grid() }, title: { display: true, text: 'mm' } },
        y1: { position: 'right', grid: { display: false }, title: { display: true, text: 't/ha' } },
        x: { grid: { display: false } }
      }
    }
  });

  new Chart(document.getElementById('chart-npk'), {
    type: 'doughnut',
    data: { labels: ['Nitrogen (N)', 'Phosphorus (P)', 'Potassium (K)'], datasets: [{ data: [90, 45, 55], backgroundColor: ['#10B981', '#D4AF37', '#0B3D2E'], borderWidth: 0, hoverOffset: 10 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } } } }
  });

  new Chart(document.getElementById('chart-crop'), {
    type: 'bar',
    data: {
      labels: ['Rice', 'Wheat', 'Maize', 'Cotton', 'Soybean', 'Potato'],
      datasets: [{ label: 'Avg. Yield (t/ha)', data: [4.1, 3.5, 3.7, 2.0, 2.3, 21.5], backgroundColor: (c) => {
        const ctx = c.chart.ctx; const g = ctx.createLinearGradient(0,0,0,240); g.addColorStop(0,'#10B981'); g.addColorStop(1,'#0B3D2E'); return g;
      }, borderRadius: 8, maxBarThickness: 34 }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { grid: { color: grid() } }, x: { grid: { display: false } } } }
  });

  new Chart(document.getElementById('chart-temp'), {
    type: 'radar',
    data: {
      labels: ['Kharif', 'Rabi', 'Zaid', 'Summer', 'Monsoon', 'Winter'],
      datasets: [{ label: 'Avg Temp °C', data: [29, 19, 33, 36, 27, 15], backgroundColor: 'rgba(212,175,55,.2)', borderColor: '#D4AF37', pointBackgroundColor: '#D4AF37' }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { r: { grid: { color: grid() }, angleLines: { color: grid() } } } }
  });

  new Chart(document.getElementById('chart-district'), {
    type: 'bar',
    data: {
      labels: ['Pune', 'Nashik', 'Kolhapur', 'Nagpur', 'Solapur'],
      datasets: [{ label: 'Yield Index', data: [88, 95, 79, 84, 91], backgroundColor: '#10B981', borderRadius: 8, maxBarThickness: 26 }]
    },
    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: grid() } }, y: { grid: { display: false } } } }
  });

  const years = ['2019','2020','2021','2022','2023','2024','2025','2026'];
  new Chart(document.getElementById('chart-yearly'), {
    type: 'bar',
    data: {
      labels: years,
      datasets: [
        { type: 'line', label: 'Yield Trend (t/ha)', data: [3.1,3.3,3.4,3.6,3.9,4.0,4.2,4.32], borderColor: '#D4AF37', backgroundColor: '#D4AF37', tension: .4, yAxisID: 'y1', pointRadius: 4, borderWidth: 3 },
        { label: 'Production (kt)', data: [102,110,108,121,130,138,145,152], backgroundColor: 'rgba(16,185,129,.75)', borderRadius: 6, yAxisID: 'y' },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8 } } },
      scales: { y: { position: 'left', grid: { color: grid() } }, y1: { position: 'right', grid: { display: false } }, x: { grid: { display: false } } }
    }
  });

  /* weather widget */
  const weatherDays = document.getElementById('weather-days');
  const loadWeather = async (city) => {
    weatherDays.innerHTML = `<div class="col-span-full text-center py-6 text-sm dash-dim"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Loading forecast…</div>`;
    const res = await fetch(`/api/weather?city=${encodeURIComponent(city)}`);
    const data = await res.json();
    weatherDays.innerHTML = data.days.map(d => `
      <div class="dash-kpi p-4 text-center">
        <p class="text-[11px] dash-dim relative">${d.date}</p>
        <i class="fa-solid ${d.icon} text-xl text-emerald-soft my-2 relative"></i>
        <p class="font-semibold text-sm text-paper relative">${d.temp_max}° <span class="dash-dim font-normal">/ ${d.temp_min}°</span></p>
        <p class="text-[10px] dash-dim-2 mt-1 relative"><i class="fa-solid fa-droplet mr-1"></i>${d.rain_chance}%</p>
      </div>`).join('');
  };
  loadWeather('Nagpur');
  document.getElementById('weather-form').addEventListener('submit', (e) => { e.preventDefault(); loadWeather(document.getElementById('weather-city').value || 'Nagpur'); });

  document.getElementById('dl-report').addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFillColor(11, 61, 46); doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(16); doc.text('AgriYield AI — Analytics Summary', 14, 18);
    doc.setTextColor(20, 20, 20); doc.setFontSize(11);
    const rows = [['Avg. Yield', '4.32 t/ha'], ['Total Production', '128.6 t'], ['Avg. Confidence', '89.4%'], ['Est. Portfolio Profit', '₹6.2L']];
    let y = 44;
    rows.forEach(([l, v]) => { doc.setFont(undefined,'bold'); doc.text(l+':', 14, y); doc.setFont(undefined,'normal'); doc.text(v, 80, y); y += 10; });
    doc.setFontSize(8); doc.setTextColor(140,140,140); doc.text('Generated by AgriYield AI dashboard.', 14, 287);
    doc.save('AgriYield-Dashboard-Report.pdf');
    showToast('Dashboard report downloaded', 'fa-file-pdf', 'text-emerald');
  });
});
