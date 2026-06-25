import { useState, useEffect } from "react";
import { Clock, ChevronRight } from "lucide-react";
import { useListOrders, useUpdateOrderStatus, getListOrdersQueryKey, formatEthiopianTime } from "@/lib/data";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const STATUS_ORDER = ["pending", "preparing", "ready"] as const;
type OrderStatus = typeof STATUS_ORDER[number];
const NEXT_STATUS: Record<OrderStatus, "preparing" | "ready" | "served"> = {
  pending: "preparing",
  preparing: "ready",
  ready: "served",
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  preparing: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  ready: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
};

const STATUS_ICONS: Record<OrderStatus, string> = {
  pending: "🟡",
  preparing: "🔵",
  ready: "🟢",
};

function ElapsedTimer({ createdAt }: { createdAt: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = new Date(createdAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [createdAt]);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  const isLate = m >= 15;
  return (
    <span className={`font-mono text-xs tabular-nums ${isLate ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
      {m}m {s}s {isLate ? "⚠️" : ""}
    </span>
  );
}

export default function OrderQueue() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: initialOrders = [], isLoading } = useListOrders({
    query: { staleTime: Infinity, refetchOnWindowFocus: false },
  });
  const updateStatus = useUpdateOrderStatus();
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [connected, setConnected] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    setOrders(initialOrders as any[]);
  }, [initialOrders]);

  useEffect(() => {
    const channel = supabase
      .channel("orders-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload: any) => {
        const row = payload.new;
        toast({ title: `🆕 New order — Table ${row.table_id}` });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => {
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      })
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Only show non-served orders in the queue. Served orders remain in the
  // database for analytics but are hidden from the live queue UI.
  const visibleOrders = orders.filter((o) => o.status !== "served");
  const activeOrders = visibleOrders.filter((o) => filter === "all" ? true : o.status === filter);
  const counts = STATUS_ORDER.reduce<Record<string, number>>((acc, s) => {
    acc[s] = visibleOrders.filter((o) => o.status === s).length;
    return acc;
  }, {});

  async function advance(orderId: number, currentStatus: OrderStatus) {
    const next = NEXT_STATUS[currentStatus];
    try {
      await updateStatus.mutateAsync({ id: orderId, data: { status: next } });
      toast({ title: next === "served" ? `✅ Order #${orderId} served` : `Order #${orderId} → ${next}` });
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
    } catch {
      toast({ title: "Error updating status", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className={`inline-flex w-2 h-2 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-amber-400 animate-ping"}`} />
        <span className="text-xs text-muted-foreground font-medium">
          {connected ? "Live — orders appear instantly" : "Connecting…"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {STATUS_ORDER.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(filter === s ? "all" : s)}
            className={`rounded-xl p-3 text-center transition-all border ${filter === s ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-secondary"}`}
          >
            <p className="text-lg font-bold">{counts[s]}</p>
            <p className="text-[10px] text-muted-foreground capitalize mt-0.5">{s}</p>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${filter === "all" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-border"}`}
        >
          All ({visibleOrders.length})
        </button>
        {STATUS_ORDER.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-all ${filter === s ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-border"}`}
          >
            {STATUS_ICONS[s]} {s} {counts[s] > 0 ? `(${counts[s]})` : ""}
          </button>
        ))}
      </div>

      {isLoading && orders.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl h-28 animate-pulse" />
          ))}
        </div>
      ) : activeOrders.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-card rounded-2xl border border-card-border">
          <Clock size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No orders {filter !== "all" ? `with status "${filter}"` : "yet"}</p>
          <p className="text-xs mt-1">Waiting for new orders…</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeOrders.map((order: any) => (
            <div key={order.id} data-testid={`card-order-${order.id}`} className="bg-card border border-card-border rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-serif font-bold text-lg">Table {order.tableId}</span>
                    <Badge className={`${STATUS_COLORS[order.status as OrderStatus]} border-0 capitalize text-xs`}>
                      {STATUS_ICONS[order.status as OrderStatus]} {order.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Clock size={11} className="text-muted-foreground" />
                    <ElapsedTimer createdAt={order.createdAt} />
                    <span className="text-xs text-muted-foreground">· #{order.id}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                    Placed {formatEthiopianTime(order.createdAt)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-accent text-lg">ETB {order.totalAmount.toFixed(0)}</p>
                  {order.paymentMethod && <p className="text-xs text-muted-foreground capitalize">{order.paymentMethod}</p>}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(order.items || []).map((item: any) => (
                  <span key={item.id} className="bg-secondary text-secondary-foreground text-xs rounded-full px-2.5 py-1 font-medium">
                    {item.nameEn} ×{item.quantity}
                  </span>
                ))}
              </div>
              <Button
                data-testid={`button-advance-${order.id}`}
                onClick={() => advance(order.id, order.status as OrderStatus)}
                disabled={updateStatus.isPending}
                size="sm"
                className="self-end flex items-center gap-1"
              >
                Mark as {NEXT_STATUS[order.status as OrderStatus]}
                <ChevronRight size={14} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
