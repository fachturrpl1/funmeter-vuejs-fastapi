// app/admin/attendance/page.tsx
// Migrasi dari src-vue-original/pages/admin/AdminAttendancePage.vue (UI identik)

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { request } from "@/lib/api";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/common/Icon";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface AttendanceMember {
  id: string;
  name: string;
  avatar?: string;
}

interface AttendanceSchedule {
  label: string;
  preset?: "workday" | "halfday" | "evening" | "wfh" | "off";
  overridden?: boolean;
}

interface AttendanceLog {
  id: string;
  member: AttendanceMember;
  date: string; // YYYY-MM-DD
  check_in: string | null; // ISO timestamp or null
  check_out: string | null; // ISO timestamp or null
  schedule: AttendanceSchedule;
  status: "present" | "late" | "left_early" | "late_left_early" | "off";
  has_override: boolean;
}

interface AttendanceResponse {
  items: AttendanceLog[];
  meta: {
    page: number;
    total_pages: number;
    total: number;
    per_page: number;
  };
}

interface AttendanceFilters {
  search?: string;
  status?: string;
  per_page?: number;
  order?: "asc" | "desc";
  date_from?: string;
  date_to?: string;
}

export default function AdminAttendancePage() {
  const { t } = useI18n();
  
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<AttendanceFilters>({
    per_page: 10,
    order: "desc"
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  
  // Modal states
  const [showViewModal, setShowViewModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AttendanceLog | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteType, setDeleteType] = useState<'log' | 'override'>('log');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Mock data untuk demo (sesuai screenshot Vue)
  const mockLogs: AttendanceLog[] = [
    {
      id: "1",
      member: { id: "1", name: "Jem Karin Samin" },
      date: "2025-11-03",
      check_in: "2025-11-03T08:35:00Z",
      check_out: "2025-11-03T17:35:00Z",
      schedule: { label: "Jam Kerja Normal", preset: "workday" },
      status: "late",
      has_override: false
    },
    {
      id: "2", 
      member: { id: "2", name: "LIBUR KERJA" },
      date: "2025-11-02",
      check_in: "2025-11-02T23:41:00Z",
      check_out: "2025-11-02T23:46:00Z",
      schedule: { label: "Libur", preset: "off" },
      status: "off",
      has_override: true
    },
    {
      id: "3",
      member: { id: "3", name: "Hari Libur" },
      date: "2025-11-02", 
      check_in: "2025-11-02T14:42:00Z",
      check_out: "2025-11-02T22:15:00Z",
      schedule: { label: "Minggu", preset: "off" },
      status: "off",
      has_override: false
    },
    {
      id: "4",
      member: { id: "4", name: "Jem Karin Kamin" },
      date: "2025-10-30",
      check_in: "2025-10-30T13:50:00Z", 
      check_out: "2025-10-30T15:51:00Z",
      schedule: { label: "Senin", preset: "workday" },
      status: "late_left_early",
      has_override: false
    },
    {
      id: "5",
      member: { id: "5", name: "Jem Karin Salman" },
      date: "2025-10-28",
      check_in: "2025-10-28T08:42:00Z",
      check_out: "2025-10-28T15:03:00Z", 
      schedule: { label: "Sabtu", preset: "workday" },
      status: "left_early",
      has_override: false
    }
  ];

  const fetchLogs = useCallback(async (page = 1, filterParams = filters) => {
    try {
      setLoading(true);
      
      // Simulasi API call - ganti dengan endpoint sebenarnya
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Filter mock data berdasarkan search
      let filteredLogs = mockLogs;
      if (filterParams.search) {
        filteredLogs = mockLogs.filter(log => 
          log.member.name.toLowerCase().includes(filterParams.search!.toLowerCase())
        );
      }
      
      // Filter berdasarkan status
      if (filterParams.status) {
        filteredLogs = filteredLogs.filter(log => log.status === filterParams.status);
      }
      
      // Pagination
      const perPage = filterParams.per_page || 10;
      const start = (page - 1) * perPage;
      const end = start + perPage;
      const paginatedLogs = filteredLogs.slice(start, end);
      
      setLogs(paginatedLogs);
      setCurrentPage(page);
      setTotalRecords(filteredLogs.length);
      setTotalPages(Math.ceil(filteredLogs.length / perPage));
      
    } catch (error) {
      toast.error(t("adminAttendance.error.fetch", "Gagal memuat data absensi"));
    } finally {
      setLoading(false);
    }
  }, [filters, t]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const clearFilters = () => {
    setFilters({
      per_page: 10,
      order: "desc"
    });
    setCurrentPage(1);
  };

  // Export functionality
  const exportData = async () => {
    try {
      // Simulasi export - ganti dengan API call sebenarnya
      const csvContent = [
        ['Member', 'Date', 'Check In', 'Check Out', 'Schedule', 'Status'].join(','),
        ...logs.map(log => [
          log.member.name,
          log.date,
          formatTime(log.check_in),
          formatTime(log.check_out),
          log.schedule.label,
          log.status
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success(t("adminAttendance.toast.exportSuccess", "Data berhasil diekspor"));
    } catch (error) {
      toast.error(t("adminAttendance.toast.exportError", "Gagal mengekspor data"));
    }
  };

  // Action handlers
  const handleView = (log: AttendanceLog) => {
    setSelectedLog(log);
    setShowViewModal(true);
  };

  const handleCustomSchedule = (log: AttendanceLog) => {
    setSelectedLog(log);
    setShowScheduleModal(true);
  };

  const handleEditOverride = (log: AttendanceLog) => {
    setSelectedLog(log);
    setShowScheduleModal(true);
  };

  const handleDeleteLog = (log: AttendanceLog) => {
    setSelectedLog(log);
    setDeleteType('log');
    setShowDeleteConfirm(true);
  };

  const handleDeleteOverride = (log: AttendanceLog) => {
    setSelectedLog(log);
    setDeleteType('override');
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!selectedLog) return;
    
    try {
      // Simulasi delete - ganti dengan API call sebenarnya
      if (deleteType === 'log') {
        setLogs(prev => prev.filter(log => log.id !== selectedLog.id));
        toast.success(t("adminAttendance.toast.logDeleted", "Log absensi berhasil dihapus"));
      } else {
        // Update log to remove override
        setLogs(prev => prev.map(log => 
          log.id === selectedLog.id 
            ? { ...log, has_override: false, schedule: { ...log.schedule, overridden: false } }
            : log
        ));
        toast.success(t("adminAttendance.toast.overrideDeleted", "Override berhasil dihapus"));
      }
    } catch (error) {
      toast.error(t("adminAttendance.toast.deleteError", "Gagal menghapus data"));
    } finally {
      setShowDeleteConfirm(false);
      setSelectedLog(null);
    }
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return "-";
    try {
      return new Date(isoString).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });
    } catch {
      return "-";
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("id-ID", {
        weekday: "long",
        day: "2-digit", 
        month: "long",
        year: "numeric"
      });
    } catch {
      return dateString;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present":
        return <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">Hadir</span>;
      case "late":
        return <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-medium">Late early</span>;
      case "left_early":
        return <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-medium">Left early</span>;
      case "late_left_early":
        return <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-medium">Late & Left early</span>;
      case "off":
        return <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs font-medium">Off</span>;
      default:
        return <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs font-medium">{status}</span>;
    }
  };

  const getScheduleBadge = (schedule: AttendanceSchedule) => {
    if (schedule.overridden) {
      return <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">Override</span>;
    }
    
    switch (schedule.preset) {
      case "workday":
        return <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">Senin</span>;
      case "off":
        return <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs font-medium">Libur</span>;
      default:
        return <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs font-medium">{schedule.label}</span>;
    }
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const goTo = (page: number) => {
      const clamped = Math.min(Math.max(1, page), totalPages);
      fetchLogs(clamped, filters);
    };

    return (
      <div className="flex items-center justify-between p-4 border-t">
        <div className="text-sm text-muted-foreground">Total: {totalRecords}</div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => goTo(1)} disabled={currentPage <= 1}>
            <Icon name="ChevronsLeft" className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => goTo(currentPage - 1)} disabled={currentPage <= 1}>
            <Icon name="ChevronLeft" className="h-4 w-4" />
          </Button>
          <span className="px-3 py-1 rounded-md bg-gray-100 text-sm">{currentPage}</span>
          <Button variant="outline" size="sm" onClick={() => goTo(currentPage + 1)} disabled={currentPage >= totalPages}>
            <Icon name="ChevronRight" className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => goTo(totalPages)} disabled={currentPage >= totalPages}>
            <Icon name="ChevronsRight" className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("pages.adminAttendance.title", "Data Absensi")}</h1>
          <p className="text-muted-foreground">
            {t("adminAttendance.subtitle", "Kelola dan pantau data absensi anggota")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportData} variant="outline" size="sm">
            <Icon name="Download" className="h-4 w-4 mr-2" />
            {t("adminAttendance.actions.export", "Export")}
          </Button>
          <Button onClick={() => fetchLogs(currentPage, filters)} variant="outline" size="sm">
            <Icon name="RefreshCw" className="h-4 w-4 mr-2" />
            {t("adminAttendance.actions.refresh", "Refresh")}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-lg border p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t("adminAttendance.filters.searchName", "Search member name")}</label>
            <input
              type="text"
              placeholder={t("adminAttendance.filters.searchPlaceholder", "Search member name...")}
              value={filters.search || ""}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">{t("adminAttendance.filters.status", "Status")}</label>
            <select
              value={filters.status || ""}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="w-full px-3 py-2 border rounded-md text-sm"
            >
              <option value="">{t("adminAttendance.filters.allStatuses", "All statuses")}</option>
              <option value="present">{t("adminAttendance.status.present", "Present")}</option>
              <option value="late">{t("adminAttendance.status.late", "Late")}</option>
              <option value="left_early">{t("adminAttendance.status.leftEarly", "Left Early")}</option>
              <option value="late_left_early">{t("adminAttendance.status.lateLeftEarly", "Late & Left Early")}</option>
              <option value="off">{t("adminAttendance.status.off", "Off")}</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">{t("adminAttendance.filters.perPage", "Per page")}</label>
            <select
              value={filters.per_page || 10}
              onChange={(e) => setFilters(prev => ({ ...prev, per_page: Number(e.target.value) }))}
              className="w-full px-3 py-2 border rounded-md text-sm"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">{t("adminAttendance.filters.order", "Order")}</label>
            <select
              value={filters.order || "desc"}
              onChange={(e) => setFilters(prev => ({ ...prev, order: e.target.value as "asc" | "desc" }))}
              className="w-full px-3 py-2 border rounded-md text-sm"
            >
              <option value="desc">{t("adminAttendance.filters.newest", "Newest")}</option>
              <option value="asc">{t("adminAttendance.filters.oldest", "Oldest")}</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">{t("adminAttendance.filters.dateRange", "Date Range")}</label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 justify-start text-left font-normal"
                onClick={() => setShowDatePicker(true)}
              >
                <Icon name="Calendar" className="mr-2 h-4 w-4" />
                {filters.date_from && filters.date_to 
                  ? `${filters.date_from} - ${filters.date_to}`
                  : t("adminAttendance.filters.pickDateRange", "Pick date range")
                }
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowDatePicker(true)}>
                <Icon name="ChevronDown" className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="text-left p-4 font-medium text-sm">{t("adminAttendance.table.member", "Member")}</th>
                <th className="text-left p-4 font-medium text-sm">{t("adminAttendance.table.date", "Date")}</th>
                <th className="text-left p-4 font-medium text-sm">{t("adminAttendance.table.checkIn", "Check In")}</th>
                <th className="text-left p-4 font-medium text-sm">{t("adminAttendance.table.checkOut", "Check Out")}</th>
                <th className="text-left p-4 font-medium text-sm">{t("adminAttendance.table.schedule", "Schedule")}</th>
                <th className="text-left p-4 font-medium text-sm">{t("adminAttendance.table.status", "Status")}</th>
                <th className="text-right p-4 font-medium text-sm">{t("adminAttendance.table.actions", "Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center">
                    <Icon name="Loader2" className="h-6 w-6 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : logs.length > 0 ? (
                logs.map((log, index) => (
                  <tr key={log.id} className="border-b hover:bg-muted/40">
                    <td className="p-4">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center mr-3 text-xs font-medium">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{log.member.name}</div>
                          <div className="text-xs text-muted-foreground">{t("adminAttendance.status.present", "Hadir")}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm">{formatDate(log.date)}</td>
                    <td className="p-4 text-sm">{formatTime(log.check_in)}</td>
                    <td className="p-4 text-sm">{formatTime(log.check_out)}</td>
                    <td className="p-4 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="font-medium">{log.schedule.label}</div>
                        {log.schedule.preset && (
                          <span className="text-[10px] px-2 py-1 rounded-full bg-muted text-foreground/80 capitalize">{log.schedule.preset === 'workday' ? t("adminAttendance.week.monday", "Senin") : log.schedule.preset}</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">Grace: {log.schedule.preset === 'workday' ? '10/5' : '0/0'} min</div>
                    </td>
                    <td className="p-4">{getStatusBadge(log.status)}</td>
                    <td className="p-4">
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleView(log)}>{t("common.view", "View")}</Button>
                          {log.has_override ? (
                            <Button size="sm" onClick={() => handleEditOverride(log)} className="bg-orange-500 hover:bg-orange-600 text-white">{t("adminAttendance.actions.editOverride", "Edit Override")}</Button>
                          ) : (
                            <Button size="sm" onClick={() => handleCustomSchedule(log)} className="bg-orange-500 hover:bg-orange-600 text-white">{t("adminAttendance.actions.customSchedule", "Custom Schedule")}</Button>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {log.has_override && (
                            <Button variant="destructive" size="sm" onClick={() => handleDeleteOverride(log)}>{t("adminAttendance.actions.deleteOverride", "Delete Override")}</Button>
                          )}
                          <Button variant="destructive" size="sm" onClick={() => handleDeleteLog(log)}>{t("adminAttendance.actions.deleteLog", "Delete Log")}</Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    <Icon name="ClipboardList" className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>{t("adminAttendance.table.empty", "Belum ada data absensi")}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {renderPagination()}
      </div>

      {/* View Modal */}
      <Dialog open={showViewModal && !!selectedLog} onOpenChange={(open)=> !open && setShowViewModal(false)}>
        <DialogContent hideOverlay className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("adminAttendance.view.title", "Detail Absensi")}</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t("adminAttendance.view.member", "Member")}</label>
                <p className="text-sm">{selectedLog.member.name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t("adminAttendance.view.date", "Tanggal")}</label>
                <p className="text-sm">{formatDate(selectedLog.date)}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t("adminAttendance.view.checkIn", "Check In")}</label>
                  <p className="text-sm">{formatTime(selectedLog.check_in)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t("adminAttendance.view.checkOut", "Check Out")}</label>
                  <p className="text-sm">{formatTime(selectedLog.check_out)}</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t("adminAttendance.view.schedule", "Schedule")}</label>
                <div className="mt-1">{getScheduleBadge(selectedLog.schedule)}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t("adminAttendance.view.status", "Status")}</label>
                <div className="mt-1">{getStatusBadge(selectedLog.status)}</div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewModal(false)}>{t("common.close", "Tutup")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Modal */}
      <Dialog open={showScheduleModal && !!selectedLog} onOpenChange={(open)=> !open && setShowScheduleModal(false)}>
        <DialogContent hideOverlay className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedLog?.has_override ? t("adminAttendance.schedule.editOverride", "Edit Override") : t("adminAttendance.schedule.custom", "Custom Schedule")}</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t("adminAttendance.view.member", "Member")}</label>
                <p className="text-sm bg-gray-50 p-2 rounded">{selectedLog.member.name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t("adminAttendance.view.date", "Tanggal")}</label>
                <p className="text-sm bg-gray-50 p-2 rounded">{formatDate(selectedLog.date)}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t("adminAttendance.view.checkIn", "Check In")}</label>
                  <input type="time" className="w-full px-3 py-2 border rounded-md text-sm" defaultValue={selectedLog.check_in ? formatTime(selectedLog.check_in) : ""} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t("adminAttendance.view.checkOut", "Check Out")}</label>
                  <input type="time" className="w-full px-3 py-2 border rounded-md text-sm" defaultValue={selectedLog.check_out ? formatTime(selectedLog.check_out) : ""} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t("adminAttendance.schedule.type", "Schedule Type")}</label>
                <select className="w-full px-3 py-2 border rounded-md text-sm">
                  <option value="workday">{t("adminAttendance.schedule.workday", "Jam Kerja Normal")}</option>
                  <option value="halfday">{t("adminAttendance.schedule.halfday", "Shift Pagi")}</option>
                  <option value="evening">{t("adminAttendance.schedule.evening", "Shift Sore")}</option>
                  <option value="wfh">{t("adminAttendance.schedule.wfh", "WFH Fleksibel")}</option>
                  <option value="off">{t("adminAttendance.schedule.off", "Libur")}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t("adminAttendance.schedule.note", "Catatan")}</label>
                <textarea className="w-full px-3 py-2 border rounded-md text-sm" rows={3} placeholder="Catatan opsional..." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => { toast.success(t("adminAttendance.schedule.saved", "Schedule berhasil disimpan")); setShowScheduleModal(false); }} className="flex-1">{t("common.save", "Simpan")}</Button>
            <Button variant="outline" onClick={() => setShowScheduleModal(false)} className="flex-1">{t("common.cancel", "Batal")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteConfirm && !!selectedLog} onOpenChange={(open)=> !open && setShowDeleteConfirm(false)}>
        <DialogContent hideOverlay className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("common.confirmDelete", "Konfirmasi Hapus")}</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="mb-6">
              <p className="text-sm text-gray-600">
                Apakah Anda yakin ingin menghapus {deleteType === 'log' ? 'log absensi' : 'override'} untuk <strong>{selectedLog.member.name}</strong> pada tanggal <strong>{formatDate(selectedLog.date)}</strong>?
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="destructive" onClick={confirmDelete} className="flex-1">{t("common.delete", "Hapus")}</Button>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} className="flex-1">{t("common.cancel", "Batal")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Date Range Picker Modal */}
      <Dialog open={showDatePicker} onOpenChange={(open)=> !open && setShowDatePicker(false)}>
        <DialogContent hideOverlay className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("adminAttendance.filters.pickTitle", "Pilih Rentang Tanggal")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t("adminAttendance.filters.startDate", "Tanggal Mulai")}</label>
              <input type="date" value={filters.date_from || ""} onChange={(e) => setFilters(prev => ({ ...prev, date_from: e.target.value }))} className="w-full px-3 py-2 border rounded-md text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t("adminAttendance.filters.endDate", "Tanggal Akhir")}</label>
              <input type="date" value={filters.date_to || ""} onChange={(e) => setFilters(prev => ({ ...prev, date_to: e.target.value }))} className="w-full px-3 py-2 border rounded-md text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => { setCurrentPage(1); fetchLogs(1, filters); setShowDatePicker(false); }} className="flex-1">{t("common.apply", "Terapkan")}</Button>
            <Button variant="outline" onClick={() => { setFilters(prev => ({ ...prev, date_from: "", date_to: "" })); setShowDatePicker(false); }} className="flex-1">{t("common.reset", "Reset")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
