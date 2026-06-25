import { useState, useRef, useEffect, useCallback } from "react";
import { ShoppingCart, X, Plus, Minus, MessageCircle, Send, Mic, MicOff } from "lucide-react";
import { useListMenuItems, useCreateOrder, useCreateSentimentLog, getListOrdersQueryKey, getListMenuItemsQueryKey, getAppSettingsQueryKey, useAppSettings } from "@/lib/data";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface CartItem {
  menuItemId: number;
  nameEn: string;
  nameAm: string;
  price: number;
  quantity: number;
  imageUrl?: string | null;
}

type MenuItem = {
  id: number;
  nameEn: string;
  nameAm: string;
  description?: string | null;
  price: number;
  category: string;
  imageUrl?: string | null;
  available: boolean;
};

interface IsraelMessage {
  role: "user" | "assistant";
  content: string;
}

const COLOR_MAP: Record<string, string> = {
  blue: "bg-blue-600",
  green: "bg-green-600",
  orange: "bg-orange-600",
  purple: "bg-purple-600",
  red: "bg-red-600",
  gray: "bg-gray-500",
};

const DEFAULT_PAYMENT_METHODS = [
  { id: "cbe", name: "Commercial Bank of Ethiopia (CBE)", account: "1000123456789", color: "blue" },
  { id: "telebirr", name: "Telebirr", account: "0911 234 567", color: "green" },
  { id: "ebirr", name: "E-birr", account: "0922 345 678", color: "orange" },
];

const CASH_METHOD = { id: "cash", name: "Cash", account: "Pay at the counter", color: "gray" };

const SENTIMENT_EMOJIS = ["😡", "😐", "🙂", "😍"];

const STATUS_INFO: Record<string, { label: string; icon: string; color: string }> = {
  pending:  { label: "Order Received",    icon: "🟡", color: "text-amber-600"       },
  preparing:{ label: "Preparing",         icon: "🔵", color: "text-blue-600"        },
  ready:    { label: "Ready for Pickup!", icon: "🟢", color: "text-green-600"       },
  served:   { label: "Served ✓",          icon: "✅", color: "text-muted-foreground" },
};

const WELCOME_TEXT = "እንኳን ወደ ሆሊ ካፌ በደህና መጡ! እኔ እስራኤል በላይ ነኝ። ዛሬ ምን ማዘዝ ይፈልጋሉ?";

// Cinematic intro — 4 animated phases
type IntroPhase = "enter" | "title" | "ai" | "exit" | "done";

