"use client";

import { useState, useEffect } from "react";
import {
  Plus, Pencil, Trash2, Wand2, CheckCircle, X,
  Palette, User, AlignLeft, Layers
} from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { Empty } from "@/components/ui/Empty";
import { AlertDialog } from "@/components/ui/AlertDialog";

const VIDEO_STYLES = [
  { value: "doodle", label: "2D Doodle" },
  { value: "2d-cartoon", label: "2D Cartoon" },
  { value: "2d-cinematic", label: "2D Cinematic" },
  { value: "3d-pixar", label: "3D Pixar Style" },
  { value: "3d-realistic", label: "3D Realistic" },
  { value: "live-action", label: "Live Action" },
  { value: "historical", label: "Historical" },
  { value: "fantasy", label: "Fantasy / Sci-Fi" },
  { value: "retro", label: "Retro / Pixel Art" },
  { value: "abstract", label: "Abstract" },
];

const NICHES = [
  "Motivation & Mindset",
  "Business & Finance",
  "History & Mythology",
  "Faith & Spirituality",
  "Tech & AI",
  "True Crime & Mysteries",
  "Health & Fitness",
  "Gaming & Esports",
  "Travel & Lifestyle",
  "Other / General"
];

const emptyForm = {
  name: "",
  niche: "Other / General",
  videoStyle: "doodle",
  characterModifier: "",
  backgroundModifier: "",
  textOverlayEnabled: false,
  extraModifiers: [] as string[],
};

type Preset = typeof emptyForm & { id: string; createdAt: string };

function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState("");
  const add = () => {
    if (!input.trim()) return;
    const parts = input.split(",").map((p) => p.trim()).filter((p) => p !== "");
    const newTags = [...tags];
    let updated = false;

    parts.forEach((p) => {
      if (!newTags.includes(p)) {
        newTags.push(p);
        updated = true;
      }
    });

    if (updated) {
      onChange(newTags);
    }
    setInput("");
  };

  return (
    <div className="flex flex-col gap-2">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span key={t} className="flex items-center gap-1 text-xs bg-black/[0.04] dark:bg-white/10 border border-black/10 dark:border-white/10 px-2.5 py-1.5 rounded-lg text-gray-700 dark:text-gray-300">
              {t}
              <button onClick={() => onChange(tags.filter((x) => x !== t))} className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 cursor-pointer shrink-0">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="e.g. soft watercolor accents, cinematic lighting (press Enter)"
          className="flex-1 bg-black/[0.02] dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-[#E00C1D]/50 transition-colors"
        />
        <button onClick={add} className="px-3.5 py-2 bg-black/[0.02] dark:bg-white/5 hover:bg-black/[0.04] dark:hover:bg-white/10 border border-black/10 dark:border-white/10 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 transition-all cursor-pointer">Add</button>
      </div>
    </div>
  );
}

