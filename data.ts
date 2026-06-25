import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// ===== Ethiopian (Addis Ababa, EAT — UTC+3) date/time formatters =====
// All timestamps shown in the app must be rendered in Ethiopian local time.
const ET_TZ = "Africa/Addis_Ababa";

export function formatEthiopianDateTime(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: ET_TZ,
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).format(d) + " EAT";
}

export function formatEthiopianTime(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: ET_TZ,
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d) + " EAT";
}

// ===== Types (camelCase API matching original) =====
export type MenuItem = {
  id: number;
  nameEn: string;
  nameAm: string;
  description?: string | null;
  price: number;
  category: string;
  imageUrl?: string | null;
  available: boolean;
  createdAt: string;
};

export type OrderItem = {
  id: number;
  orderId: number;
  menuItemId: number;
  nameEn: string;
  nameAm: string;
  quantity: number;
  unitPrice: number;
};

export type Order = {
  id: number;
  tableId: string;
  status: string;
  totalAmount: number;
  paymentMethod?: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
};

export type SentimentLog = {
  id: number;
  orderId?: number | null;
  tableId: string;
  emoji: string;
  createdAt: string;
};

// ===== Mappers =====
function mapMenuItem(row: any): MenuItem {
  return {
    id: row.id,
    nameEn: row.name_en,
    nameAm: row.name_am,
    description: row.description,
    price: Number(row.price),
    category: row.category,
    imageUrl: row.image_url,
    available: row.available,
    createdAt: row.created_at,
  };
}

function mapOrderItem(row: any): OrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    menuItemId: row.menu_item_id,
    nameEn: row.name_en,
    nameAm: row.name_am,
    quantity: row.quantity,
    unitPrice: Number(row.unit_price),
  };
}

function mapOrder(row: any): Order {
  return {
    id: row.id,
    tableId: row.table_id,
    status: row.status,
    totalAmount: Number(row.total_amount),
    paymentMethod: row.payment_method,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: (row.order_items || []).map(mapOrderItem),
  };
}

function mapSentiment(row: any): SentimentLog {
  return {
    id: row.id,
    orderId: row.order_id,
    tableId: row.table_id,
    emoji: row.emoji,
    createdAt: row.created_at,
  };
}

// ===== Query keys =====
export const getListMenuItemsQueryKey = () => ["menu_items"] as const;
export const getListOrdersQueryKey = () => ["orders"] as const;
export const getListSentimentLogsQueryKey = () => ["sentiment_logs"] as const;
export const getAnalyticsSummaryQueryKey = (period: string) => ["analytics_summary", period] as const;

// ===== Menu Items =====
const MENU_CACHE_KEY = "holly_cafe_menu_cache_v1";
function loadMenuCache(): MenuItem[] | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(MENU_CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : undefined;
  } catch { return undefined; }
}
function saveMenuCache(items: MenuItem[]) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(MENU_CACHE_KEY, JSON.stringify(items)); } catch {}
}

export function useListMenuItems() {
  return useQuery({
    queryKey: getListMenuItemsQueryKey(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .order("id", { ascending: true });
      if (error) throw error;
      const items = (data ?? []).map(mapMenuItem);
      saveMenuCache(items);
      return items;
    },
    initialData: loadMenuCache(),
    // Keep zero stale time so any focus / reconnect / visibility return on
    // mobile pulls the latest menu instantly. Mobile browsers (especially
    // iOS Safari) throttle background WebSockets, so we cannot rely on
    // realtime alone — focus refetch is the safety net.
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });
}

export function useCreateMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ data }: { data: Partial<MenuItem> & { nameEn: string; nameAm: string; price: number; category: string } }) => {
      const { data: row, error } = await supabase
        .from("menu_items")
        .insert({
          name_en: data.nameEn,
          name_am: data.nameAm,
          description: data.description ?? null,
          price: data.price,
          category: data.category,
          image_url: data.imageUrl ?? null,
          available: data.available ?? true,
        })
        .select()
        .single();
      if (error) throw error;
      return mapMenuItem(row);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: getListMenuItemsQueryKey() }),
  });
}

export function useUpdateMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<MenuItem> }) => {
      const patch: any = {};
      if (data.nameEn !== undefined) patch.name_en = data.nameEn;
      if (data.nameAm !== undefined) patch.name_am = data.nameAm;
      if (data.description !== undefined) patch.description = data.description ?? null;
      if (data.price !== undefined) patch.price = data.price;
      if (data.category !== undefined) patch.category = data.category;
      if (data.imageUrl !== undefined) patch.image_url = data.imageUrl ?? null;
      if (data.available !== undefined) patch.available = data.available;
      const { data: row, error } = await supabase
        .from("menu_items")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return mapMenuItem(row);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: getListMenuItemsQueryKey() }),
  });
}

