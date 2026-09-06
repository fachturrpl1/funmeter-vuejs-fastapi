// app/admin/schedule/page.tsx
// Migrasi dari src-vue-original/pages/admin/AdminSchedulePage.vue (fitur inti)

"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { request } from "@/lib/api";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/common/Icon";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DayKey =
  | "Senin"
  | "Selasa"
  | "Rabu"
  | "Kamis"
  | "Jumat"
  | "Sabtu"
  | "Minggu";

interface RuleItem {
  day: DayKey;
  label: string;
  enabled: boolean;
  check_in: string; // HH:MM or ""
  check_out: string; // HH:MM or ""
  grace_in_min: number;
  grace_out_min: number;
  notes?: string;
}

interface OverrideItem {
  id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  label: string;
  enabled: boolean;
  check_in: string | null;
  check_out: string | null;
  grace_in_min: number;
  grace_out_min: number;
  notes: string;
  targets?: Array<string | { value: string; label?: string }>; // minimal
}

interface AttendanceConfig {
  grace_in_min: number;
  grace_out_min: number;
  rules: RuleItem[];
  overrides: OverrideItem[];
}

interface ScheduleResponse {
  attendance: Partial<AttendanceConfig>;
}

const DAYS: DayKey[] = [
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
  "Minggu",
];

const WORKDAYS: DayKey[] = DAYS.slice(0, 5);
const WEEKEND: DayKey[] = DAYS.slice(5) as DayKey[];

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));

function genId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `ov_${Math.random().toString(36).slice(2, 10)}`;
}

function defaultRule(day: DayKey, gIn = 10, gOut = 5): RuleItem {
  const weekend = WEEKEND.includes(day);
  return {
    day,
    label: weekend ? "Hari Libur" : "Jam Kerja Normal",
    enabled: !weekend,
    check_in: weekend ? "" : "08:30",
    check_out: weekend ? "" : "17:00",
    grace_in_min: weekend ? 0 : gIn,
    grace_out_min: weekend ? 0 : gOut,
    notes: weekend ? "Libur akhir pekan" : "",
  };
}

function normalizeRules(raw: Partial<RuleItem>[] | undefined, gIn: number, gOut: number): RuleItem[] {
  const map = new Map<DayKey, Partial<RuleItem>>();
  (raw || []).forEach((r) => {
    if (r?.day) map.set(r.day as DayKey, r);
  });
  return DAYS.map((d) => {
    const base = defaultRule(d, gIn, gOut);
    const src = map.get(d) || {};
    const enabled = src.enabled ?? base.enabled;
    const rule: RuleItem = {
      day: d,
      label: String(src.label ?? base.label),
      enabled,
      check_in: enabled ? (TIME_RE.test(String(src.check_in || base.check_in)) ? String(src.check_in || base.check_in) : base.check_in) : "",
      check_out: enabled ? (TIME_RE.test(String(src.check_out || base.check_out)) ? String(src.check_out || base.check_out) : base.check_out) : "",
      grace_in_min: enabled ? clamp(Number(src.grace_in_min ?? base.grace_in_min), 0, 240) : 0,
      grace_out_min: enabled ? clamp(Number(src.grace_out_min ?? base.grace_out_min), 0, 240) : 0,
      notes: String(src.notes ?? base.notes ?? ""),
    };
    return rule;
  });
}

function sortOverrides(list: OverrideItem[]): OverrideItem[] {
  return [...list].sort((a, b) => (a.start_date === b.start_date ? a.end_date.localeCompare(b.end_date) : a.start_date.localeCompare(b.start_date)));
}

