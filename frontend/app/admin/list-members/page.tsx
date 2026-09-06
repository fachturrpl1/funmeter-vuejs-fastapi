// app/admin/list-members/page.tsx
// Port dari src-vue-original/pages/admin/AdminFaceDbPage.vue

"use client";

import React, { useState, useEffect } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { useConfirmDialog } from "@/components/providers/ConfirmDialogProvider";
import { request, resolveApi } from "@/lib/api";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/common/Icon";

interface FaceItem {
  id: string | number;
  label: string;
  person_id?: string;
  ts?: string; // timestamp ISO
  time?: string;
  timestamp?: string;
  created_at?: string;
  date?: string;
  photo_url?: string;
  photo_path?: string;
}

export default function AdminListMembersPage() {
  const { t } = useI18n();
  const confirm = useConfirmDialog();
  const [items, setItems] = useState<FaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMembers, setTotalMembers] = useState(0);
  const [perPage, setPerPage] = useState(10);
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  // Fetch members data
  const fetchMembers = async (page = 1, search = "") => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("per_page", String(perPage));
      params.set("order", order);
      if (search.trim()) params.set("q", search.trim());
      const response = await request<{
        items: FaceItem[];
        meta?: { page?: number; total_pages?: number; total?: number; per_page?: number; order?: string };
      }>(`/register-db-data?${params.toString()}`);

      setItems(response.items || []);
      setCurrentPage(response.meta?.page || page);
      setTotalPages(response.meta?.total_pages || 1);
      setTotalMembers(response.meta?.total || (response.items?.length || 0));
    } catch (error) {
      toast.error(t("adminListMembers.toast.fetchError", "Gagal memuat data anggota"));
    } finally {
      setLoading(false);
    }
  };

  // Delete member
  const deleteMember = async (memberId: string, memberName: string) => {
    const confirmed = await confirm({
      title: t("adminListMembers.confirm.delete.title", "Hapus Anggota"),
      description: t("adminListMembers.confirm.delete.desc", "Apakah Anda yakin ingin menghapus {name}? Tindakan ini tidak dapat dibatalkan.", { name: memberName }),
      confirmText: t("adminListMembers.confirm.delete.confirm", "Hapus"),
      cancelText: t("adminListMembers.confirm.delete.cancel", "Batal"),
    });

    if (!confirmed) return;

    try {
      await request(`/admin/face-db/members/${memberId}`, { method: "DELETE" });
      toast.success(t("adminListMembers.toast.deleteSuccess", "Anggota berhasil dihapus"));
      fetchMembers(currentPage, searchQuery);
    } catch (error) {
      toast.error(t("adminListMembers.toast.deleteError", "Gagal menghapus anggota"));
    }
  };

  // Delete multiple members
  const deleteSelectedMembers = async () => {
    if (selectedMembers.length === 0) return;

    const confirmed = await confirm({
      title: t("adminListMembers.confirm.deleteMultiple.title", "Hapus Beberapa Anggota"),
      description: t("adminListMembers.confirm.deleteMultiple.desc", "Apakah Anda yakin ingin menghapus {count} anggota yang dipilih?", { count: selectedMembers.length }),
      confirmText: t("adminListMembers.confirm.deleteMultiple.confirm", "Hapus Semua"),
      cancelText: t("adminListMembers.confirm.deleteMultiple.cancel", "Batal"),
    });

    if (!confirmed) return;

    try {
      await request("/admin/face-db/members/bulk-delete", {
        method: "POST",
        body: { member_ids: selectedMembers },
      });
      toast.success(t("adminListMembers.toast.deleteMultipleSuccess", "Anggota terpilih berhasil dihapus"));
      setSelectedMembers([]);
      fetchMembers(currentPage, searchQuery);
    } catch (error) {
      toast.error(t("adminListMembers.toast.deleteMultipleError", "Gagal menghapus anggota terpilih"));
    }
  };

  // Toggle member selection
  const toggleMemberSelection = (memberId: string) => {
    setSelectedMembers(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  // Select all members
  const toggleSelectAll = () => {
    if (selectedMembers.length === items.length) {
      setSelectedMembers([]);
    } else {
      setSelectedMembers(items.map(m => String(m.id)));
    }
  };

  // Search members
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
    fetchMembers(1, query);
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const photoUrl = (row: FaceItem): string => {
    const p = row.photo_url || row.photo_path || "";
    if (!p) return "";
    const s = String(p).replace(/\\/g, "/");
    return /^https?:\/\//i.test(s) ? s : resolveApi(s.replace(/^\/+/, ""));
  };
  const rowTs = (row: FaceItem): string => {
    const s = row.ts || row.time || row.timestamp || row.created_at || row.date || "";
    if (!s) return "-";
    const d = new Date(String(s).replace(" ", "T"));
    if (Number.isNaN(d.getTime())) return String(s);
    return d.toLocaleString("id-ID");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("pages.adminRegisterDb.title", "DB Wajah Admin")}</h1>
          <p className="text-muted-foreground">
            {t("adminListMembers.subtitle", "Kelola database wajah anggota ({total} anggota)", { total: totalMembers })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => fetchMembers(currentPage, searchQuery)} variant="outline" size="sm">
            <Icon name="RefreshCw" className="h-4 w-4 mr-2" />
            {t("adminListMembers.actions.refresh", "Refresh")}
          </Button>
          <Button variant="default" size="sm">
            <Icon name="UserPlus" className="h-4 w-4 mr-2" />
            {t("adminListMembers.actions.addMember", "Tambah Anggota")}
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Icon name="Search" className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t("adminListMembers.search.placeholder", "Search labels…")}
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-md"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-9 rounded-md border px-2 text-sm"
            value={perPage}
            onChange={(e) => { setPerPage(Number(e.target.value)); fetchMembers(1, searchQuery); }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          <select
            className="h-9 rounded-md border px-2 text-sm"
            value={order}
            onChange={(e) => { setOrder(e.target.value as "asc" | "desc"); fetchMembers(1, searchQuery); }}
          >
            <option value="desc">{t("adminListMembers.order.newest", "Newest")}</option>
            <option value="asc">{t("adminListMembers.order.oldest", "Oldest")}</option>
          </select>
          <Button variant="outline" size="sm">
            <Icon name="Upload" className="h-4 w-4 mr-2" />
            {t("adminListMembers.actions.bulkUpload", "Bulk Upload")}
          </Button>
          <Button onClick={deleteSelectedMembers} variant="destructive" size="sm" disabled={selectedMembers.length===0}>
            <Icon name="Trash2" className="h-4 w-4 mr-2" />
            {t("adminListMembers.actions.deleteSelected", "Delete")}
          </Button>
          <Button variant="outline" size="sm">
            <Icon name="Download" className="h-4 w-4 mr-2" />
            {t("adminListMembers.actions.export", "Export")}
          </Button>
        </div>
      </div>

      {/* Members Table */}
      <div className="border rounded-lg">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="w-12 p-4">
                  <input
                    type="checkbox"
                    checked={selectedMembers.length === items.length && items.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                </th>
                <th className="text-left p-4 font-medium">{t("adminListMembers.table.label", "Label")}</th>
                <th className="text-left p-4 font-medium">{t("adminListMembers.table.photo", "Photo")}</th>
                <th className="text-left p-4 font-medium">{t("adminListMembers.table.timestamp", "Timestamp")}</th>
                <th className="text-left p-4 font-medium">
                  {t("adminListMembers.table.actions", "Aksi")}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center">
                    <Icon name="Loader2" className="h-6 w-6 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : items.length > 0 ? (
                items.map((row) => (
                  <tr key={String(row.id)} className="border-b hover:bg-muted/50 align-top">
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(String(row.id))}
                        onChange={() => toggleMemberSelection(String(row.id))}
                        className="rounded"
                      />
                    </td>
                    <td className="p-4">
                      <div className="space-y-1">
                        <div className="font-medium">{row.label}</div>
                        <div className="text-xs text-muted-foreground">ID: {String(row.id)}</div>
                        <button className="text-xs text-blue-600 hover:underline" onClick={() => toast.info(t("adminListMembers.editLabel.todo", "Edit label (coming soon)"))}>
                          {t("adminListMembers.actions.editLabel", "Edit label")}
                        </button>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {photoUrl(row) ? (
                          <img src={photoUrl(row)} alt={row.label} className="h-16 w-16 rounded-md object-cover border" />
                        ) : (
                          <div className="h-16 w-16 rounded-md bg-muted" />
                        )}
                        <button className="text-xs text-blue-600 hover:underline" onClick={() => toast.info(t("adminListMembers.replacePhoto.todo", "Replace photo (coming soon)"))}>
                          {t("adminListMembers.actions.replacePhoto", "Replace photo")}
                        </button>
                      </div>
                    </td>
                    <td className="p-4 text-sm whitespace-nowrap">{rowTs(row)}</td>
                    <td className="p-4">
                      <Button 
                        variant="destructive" 
                        className="w-32"
                        size="sm"
                        onClick={() => deleteMember(String(row.id), row.label)}
                      >
                        <Icon name="Trash2" className="h-4 w-4 mr-2" />
                        {t("adminListMembers.actions.delete", "Delete")}
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    <Icon name="Users" className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>{t("adminListMembers.table.empty", "Belum ada anggota terdaftar")}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t">
            <div className="text-sm text-muted-foreground">
              {t("adminListMembers.pagination.info", "Menampilkan {start}-{end} dari {total} anggota", {
                start: (currentPage - 1) * 20 + 1,
                end: Math.min(currentPage * 20, totalMembers),
                total: totalMembers,
              })}
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchMembers(currentPage - 1, searchQuery)}
                disabled={currentPage <= 1}
              >
                {t("adminListMembers.pagination.previous", "Sebelumnya")}
              </Button>
              
              <span className="text-sm">
                {t("adminListMembers.pagination.current", "Halaman {page} dari {total}", {
                  page: currentPage,
                  total: totalPages,
                })}
              </span>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchMembers(currentPage + 1, searchQuery)}
                disabled={currentPage >= totalPages}
              >
                {t("adminListMembers.pagination.next", "Selanjutnya")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
