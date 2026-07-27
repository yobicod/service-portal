"use client";

import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { localizeStatus } from "@/lib/localization";

type ChartReport = { status: string };
type StatusCounts = Partial<Record<string, number>>;

const series = [
  { status: "Submitted", color: "#0ea5e9" },
  { status: "Under Review", color: "#f59e0b" },
  { status: "Approved", color: "#14b8a6" },
  { status: "Assigned", color: "#f97316" },
  { status: "In Progress", color: "#8b5cf6" },
  { status: "Completed by Staff", color: "#10b981" },
  { status: "Needs Revision", color: "#eab308" },
  { status: "Closed", color: "#64748b" },
  { status: "Rejected", color: "#ef4444" },
];

function Bars({
  reports,
  statusCounts,
  total,
  large = false,
}: {
  reports: ChartReport[];
  statusCounts?: StatusCounts;
  total?: number;
  large?: boolean;
}) {
  const { language } = useLanguage();
  const th = language === "th";
  const data = useMemo(
    () =>
      series.map((item) => ({
        ...item,
        value:
          statusCounts?.[item.status] ??
          reports.filter((report) => report.status === item.status).length,
      })),
    [reports, statusCounts],
  );
  const max = Math.max(1, ...data.map((item) => item.value));
  const active = data.filter((item) => item.value > 0);

  if (!active.length)
    return (
      <div className="grid h-48 place-items-center text-sm text-slate-500">
        {th
          ? "ยังไม่มีข้อมูลรายการแจ้งซ่อม"
          : "No report data is available yet."}
      </div>
    );

  return (
    <div
      className={
        large ? "grid gap-5 sm:grid-cols-2 lg:grid-cols-3" : "space-y-3"
      }
    >
      {active.map((item) => (
        <div
          key={item.status}
          className={
            large ? "rounded-xl border border-slate-100 bg-slate-50 p-4" : ""
          }
        >
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-semibold text-slate-700">
              {localizeStatus(item.status, language)}
            </span>
            <span className="font-bold text-slate-900">{item.value}</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(item.value / max) * 100}%`,
                backgroundColor: item.color,
              }}
            />
          </div>
          {large && (
            <p className="mt-2 text-xs text-slate-500">
              {Math.round((item.value / (total ?? reports.length)) * 100)}%{" "}
              {th ? "ของรายการทั้งหมด" : "of all requests"}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export function RequestStatusChart({
  reports,
  statusCounts,
  total,
}: {
  reports: ChartReport[];
  statusCounts?: StatusCounts;
  total?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const wasExpandedRef = useRef(false);
  const { language } = useLanguage();
  const th = language === "th";
  const activeCount = statusCounts
    ? Object.entries(statusCounts)
        .filter(([status]) => !["Closed", "Rejected"].includes(status))
        .reduce((sum, [, count]) => sum + (count ?? 0), 0)
    : reports.filter(
        (report) => !["Closed", "Rejected"].includes(report.status),
      ).length;
  const reportTotal = total ?? reports.length;

  function closeDialog() {
    setExpanded(false);
  }

  function trapFocus(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  useEffect(() => {
    if (!expanded) {
      if (wasExpandedRef.current) triggerRef.current?.focus();
      return;
    }

    wasExpandedRef.current = true;
    closeButtonRef.current?.focus();
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") closeDialog();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expanded]);

  return (
    <>
      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-[#e65d15]">
              {th ? "ภาพรวมรายการแจ้งซ่อม" : "REQUEST WORKLOAD"}
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">
              {th ? "สถานะของรายการแจ้งซ่อม" : "Where your requests are now"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {th
                ? `มี ${activeCount} รายการที่ยังดำเนินการอยู่`
                : `${activeCount} active request${activeCount === 1 ? "" : "s"} across the maintenance workflow.`}
            </p>
          </div>
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setExpanded(true)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            {th ? "ขยายกราฟ" : "Expand chart"}
          </button>
        </div>
        <div className="mt-6">
          <Bars
            reports={reports}
            statusCounts={statusCounts}
            total={reportTotal}
          />
        </div>
      </section>
      {expanded && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="workload-chart-title"
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"
          onClick={closeDialog}
        >
          <section
            ref={dialogRef}
            tabIndex={-1}
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={trapFocus}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-[#e65d15]">
                  {th ? "ภาพรวมรายการแจ้งซ่อม" : "REQUEST WORKLOAD"}
                </p>
                <h2
                  id="workload-chart-title"
                  className="mt-1 text-2xl font-extrabold text-slate-900"
                >
                  {th ? "สรุปสถานะทั้งหมด" : "Full status breakdown"}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  {th
                    ? `สรุปแบบสดของรายการแจ้งซ่อม ${reportTotal} รายการ`
                    : `A live summary of your ${reportTotal} maintenance request${reportTotal === 1 ? "" : "s"}.`}
                </p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeDialog}
                aria-label={
                  th ? "ปิดหน้าต่างสรุปสถานะ" : "Close status summary"
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700"
              >
                {th ? "ปิด" : "Close"}
              </button>
            </div>
            <div className="mt-8">
              <Bars
                reports={reports}
                statusCounts={statusCounts}
                total={reportTotal}
                large
              />
            </div>
          </section>
        </div>
      )}
    </>
  );
}