export default function AdminSchedulePage() {
  const { t, locale } = useI18n();

  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [gIn, setGIn] = useState<number>(10);
  const [gOut, setGOut] = useState<number>(5);
  const [rules, setRules] = useState<RuleItem[]>(() => normalizeRules([], 10, 5));
  const [origRules, setOrigRules] = useState<RuleItem[]>([]);
  const [overrides, setOverrides] = useState<OverrideItem[]>([]);
  const [origOverrides, setOrigOverrides] = useState<OverrideItem[]>([]);
  const [selectedDay, setSelectedDay] = useState<DayKey>("Senin");

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await request<ScheduleResponse>("/admin/attendance/schedule", { method: "GET" });
      const att = data?.attendance || {};
      const baseGIn = clamp(Number(att.grace_in_min ?? 10), 0, 240);
      const baseGOut = clamp(Number(att.grace_out_min ?? 5), 0, 240);
      setGIn(baseGIn);
      setGOut(baseGOut);
      const nextRules = normalizeRules((att.rules as Partial<RuleItem>[]) || [], baseGIn, baseGOut);
      setRules(nextRules);
      setOrigRules(JSON.parse(JSON.stringify(nextRules)));
      const rawOverrides = (att.overrides as OverrideItem[]) || [];
      const sorted = sortOverrides(
        rawOverrides.map((ov) => ({
          id: String(ov.id || genId()),
          start_date: String(ov.start_date || ""),
          end_date: String(ov.end_date || ov.start_date || ""),
          label: String(ov.label || t("adminSchedule.overrides.defaultLabel", "Jadwal Khusus")),
          enabled: ov.enabled !== false,
          check_in: ov.enabled !== false ? (ov.check_in ?? null) : null,
          check_out: ov.enabled !== false ? (ov.check_out ?? null) : null,
          grace_in_min: ov.enabled !== false ? clamp(Number(ov.grace_in_min ?? baseGIn), 0, 240) : 0,
          grace_out_min: ov.enabled !== false ? clamp(Number(ov.grace_out_min ?? baseGOut), 0, 240) : 0,
          notes: String(ov.notes || ""),
          targets: Array.isArray(ov.targets) ? ov.targets : [],
        }))
      );
      setOverrides(sorted);
      setOrigOverrides(JSON.parse(JSON.stringify(sorted)));
    } catch (err) {
      console.error(err);
      toast.error(t("adminSchedule.error.load", "Gagal memuat konfigurasi jadwal."));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const selectedRule = useMemo(() => rules.find((r) => r.day === selectedDay) || null, [rules, selectedDay]);
  const isDirty = useMemo(() => {
    return (
      JSON.stringify(rules) !== JSON.stringify(origRules) ||
      JSON.stringify(overrides) !== JSON.stringify(origOverrides) ||
      gIn !== (origRules[0]?.grace_in_min ?? 10) ||
      gOut !== (origRules[0]?.grace_out_min ?? 5)
    );
  }, [rules, origRules, overrides, origOverrides, gIn, gOut]);

  const updateRule = (day: DayKey, patch: Partial<RuleItem>): void => {
    setRules((prev) =>
      prev.map((r) => {
        if (r.day !== day) return r;
        const enabled = patch.enabled ?? r.enabled;
        const next: RuleItem = {
          ...r,
          ...patch,
          enabled,
          check_in: enabled ? (patch.check_in !== undefined ? (TIME_RE.test(String(patch.check_in)) ? String(patch.check_in) : r.check_in || "08:30") : r.check_in) : "",
          check_out: enabled ? (patch.check_out !== undefined ? (TIME_RE.test(String(patch.check_out)) ? String(patch.check_out) : r.check_out || "17:00") : r.check_out) : "",
          grace_in_min: enabled ? clamp(Number(patch.grace_in_min ?? r.grace_in_min), 0, 240) : 0,
          grace_out_min: enabled ? clamp(Number(patch.grace_out_min ?? r.grace_out_min), 0, 240) : 0,
        };
        if (!enabled) {
          next.check_in = "";
          next.check_out = "";
        }
        return next;
      })
    );
  };

  const applyPreset = (target: "workday" | "halfday" | "evening" | "wfh" | "off"): void => {
    const rule = selectedRule;
    if (!rule) return;
    const presets: Record<string, Partial<RuleItem>> = {
      workday: { enabled: true, label: t("adminSchedule.presets.workday.dataLabel", "Jam Kerja Normal"), check_in: "08:30", check_out: "17:00", grace_in_min: 10, grace_out_min: 5, notes: "" },
      halfday: { enabled: true, label: t("adminSchedule.presets.halfday.dataLabel", "Shift Pagi"), check_in: "08:30", check_out: "13:00", grace_in_min: 5, grace_out_min: 0, notes: t("adminSchedule.presets.halfday.notes", "Shift pagi setengah hari.") },
      evening: { enabled: true, label: t("adminSchedule.presets.evening.dataLabel", "Shift Sore"), check_in: "13:00", check_out: "21:00", grace_in_min: 5, grace_out_min: 5, notes: t("adminSchedule.presets.evening.notes", "Shift sore / penutupan.") },
      wfh: { enabled: true, label: t("adminSchedule.presets.wfh.dataLabel", "WFH Fleksibel"), check_in: "09:00", check_out: "17:00", grace_in_min: 30, grace_out_min: 10, notes: t("adminSchedule.presets.wfh.notes", "WFH dengan toleransi keterlambatan 30 menit.") },
      off: { enabled: false, label: t("adminSchedule.presets.off.dataLabel", "Hari Libur"), check_in: "", check_out: "", grace_in_min: 0, grace_out_min: 0, notes: t("adminSchedule.presets.off.notes", "Tidak ada jam kerja terjadwal.") },
    };
    updateRule(rule.day, presets[target]);
    toast.success(t("adminSchedule.toast.presetApplied", "Preset diterapkan."));
  };

  const applyToDays = (days: DayKey[]): void => {
    const src = selectedRule;
    if (!src) return;
    setRules((prev) =>
      prev.map((r) => (days.includes(r.day) ? { ...r, label: src.label, enabled: src.enabled, check_in: src.check_in, check_out: src.check_out, grace_in_min: src.grace_in_min, grace_out_min: src.grace_out_min, notes: src.notes } : r))
    );
    toast.success(t("adminSchedule.toast.appliedToDays", "Diterapkan ke hari yang dipilih."));
  };

  const saveAll = async (): Promise<void> => {
    setSaving(true);
    try {
      const payload = {
        grace_in_min: clamp(gIn, 0, 240),
        grace_out_min: clamp(gOut, 0, 240),
        rules: rules.map((r) => ({
          day: r.day,
          label: r.label.trim() || t("adminSchedule.defaults.workdayLabel", "Jam Kerja Normal"),
          enabled: r.enabled,
          check_in: r.enabled && TIME_RE.test(r.check_in) ? r.check_in : null,
          check_out: r.enabled && TIME_RE.test(r.check_out) ? r.check_out : null,
          grace_in_min: r.enabled ? clamp(r.grace_in_min, 0, 240) : 0,
          grace_out_min: r.enabled ? clamp(r.grace_out_min, 0, 240) : 0,
          ...(r.notes && r.notes.trim() ? { notes: r.notes.trim() } : {}),
        })),
        overrides: sortOverrides(overrides).map((ov) => ({
          id: ov.id,
          start_date: ov.start_date,
          end_date: ov.end_date || ov.start_date,
          label: ov.label || t("adminSchedule.overrides.defaultLabel", "Jadwal Khusus"),
          enabled: ov.enabled,
          check_in: ov.enabled ? ov.check_in : null,
          check_out: ov.enabled ? ov.check_out : null,
          grace_in_min: ov.enabled ? clamp(ov.grace_in_min, 0, 240) : 0,
          grace_out_min: ov.enabled ? clamp(ov.grace_out_min, 0, 240) : 0,
          notes: ov.notes || "",
          targets: ov.targets || [],
        })),
      };
      const resp = await request<ScheduleResponse>("/admin/attendance/schedule", { method: "PUT", body: payload });
      // refresh from server echo
      const att = resp?.attendance || {};
      const baseGIn = clamp(Number(att.grace_in_min ?? payload.grace_in_min), 0, 240);
      const baseGOut = clamp(Number(att.grace_out_min ?? payload.grace_out_min), 0, 240);
      setGIn(baseGIn);
      setGOut(baseGOut);
      const nextRules = normalizeRules((att.rules as Partial<RuleItem>[]) || payload.rules, baseGIn, baseGOut);
      setRules(nextRules);
      setOrigRules(JSON.parse(JSON.stringify(nextRules)));
      const rawOverrides = (att.overrides as OverrideItem[]) || (payload.overrides as OverrideItem[]);
      const sorted = sortOverrides(rawOverrides.map((x) => ({ ...x, id: String(x.id || genId()) })));
      setOverrides(sorted);
      setOrigOverrides(JSON.parse(JSON.stringify(sorted)));
      toast.success(t("adminSchedule.toast.saved", "Jadwal tersimpan."));
    } catch (err) {
      console.error(err);
      toast.error(t("adminSchedule.error.save", "Gagal menyimpan jadwal."));
    } finally {
      setSaving(false);
    }
  };

  const resetChanges = (): void => {
    setRules(JSON.parse(JSON.stringify(origRules)) as RuleItem[]);
    setOverrides(JSON.parse(JSON.stringify(origOverrides)) as OverrideItem[]);
    setGIn(origRules[0]?.grace_in_min ?? 10);
    setGOut(origRules[0]?.grace_out_min ?? 5);
  };

  const addOverride = (): void => {
    setOverrides((prev) => [
      ...prev,
      {
        id: genId(),
        start_date: "",
        end_date: "",
        label: t("adminSchedule.overrides.defaultLabel", "Jadwal Khusus"),
        enabled: true,
        check_in: "08:30",
        check_out: "17:00",
        grace_in_min: gIn,
        grace_out_min: gOut,
        notes: "",
        targets: [],
      },
    ]);
    toast.info(t("adminSchedule.overrides.added", "Override ditambahkan. Isi datanya lalu Simpan."));
  };
  const duplicateOverride = (id: string): void => {
    setOverrides((prev) => {
      const src = prev.find((x) => x.id === id);
      if (!src) return prev;
      const copy: OverrideItem = { ...src, id: genId(), label: `${src.label}` };
      return sortOverrides([...prev, copy]);
    });
  };
  const deleteOverride = (id: string): void => {
    setOverrides((prev) => prev.filter((x) => x.id !== id));
  };

  const hdr = t("adminSchedule.overrides.title", "Schedule Overrides");

  const df = useMemo(() => {
    const userLocale = locale || (typeof navigator !== "undefined" ? navigator.language : "en-US");
    // short weekday & month => Wed, 01 Nov 2025 / Rab, 01 Nov 2025
    return new Intl.DateTimeFormat(userLocale, {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }, [locale]);

  // Modal States
  const [modalView, setModalView] = useState<{ open: boolean; ov: OverrideItem | null }>({ open: false, ov: null });
  const [modalEdit, setModalEdit] = useState<{ open: boolean; ov: OverrideItem | null }>({ open: false, ov: null });
  const [modalDeleteOv, setModalDeleteOv] = useState<{ open: boolean; ov: OverrideItem | null }>({ open: false, ov: null });
  const [modalDeleteLog, setModalDeleteLog] = useState<{ open: boolean; ov: OverrideItem | null }>({ open: false, ov: null });

  const openView = (ov: OverrideItem) => setModalView({ open: true, ov });
  const openEdit = (ov: OverrideItem) => setModalEdit({ open: true, ov: { ...ov } });
  const openCustom = (ov: OverrideItem) => setModalEdit({ open: true, ov: { ...ov } });
  const openDeleteOverride = (ov: OverrideItem) => setModalDeleteOv({ open: true, ov });
  const openDeleteLog = (ov: OverrideItem) => setModalDeleteLog({ open: true, ov });

  const saveEdit = (): void => {
    if (!modalEdit.ov) return;
    const upd = modalEdit.ov;
    setOverrides((prev) => prev.map((x) => (x.id === upd.id ? { ...upd } : x)));
    setModalEdit({ open: false, ov: null });
    toast.success(t("adminSchedule.overrides.saved", "Override tersimpan."));
  };

  const confirmDeleteOverride = (): void => {
    const id = modalDeleteOv.ov?.id;
    if (id) deleteOverride(id);
    setModalDeleteOv({ open: false, ov: null });
    toast.success(t("adminSchedule.overrides.deleted", "Override dihapus."));
  };

  const confirmDeleteLog = async (): Promise<void> => {
    try {
      // Placeholder: implement real endpoint if available
      // await request("/admin/attendance/logs", { method: "DELETE", body: { override_id: modalDeleteLog.ov?.id } });
      toast.success(t("adminSchedule.logs.deleted", "Log dihapus."));
    } catch {
      toast.error(t("adminSchedule.logs.deleteFailed", "Gagal menghapus log."));
    } finally {
      setModalDeleteLog({ open: false, ov: null });
    }
  };

  return (
    <div className="space-y-6">
      {/* Overrides Header */}
      <div className="border rounded-lg">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">{hdr}</div>
            <div className="text-xs text-muted-foreground">
              {t("adminSchedule.overrides.description", "Tambah rentang tanggal untuk menimpa jadwal mingguan (libur, WFH, lembur).")}
            </div>
      {/* Modals */}
      <Dialog open={modalView.open} onOpenChange={(open) => !open && setModalView({ open: false, ov: null })}>
        <DialogContent className="max-w-lg" hideOverlay>
          <DialogHeader>
            <DialogTitle>{t("adminSchedule.modals.view.title", "View Override")}</DialogTitle>
          </DialogHeader>
          {modalView.ov && (
            <div className="grid gap-3 text-sm">
              <div className="flex justify-between"><span>{t("adminSchedule.overrides.label", "Label")}</span><span className="font-medium">{modalView.ov.label}</span></div>
              <div className="flex justify-between"><span>{t("adminSchedule.overrides.range", "Date Range")}</span><span className="font-medium">{modalView.ov.start_date} {modalView.ov.end_date && modalView.ov.end_date !== modalView.ov.start_date ? `→ ${modalView.ov.end_date}` : ""}</span></div>
              <div className="flex justify-between"><span>{t("adminSchedule.overrides.status", "Status")}</span><span className="font-medium">{modalView.ov.enabled ? t("adminSchedule.common.onLabel", "Hari Masuk") : t("adminSchedule.common.offLabel", "Hari Libur")}</span></div>
              <div className="flex justify-between"><span>{t("adminSchedule.overrides.hours", "Hours")}</span><span className="font-medium">{modalView.ov.check_in || "—"} - {modalView.ov.check_out || "—"}</span></div>
              <div className="flex justify-between"><span>{t("adminSchedule.overrides.grace", "Grace (In/Out)")}</span><span className="font-medium">{modalView.ov.grace_in_min} / {modalView.ov.grace_out_min}</span></div>
              {modalView.ov.notes && <div><div className="text-muted-foreground">{t("adminSchedule.overrides.notes", "Notes")}</div><div className="font-medium">{modalView.ov.notes}</div></div>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalView({ open: false, ov: null })}>{t("common.close", "Close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modalEdit.open} onOpenChange={(open) => !open && setModalEdit({ open: false, ov: null })}>
        <DialogContent className="max-w-lg" hideOverlay>
          <DialogHeader>
            <DialogTitle>{t("adminSchedule.modals.edit.title", "Edit Override")}</DialogTitle>
          </DialogHeader>
          {modalEdit.ov && (
            <div className="grid gap-3">
              <label className="space-y-1">
                <Label>{t("adminSchedule.overrides.form.range", "Date Range")}</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Input type="date" value={modalEdit.ov.start_date} onChange={(e) => setModalEdit((p)=> ({ ...p, ov: { ...(p.ov as OverrideItem), start_date: e.target.value } }))} />
                  <Input type="date" value={modalEdit.ov.end_date} onChange={(e) => setModalEdit((p)=> ({ ...p, ov: { ...(p.ov as OverrideItem), end_date: e.target.value } }))} />
                </div>
              </label>
              <label className="space-y-1">
                <Label>{t("adminSchedule.overrides.form.label", "Label")}</Label>
                <Input value={modalEdit.ov.label} onChange={(e)=> setModalEdit((p)=> ({ ...p, ov: { ...(p.ov as OverrideItem), label: e.target.value } }))} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <Label>{t("adminSchedule.form.checkIn", "Check In")}</Label>
                  <Input placeholder="08:30" value={modalEdit.ov.check_in ?? ""} onChange={(e)=> setModalEdit((p)=> ({ ...p, ov: { ...(p.ov as OverrideItem), check_in: e.target.value || null } }))} />
                </label>
                <label className="space-y-1">
                  <Label>{t("adminSchedule.form.checkOut", "Check Out")}</Label>
                  <Input placeholder="17:00" value={modalEdit.ov.check_out ?? ""} onChange={(e)=> setModalEdit((p)=> ({ ...p, ov: { ...(p.ov as OverrideItem), check_out: e.target.value || null } }))} />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <Label>{t("adminSchedule.form.graceIn", "Grace In (minutes)")}</Label>
                  <Input type="number" value={modalEdit.ov.grace_in_min} onChange={(e)=> setModalEdit((p)=> ({ ...p, ov: { ...(p.ov as OverrideItem), grace_in_min: clamp(Number(e.target.value), 0, 240) } }))} />
                </label>
                <label className="space-y-1">
                  <Label>{t("adminSchedule.form.graceOut", "Grace Out (minutes)")}</Label>
                  <Input type="number" value={modalEdit.ov.grace_out_min} onChange={(e)=> setModalEdit((p)=> ({ ...p, ov: { ...(p.ov as OverrideItem), grace_out_min: clamp(Number(e.target.value), 0, 240) } }))} />
                </label>
              </div>
              <label className="space-y-1">
                <Label>{t("adminSchedule.form.notes", "Notes")}</Label>
                <Input value={modalEdit.ov.notes} onChange={(e)=> setModalEdit((p)=> ({ ...p, ov: { ...(p.ov as OverrideItem), notes: e.target.value } }))} />
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalEdit({ open: false, ov: null })}>{t("common.cancel", "Cancel")}</Button>
            <Button onClick={saveEdit}>{t("common.save", "Save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modalDeleteOv.open} onOpenChange={(open) => !open && setModalDeleteOv({ open: false, ov: null })}>
        <DialogContent className="max-w-md" hideOverlay>
          <DialogHeader>
            <DialogTitle>{t("adminSchedule.modals.deleteOverride.title", "Delete Override?")}</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            {t("adminSchedule.modals.deleteOverride.body", "Tindakan ini akan menghapus override terpilih. Lanjutkan?")}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalDeleteOv({ open: false, ov: null })}>{t("common.cancel", "Cancel")}</Button>
            <Button variant="destructive" onClick={confirmDeleteOverride}>{t("common.delete", "Delete")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modalDeleteLog.open} onOpenChange={(open) => !open && setModalDeleteLog({ open: false, ov: null })}>
        <DialogContent className="max-w-md" hideOverlay>
          <DialogHeader>
            <DialogTitle>{t("adminSchedule.modals.deleteLog.title", "Delete Log?")}</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            {t("adminSchedule.modals.deleteLog.body", "Tindakan ini akan menghapus log terkait jadwal ini. Lanjutkan?")}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalDeleteLog({ open: false, ov: null })}>{t("common.cancel", "Cancel")}</Button>
            <Button variant="destructive" onClick={confirmDeleteLog}>{t("adminSchedule.actions.deleteLog", "Delete Log")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
          </div>
          <Button size="sm" onClick={addOverride}>
            <Icon name="Plus" className="h-4 w-4 mr-2" />
            {t("adminSchedule.overrides.add", "Add Override")}
          </Button>
        </div>

        <div className="p-2 overflow-x-auto">
          <table className="w-full">
            <thead className="text-xs text-muted-foreground border-b">
              <tr>
                <th className="text-left p-2">{t("adminSchedule.overrides.range", "Date Range")}</th>
                <th className="text-left p-2">{t("adminSchedule.overrides.label", "Label")}</th>
                <th className="text-left p-2">{t("adminSchedule.overrides.status", "Status")}</th>
                <th className="text-left p-2">{t("adminSchedule.overrides.hours", "Hours")}</th>
                <th className="text-left p-2">{t("adminSchedule.overrides.grace", "Grace (In/Out)")}</th>
                <th className="text-left p-2">{t("adminSchedule.overrides.notes", "Notes")}</th>
                <th className="text-right p-2">{t("common.actions", "Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {overrides.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-sm text-muted-foreground">
                    {t("adminSchedule.overrides.empty", "Belum ada override")}
                  </td>
                </tr>
              ) : (
                overrides.map((ov) => (
                  <tr key={ov.id} className="border-b align-top">
                    <td className="p-2 text-sm whitespace-nowrap">
                      <div>
                        {ov.start_date ? df.format(new Date(ov.start_date)) : "—"}
                        {ov.end_date && ov.end_date !== ov.start_date ? ` » ${df.format(new Date(ov.end_date))}` : ""}
                      </div>
                    </td>
                    <td className="p-2 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold uppercase">{ov.label}</div>
                        {!ov.enabled && (
                          <span className="text-[10px] px-2 py-1 rounded-full bg-red-100 text-red-700">{t("adminSchedule.overrides.offSummary", "Off / Holiday")}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${ov.enabled ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-700"}`}>
                        {ov.enabled ? t("adminSchedule.common.onLabel", "Hari Masuk") : t("adminSchedule.common.offLabel", "Hari Libur")}
                      </span>
                    </td>
                    <td className="p-2 text-sm">
                      {ov.enabled && ov.check_in && ov.check_out ? (
                        <span>{ov.check_in} - {ov.check_out}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-2 text-sm">
                      {ov.enabled ? (
                        <span>{ov.grace_in_min || 0} / {ov.grace_out_min || 0}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-2 text-sm">
                      {ov.notes?.trim() ? ov.notes : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-2 text-right">
                      <div className="inline-flex flex-wrap gap-2 justify-end">
                        <Button size="sm" onClick={() => openEdit(ov)} className="bg-orange-500 hover:bg-orange-600 text-white">
                          {t("adminSchedule.actions.editOverride", "Edit Override")}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => duplicateOverride(ov.id)}>
                          {t("common.duplicate", "Duplicate")}
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => openDeleteOverride(ov)}>
                          {t("adminSchedule.actions.deleteOverride", "Delete Override")}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Days Editor */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded-lg p-2 md:col-span-1">
          <div className="divide-y">
            {DAYS.map((d) => {
              const r = rules.find((x) => x.day === d);
              const active = selectedDay === d;
              const badge = r?.enabled ? t("adminSchedule.badge.work", "Working Day") : t("adminSchedule.badge.holiday", "Holiday / Off");
              const hours = r?.enabled ? `${r.check_in} - ${r.check_out}` : t("adminSchedule.badge.noSchedule", "No schedule");
              return (
                <button
                  key={d}
                  className={`w-full text-left p-3 flex items-center justify-between ${active ? "bg-accent" : "hover:bg-muted/50"}`}
                  onClick={() => setSelectedDay(d)}
                >
                  <div>
                    <div className="font-medium">{d}</div>
                    <div className="text-xs text-muted-foreground">{hours}</div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${r?.enabled ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-700"}`}>{badge}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border rounded-lg p-4 md:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="text-lg font-semibold">{selectedDay}</div>
            <div className="flex items-center gap-2">
              <span className="text-sm">{t("adminSchedule.common.workingDay", "Working Day")}</span>
              <select
                className="h-8 rounded-md border px-2 text-sm"
                value={selectedRule?.enabled ? "on" : "off"}
                onChange={(e) => updateRule(selectedDay, { enabled: e.target.value === "on" })}
              >
                <option value="on">{t("adminSchedule.common.onLabel", "Hari Masuk")}</option>
                <option value="off">{t("adminSchedule.common.offLabel", "Hari Libur")}</option>
              </select>
            </div>
          </div>

          {/* Presets */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={() => applyPreset("workday")}>{t("adminSchedule.presets.workday.label", "Normal Hours")}</Button>
            <Button variant="outline" size="sm" onClick={() => applyPreset("halfday")}>{t("adminSchedule.presets.halfday.label", "Morning Shift")}</Button>
            <Button variant="outline" size="sm" onClick={() => applyPreset("evening")}>{t("adminSchedule.presets.evening.label", "Evening Shift")}</Button>
            <Button variant="outline" size="sm" onClick={() => applyPreset("wfh")}>{t("adminSchedule.presets.wfh.label", "Flexible WFH")}</Button>
            <Button variant="outline" size="sm" onClick={() => applyPreset("off")}>{t("adminSchedule.presets.off.label", "Holiday / Off")}</Button>
          </div>

          {/* Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1">
              <div className="text-sm font-medium">{t("adminSchedule.form.label", "Schedule Label")}</div>
              <input
                className="h-9 w-full rounded-md border px-3 text-sm"
                value={selectedRule?.label || ""}
                onChange={(e) => updateRule(selectedDay, { label: e.target.value })}
              />
            </label>
            <div />

            <label className="space-y-1">
              <div className="text-sm font-medium">{t("adminSchedule.form.checkIn", "Check In")}</div>
              <input
                className="h-9 w-40 rounded-md border px-3 text-sm"
                placeholder="08:30"
                value={selectedRule?.check_in || ""}
                onChange={(e) => updateRule(selectedDay, { check_in: e.target.value })}
              />
            </label>
            <label className="space-y-1">
              <div className="text-sm font-medium">{t("adminSchedule.form.checkOut", "Check Out")}</div>
              <input
                className="h-9 w-40 rounded-md border px-3 text-sm"
                placeholder="17:00"
                value={selectedRule?.check_out || ""}
                onChange={(e) => updateRule(selectedDay, { check_out: e.target.value })}
              />
            </label>

            <label className="space-y-1">
              <div className="text-sm font-medium">{t("adminSchedule.form.graceIn", "Grace In (minutes)")}</div>
              <input
                type="number"
                className="h-9 w-32 rounded-md border px-3 text-sm"
                value={selectedRule?.grace_in_min ?? 0}
                onChange={(e) => updateRule(selectedDay, { grace_in_min: clamp(Number(e.target.value), 0, 240) })}
              />
            </label>
            <label className="space-y-1">
              <div className="text-sm font-medium">{t("adminSchedule.form.graceOut", "Grace Out (minutes)")}</div>
              <input
                type="number"
                className="h-9 w-32 rounded-md border px-3 text-sm"
                value={selectedRule?.grace_out_min ?? 0}
                onChange={(e) => updateRule(selectedDay, { grace_out_min: clamp(Number(e.target.value), 0, 240) })}
              />
            </label>

            <label className="space-y-1 md:col-span-2">
              <div className="text-sm font-medium">{t("adminSchedule.form.notes", "Notes")}</div>
              <input
                className="h-9 w-full rounded-md border px-3 text-sm"
                placeholder={t("adminSchedule.form.notesPlaceholder", "Optional")}
                value={selectedRule?.notes || ""}
                onChange={(e) => updateRule(selectedDay, { notes: e.target.value })}
              />
            </label>

            <div className="md:col-span-2 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => applyToDays(DAYS)}>
                {t("adminSchedule.actions.copyToAll", "Copy to other days")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => applyToDays(WORKDAYS)}>
                {t("adminSchedule.actions.applyToWorkdays", "Apply to workdays")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => applyToDays(WEEKEND)}>
                {t("adminSchedule.actions.applyToWeekend", "Apply to weekend")}
              </Button>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t pt-4">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <span>{t("adminSchedule.form.defaultGraceIn", "Default grace in")}</span>
                <input
                  type="number"
                  className="h-8 w-20 rounded-md border px-2 text-sm"
                  value={gIn}
                  onChange={(e) => setGIn(clamp(Number(e.target.value), 0, 240))}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <span>{t("adminSchedule.form.defaultGraceOut", "Default grace out")}</span>
                <input
                  type="number"
                  className="h-8 w-20 rounded-md border px-2 text-sm"
                  value={gOut}
                  onChange={(e) => setGOut(clamp(Number(e.target.value), 0, 240))}
                />
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={resetChanges} disabled={loading || saving || !isDirty}>
                {t("adminSchedule.actions.discard", "Discard Changes")}
              </Button>
              <Button size="sm" onClick={saveAll} disabled={loading || saving}>
                {saving ? t("adminSchedule.actions.saving", "Menyimpan...") : t("adminSchedule.actions.save", "Save Schedule")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
