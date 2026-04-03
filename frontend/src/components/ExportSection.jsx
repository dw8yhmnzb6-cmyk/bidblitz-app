import { useState } from "react";
import { motion } from "framer-motion";
import { FileDown, Calendar, Filter } from "lucide-react";
import ExportButton from "./ExportButton";

const ExportSection = ({ title, exports, t, testIdPrefix = "export" }) => {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const filters = { date_from: dateFrom || undefined, date_to: dateTo || undefined };

  return (
    <motion.div
      data-testid={`${testIdPrefix}-section`}
      className="rounded-2xl overflow-hidden"
      style={{ background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.04)" }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
        <div className="flex items-center gap-2">
          <FileDown size={15} className="text-[#00C2FF]" />
          <h3 className="text-[13px] font-semibold text-white font-outfit">{title}</h3>
        </div>
        <motion.button
          data-testid={`${testIdPrefix}-filter-toggle`}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium"
          style={{
            background: showFilters ? "rgba(0,194,255,0.08)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${showFilters ? "rgba(0,194,255,0.15)" : "rgba(255,255,255,0.05)"}`,
            color: showFilters ? "#00C2FF" : "#666",
          }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter size={10} />
          {t("export.filter")}
        </motion.button>
      </div>

      {/* Filter Row */}
      {showFilters && (
        <motion.div
          className="px-4 py-3 border-b border-white/[0.04] flex items-center gap-3"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
        >
          <div className="flex items-center gap-1.5">
            <Calendar size={11} className="text-[#444]" />
            <span className="text-[10px] text-[#444] font-medium">{t("export.date_from")}</span>
            <input
              data-testid={`${testIdPrefix}-date-from`}
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1 text-[11px] text-white/80 outline-none"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[#444] font-medium">{t("export.date_to")}</span>
            <input
              data-testid={`${testIdPrefix}-date-to`}
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1 text-[11px] text-white/80 outline-none"
            />
          </div>
        </motion.div>
      )}

      {/* Export Buttons Grid */}
      <div className="px-4 py-3 flex flex-wrap gap-2">
        {exports.map((exp) => (
          <ExportButton
            key={exp.key}
            label={exp.label}
            testId={`${testIdPrefix}-${exp.key}`}
            onExport={() => exp.action(filters)}
            compact
          />
        ))}
      </div>
    </motion.div>
  );
};

export default ExportSection;