export function useDeleteMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: number }) => {
      const { error } = await supabase.from("menu_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: getListMenuItemsQueryKey() }),
  });
}

// ===== Orders =====
export function useListOrders(opts?: { query?: { staleTime?: number; refetchOnWindowFocus?: boolean } }) {
  return useQuery({
    queryKey: getListOrdersQueryKey(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(mapOrder);
    },
    staleTime: opts?.query?.staleTime,
    refetchOnWindowFocus: opts?.query?.refetchOnWindowFocus,
  });
}

export async function fetchOrderById(id: number): Promise<Order | null> {
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapOrder(data) : null;
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ data }: { data: { tableId: string; paymentMethod?: string; items: { menuItemId: number; quantity: number }[] } }) => {
      // Fetch menu items to compute price + names server-side-ish
      const ids = data.items.map((i) => i.menuItemId);
      const { data: menuRows, error: mErr } = await supabase
        .from("menu_items")
        .select("*")
        .in("id", ids);
      if (mErr) throw mErr;
      const menuById = new Map((menuRows ?? []).map((m: any) => [m.id, m]));
      let total = 0;
      const orderItemsPayload = data.items.map((it) => {
        const m: any = menuById.get(it.menuItemId);
        if (!m) throw new Error("Menu item not found");
        const price = Number(m.price);
        total += price * it.quantity;
        return {
          menu_item_id: m.id,
          name_en: m.name_en,
          name_am: m.name_am,
          quantity: it.quantity,
          unit_price: price,
        };
      });

      const { data: orderRow, error: oErr } = await supabase
        .from("orders")
        .insert({
          table_id: data.tableId,
          status: "pending",
          total_amount: total,
          payment_method: data.paymentMethod ?? null,
        })
        .select()
        .single();
      if (oErr) throw oErr;

      const itemsWithOrderId = orderItemsPayload.map((p) => ({ ...p, order_id: orderRow.id }));
      const { error: iErr } = await supabase.from("order_items").insert(itemsWithOrderId);
      if (iErr) throw iErr;

      return mapOrder({ ...orderRow, order_items: itemsWithOrderId.map((p, idx) => ({ ...p, id: idx })) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: getListOrdersQueryKey() }),
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { status: string } }) => {
      const { data: row, error } = await supabase
        .from("orders")
        .update({ status: data.status })
        .eq("id", id)
        .select("*, order_items(*)")
        .single();
      if (error) throw error;
      return mapOrder(row);
    },
    // Optimistic update — UI reflects the new status in <1s without waiting
    // for the network round-trip. Realtime will reconcile any drift.
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: getListOrdersQueryKey() });
      const prev = qc.getQueryData<Order[]>(getListOrdersQueryKey());
      if (prev) {
        qc.setQueryData<Order[]>(
          getListOrdersQueryKey(),
          prev.map((o) => (o.id === id ? { ...o, status: data.status } : o)),
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(getListOrdersQueryKey(), ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: getListOrdersQueryKey() }),
  });
}

export async function deleteOrder(id: number) {
  await supabase.from("order_items").delete().eq("order_id", id);
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteAllServedOrders(): Promise<number> {
  const { data: served, error: sErr } = await supabase
    .from("orders")
    .select("id")
    .eq("status", "served");
  if (sErr) throw sErr;
  const ids = (served ?? []).map((r: any) => r.id);
  if (ids.length === 0) return 0;
  await supabase.from("order_items").delete().in("order_id", ids);
  const { error } = await supabase.from("orders").delete().in("id", ids);
  if (error) throw error;
  return ids.length;
}

// ===== Sentiment =====
export function useListSentimentLogs() {
  return useQuery({
    queryKey: getListSentimentLogsQueryKey(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sentiment_logs")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(mapSentiment);
    },
  });
}

export function useCreateSentimentLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ data }: { data: { tableId: string; emoji: string; orderId?: number } }) => {
      const { data: row, error } = await supabase
        .from("sentiment_logs")
        .insert({
          table_id: data.tableId,
          emoji: data.emoji,
          order_id: data.orderId ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return mapSentiment(row);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: getListSentimentLogsQueryKey() }),
  });
}

export async function deleteAllSentiments(): Promise<number> {
  const { data: all, error: sErr } = await supabase.from("sentiment_logs").select("id");
  if (sErr) throw sErr;
  const ids = (all ?? []).map((r: any) => r.id);
  if (ids.length === 0) return 0;
  const { error } = await supabase.from("sentiment_logs").delete().in("id", ids);
  if (error) throw error;
  return ids.length;
}

