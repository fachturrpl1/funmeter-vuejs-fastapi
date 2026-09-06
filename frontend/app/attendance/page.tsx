// app/attendance/page.tsx
// Port dari src-vue-original/pages/default/AttendancePage.vue

"use client";

import React, { useState, useRef, useEffect } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { useSettings } from "@/components/providers/SettingsProvider";
import { toast } from "@/lib/toast";
import { request } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { RefreshCw, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { fmtAttendanceWIB } from "@/lib/format";
import * as Cam from "@/lib/cameraManager";


interface AttendanceRecord {
  label: string;
  person_id?: string;
  ts: string;
  score: number;
}

//

export default function AttendancePage() {
  const { t } = useI18n();
  const { useSetting } = useSettings();
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  
  const [cameraActive, setCameraActive] = useState(false);
  // simplified state for this page (no realtime results shown)
  const [logItems, setLogItems] = useState<AttendanceRecord[]>([]);
  const [logMeta, setLogMeta] = useState({
    page: 1,
    total_pages: 1,
    per_page: 25,
    total: 0,
    has_prev: false,
    has_next: false,
  });
  const [perPage, setPerPage] = useState<number>(10);
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  // Settings
  type SettingBinding = { model: number; setModel: (v: number) => void };
  const baseInterval = useSetting("baseInterval", { clamp: { max: 5000, round: true } }) as unknown as SettingBinding;
  // other settings omitted in this compact view

  // no realtime socket on this page

  // Camera functions
  const startCamera = async () => {
    if (!videoRef.current) return;
    try {
      await Cam.attach(videoRef.current);
      setCameraActive(true);
    } catch {
      toast.error(t("attendance.toast.cameraError", "Gagal mengakses kamera"));
    }
  };

  const stopCamera = () => {
    Cam.detach(videoRef.current);
    setCameraActive(Cam.isActive());
  };

  // Fetch attendance log
  type LogResponse = { items: AttendanceRecord[]; meta: typeof logMeta };
  const refreshLog = React.useCallback(async (page = 1) => {
    try {
      const response = await request<LogResponse>(`/attendance-log?page=${page}&per_page=${perPage}&order=${order}`);
      setLogItems(response.items || []);
      const meta = response.meta || logMeta;
      const total = Number(meta.total ?? 0);
      const totalPages = Math.max(1, Number(meta.total_pages ?? (total > 0 ? Math.ceil(total / perPage) : 1)));
      const pageSafe = Math.max(1, Math.min(Number(meta.page ?? page), totalPages));
      const computed = {
        ...meta,
        page: pageSafe,
        per_page: perPage,
        total_pages: totalPages,
        total: total,
        has_prev: pageSafe > 1,
        has_next: pageSafe < totalPages,
      };
      setLogMeta(computed);
    } catch {
      toast.error(t("attendance.toast.fetchError", "Gagal memuat data absensi"));
    }
  }, [order, perPage, t]);

  // Load initial data and react to perPage/order changes
  useEffect(() => {
    void refreshLog(1);
  }, [refreshLog, perPage, order]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  //

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left: Camera card */}
        <div className="bg-card rounded-lg border p-6 self-start">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {t("attendance.camera.title", "Camera")}
          </p>
          <h3 className="text-lg font-semibold mb-4">{t("attendance.camera.subtitle", "Attendance Streaming")}</h3>
          <div className="relative rounded-lg border bg-muted/30 overflow-hidden mb-4">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-auto object-contain block"
            />
            <canvas
              ref={overlayRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />
          </div>

          <div className="mt-2">
            <label className="text-sm font-medium block mb-1">{t("attendance.settings.baseInterval", "Interval (ms)")}</label>
            <input
              type="number"
              value={baseInterval.model as number}
              onChange={(e) => baseInterval.setModel(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-md"
              min="200"
              max="5000"
            />
          </div>
          <p className="m-4 text-sm text-muted-foreground">
            {t("attendance.camera.help", "Press start to send frames to the attendance server.")}
          </p>
          <div className="mb-2">
            <Button
              onClick={cameraActive ? stopCamera : startCamera}
              variant={cameraActive ? "outline" : "default"}
            >
              {cameraActive
                ? t("attendance.actions.stopCamera", "Stop Camera")
                : t("attendance.actions.startCamera", "Start Camera")}
            </Button>
          </div>
        </div>

        {/* Right: Attendance log card */}
        <div className="bg-card rounded-lg border p-6 self-start">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{t("attendance.log.section", "Attendance Log")}</p>
              <div className="text-lg font-semibold">{t("attendance.log.arrival", "Arrival History")}</div>
            </div>
            <Button 
              onClick={() => refreshLog()} 
              size="sm" 
              variant="outline"
              className="aspect-square p-2"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <label className="space-y-1">
              <span className="text-sm font-medium">{t("attendance.log.itemsPerPage", "Items per page")}</span>
              <select
                value={perPage}
                onChange={(e) => { setPerPage(Number(e.target.value)); refreshLog(1); }}
                className="h-9 w-full rounded-md border px-3 py-1 text-sm"
              >
                {[10, 25, 50].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">{t("attendance.log.order", "Order")}</span>
              <select
                value={order}
                onChange={(e) => { const v = e.target.value as "asc" | "desc"; setOrder(v); refreshLog(1); }}
                className="h-9 w-full rounded-md border px-3 py-1 text-sm"
              >
                <option value="desc">{t("attendance.log.newest", "Newest")}</option>
                <option value="asc">{t("attendance.log.oldest", "Oldest")}</option>
              </select>
            </label>
          </div>
          <div className="rounded-lg border p-0 text-sm overflow-x-auto">
            {logItems.length === 0 ? (
              <div className="p-6">
                <p className="text-muted-foreground">{t("attendance.log.empty", "No attendance data available.")}</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left p-3 font-medium w-16">No</th>
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">Time & Date</th>
                    <th className="text-right p-3 font-medium w-24">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {logItems.map((item, idx) => {
                    const no = (logMeta.page - 1) * perPage + idx + 1;
                    return (
                      <tr key={`${item.ts}-${idx}`} className="border-b last:border-0">
                        <td className="p-3">{no}</td>
                        <td className="p-3">{item.label || "-"}</td>
                        <td className="p-3">{fmtAttendanceWIB(item.ts)}</td>
                        <td className="p-3 text-right font-mono">{(item.score || 0).toFixed(3)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
            <div>
              {t("attendance.log.total", "Total:")} {logMeta.total || 0}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refreshLog(1)}
                disabled={logMeta.page <= 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refreshLog(Math.max(1, logMeta.page - 1))}
                disabled={logMeta.page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-3 py-1 rounded-md bg-gray-100 text-foreground">{logMeta.page}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refreshLog(Math.min(logMeta.total_pages, logMeta.page + 1))}
                disabled={logMeta.page >= logMeta.total_pages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refreshLog(logMeta.total_pages || 1)}
                disabled={logMeta.page >= logMeta.total_pages}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