function PresetForm({
  initial,
  onSave,
  onCancel,
  saving,
  error,
}: {
  initial: typeof emptyForm;
  onSave: (data: typeof emptyForm) => void;
  onCancel: () => void;
  saving: boolean;
  error?: string;
}) {
  const [form, setForm] = useState(initial);
  const set = (k: keyof typeof emptyForm, v: any) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="bg-[#0d0d10] border border-white/10 rounded-2xl p-6 flex flex-col gap-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Preset Name *</label>
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Eazi Faith - Purity Doodle"
            className="bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#E00C1D]/50"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Niche / Category *</label>
          <Select
            value={form.niche}
            onChange={(val) => set("niche", val)}
            options={NICHES.map((n) => ({ value: n, label: n }))}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5"><Palette className="w-3.5 h-3.5" /> Video Style *</label>
        <Select
          value={form.videoStyle}
          onChange={(val) => set("videoStyle", val)}
          options={VIDEO_STYLES.map((s) => ({ value: s.value, label: s.label }))}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Character Modifier *</label>
        <Textarea
          value={form.characterModifier}
          onChange={(e) => set("characterModifier", e.target.value)}
          rows={3}
          placeholder="e.g. simple clean stick figure character, round white head, a few thin strands of hair on top, single line stick body, wearing a solid black necktie"
        />
        <p className="text-[10px] text-gray-500">Describe how characters should look in every scene for this preset.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5"><AlignLeft className="w-3.5 h-3.5" /> Background Modifier *</label>
        <Textarea
          value={form.backgroundModifier}
          onChange={(e) => set("backgroundModifier", e.target.value)}
          rows={2}
          placeholder="e.g. soft very light charcoal-gray paper textured background, close to off-white, with a subtle vignette and gentle studio lighting"
        />
        <p className="text-[10px] text-gray-500">Overrides the generic background. The AI still selects emotional tone; this controls the visual treatment.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> Extra Modifiers</label>
        <TagInput tags={form.extraModifiers} onChange={(v) => set("extraModifiers", v)} />
        <p className="text-[10px] text-gray-500">Optional style keywords appended to every prompt (e.g. &quot;soft watercolor accents&quot;).</p>
      </div>

      <div className="p-4 bg-white/[0.02] border border-white/10 rounded-xl">
        <Switch
          checked={form.textOverlayEnabled}
          onChange={(val) => set("textOverlayEnabled", val)}
          label="Text Overlay"
          description="Burns the narration caption into each image prompt as hand-drawn typography"
        />
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          ⚠ {error}
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.name || !form.characterModifier || !form.backgroundModifier}
          className="flex-1 py-3 bg-[#E00C1D] hover:bg-[#b0060f] disabled:opacity-40 text-white font-bold rounded-xl transition-all text-sm"
        >
          {saving ? "Saving…" : "Save Preset"}
        </button>
        <button onClick={onCancel} className="px-5 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-xl text-sm transition-all">
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function PresetsPage() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const fetchPresets = async () => {
    const res = await fetch("/api/niche-presets");
    if (res.ok) {
      const data = await res.json();
      setPresets(data.presets);
    }
    setLoading(false);
  };

  useEffect(() => { fetchPresets(); }, []);

  const handleSave = async (form: typeof emptyForm) => {
    setSaving(true);
    setSaveError("");
    try {
      let res: Response;
      if (editingPreset) {
        res = await fetch(`/api/niche-presets/${editingPreset.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      } else {
        res = await fetch("/api/niche-presets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      }
      if (!res.ok) {
        const data = await res.json();
        setSaveError(data.error || `Request failed (${res.status})`);
        return;
      }
      await fetchPresets();
      setShowForm(false);
      setEditingPreset(null);
    } catch (e: any) {
      setSaveError(e.message || "Network error — check your connection.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteTarget(id);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget);
    await fetch(`/api/niche-presets/${deleteTarget}`, { method: "DELETE" });
    await fetchPresets();
    setDeletingId(null);
    setDeleteTarget(null);
  };

  const styleLabel = (val: string) => VIDEO_STYLES.find((s) => s.value === val)?.label ?? val;

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-8 text-white px-4 md:px-0 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Settings</span>
          <h1 className="text-2xl font-bold tracking-tight mt-0.5">Niche Presets</h1>
          <p className="text-sm text-gray-400 mt-1">Reusable visual identity bundles — character, background, and style — applied to any project&apos;s image prompt generation.</p>
        </div>
        {!showForm && !editingPreset && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#E00C1D] hover:bg-[#b0060f] text-white text-sm font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(224,12,29,0.25)] shrink-0"
          >
            <Plus className="w-4 h-4" /> New Preset
          </button>
        )}
      </div>

      {/* New Preset Form */}
      {showForm && !editingPreset && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-bold text-gray-300">New Preset</h2>
          <PresetForm
            initial={emptyForm}
            onSave={handleSave}
            onCancel={() => setShowForm(false)}
            saving={saving}
            error={saveError}
          />
        </div>
      )}

      {/* Presets List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="md" label="Loading presets…" />
        </div>
      ) : presets.length === 0 && !showForm ? (
        <Empty
          icon={<Wand2 className="w-6 h-6" />}
          title="No presets yet"
          description="Create your first visual identity preset to reuse across projects."
          action={
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#E00C1D] hover:bg-[#b0060f] text-white text-sm font-bold rounded-xl transition-all"
            >
              <Plus className="w-4 h-4" /> Create First Preset
            </button>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {presets.map((preset) => (
            <div key={preset.id}>
              {editingPreset?.id === preset.id ? (
                <div className="flex flex-col gap-3">
                  <h2 className="text-sm font-bold text-gray-300">Editing: {preset.name}</h2>
                  <PresetForm
                    initial={editingPreset}
                    onSave={handleSave}
                    onCancel={() => setEditingPreset(null)}
                    saving={saving}
                    error={saveError}
                  />
                </div>
              ) : (
                <div className="bg-white/[0.02] border border-white/5 hover:border-white/10 rounded-2xl p-5 transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-base text-white">{preset.name}</h3>
                        {preset.niche && <Badge variant="default">{preset.niche}</Badge>}
                        <Badge variant="blue">{styleLabel(preset.videoStyle)}</Badge>
                        {preset.textOverlayEnabled && (
                          <Badge variant="amber" icon={<CheckCircle className="w-3 h-3" />}>Text Overlay</Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{preset.characterModifier}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setEditingPreset(preset)}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(preset.id)}
                        disabled={deletingId === preset.id}
                        className="p-2 rounded-lg bg-white/5 hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-all disabled:opacity-40"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete this preset?"
        description="Projects using this preset will lose the link but keep their existing image prompts."
        confirmLabel="Delete Preset"
        cancelLabel="Keep It"
        variant="danger"
        isLoading={!!deletingId}
      />
    </div>
  );
}
