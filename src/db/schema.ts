import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerAddress: text("customer_address").notNull(),
  customerComment: text("customer_comment"),
  itemsJson: text("items_json").notNull(),
  totalAmount: integer("total_amount").notNull(),
  status: text("status").notNull().default("pending"), // 'pending' | 'accepted' | 'rejected' | 'delivered'
  adminComment: text("admin_comment"),
  estimatedMinutes: integer("estimated_minutes").default(25),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