// Clear all analytics data (orders + order_items + sentiment_logs) for a given period.
// Used by the Analytics "Clear All" buttons. Deletes only data within the period window.
export async function clearAnalyticsForPeriod(period: "day" | "week" | "month" | "year"): Promise<{ orders: number; sentiments: number }> {
  const now = new Date();
  let start: Date;
  if (period === "day") {
    start = new Date(now); start.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    start = new Date(now); start.setHours(0, 0, 0, 0);
    const dow = (start.getDay() + 6) % 7; // 0 = Monday
    start.setDate(start.getDate() - dow);
  } else if (period === "month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  } else {
    start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
  }
  const sinceIso = start.toISOString();

  const { data: orderRows, error: oErr } = await supabase
    .from("orders").select("id").gte("created_at", sinceIso);
  if (oErr) throw oErr;
  const orderIds = (orderRows ?? []).map((r: any) => r.id);

  if (orderIds.length > 0) {
    await supabase.from("order_items").delete().in("order_id", orderIds);
    const { error: dErr } = await supabase.from("orders").delete().in("id", orderIds);
    if (dErr) throw dErr;
  }

  const { data: sRows, error: sErr } = await supabase
    .from("sentiment_logs").select("id").gte("created_at", sinceIso);
  if (sErr) throw sErr;
  const sIds = (sRows ?? []).map((r: any) => r.id);
  if (sIds.length > 0) {
    const { error: dsErr } = await supabase.from("sentiment_logs").delete().in("id", sIds);
    if (dsErr) throw dsErr;
  }

  return { orders: orderIds.length, sentiments: sIds.length };
}

// ===== Analytics =====
function periodStart(period: "day" | "week" | "month" | "year"): Date {
  const now = new Date();
  const d = new Date(now);
  if (period === "day") {
    d.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    d.setDate(d.getDate() - 7);
  } else if (period === "month") {
    d.setMonth(d.getMonth() - 1);
  } else {
    d.setFullYear(d.getFullYear() - 1);
  }
  return d;
}