function CinematicIntro({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<IntroPhase>("enter");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("title"), 500);
    const t2 = setTimeout(() => setPhase("ai"),   1800);
    const t3 = setTimeout(() => { setPhase("exit"); setTimeout(onDone, 900); }, 4500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const dismiss = () => {
    setPhase("exit");
    setTimeout(onDone, 600);
  };

  return (
    <>
      <style>{`
        @keyframes fadeUp   { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
        @keyframes scaleIn  { from { opacity:0; transform:scale(0.6) }       to { opacity:1; transform:scale(1)   } }
        @keyframes fadeIn   { from { opacity:0 }                              to { opacity:1 }                       }
        @keyframes ripple   { 0%,100% { transform:scale(1)   opacity:.4 }    50% { transform:scale(1.6) opacity:0 } }
        @keyframes pulse2   { 0%,100% { opacity:.6 } 50% { opacity:1 } }
        @keyframes slideUp  { from { opacity:0; transform:translateY(30px) } to { opacity:1; transform:translateY(0) } }
        @keyframes exitFade { from { opacity:1 } to { opacity:0 } }
        .anim-fade-up   { animation: fadeUp  .7s cubic-bezier(.22,1,.36,1) both }
        .anim-scale-in  { animation: scaleIn .8s cubic-bezier(.34,1.56,.64,1) both }
        .anim-fade-in   { animation: fadeIn  .6s ease both }
        .anim-slide-up  { animation: slideUp .7s cubic-bezier(.22,1,.36,1) both }
        .anim-exit      { animation: exitFade .8s ease both }
        .ripple-ring    { animation: ripple 2s ease-in-out infinite }
      `}</style>

      <div
        className={`fixed inset-0 z-[100] flex flex-col items-center justify-center cursor-pointer overflow-hidden ${phase === "exit" ? "anim-exit" : ""}`}
        style={{ background: "linear-gradient(160deg,#1c0e05 0%,#2d1a08 50%,#1a0d03 100%)" }}
        onClick={dismiss}
      >
        {/* Ambient background rings */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="ripple-ring absolute w-64 h-64 rounded-full border border-amber-600/10" style={{ animationDelay: "0s" }} />
          <div className="ripple-ring absolute w-96 h-96 rounded-full border border-amber-600/10" style={{ animationDelay: ".7s" }} />
          <div className="ripple-ring absolute w-[32rem] h-[32rem] rounded-full border border-amber-600/10" style={{ animationDelay: "1.4s" }} />
        </div>

        {/* Coffee icon — phase: enter */}
        {(phase === "enter" || phase === "title" || phase === "ai" || phase === "exit") && (
          <div className={`anim-scale-in flex flex-col items-center gap-6 px-8 max-w-sm w-full text-center`} style={{ animationDelay: "0.1s" }}>
            {/* Logo mark */}
            <div className="relative">
              <div className="w-24 h-24 rounded-full flex items-center justify-center text-5xl shadow-2xl"
                style={{ background: "linear-gradient(135deg,#c8891a,#a06010)" }}>
                ☕
              </div>
              <div className="absolute inset-0 rounded-full blur-xl opacity-40"
                style={{ background: "#c8891a", transform: "scale(1.3)" }} />
            </div>

            {/* Holly Cafe title */}
            {(phase === "title" || phase === "ai" || phase === "exit") && (
              <div className="anim-fade-up space-y-1" style={{ animationDelay: "0s" }}>
                <h1 className="text-5xl font-serif font-bold text-amber-50 tracking-wide drop-shadow-lg">Holly Cafe</h1>
                <p className="text-xs font-semibold tracking-[0.5em] text-amber-400/60 uppercase">Dire Dawa · Ethiopia</p>
              </div>
            )}

            {/* Israel Belay AI card */}
            {(phase === "ai" || phase === "exit") && (
              <div
                className="anim-slide-up w-full rounded-2xl px-6 py-5 space-y-2 border"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  borderColor: "rgba(200,137,26,0.25)",
                  backdropFilter: "blur(8px)",
                  animationDelay: "0s",
                }}
              >
                <div className="flex items-center justify-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center text-sm font-bold text-white">IB</div>
                  <div className="text-left">
                    <p className="text-amber-50 font-serif font-bold text-base leading-tight">እስራኤል በላይ</p>
                    <p className="text-amber-400/50 text-[10px] font-semibold tracking-widest uppercase">AI Hostess · Holly Cafe</p>
                  </div>
                </div>
                <p className="text-amber-100/90 text-base leading-relaxed font-light">
                  {WELCOME_TEXT}
                </p>
              </div>
            )}

            <p className="text-amber-200/25 text-xs mt-2">ለመቀጠል ይጫኑ</p>
          </div>
        )}
      </div>
    </>
  );
}

