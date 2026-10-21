// ============ AgriYield AI — global behaviours ============
document.addEventListener('DOMContentLoaded', () => {

  /* loader curtain */
  const loader = document.getElementById('loader');
  window.addEventListener('load', () => setTimeout(() => loader.classList.add('hide'), 400));
  setTimeout(() => loader && loader.classList.add('hide'), 2200);

  /* AOS */
  if (window.AOS) AOS.init({ duration: 800, once: true, easing: 'ease-out-cubic', offset: 60 });

  /* nav scroll state */
  const nav = document.getElementById('site-nav');
  const onScroll = () => { window.scrollY > 24 ? nav.classList.add('scrolled') : nav.classList.remove('scrolled'); };
  onScroll(); window.addEventListener('scroll', onScroll);

  /* mobile menu */
  const burger = document.getElementById('nav-burger');
  const mobileMenu = document.getElementById('mobile-menu');
  burger && burger.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));

  /* dark mode */
  const root = document.documentElement;
  const themeBtn = document.getElementById('theme-toggle');
  const applyTheme = (t) => { t === 'dark' ? root.classList.add('dark') : root.classList.remove('dark'); localStorage.setItem('agri-theme', t); };
  applyTheme(localStorage.getItem('agri-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  themeBtn && themeBtn.addEventListener('click', () => applyTheme(root.classList.contains('dark') ? 'light' : 'dark'));

  /* animated counters */
  const counters = document.querySelectorAll('[data-counter]');
  const runCounter = (el) => {
    const target = parseFloat(el.dataset.counter);
    const decimals = (el.dataset.counter.split('.')[1] || '').length;
    const suffix = el.dataset.suffix || '';
    const dur = 1600; const start = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * eased).toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { runCounter(e.target); io.unobserve(e.target); } });
  }, { threshold: 0.4 });
  counters.forEach(c => io.observe(c));

  /* floating leaves */
  const leafHost = document.getElementById('leaf-particles');
  if (leafHost) {
    const emojis = ['🍃', '🌿', '🌾'];
    for (let i = 0; i < 14; i++) {
      const s = document.createElement('span');
      s.className = 'leaf'; s.textContent = emojis[i % emojis.length];
      s.style.left = Math.random() * 100 + '%';
      s.style.fontSize = (12 + Math.random() * 18) + 'px';
      s.style.animationDuration = (10 + Math.random() * 12) + 's';
      s.style.animationDelay = (Math.random() * 10) + 's';
      leafHost.appendChild(s);
    }
  }

  /* toast helper */
  window.showToast = (msg, icon = 'fa-circle-check', color = 'text-emerald') => {
    const stack = document.getElementById('toast-stack');
    if (!stack) return;
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<i class="fa-solid ${icon} ${color}"></i><span>${msg}</span>`;
    stack.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(20px)'; t.style.transition = 'all .4s ease'; setTimeout(() => t.remove(), 400); }, 3400);
  };

  /* ============ Chat assistant (Sprout) ============ */
  const chatToggle = document.getElementById('chat-toggle');
  const chatPanel = document.getElementById('chat-panel');
  const chatClose = document.getElementById('chat-close');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const chatBody = document.getElementById('chat-body');

  chatToggle && chatToggle.addEventListener('click', () => chatPanel.classList.toggle('hidden'));
  chatClose && chatClose.addEventListener('click', () => chatPanel.classList.add('hidden'));

  const addMsg = (text, who) => {
    const d = document.createElement('div');
    d.className = `chat-msg ${who}`;
    d.textContent = text;
    chatBody.appendChild(d);
    chatBody.scrollTop = chatBody.scrollHeight;
  };

  chatForm && chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = chatInput.value.trim();
    if (!q) return;
    addMsg(q, 'user');
    chatInput.value = '';
    const typing = document.createElement('div');
    typing.className = 'chat-msg bot'; typing.textContent = 'Sprout is typing…';
    chatBody.appendChild(typing); chatBody.scrollTop = chatBody.scrollHeight;
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: q }) });
      const data = await res.json();
      typing.remove();
      addMsg(data.reply, 'bot');
    } catch (err) {
      typing.remove();
      addMsg("I'm having trouble connecting right now — please try again in a moment.", 'bot');
    }
  });

});