export function useGetAnalyticsSummary({ period }: { period: "day" | "week" | "month" | "year" }) {
  return useQuery({
    queryKey: getAnalyticsSummaryQueryKey(period),
    queryFn: async () => {
      const since = periodStart(period).toISOString();
      const [ordersRes, menuRes, sentimentRes] = await Promise.all([
        supabase.from("orders").select("*, order_items(*)").gte("created_at", since),
        supabase.from("menu_items").select("id, category"),
        supabase.from("sentiment_logs").select("emoji, created_at").gte("created_at", since),
      ]);
      if (ordersRes.error) throw ordersRes.error;
      if (menuRes.error) throw menuRes.error;
      if (sentimentRes.error) throw sentimentRes.error;

      const mapped = (ordersRes.data ?? []).map(mapOrder);
      const categoryByItem = new Map<number, string>(
        (menuRes.data ?? []).map((m: any) => [m.id, m.category])
      );

      const totalRevenue = mapped.reduce((s, o) => s + o.totalAmount, 0);
      const totalOrders = mapped.length;
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const ordersByStatus: Record<string, number> = { pending: 0, preparing: 0, ready: 0, served: 0 };
      for (const o of mapped) ordersByStatus[o.status] = (ordersByStatus[o.status] || 0) + 1;

      // Top items
      const itemAgg = new Map<number, { menuItemId: number; nameEn: string; nameAm: string; totalQuantity: number; totalRevenue: number }>();
      // Category revenue
      const categoryAgg = new Map<string, number>();
      // Hour & day
      const hourAgg = new Array(24).fill(0).map(() => ({ orders: 0, revenue: 0 }));
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dayAgg = dayNames.map((d) => ({ day: d, orders: 0, revenue: 0 }));
      // Revenue over time
      const timeAgg = new Map<string, { date: string; revenue: number; orders: number }>();

      for (const o of mapped) {
        const dt = new Date(o.createdAt);
        hourAgg[dt.getHours()].orders += 1;
        hourAgg[dt.getHours()].revenue += o.totalAmount;
        dayAgg[dt.getDay()].orders += 1;
        dayAgg[dt.getDay()].revenue += o.totalAmount;

        const bucket = period === "day"
          ? `${dt.getHours().toString().padStart(2, "0")}:00`
          : dt.toISOString().slice(0, 10);
        const tcur = timeAgg.get(bucket) ?? { date: bucket, revenue: 0, orders: 0 };
        tcur.revenue += o.totalAmount;
        tcur.orders += 1;
        timeAgg.set(bucket, tcur);

        for (const it of o.items) {
          const cur = itemAgg.get(it.menuItemId) ?? { menuItemId: it.menuItemId, nameEn: it.nameEn, nameAm: it.nameAm, totalQuantity: 0, totalRevenue: 0 };
          cur.totalQuantity += it.quantity;
          cur.totalRevenue += it.quantity * it.unitPrice;
          itemAgg.set(it.menuItemId, cur);

          const cat = categoryByItem.get(it.menuItemId) ?? "Other";
          categoryAgg.set(cat, (categoryAgg.get(cat) ?? 0) + it.quantity * it.unitPrice);
        }
      }

      const topItems = Array.from(itemAgg.values()).sort((a, b) => b.totalQuantity - a.totalQuantity).slice(0, 5);
      const revenueByCategory = Array.from(categoryAgg.entries())
        .map(([category, revenue]) => ({ category, revenue }))
        .sort((a, b) => b.revenue - a.revenue);
      const busiestHours = hourAgg.map((h, i) => ({ hour: `${i.toString().padStart(2, "0")}:00`, orders: h.orders, revenue: h.revenue }));
      const peakDays = dayAgg;
      const revenueOverTime = Array.from(timeAgg.values()).sort((a, b) => a.date.localeCompare(b.date));

      // Sentiment score: 😡=1, 😐=2, 🙂=3, 😍=4
      const SENT_MAP: Record<string, number> = { "😡": 1, "😐": 2, "🙂": 3, "😍": 4 };
      const sentiments = (sentimentRes.data ?? []) as any[];
      const sentScores = sentiments.map((s) => SENT_MAP[s.emoji] ?? 0).filter((n) => n > 0);
      const sentimentScore = sentScores.length > 0
        ? sentScores.reduce((a, b) => a + b, 0) / sentScores.length
        : 0;
      const sentimentCount = sentScores.length;
      const sentimentBreakdown = ["😡", "😐", "🙂", "😍"].map((emoji) => ({
        emoji,
        count: sentiments.filter((s) => s.emoji === emoji).length,
      }));

      return {
        totalRevenue,
        totalOrders,
        averageOrderValue,
        ordersByStatus,
        topItems,
        revenueByCategory,
        busiestHours,
        peakDays,
        revenueOverTime,
        sentimentScore,
        sentimentCount,
        sentimentBreakdown,
      };
    },
    staleTime: 30 * 1000,
  });
}

// ===== Settings (localStorage) =====
export type PaymentMethod = { id: string; name: string; account: string; color: string };
export type AppSettings = { paymentMethods: PaymentMethod[] };

const DEFAULT_SETTINGS: AppSettings = {
  paymentMethods: [
    { id: "cbe", name: "Commercial Bank of Ethiopia (CBE)", account: "1000123456789", color: "blue" },
    { id: "telebirr", name: "Telebirr", account: "0911 234 567", color: "green" },
    { id: "ebirr", name: "E-birr", account: "0922 345 678", color: "orange" },
  ],
};

const SETTINGS_KEY = "holly_cafe_settings_v1";

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return JSON.parse(raw) as AppSettings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: AppSettings): AppSettings {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  }
  return s;
}

// ===== Settings (Supabase-backed, realtime synced) =====
export const getAppSettingsQueryKey = () => ["app_settings"] as const;

function cacheSettings(s: AppSettings) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
}

async function fetchAppSettings(): Promise<AppSettings> {
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "app")
    .maybeSingle();
  if (error) throw error;
  const value = (data?.value as AppSettings | undefined) ?? DEFAULT_SETTINGS;
  cacheSettings(value);
  return value;
}

export function useAppSettings() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: getAppSettingsQueryKey(),
    queryFn: fetchAppSettings,
    initialData: loadSettings(),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });
  useEffect(() => {
    const channel = supabase
      .channel("settings-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "settings", filter: "key=eq.app" }, (payload: any) => {
        const next = payload.eventType === "DELETE"
          ? DEFAULT_SETTINGS
          : (payload.new?.value as AppSettings | undefined);
        if (next?.paymentMethods) {
          cacheSettings(next);
          qc.setQueryData(getAppSettingsQueryKey(), next);
        }
        qc.invalidateQueries({ queryKey: getAppSettingsQueryKey() });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);
  return query;
}

export async function saveAppSettings(s: AppSettings): Promise<AppSettings> {
  cacheSettings(s);
  const { error } = await supabase
    .from("settings")
    .upsert({ key: "app", value: s as any, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
  return s;
}