export default function MenuPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: menuItems = [], isLoading } = useListMenuItems();
  const createOrder = useCreateOrder();
  const createSentiment = useCreateSentimentLog();

  const tableId = typeof window === "undefined"
    ? "T1"
    : new URLSearchParams(window.location.search).get("table") || "T1";

  const [introVisible, setIntroVisible] = useState(true);
  const [menuMounted, setMenuMounted] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<"cart" | "payment" | "confirm">("cart");
  const [selectedPayment, setSelectedPayment] = useState<string | null>(null);
  const [sentimentOpen, setSentimentOpen] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<number | null>(null);
  const [trackedOrder, setTrackedOrder] = useState<{ id: number; status: string; tableId: string } | null>(null);
  const [israelOpen, setIsraelOpen] = useState(false);
  const [israelMessages, setIsraelMessages] = useState<IsraelMessage[]>([
    { role: "assistant", content: "እንኳን ወደ ሆሊ ካፌ በደህና መጡ! እኔ እስራኤል በላይ ነኝ። ምናሌያችን ከምን ላስተዋውቅዎ?" }
  ]);
  const [israelInput, setIsraelInput] = useState("");
  const [israelStreaming, setIsraelStreaming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [paymentMethods, setPaymentMethods] = useState(DEFAULT_PAYMENT_METHODS);
  const { data: appSettings } = useAppSettings();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  function handleIntroDone() {
    setIntroVisible(false);
    setMenuMounted(true);
  }

  useEffect(() => {
    if (appSettings?.paymentMethods?.length) setPaymentMethods(appSettings.paymentMethods);
  }, [appSettings]);

  useEffect(() => {
    if (!appSettings?.paymentMethods?.length) return;
    if (selectedPayment && !appSettings.paymentMethods.some((pm) => pm.id === selectedPayment)) {
      setSelectedPayment(null);
    }
  }, [appSettings, selectedPayment]);

  // FIX 1: Real-time menu sync — refresh menu instantly when staff add/edit/delete items
  useEffect(() => {
    const channel = supabase
      .channel("menu-items-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, () => {
        queryClient.invalidateQueries({ queryKey: getListMenuItemsQueryKey() });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "settings", filter: "key=eq.app" }, (payload: any) => {
        const next = payload.eventType === "DELETE" ? null : payload.new?.value;
        if (next?.paymentMethods?.length) {
          setPaymentMethods(next.paymentMethods);
          queryClient.setQueryData(getAppSettingsQueryKey(), next);
        }
        queryClient.invalidateQueries({ queryKey: getAppSettingsQueryKey() });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Mobile safety net: iOS Safari & Android Chrome throttle background
  // WebSockets, so realtime events get dropped while the screen is off or
  // the tab is hidden. When the page becomes visible / online again, force
  // a refetch of menu + settings so the customer always sees current data.
  useEffect(() => {
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: getListMenuItemsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getAppSettingsQueryKey() });
    };
    const onVisibility = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [queryClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [israelMessages]);

  // Realtime — customer sees order status changes the second staff updates them.
  useEffect(() => {
    if (!trackedOrder || trackedOrder.status === "served") return;
    const orderId = trackedOrder.id;
    const channel = supabase
      .channel(`order-track-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (payload: any) => {
          const next = payload.new;
          if (!next) return;
          setTrackedOrder((prev) => prev ? { ...prev, status: next.status } : null);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [trackedOrder?.id, trackedOrder?.status]);

  const categories = ["All", ...Array.from(new Set((menuItems as MenuItem[]).map((m) => m.category)))];
  const filteredItems = activeCategory === "All"
    ? (menuItems as MenuItem[]).filter((m) => m.available)
    : (menuItems as MenuItem[]).filter((m) => m.available && m.category === activeCategory);

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  function addToCart(item: MenuItem) {
    setCart((prev) => {
      const exists = prev.find((c) => c.menuItemId === item.id);
      if (exists) return prev.map((c) => c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { menuItemId: item.id, nameEn: item.nameEn, nameAm: item.nameAm, price: item.price, quantity: 1, imageUrl: item.imageUrl }];
    });
  }

  function updateQty(menuItemId: number, delta: number) {
    setCart((prev) => prev.map((c) => c.menuItemId === menuItemId ? { ...c, quantity: c.quantity + delta } : c).filter((c) => c.quantity > 0));
  }

  async function placeOrder() {
    try {
      const order = await createOrder.mutateAsync({
        data: {
          tableId,
          paymentMethod: selectedPayment ?? "cash",
          items: cart.map((c) => ({ menuItemId: c.menuItemId, quantity: c.quantity })),
        },
      });
      setLastOrderId(order.id);
      setTrackedOrder({ id: order.id, status: order.status, tableId });
      setCart([]);
      setCartOpen(false);
      setCheckoutStep("cart");
      setSelectedPayment(null);
      setSentimentOpen(true);
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      toast({ title: "Order placed!", description: `Order #${order.id} sent to kitchen.` });
    } catch {
      toast({ title: "Error", description: "Failed to place order.", variant: "destructive" });
    }
  }

  async function submitSentiment(emoji: string) {
    await createSentiment.mutateAsync({
      data: { tableId, emoji, orderId: lastOrderId ?? undefined },
    });
    setSentimentOpen(false);
    toast({ title: "Thank you!", description: "Your feedback was recorded." });
  }

  async function sendIsraelMessage(text?: string) {
    const userMsg = (text ?? israelInput).trim();
    if (!userMsg || israelStreaming) return;
    setIsraelInput("");
    const updatedHistory: IsraelMessage[] = [...israelMessages, { role: "user", content: userMsg }];
    setIsraelMessages(updatedHistory);
    setIsraelStreaming(true);

    let assistantContent = "";
    setIsraelMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hana-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          message: userMsg,
          tableId,
          history: israelMessages.map((m) => ({ role: m.role, content: m.content })),
          menu: (menuItems as MenuItem[])
            .filter((m) => m.available)
            .map((m) => ({
              nameEn: m.nameEn,
              nameAm: m.nameAm,
              price: m.price,
              category: m.category,
              description: m.description ?? "",
            })),
        }),
      });
      if (!res.ok || !res.body) throw new Error("chat failed");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setIsraelMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: assistantContent };
                return updated;
              });
            }
          } catch { /* partial */ }
        }
      }
    } catch {
      setIsraelMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: "ይቅርታ፣ ችግር ተፈጥሯል።" };
        return updated;
      });
    } finally {
      setIsraelStreaming(false);
    }
  }

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast({ title: "Voice not supported", description: "Use text input instead.", variant: "destructive" });
      return;
    }
    const rec = new SR();
    recognitionRef.current = rec;
    rec.lang = "am-ET";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart = () => setIsListening(true);
    rec.onend = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setIsraelInput(transcript);
      setTimeout(() => sendIsraelMessage(transcript), 200);
    };
    rec.start();
  }, [israelMessages, israelStreaming]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const cartItemCount = (id: number) => cart.find((c) => c.menuItemId === id)?.quantity ?? 0;

  const allPaymentMethods = [...paymentMethods, CASH_METHOD];
  const selectedPmLabel = selectedPayment
    ? allPaymentMethods.find((p) => p.id === selectedPayment)?.name ?? selectedPayment
    : "Cash";

  return (
    <>
      <style>{`
        @keyframes menuFadeIn { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        @keyframes cardIn     { from { opacity:0; transform:scale(.94) translateY(10px) } to { opacity:1; transform:scale(1) translateY(0) } }
        @keyframes headerIn   { from { opacity:0; transform:translateY(-16px) } to { opacity:1; transform:translateY(0) } }
        @keyframes statusIn   { from { opacity:0; transform:translateY(-8px) } to { opacity:1; transform:translateY(0) } }
        .menu-enter  { animation: menuFadeIn .6s cubic-bezier(.22,1,.36,1) both }
        .header-in   { animation: headerIn   .5s cubic-bezier(.22,1,.36,1) both }
        .status-in   { animation: statusIn   .4s cubic-bezier(.22,1,.36,1) both }
      `}</style>

      {introVisible && <CinematicIntro onDone={handleIntroDone} />}

      <div className={`min-h-screen bg-background ${menuMounted ? "menu-enter" : "opacity-0"}`}>

        {/* Order Status Tracker */}
        {trackedOrder && trackedOrder.status !== "served" && (
          <div className="status-in fixed top-0 left-0 right-0 z-50 bg-card border-b border-card-border px-4 py-2.5 flex items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">{STATUS_INFO[trackedOrder.status]?.icon ?? "🟡"}</span>
              <div>
                <p className={`text-xs font-bold ${STATUS_INFO[trackedOrder.status]?.color}`}>
                  {STATUS_INFO[trackedOrder.status]?.label ?? trackedOrder.status}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Order #{trackedOrder.id} · Table {trackedOrder.tableId} · Auto-refreshing...
                </p>
              </div>
            </div>
            <button onClick={() => setTrackedOrder(null)} className="text-muted-foreground hover:text-foreground p-1">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Header */}
        <header
          className={`sticky top-0 z-40 bg-primary text-primary-foreground shadow-lg header-in ${trackedOrder && trackedOrder.status !== "served" ? "mt-10" : ""}`}
          style={{ animationDelay: "0.1s" }}
        >
          <div className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-serif font-bold tracking-wide">Holly Cafe</h1>
              <p className="text-xs font-sans font-semibold tracking-[0.35em] opacity-70 mt-0.5">DIRE DAWA</p>
            </div>
            <button
              data-testid="button-cart"
              onClick={() => { setCartOpen(true); setCheckoutStep("cart"); }}
              className="relative bg-accent text-accent-foreground rounded-full px-4 py-2 font-semibold flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all"
            >
              <ShoppingCart size={18} />
              <span>Cart</span>
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {cartCount}
                </span>
              )}
            </button>
          </div>

          {/* Category filter */}
          <div className="max-w-5xl mx-auto px-4 pb-3 flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                data-testid={`button-category-${cat}`}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all active:scale-95 ${
                  activeCategory === cat
                    ? "bg-accent text-accent-foreground shadow-sm"
                    : "bg-primary-foreground/10 text-primary-foreground/80 hover:bg-primary-foreground/20"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </header>

        {/* Menu grid */}
        <main className="max-w-5xl mx-auto px-4 py-8">
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-card rounded-2xl h-64 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredItems.map((item, idx) => {
                const qty = cartItemCount(item.id);
                return (
                  <div
                    key={item.id}
                    data-testid={`card-menu-${item.id}`}
                    className="bg-card border border-card-border rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col"
                    style={{
                      animation: "cardIn .5s cubic-bezier(.22,1,.36,1) both",
                      animationDelay: `${idx * 0.05}s`,
                    }}
                  >
                    <div className="h-40 bg-muted relative overflow-hidden group">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.nameEn}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl">☕</div>
                      )}
                      <Badge className="absolute top-2 left-2 text-xs bg-primary/90 text-primary-foreground border-0 shadow">
                        {item.category}
                      </Badge>
                    </div>
                    <div className="p-3 flex flex-col gap-1 flex-1">
                      <p className="font-serif font-semibold text-sm leading-tight text-card-foreground">{item.nameEn}</p>
                      <p className="text-xs text-muted-foreground">{item.nameAm}</p>
                      {item.description && (
                        <p className="text-[11px] text-muted-foreground/70 leading-snug line-clamp-2">{item.description}</p>
                      )}
                      <p className="text-accent font-bold text-sm mt-auto">ETB {item.price.toFixed(0)}</p>
                      {qty === 0 ? (
                        <button
                          data-testid={`button-add-${item.id}`}
                          onClick={() => addToCart(item)}
                          className="mt-2 w-full bg-primary text-primary-foreground rounded-lg py-1.5 text-sm font-medium hover:opacity-90 active:scale-95 transition-all"
                        >
                          Add to Cart
                        </button>
                      ) : (
                        <div className="mt-2 flex items-center justify-between bg-secondary rounded-lg px-2 py-1">
                          <button data-testid={`button-minus-${item.id}`} onClick={() => updateQty(item.id, -1)} className="p-1 hover:text-destructive transition-colors active:scale-90"><Minus size={14} /></button>
                          <span className="font-bold text-sm">{qty}</span>
                          <button data-testid={`button-plus-${item.id}`} onClick={() => updateQty(item.id, 1)} className="p-1 hover:text-primary transition-colors active:scale-90"><Plus size={14} /></button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>

        {/* Cart Modal */}
        <Dialog open={cartOpen} onOpenChange={setCartOpen}>
          <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="font-serif">
                {checkoutStep === "cart" ? "Your Order" : checkoutStep === "payment" ? "Choose Payment" : "Confirm Order"}
              </DialogTitle>
            </DialogHeader>

            {checkoutStep === "cart" && (
              <div className="flex flex-col gap-4 flex-1 overflow-auto">
                {cart.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Your cart is empty</p>
                ) : (
                  <>
                    <div className="space-y-3 overflow-auto">
                      {cart.map((item) => (
                        <div key={item.menuItemId} data-testid={`cart-item-${item.menuItemId}`} className="flex items-center gap-3 bg-secondary rounded-xl p-3">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{item.nameEn}</p>
                            <p className="text-xs text-muted-foreground">{item.nameAm}</p>
                            <p className="text-accent font-bold text-sm">ETB {(item.price * item.quantity).toFixed(0)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => updateQty(item.menuItemId, -1)} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center hover:bg-border transition-colors active:scale-90"><Minus size={12} /></button>
                            <span className="w-4 text-center font-bold text-sm">{item.quantity}</span>
                            <button onClick={() => updateQty(item.menuItemId, 1)} className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 active:scale-90"><Plus size={12} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-border pt-3">
                      <div className="flex justify-between font-bold text-lg mb-4">
                        <span>Total</span>
                        <span className="text-accent">ETB {cartTotal.toFixed(0)}</span>
                      </div>
                      <Button data-testid="button-checkout" onClick={() => setCheckoutStep("payment")} className="w-full">
                        Proceed to Payment
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {checkoutStep === "payment" && (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  Select payment for ETB {cartTotal.toFixed(0)} <span className="text-xs opacity-60">(optional — tap to toggle)</span>
                </p>
                <div className="space-y-2">
                  {allPaymentMethods.map((pm) => (
                    <button
                      key={pm.id}
                      data-testid={`button-payment-${pm.id}`}
                      onClick={() => setSelectedPayment(pm.id === selectedPayment ? null : pm.id)}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all ${
                        selectedPayment === pm.id
                          ? "border-primary bg-secondary shadow-sm"
                          : "border-border hover:border-muted-foreground"
                      }`}
                    >
                      <div className={`w-3 h-3 rounded-full shrink-0 ${COLOR_MAP[pm.color] ?? "bg-gray-500"}`} />
                      <div className="text-left flex-1">
                        <p className="font-semibold text-sm">{pm.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{pm.account}</p>
                      </div>
                      {selectedPayment === pm.id && <div className="w-4 h-4 rounded-full bg-primary shrink-0" />}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setCheckoutStep("cart")} className="flex-1">Back</Button>
                  <Button data-testid="button-confirm-payment" onClick={() => setCheckoutStep("confirm")} className="flex-1">Continue</Button>
                </div>
              </div>
            )}

            {checkoutStep === "confirm" && (
              <div className="flex flex-col gap-4">
                <div className="bg-secondary rounded-xl p-4 space-y-2">
                  <p className="text-sm font-semibold">Order Summary — Table {tableId}</p>
                  {cart.map((item) => (
                    <div key={item.menuItemId} className="flex justify-between text-sm">
                      <span>{item.nameEn} x{item.quantity}</span>
                      <span>ETB {(item.price * item.quantity).toFixed(0)}</span>
                    </div>
                  ))}
                  <div className="border-t border-border pt-2 flex justify-between font-bold">
                    <span>Total</span>
                    <span className="text-accent">ETB {cartTotal.toFixed(0)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground pt-1">Payment: {selectedPmLabel}</p>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setCheckoutStep("payment")} className="flex-1">Back</Button>
                  <Button
                    data-testid="button-place-order"
                    onClick={placeOrder}
                    disabled={createOrder.isPending}
                    className="flex-1"
                  >
                    {createOrder.isPending ? "Placing..." : "Place Order"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Sentiment Modal */}
        <Dialog open={sentimentOpen} onOpenChange={setSentimentOpen}>
          <DialogContent className="max-w-sm text-center">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">How was your experience?</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground text-sm mb-2">Tap to rate your visit at Holly Cafe</p>
            <div className="flex justify-center gap-4 my-4">
              {SENTIMENT_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  data-testid={`button-sentiment-${emoji}`}
                  onClick={() => submitSentiment(emoji)}
                  className="text-4xl hover:scale-125 active:scale-110 transition-transform"
                >
                  {emoji}
                </button>
              ))}
            </div>
            <button onClick={() => setSentimentOpen(false)} className="text-xs text-muted-foreground underline">Skip</button>
          </DialogContent>
        </Dialog>

        {/* Footer */}
        <footer className="max-w-5xl mx-auto px-4 py-6 mt-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">© Holly Cafe · Dire Dawa, Ethiopia</p>
        </footer>

        {/* Israel Belay Floating Chat */}
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
          {israelOpen && (
            <div
              className="w-80 bg-card border border-card-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
              style={{ height: "450px", animation: "cardIn .3s cubic-bezier(.22,1,.36,1) both" }}
            >
              <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs font-bold text-accent-foreground shrink-0">IB</div>
                <div className="flex-1 min-w-0">
                  <p className="font-serif font-bold text-sm leading-tight">እስራኤል በላይ</p>
                  <p className="text-xs opacity-60">Israel Belay · አማርኛ</p>
                </div>
                <button onClick={() => setIsraelOpen(false)} className="hover:opacity-70 transition-opacity shrink-0"><X size={18} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {israelMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-secondary text-secondary-foreground rounded-tl-sm"
                    }`}>
                      {msg.content || <span className="opacity-40 animate-pulse">●●●</span>}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <div className="p-3 border-t border-border flex gap-2">
                <input
                  data-testid="input-israel-message"
                  value={israelInput}
                  onChange={(e) => setIsraelInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendIsraelMessage()}
                  placeholder={isListening ? "ማዳመጫ ላይ..." : "ይጻፉ ወይም ይናገሩ..."}
                  className="flex-1 text-sm bg-secondary rounded-xl px-3 py-2 outline-none border border-border focus:border-ring placeholder:text-muted-foreground"
                  disabled={israelStreaming || isListening}
                />
                <button
                  data-testid="button-israel-mic"
                  onClick={isListening ? stopListening : startListening}
                  disabled={israelStreaming}
                  className={`rounded-xl px-3 py-2 transition-all disabled:opacity-50 ${isListening ? "bg-destructive text-destructive-foreground animate-pulse" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                >
                  {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
                <button
                  data-testid="button-israel-send"
                  onClick={() => sendIsraelMessage()}
                  disabled={israelStreaming || !israelInput.trim()}
                  className="bg-primary text-primary-foreground rounded-xl px-3 py-2 disabled:opacity-50 hover:opacity-90 transition-opacity"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          )}
          <button
            data-testid="button-israel-toggle"
            onClick={() => setIsraelOpen(!israelOpen)}
            className="w-16 h-16 rounded-full shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all relative"
            style={{ background: "linear-gradient(135deg,#c8891a,#a06010)" }}
          >
            {israelOpen ? <X size={22} className="text-white" /> : <MessageCircle size={22} className="text-white" />}
            {!israelOpen && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[9px] font-bold rounded-full px-1.5 py-0.5 leading-none shadow">AI</span>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
