import { useState, useEffect } from "react";
import { Save, Pencil, Check, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAppSettings, saveAppSettings } from "@/lib/data";

interface PaymentMethod {
  id: string;
  name: string;
  account: string;
  color: string;
}

interface Settings {
  paymentMethods: PaymentMethod[];
}

const COLOR_OPTIONS = [
  { value: "blue", label: "Blue" },
  { value: "green", label: "Green" },
  { value: "orange", label: "Orange" },
  { value: "purple", label: "Purple" },
  { value: "red", label: "Red" },
  { value: "gray", label: "Gray" },
];

const COLOR_CLASSES: Record<string, string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  orange: "bg-orange-500",
  purple: "bg-purple-500",
  red: "bg-red-500",
  gray: "bg-gray-400",
};

export default function SettingsPage() {
  const { toast } = useToast();
  const { data: remoteSettings } = useAppSettings();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMethod, setNewMethod] = useState({ name: "", account: "", color: "blue" });

  useEffect(() => {
    if (remoteSettings) setSettings(remoteSettings as Settings);
  }, [remoteSettings]);

  async function save(updatedSettings?: Settings) {
    const target = updatedSettings ?? settings;
    if (!target) return;
    setSaving(true);
    try {
      await saveAppSettings(target);
      setSettings(target);
      setEditingIdx(null);
      toast({ title: "Settings saved" });
    } catch {
      toast({ title: "Failed to save settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function updateMethod(idx: number, field: keyof PaymentMethod, value: string) {
    if (!settings) return;
    const updated = settings.paymentMethods.map((m, i) =>
      i === idx ? { ...m, [field]: value } : m
    );
    setSettings({ ...settings, paymentMethods: updated });
  }

  async function deleteMethod(idx: number) {
    if (!settings) return;
    if (!confirm(`Delete "${settings.paymentMethods[idx].name}"?`)) return;
    const updated = settings.paymentMethods.filter((_, i) => i !== idx);
    const next = { ...settings, paymentMethods: updated };
    setSettings(next);
    await save(next);
  }

  async function addMethod() {
    if (!newMethod.name.trim() || !newMethod.account.trim()) {
      toast({ title: "Name and account are required", variant: "destructive" });
      return;
    }
    if (!settings) return;
    const id = newMethod.name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") + "_" + Date.now();
    const added = [...settings.paymentMethods, { id, ...newMethod }];
    const next = { ...settings, paymentMethods: added };
    setSettings(next);
    setNewMethod({ name: "", account: "", color: "blue" });
    setShowAddForm(false);
    await save(next);
  }

  if (!settings) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-card rounded-2xl h-20 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-card border border-card-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-serif font-semibold text-lg">Payment Methods</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Manage payment options shown to customers at checkout</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowAddForm(!showAddForm)}
              size="sm"
              variant="outline"
              className="flex items-center gap-1"
            >
              <Plus size={14} /> Add
            </Button>
            <Button
              data-testid="button-save-settings"
              onClick={() => save()}
              disabled={saving}
              size="sm"
              className="flex items-center gap-1"
            >
              <Save size={14} /> {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        {/* Add new method form */}
        {showAddForm && (
          <div className="bg-secondary/60 border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">New Payment Method</p>
              <button onClick={() => setShowAddForm(false)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Display Name *</Label>
                <Input
                  value={newMethod.name}
                  onChange={(e) => setNewMethod((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Amhara Bank"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Account Number / Phone *</Label>
                <Input
                  value={newMethod.account}
                  onChange={(e) => setNewMethod((p) => ({ ...p, account: e.target.value }))}
                  placeholder="e.g. 1000 456 789"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Color</Label>
                <select
                  value={newMethod.color}
                  onChange={(e) => setNewMethod((p) => ({ ...p, color: e.target.value }))}
                  className="w-full text-sm bg-background border border-input rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
                >
                  {COLOR_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>
            <Button onClick={addMethod} size="sm" className="w-full flex items-center gap-1">
              <Plus size={14} /> Add Payment Method
            </Button>
          </div>
        )}

        <div className="space-y-3">
          {settings.paymentMethods.map((pm, idx) => (
            <div key={pm.id} data-testid={`payment-method-${pm.id}`} className="bg-secondary rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${COLOR_CLASSES[pm.color] || "bg-gray-400"}`} />
                  <span className="font-medium text-sm">{pm.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingIdx(editingIdx === idx ? null : idx)}
                    className="p-1.5 rounded-lg hover:bg-border transition-colors text-muted-foreground hover:text-foreground"
                    title="Edit"
                  >
                    {editingIdx === idx ? <Check size={14} /> : <Pencil size={14} />}
                  </button>
                  <button
                    onClick={() => deleteMethod(idx)}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {editingIdx === idx ? (
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Display Name</Label>
                    <Input
                      data-testid={`input-pm-name-${pm.id}`}
                      value={pm.name}
                      onChange={(e) => updateMethod(idx, "name", e.target.value)}
                      placeholder="e.g. Commercial Bank of Ethiopia"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Account Number / Phone</Label>
                    <Input
                      data-testid={`input-pm-account-${pm.id}`}
                      value={pm.account}
                      onChange={(e) => updateMethod(idx, "account", e.target.value)}
                      placeholder="e.g. 1000 123 456 789"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Color</Label>
                    <select
                      value={pm.color}
                      onChange={(e) => updateMethod(idx, "color", e.target.value)}
                      className="w-full text-sm bg-background border border-input rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
                    >
                      {COLOR_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                </div>
              ) : (
                <p className="font-mono text-sm text-muted-foreground">{pm.account}</p>
              )}
            </div>
          ))}

          {settings.paymentMethods.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">No payment methods. Add one above.</p>
          )}
        </div>
      </div>
    </div>
  );
}
