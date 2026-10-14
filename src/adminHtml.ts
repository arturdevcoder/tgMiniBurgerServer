export const adminHtml = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Панель Администратора · YUMMY</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: { sans: ['Inter', 'sans-serif'] },
          colors: { brand: { DEFAULT: '#FF5722', dark: '#E64A19', light: '#FFF0ED' } }
        }
      }
    }
  </script>
</head>
<body class="bg-gray-100 text-gray-800 min-h-screen">
  <header class="bg-white shadow-sm border-b sticky top-0 z-30">
    <div class="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-gray-950 rounded-xl flex items-center justify-center text-xl shadow">🍔</div>
        <div>
          <h1 class="text-lg font-black text-gray-900 leading-none">YUMMY · АДМИНКА</h1>
          <p class="text-xs text-gray-500 font-medium">Управление и подтверждение заказов</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <span id="ws-status" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <span class="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
          Подключение...
        </span>
        <button onclick="fetchOrders()" class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-semibold text-gray-700 transition">
          <i class="fa-solid fa-arrows-rotate mr-1"></i> Обновить
        </button>
      </div>
    </div>
  </header>

  <main class="max-w-6xl mx-auto px-4 py-6">
    <!-- Stats banner -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <div class="bg-white rounded-2xl p-4 shadow-sm border border-amber-100 flex items-center justify-between">
        <div>
          <p class="text-xs font-semibold text-amber-600 uppercase tracking-wider">Новые / Ожидают</p>
          <p id="pending-count" class="text-3xl font-black text-gray-900 mt-1">0</p>
        </div>
        <div class="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500 text-xl font-bold">⏳</div>
      </div>

      <div class="bg-white rounded-2xl p-4 shadow-sm border border-green-100 flex items-center justify-between">
        <div>
          <p class="text-xs font-semibold text-green-600 uppercase tracking-wider">Принятые заказы</p>
          <p id="accepted-count" class="text-3xl font-black text-gray-900 mt-1">0</p>
        </div>
        <div class="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-500 text-xl font-bold">✅</div>
      </div>

      <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between">
        <div>
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Всего заказов</p>
          <p id="total-count" class="text-3xl font-black text-gray-900 mt-1">0</p>
        </div>
        <div class="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center text-gray-500 text-xl font-bold">📦</div>
      </div>
    </div>

    <!-- Orders container -->
    <div>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-bold text-gray-900">Список заказов в реальном времени</h2>
        <div class="flex gap-2">
          <button onclick="setFilter('all')" id="btn-all" class="px-3 py-1 rounded-full text-xs font-semibold bg-gray-900 text-white transition">Все</button>
          <button onclick="setFilter('pending')" id="btn-pending" class="px-3 py-1 rounded-full text-xs font-semibold bg-white text-gray-700 hover:bg-gray-100 transition">Ожидают</button>
          <button onclick="setFilter('accepted')" id="btn-accepted" class="px-3 py-1 rounded-full text-xs font-semibold bg-white text-gray-700 hover:bg-gray-100 transition">Принятые</button>
        </div>
      </div>

      <div id="orders-list" class="space-y-4">
        <!-- Rendered via JS -->
      </div>
    </div>
  </main>

  <script>
    let orders = [];
    let currentFilter = 'all';
    let ws = null;

    function playSound() {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } catch (e) {}
    }

    function initWs() {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = proto + '//' + location.host + '/ws';
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        const badge = document.getElementById('ws-status');
        badge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200';
        badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-green-500"></span> Live подключен';
        ws.send(JSON.stringify({ type: 'subscribe_admin' }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'new_order') {
            playSound();
            fetchOrders();
          } else if (data.type === 'order_status_changed') {
            fetchOrders();
          }
        } catch (e) {}
      };

      ws.onclose = () => {
        const badge = document.getElementById('ws-status');
        badge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200';
        badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span> Переподключение...';
        setTimeout(initWs, 3000);
      };
    }

    async function fetchOrders() {
      try {
        const res = await fetch('/api/orders');
        const data = await res.json();
        orders = data.orders || [];
        updateStats();
        renderOrders();
      } catch (e) {
        console.error(e);
      }
    }

    function setFilter(f) {
      currentFilter = f;
      ['all', 'pending', 'accepted'].forEach(k => {
        const btn = document.getElementById('btn-' + k);
        if (k === f) {
          btn.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-gray-900 text-white transition';
        } else {
          btn.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-white text-gray-700 hover:bg-gray-100 transition';
        }
      });
      renderOrders();
    }

    function updateStats() {
      const pending = orders.filter(o => o.status === 'pending').length;
      const accepted = orders.filter(o => o.status === 'accepted').length;
      document.getElementById('pending-count').innerText = pending;
      document.getElementById('accepted-count').innerText = accepted;
      document.getElementById('total-count').innerText = orders.length;
    }

    function renderOrders() {
      const container = document.getElementById('orders-list');
      const filtered = orders.filter(o => {
        if (currentFilter === 'pending') return o.status === 'pending';
        if (currentFilter === 'accepted') return o.status === 'accepted';
        return true;
      });

      if (filtered.length === 0) {
        container.innerHTML = \`
          <div class="bg-white rounded-2xl p-12 text-center text-gray-400">
            <i class="fa-solid fa-clipboard-check text-4xl mb-3 text-gray-300"></i>
            <p class="font-medium text-sm">Нет заказов в этой категории</p>
          </div>
        \`;
        return;
      }

      container.innerHTML = filtered.map(order => {
        let items = [];
        try { items = JSON.parse(order.itemsJson); } catch (e) {}

        const isPending = order.status === 'pending';
        const isAccepted = order.status === 'accepted';
        const isRejected = order.status === 'rejected';

        let badge = '<span class="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">⏳ Ожидает решения</span>';
        if (isAccepted) badge = \`<span class="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">✅ Принят (\${order.estimatedMinutes || 25} мин)</span>\`;
        if (isRejected) badge = '<span class="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800">❌ Отклонен</span>';

        return \`
          <div class="bg-white rounded-2xl p-5 shadow-sm border \${isPending ? 'border-amber-300 ring-2 ring-amber-100' : 'border-gray-200'} transition">
            <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b">
              <div class="flex items-center gap-3">
                <span class="text-lg font-black text-gray-900">Заказ #\${order.id}</span>
                <span class="text-xs text-gray-400 font-medium">\${order.createdAt}</span>
              </div>
              <div>\${badge}</div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <div class="space-y-1.5 text-sm">
                <p><span class="text-gray-400 text-xs">Клиент:</span> <span class="font-bold text-gray-800">\${order.customerName}</span></p>
                <p><span class="text-gray-400 text-xs">Телефон:</span> <a href="tel:\${order.customerPhone}" class="font-bold text-brand hover:underline">\${order.customerPhone}</a></p>
                <p><span class="text-gray-400 text-xs">Адрес:</span> <span class="font-semibold text-gray-800">\${order.customerAddress}</span></p>
                \${order.customerComment ? \`<p><span class="text-gray-400 text-xs">Комментарий:</span> <span class="italic text-gray-600">\${order.customerComment}</span></p>\` : ''}
              </div>

              <div class="bg-gray-50 rounded-xl p-3">
                <p class="text-xs font-bold text-gray-500 uppercase mb-2">Состав заказа</p>
                <div class="space-y-2 max-h-48 overflow-y-auto pr-1">
                  \${items.map(it => \`
                    <div class="flex items-start justify-between text-xs">
                      <div>
                        <span class="font-bold text-gray-800">\${it.name}</span>
                        <span class="text-gray-500">(\${it.size}) × \${it.qty || 1}</span>
                        \${it.toppings ? \`<p class="text-[11px] text-gray-400">+ \${it.toppings}</p>\` : ''}
                      </div>
                      <span class="font-bold text-gray-900 shrink-0">\${it.price} ₽</span>
                    </div>
                  \`).join('')}
                </div>
                <div class="mt-3 pt-2 border-t border-gray-200 flex justify-between items-center font-black text-sm">
                  <span>Сумма к оплате:</span>
                  <span class="text-brand text-base">\${order.totalAmount} ₽</span>
                </div>
              </div>
            </div>

            <!-- Action buttons for admin -->
            <div class="pt-3 border-t flex flex-wrap gap-2 justify-end">
              \${isPending ? \`
                <button onclick="updateStatus(\${order.id}, 'accepted', 25)" class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold shadow-sm transition active:scale-95">
                  <i class="fa-solid fa-check mr-1.5"></i> Принять (25 мин)
                </button>
                <button onclick="updateStatus(\${order.id}, 'accepted', 45)" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition active:scale-95">
                  <i class="fa-solid fa-clock mr-1.5"></i> Принять (45 мин)
                </button>
                <button onclick="updateStatus(\${order.id}, 'rejected')" class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold shadow-sm transition active:scale-95">
                  <i class="fa-solid fa-xmark mr-1.5"></i> Отклонить
                </button>
              \` : isAccepted ? \`
                <span class="text-xs font-semibold text-green-700 self-center">Заказ подтвержден на \${order.estimatedMinutes || 25} мин</span>
                <button onclick="updateStatus(\${order.id}, 'delivered')" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition">
                  <i class="fa-solid fa-motorcycle mr-1"></i> Доставлен
                </button>
              \` : \`
                <span class="text-xs font-semibold text-red-600 self-center">Заказ был отклонен</span>
              \`}
            </div>
          </div>
        \`;
      }).join('');
    }

    async function updateStatus(orderId, status, minutes = 25) {
      try {
        const res = await fetch(\`/api/orders/\${orderId}/status\`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, estimatedMinutes: minutes })
        });
        const data = await res.json();
        if (data.success) {
          fetchOrders();
        } else {
          alert('Ошибка: ' + (data.error || 'Не удалось обновить статус'));
        }
      } catch (err) {
        alert('Ошибка сети: ' + err.message);
      }
    }

    // Auto-refresh fallback
    setInterval(fetchOrders, 4000);
    fetchOrders();
    initWs();
  </script>
</body>
</html>`;
