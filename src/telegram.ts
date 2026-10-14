export interface TelegramConfig {
  botToken?: string;
  adminChatId?: string;
}

export class TelegramNotifier {
  private botToken?: string;
  private adminChatId?: string;
  private proxy?: string;
  private apiBase: string;
  private isPolling = false;
  private lastUpdateId = 0;
  private onStatusChangeCallback?: (orderId: number, status: 'accepted' | 'rejected', minutes?: number) => Promise<void>;

  constructor() {
    this.botToken = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
    this.adminChatId = process.env.ADMIN_CHAT_ID || process.env.TELEGRAM_ADMIN_CHAT_ID;
    this.proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.TELEGRAM_PROXY;
    this.apiBase = process.env.TELEGRAM_API_BASE || 'https://api.telegram.org';
  }

  private async request(endpoint: string, options: any = {}) {
    const fetchOpts: any = {
      ...options,
      signal: options.signal || AbortSignal.timeout(10000),
    };
    if (this.proxy) {
      fetchOpts.proxy = this.proxy;
    }
    return fetch(`${this.apiBase}/bot${this.botToken}/${endpoint}`, fetchOpts);
  }

  public setStatusChangeHandler(handler: (orderId: number, status: 'accepted' | 'rejected', minutes?: number) => Promise<void>) {
    this.onStatusChangeCallback = handler;
  }

  public async sendNewOrderAlert(order: {
    id: number;
    customerName: string;
    customerPhone: string;
    customerAddress: string;
    customerComment?: string | null;
    itemsJson: string;
    totalAmount: number;
  }) {
    if (!this.botToken || !this.adminChatId) {
      console.log(`ℹ️ Telegram Bot не настроен (BOT_TOKEN или ADMIN_CHAT_ID не указаны). Заказ #${order.id} можно подтвердить в веб-панели /admin`);
      return;
    }

    try {
      const items = JSON.parse(order.itemsJson);
      const itemsText = items
        .map((it: any) => `• <b>${it.name}</b> (${it.size}) × ${it.qty || 1} — ${it.price} ₽${it.toppings ? `\n  <i>+ ${it.toppings}</i>` : ''}`)
        .join('\n');

      const message = `🔔 <b>НОВЫЙ ЗАКАЗ #${order.id}!</b>\n\n` +
        `👤 <b>Клиент:</b> ${order.customerName}\n` +
        `📞 <b>Телефон:</b> ${order.customerPhone}\n` +
        `📍 <b>Адрес:</b> ${order.customerAddress}\n` +
        (order.customerComment ? `💬 <b>Комментарий:</b> ${order.customerComment}\n` : '') +
        `\n🛒 <b>Состав:</b>\n${itemsText}\n\n` +
        `💰 <b>Итого к оплате:</b> <b>${order.totalAmount} ₽</b>`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: '✅ Принять (25 мин)', callback_data: `accept_${order.id}_25` },
            { text: '⏱ Принять (45 мин)', callback_data: `accept_${order.id}_45` },
          ],
          [
            { text: '❌ Отклонить заказ', callback_data: `reject_${order.id}` },
          ],
        ],
      };

      const res = await this.request('sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.adminChatId,
          text: message,
          parse_mode: 'HTML',
          reply_markup: keyboard,
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        console.error('Ошибка ответа Telegram API:', data);
      } else {
        console.log(`✅ Заказ #${order.id} успешно отправлен в Telegram бот админу!`);
      }
    } catch (err: any) {
      console.warn(`⚠️ Не удалось связаться с api.telegram.org (${err.message || 'сеть'}). Заказ доступен в панели: http://localhost:3000/admin`);
    }
  }

  public startPolling() {
    if (!this.botToken) return;
    if (this.isPolling) return;
    this.isPolling = true;

    console.log('🤖 Запущен Telegram Bot listener для подтверждения заказов админом...');

    const poll = async () => {
      while (this.isPolling) {
        try {
          const res = await this.request(
            `getUpdates?offset=${this.lastUpdateId + 1}&timeout=20`,
            { signal: AbortSignal.timeout(25000) }
          );
          const data = await res.json();
          if (data.ok && Array.isArray(data.result)) {
            for (const update of data.result) {
              this.lastUpdateId = update.update_id;

              if (update.callback_query) {
                const cq = update.callback_query;
                const callbackData = cq.data || '';

                if (callbackData.startsWith('accept_')) {
                  const parts = callbackData.split('_');
                  const orderId = parseInt(parts[1], 10);
                  const minutes = parseInt(parts[2], 10) || 25;

                  if (this.onStatusChangeCallback) {
                    await this.onStatusChangeCallback(orderId, 'accepted', minutes);
                  }

                  // Answer callback
                  await this.request('answerCallbackQuery', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: AbortSignal.timeout(5000),
                    body: JSON.stringify({
                      callback_query_id: cq.id,
                      text: `Заказ #${orderId} принят на ${minutes} мин!`,
                    }),
                  }).catch(() => {});

                  // Edit original message text
                  if (cq.message) {
                    await this.request('editMessageText', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      signal: AbortSignal.timeout(5000),
                      body: JSON.stringify({
                        chat_id: cq.message.chat.id,
                        message_id: cq.message.message_id,
                        text: cq.message.text + `\n\n✅ <b>ЗАКАЗ ПРИНЯТ АДМИНИСТРАТОРОМ!</b>\n⏱ Время ожидания: ~${minutes} мин`,
                        parse_mode: 'HTML',
                      }),
                    }).catch(() => {});
                  }
                } else if (callbackData.startsWith('reject_')) {
                  const orderId = parseInt(callbackData.split('_')[1], 10);

                  if (this.onStatusChangeCallback) {
                    await this.onStatusChangeCallback(orderId, 'rejected');
                  }

                  await this.request('answerCallbackQuery', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: AbortSignal.timeout(5000),
                    body: JSON.stringify({
                      callback_query_id: cq.id,
                      text: `Заказ #${orderId} отклонен!`,
                    }),
                  }).catch(() => {});

                  if (cq.message) {
                    await this.request('editMessageText', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      signal: AbortSignal.timeout(5000),
                      body: JSON.stringify({
                        chat_id: cq.message.chat.id,
                        message_id: cq.message.message_id,
                        text: cq.message.text + `\n\n❌ <b>ЗАКАЗ ОТКЛОНЕН АДМИНИСТРАТОРОМ</b>`,
                        parse_mode: 'HTML',
                      }),
                    }).catch(() => {});
                  }
                }
              }
            }
          }
        } catch (err) {
          // Wait before retry on network error or timeout
          await new Promise((r) => setTimeout(r, 4000));
        }
      }
    };

    poll();
  }

  public stopPolling() {
    this.isPolling = false;
  }
}

export const telegramNotifier = new TelegramNotifier();

