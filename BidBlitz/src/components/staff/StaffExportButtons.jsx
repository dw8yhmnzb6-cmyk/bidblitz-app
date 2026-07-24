/**
 * Export Buttons: CSV / PDF / Payroll / DATEV
 */
import React, { useState } from "react";
import { Download, FileText, FileSpreadsheet, FileCog, Loader2 } from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

export default function StaffExportButtons({ period = "monthly" }) {
  const [loading, setLoading] = useState(null);

  const download = async (url, filename, kind) => {
    setLoading(kind);
    try {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("download failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success(`${kind.toUpperCase()} Export bereit`);
    } catch (e) {
      toast.error(`Export fehlgeschlagen (${kind})`);
    }
    setLoading(null);
  };

  const buttons = [
    { kind: "csv", label: "CSV Export", icon: FileSpreadsheet, color: "#10B981",
      action: () => download(`${API}/api/staff/reports/export/csv?period=${period}`, `staff_${period}.csv`, "csv") },
    { kind: "pdf", label: "PDF Export", icon: FileText, color: "#EF4444",
      action: () => toast.message("PDF Export", { description: "PDF Lohnzettel über /api/staff/export/pdf/{staff_id}" }) },
    { kind: "payroll", label: "Payroll Export", icon: Download, color: "#A855F7",
      action: () => download(`${API}/api/staff/reports/export/csv?period=${period}`, `payroll_${period}.csv`, "payroll") },
    { kind: "datev", label: "DATEV Export", icon: FileCog, color: "#F59E0B",
      action: () => download(`${API}/api/staff/reports/export/datev?period=${period}`, `datev_${period}.csv`, "datev") },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2" data-testid="staff-export-buttons">
      {buttons.map((b) => {
        const I = b.icon;
        return (
          <button
            key={b.kind}
            onClick={b.action}
            disabled={loading === b.kind}
            data-testid={`staff-export-${b.kind}-btn`}
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-sm transition-all"
          >
            {loading === b.kind ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <I size={16} style={{ color: b.color }} />
            )}
            <span className="font-medium">{b.label}</span>
          </button>
        );
      })}
    </div>
  );
}
