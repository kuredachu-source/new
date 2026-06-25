import { useState } from "react";
import { Moon, Sun, ClipboardList, BarChart3, UtensilsCrossed, MessageSquare, QrCode, Settings } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import OrderQueue from "@/pages/staff/order-queue";
import AnalyticsHub from "@/pages/staff/analytics-hub";
import MenuEdit from "@/pages/staff/menu-edit";
import SentimentLogs from "@/pages/staff/sentiment-logs";
import QRGenerator from "@/pages/staff/qr-generator";
import SettingsPage from "@/pages/staff/settings";

type Tab = "orders" | "analytics" | "menu" | "sentiment" | "qr" | "settings";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "orders", label: "Order Queue", icon: <ClipboardList size={18} /> },
  { id: "analytics", label: "Analytics", icon: <BarChart3 size={18} /> },
  { id: "menu", label: "Menu Edit", icon: <UtensilsCrossed size={18} /> },
  { id: "sentiment", label: "Sentiment", icon: <MessageSquare size={18} /> },
  { id: "qr", label: "QR Generator", icon: <QrCode size={18} /> },
  { id: "settings", label: "Settings", icon: <Settings size={18} /> },
];

export default function StaffPage() {
  const [activeTab, setActiveTab] = useState<Tab>("orders");
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar — desktop */}
      <aside className="w-56 shrink-0 bg-sidebar border-r border-sidebar-border flex-col hidden md:flex">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <h1 className="font-serif text-lg font-bold text-sidebar-foreground">Holly Cafe</h1>
          <p className="text-[10px] font-semibold tracking-[0.3em] text-sidebar-foreground/50 mt-0.5 uppercase">Staff Terminal</p>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              data-testid={`button-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-sidebar-border">
          <button
            data-testid="button-theme-toggle"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
        </div>
      </aside>

      {/* Mobile top nav */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-sidebar border-b border-sidebar-border">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="font-serif font-bold text-sidebar-foreground">Holly Cafe — Staff</h1>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 rounded-lg hover:bg-sidebar-accent transition-colors text-sidebar-foreground/70"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
        <div className="flex overflow-x-auto px-3 pb-3 gap-1.5 scrollbar-none">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "bg-sidebar-accent text-sidebar-accent-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-5 pt-32 md:pt-8 pb-10">
          <div className="mb-5">
            <h2 className="font-serif text-2xl font-bold">
              {TABS.find((t) => t.id === activeTab)?.label}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Holly Cafe · Dire Dawa, Ethiopia</p>
          </div>

          {activeTab === "orders" && <OrderQueue />}
          {activeTab === "analytics" && <AnalyticsHub />}
          {activeTab === "menu" && <MenuEdit />}
          {activeTab === "sentiment" && <SentimentLogs />}
          {activeTab === "qr" && <QRGenerator />}
          {activeTab === "settings" && <SettingsPage />}
        </div>
      </main>
    </div>
  );
}
