document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('predict-form');
  if (!form) return;

  /* live slider value readout */
  form.querySelectorAll('input[type="range"]').forEach(r => {
    const out = form.querySelector(`[data-out="${r.dataset.linked}"]`);
    r.addEventListener('input', () => { out.textContent = r.value; });
  });

  /* voice input (Web Speech API) */
  const voiceBtn = document.getElementById('voice-btn');
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  voiceBtn.addEventListener('click', () => {
    if (!SpeechRecognition) { showToast('Voice input is not supported in this browser.', 'fa-triangle-exclamation', 'text-gold'); return; }
    const rec = new SpeechRecognition();
    rec.lang = 'en-IN'; rec.interimResults = false;
    voiceBtn.classList.add('animate-pulse');
    showToast('Listening… try "crop rice, area 3 hectares, rainfall 900"', 'fa-microphone', 'text-emerald');
    rec.start();
    rec.onresult = (e) => {
      const t = e.results[0][0].transcript.toLowerCase();
      voiceBtn.classList.remove('animate-pulse');

      const cropSelect = form.querySelector('[name="Crop"]');
      for (const opt of cropSelect.options) { if (t.includes(opt.value.toLowerCase())) { cropSelect.value = opt.value; break; } }

      const numMatch = (label) => {
        const re = new RegExp(label + '\\s*(\\d+(\\.\\d+)?)');
        const m = t.match(re);
        return m ? m[1] : null;
      };
      const area = numMatch('area|hectare');
      const rain = numMatch('rainfall|rain');
      const temp = numMatch('temperature|temp');
      if (area) form.querySelector('[name="Area"]').value = area;
      if (rain) { const el = form.querySelector('[name="Rainfall"]'); el.value = rain; el.dispatchEvent(new Event('input')); }
      if (temp) { const el = form.querySelector('[name="Temperature"]'); el.value = temp; el.dispatchEvent(new Event('input')); }

      showToast('Voice input applied ✓', 'fa-circle-check', 'text-emerald');
    };
    rec.onerror = () => { voiceBtn.classList.remove('animate-pulse'); showToast('Could not capture audio — try again.', 'fa-triangle-exclamation', 'text-gold'); };
  });

  const emptyState = document.getElementById('result-empty');
  const loadingState = document.getElementById('result-loading');
  const resultPanel = document.getElementById('result-panel');
  const btn = document.getElementById('predict-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    emptyState.classList.add('hidden');
    resultPanel.classList.add('hidden');
    loadingState.classList.remove('hidden');
    btn.disabled = true; btn.style.opacity = '.7';

    const fd = new FormData(form);
    const payload = {};
    fd.forEach((v, k) => payload[k] = v);

    try {
      const t0 = performance.now();
      const res = await fetch('/api/predict', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      const elapsed = performance.now() - t0;
      await new Promise(r => setTimeout(r, Math.max(0, 900 - elapsed))); // let the loader breathe

      if (!data.ok) throw new Error(data.error || 'Prediction failed');
      renderResult(data.result, payload);
      showToast('Prediction generated successfully', 'fa-circle-check', 'text-emerald');
    } catch (err) {
      loadingState.classList.add('hidden');
      emptyState.classList.remove('hidden');
      showToast('Something went wrong: ' + err.message, 'fa-triangle-exclamation', 'text-red-400');
    } finally {
      btn.disabled = false; btn.style.opacity = '1';
    }
  });

  function levelColor(color) {
    return { emerald: 'text-emerald-dark dark:text-emerald-soft bg-emerald/10', gold: 'text-gold bg-gold/10', red: 'text-red-500 bg-red-500/10' }[color] || 'text-emerald';
  }

  window.__lastResult = null;

  function renderResult(r, inputs) {
    window.__lastResult = { r, inputs };
    loadingState.classList.add('hidden');
    resultPanel.classList.remove('hidden');

    const circumference = 2 * Math.PI * 27;
    const offset = circumference * (1 - r.confidence_score / 100);

    resultPanel.innerHTML = `
      <div class="hero-gradient grain rounded-[28px] p-7 pop-in relative overflow-hidden">
        <div class="flex items-center justify-between relative">
          <div>
            <p class="text-xs text-paper/60 flex items-center gap-1.5"><i class="fa-solid fa-circle-check text-emerald-soft"></i> Prediction #${r.id}</p>
            <p class="font-display text-4xl font-semibold text-paper mt-2">${r.yield_per_hectare} <span class="text-base font-normal text-paper/60">t/ha</span></p>
            <p class="text-xs text-paper/50 mt-1">${r.timestamp}</p>
          </div>
          <div class="relative h-20 w-20 flex-shrink-0">
            <svg class="ring-dial" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="27" stroke="rgba(255,255,255,.15)" stroke-width="6" fill="none"/>
              <circle cx="32" cy="32" r="27" stroke="url(#gg2)" stroke-width="6" fill="none" stroke-linecap="round"
                stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"/>
              <defs><linearGradient id="gg2" x1="0" y1="0" x2="64" y2="64"><stop stop-color="#10B981"/><stop offset="1" stop-color="#D4AF37"/></linearGradient></defs>
            </svg>
            <span class="absolute inset-0 flex flex-col items-center justify-center"><span class="text-sm font-bold text-paper">${r.confidence_score}%</span></span>
          </div>
        </div>
        <span class="inline-block mt-4 text-xs font-semibold px-3 py-1.5 rounded-full ${levelColor(r.productivity_color)}">${r.productivity_level} productivity</span>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="kpi-card neu-card">
          <p class="text-xs text-ink/50 dark:text-paper/50 relative">Expected Production</p>
          <p class="font-display text-2xl font-semibold mt-1 relative">${r.expected_production} <span class="text-sm font-normal">t</span></p>
        </div>
        <div class="kpi-card neu-card">
          <p class="text-xs text-ink/50 dark:text-paper/50 relative">Water Requirement</p>
          <p class="font-display text-2xl font-semibold mt-1 relative">${r.water_requirement_mm} <span class="text-sm font-normal">mm</span></p>
          <p class="text-[11px] text-emerald-dark dark:text-emerald-soft mt-1 relative">${r.water_gap_mm > 0 ? `+${r.water_gap_mm}mm irrigation needed` : 'Rainfall sufficient'}</p>
        </div>
      </div>

      <div class="glass-card rounded-[24px] p-6 pop-in">
        <h4 class="font-display font-semibold flex items-center gap-2 mb-3"><i class="fa-solid fa-flask text-emerald"></i> Best Fertilizer Suggestion</h4>
        <p class="text-sm text-ink/65 dark:text-paper/65 leading-relaxed">${r.fertilizer_suggestion}</p>
      </div>

      <div class="glass-card rounded-[24px] p-6 pop-in">
        <h4 class="font-display font-semibold flex items-center gap-2 mb-3"><i class="fa-solid fa-heart-pulse text-emerald"></i> Soil Health Insights</h4>
        <ul class="space-y-2.5">
          ${r.soil_health_insights.map(n => `<li class="text-sm text-ink/65 dark:text-paper/65 flex gap-2.5"><i class="fa-solid fa-circle-dot text-[6px] mt-2 text-gold flex-shrink-0"></i>${n}</li>`).join('')}
        </ul>
      </div>

      <div class="glass-card rounded-[24px] p-6 pop-in">
        <h4 class="font-display font-semibold flex items-center gap-2 mb-4"><i class="fa-solid fa-sack-dollar text-emerald"></i> Profit Estimation</h4>
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div><p class="text-ink/50 dark:text-paper/50 text-xs">Est. Revenue</p><p class="font-semibold mono mt-1">₹${r.profit.estimated_revenue.toLocaleString('en-IN')}</p></div>
          <div><p class="text-ink/50 dark:text-paper/50 text-xs">Est. Cost</p><p class="font-semibold mono mt-1">₹${r.profit.estimated_cost.toLocaleString('en-IN')}</p></div>
          <div><p class="text-ink/50 dark:text-paper/50 text-xs">Est. Profit</p><p class="font-semibold mono mt-1 text-emerald-dark dark:text-emerald-soft">₹${r.profit.estimated_profit.toLocaleString('en-IN')}</p></div>
          <div><p class="text-ink/50 dark:text-paper/50 text-xs">ROI</p><p class="font-semibold mono mt-1">${r.profit.roi_percent}%</p></div>
        </div>
      </div>

      <div class="flex gap-3">
        <button id="export-pdf" class="btn-ghost flex-1 flex items-center justify-center gap-2 text-sm"><i class="fa-solid fa-file-pdf"></i> Export PDF</button>
        <button id="new-prediction" class="btn-ghost flex-1 flex items-center justify-center gap-2 text-sm"><i class="fa-solid fa-rotate"></i> New Prediction</button>
      </div>
    `;

    document.getElementById('new-prediction').addEventListener('click', () => {
      resultPanel.classList.add('hidden'); emptyState.classList.remove('hidden');
      window.scrollTo({ top: form.offsetTop - 120, behavior: 'smooth' });
    });
    document.getElementById('export-pdf').addEventListener('click', () => exportPDF(r, inputs));
  }

  function exportPDF(r, inputs) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFillColor(11, 61, 46); doc.rect(0, 0, 210, 32, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(18); doc.text('AgriYield AI — Prediction Report', 14, 18);
    doc.setFontSize(10); doc.text(r.timestamp, 14, 26);

    doc.setTextColor(20, 20, 20); doc.setFontSize(13);
    let y = 45;
    doc.text(`Crop: ${inputs.Crop}  |  Season: ${inputs.Season}  |  State: ${inputs.State}, ${inputs.District}`, 14, y); y += 10;

    doc.setFontSize(22); doc.setTextColor(16, 129, 89);
    doc.text(`${r.yield_per_hectare} t/ha`, 14, y + 4);
    doc.setFontSize(10); doc.setTextColor(90, 90, 90);
    doc.text('Predicted Yield per Hectare', 14, y + 10); y += 24;

    doc.setTextColor(20, 20, 20); doc.setFontSize(11);
    const lines = [
      [`Expected Production`, `${r.expected_production} tons`],
      [`Confidence Score`, `${r.confidence_score}%`],
      [`Productivity Level`, r.productivity_level],
      [`Water Requirement`, `${r.water_requirement_mm} mm`],
      [`Best Fertilizer`, r.fertilizer_suggestion],
      [`Estimated Revenue`, `₹${r.profit.estimated_revenue.toLocaleString('en-IN')}`],
      [`Estimated Cost`, `₹${r.profit.estimated_cost.toLocaleString('en-IN')}`],
      [`Estimated Profit`, `₹${r.profit.estimated_profit.toLocaleString('en-IN')}`],
      [`ROI`, `${r.profit.roi_percent}%`],
    ];
    lines.forEach(([label, val]) => {
      doc.setFont(undefined, 'bold'); doc.text(label + ':', 14, y);
      doc.setFont(undefined, 'normal');
      const split = doc.splitTextToSize(String(val), 130);
      doc.text(split, 70, y);
      y += 8 * split.length;
    });

    y += 4;
    doc.setFont(undefined, 'bold'); doc.text('Soil Health Insights:', 14, y); y += 7;
    doc.setFont(undefined, 'normal');
    r.soil_health_insights.forEach(n => {
      const split = doc.splitTextToSize('• ' + n, 180);
      doc.text(split, 16, y); y += 6 * split.length;
    });

    doc.setFontSize(8); doc.setTextColor(140, 140, 140);
    doc.text('Generated by AgriYield AI — model estimate, not an agronomic guarantee.', 14, 287);
    doc.save(`AgriYield-Prediction-${r.id}.pdf`);
  }
});
