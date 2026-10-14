import { Elysia } from "elysia";
import { cors } from "@elysia/cors";
import { db } from "./db";
import { orders } from "./db/schema";
import { eq, desc } from "drizzle-orm";
import { telegramNotifier } from "./telegram";
import { adminHtml } from "./adminHtml";

// Store connected WebSocket clients
interface ClientSubscription {
  ws: any;
  orderId?: number;
  isAdmin?: boolean;
}

const activeSockets = new Set<ClientSubscription>();

function broadcastToOrder(orderId: number, data: any) {
  const payload = JSON.stringify(data);
  for (const client of activeSockets) {
    if (client.orderId === orderId || client.isAdmin) {
      try {
        client.ws.send(payload);
      } catch (e) {
        activeSockets.delete(client);
      }
    }
  }
}

function broadcastToAdmins(data: any) {
  const payload = JSON.stringify(data);
  for (const client of activeSockets) {
    if (client.isAdmin) {
      try {
        client.ws.send(payload);
      } catch (e) {
        activeSockets.delete(client);
      }
    }
  }
}

// Telegram status change handler
telegramNotifier.setStatusChangeHandler(async (orderId, status, minutes) => {
  const now = new Date().toISOString();
  const [updated] = await db
    .update(orders)
    .set({
      status,
      estimatedMinutes: minutes || 25,
      updatedAt: now,
    })
    .where(eq(orders.id, orderId))
    .returning();

  if (updated) {
    broadcastToOrder(orderId, {
      type: "order_status_changed",
      order: updated,
    });
  }
});

telegramNotifier.startPolling();

const app = new Elysia()
  .use(
    cors({
      origin: "*",
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    })
  )
  .onAfterHandle(({ response, set }) => {
    if (typeof response === "object" && !(response instanceof Response)) {
      set.headers["Content-Type"] = "application/json; charset=utf-8";
    }
  })
  // Admin Web Panel
  .get("/admin", () => {
    return new Response(adminHtml, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  })
  // Health check
  .get("/api/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))
  // Create order
  .post("/api/orders", async ({ body, set }: any) => {
    try {
      const {
        customerName,
        customerPhone,
        customerAddress,
        customerComment,
        items,
        totalAmount,
      } = body;

      if (!customerName || !customerPhone || !customerAddress) {
        set.status = 400;
        return { success: false, error: "Заполните имя, телефон и адрес" };
      }

      const nowStr = new Date().toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
      });

      const [newOrder] = await db
        .insert(orders)
        .values({
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerAddress: customerAddress.trim(),
          customerComment: customerComment ? customerComment.trim() : null,
          itemsJson: JSON.stringify(items || []),
          totalAmount: Number(totalAmount) || 0,
          status: "pending",
          estimatedMinutes: 25,
          createdAt: nowStr,
          updatedAt: new Date().toISOString(),
        })
        .returning();

      // Broadcast to connected admin dashboards
      broadcastToAdmins({
        type: "new_order",
        order: newOrder,
      });

      // Send to Telegram admin if configured
      await telegramNotifier.sendNewOrderAlert(newOrder);

      return {
        success: true,
        order: newOrder,
      };
    } catch (err: any) {
      console.error("Ошибка при создании заказа:", err);
      set.status = 500;
      return { success: false, error: err.message || "Ошибка сервера" };
    }
  })
  // List orders for admin
  .get("/api/orders", async () => {
    const allOrders = await db.select().from(orders).orderBy(desc(orders.id));
    return {
      success: true,
      orders: allOrders,
    };
  })
  // Get single order status
  .get("/api/orders/:id", async ({ params: { id }, set }: any) => {
    const orderId = parseInt(id, 10);
    const [found] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);

    if (!found) {
      set.status = 404;
      return { success: false, error: "Заказ не найден" };
    }

    return {
      success: true,
      order: found,
    };
  })
  // Update order status (Admin accept / reject)
  .patch("/api/orders/:id/status", async ({ params: { id }, body, set }: any) => {
    try {
      const orderId = parseInt(id, 10);
      const { status, estimatedMinutes, adminComment } = body;

      const [updated] = await db
        .update(orders)
        .set({
          status,
          ...(estimatedMinutes !== undefined ? { estimatedMinutes: Number(estimatedMinutes) } : {}),
          ...(adminComment !== undefined ? { adminComment } : {}),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(orders.id, orderId))
        .returning();

      if (!updated) {
        set.status = 404;
        return { success: false, error: "Заказ не найден" };
      }

      // Notify clients and admin
      broadcastToOrder(orderId, {
        type: "order_status_changed",
        order: updated,
      });

      return {
        success: true,
        order: updated,
      };
    } catch (err: any) {
      console.error("Ошибка при обновлении статуса:", err);
      set.status = 500;
      return { success: false, error: err.message || "Ошибка сервера" };
    }
  })
  // Real-time WebSocket
  .ws("/ws", {
    open(ws) {
      activeSockets.add({ ws });
    },
    message(ws, message: any) {
      try {
        const data = typeof message === "string" ? JSON.parse(message) : message;

        // Find client subscription
        for (const client of activeSockets) {
          if (client.ws === ws) {
            if (data.type === "subscribe_order") {
              client.orderId = Number(data.orderId);
            } else if (data.type === "subscribe_admin") {
              client.isAdmin = true;
            }
            break;
          }
        }
      } catch (err) {}
    },
    close(ws) {
      for (const client of activeSockets) {
        if (client.ws === ws) {
          activeSockets.delete(client);
          break;
        }
      }
    },
  })
  .listen(3000);

console.log(`🚀 Elysia backend запущен на http://localhost:${app.server?.port}`);
console.log(`👉 Панель администратора: http://localhost:${app.server?.port}/admin`);
