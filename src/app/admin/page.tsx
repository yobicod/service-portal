"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { LogoutButton } from "@/components/logout-button";
import { useLanguage } from "@/components/language-provider";
import { localizeCategory, localizeStatus } from "@/lib/localization";

type Task = { id: string; status: string; assignedStaff: { name: string } };
type Report = {
  id: string;
  referenceNo: string;
  title: string;
  category: string;
  location: string;
  priority: string;
  status: string;
  reporter: { name: string };
  tasks: Task[];
};
type Staff = { id: string; name: string };
type Notice = { tone: "success" | "error"; text: string };
type Confirmation =
  | { kind: "review"; report: Report; action: "approve" | "reject" }
  | { kind: "verify"; task: Task; action: "close" | "revision" };

const jsonHeaders = { "Content-Type": "application/json" };
const statusTone: Record<string, string> = {
  SUBMITTED: "bg-sky-50 text-sky-700 ring-sky-100",
  UNDER_REVIEW: "bg-amber-50 text-amber-700 ring-amber-100",
  REJECTED: "bg-red-50 text-red-700 ring-red-100",
  APPROVED: "bg-teal-50 text-teal-700 ring-teal-100",
  ASSIGNED: "bg-orange-50 text-orange-700 ring-orange-100",
  IN_PROGRESS: "bg-violet-50 text-violet-700 ring-violet-100",
  COMPLETED_BY_STAFF: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  NEEDS_REVISION: "bg-yellow-50 text-yellow-700 ring-yellow-100",
  CLOSED: "bg-slate-100 text-slate-600 ring-slate-200",
};

async function readPayload(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as { data?: unknown; error?: unknown };
  } catch {
    return null;
  }
}

export default function AdminPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [assignment, setAssignment] = useState<Report | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const busyRef = useRef(new Set<string>());
  const assignmentHeadingRef = useRef<HTMLHeadingElement>(null);
  const confirmationHeadingRef = useRef<HTMLHeadingElement>(null);
  const panelTriggerRef = useRef<HTMLButtonElement | null>(null);
  const { language } = useLanguage();
  const th = language === "th";

  const load = useCallback(async () => {
    try {
      const [reportResponse, staffResponse] = await Promise.all([
        fetch("/api/admin/reports"),
        fetch("/api/admin/staff"),
      ]);
      const [reportPayload, staffPayload] = await Promise.all([
        readPayload(reportResponse),
        readPayload(staffResponse),
      ]);
      if (!reportResponse.ok || !reportPayload || !Array.isArray(reportPayload.data)) {
        throw new Error(
          typeof reportPayload?.error === "string"
            ? reportPayload.error
            : th
              ? "ไม่สามารถโหลดรายการแจ้งซ่อมได้"
              : "Unable to load reports.",
        );
      }
      if (!staffResponse.ok || !staffPayload || !Array.isArray(staffPayload.data)) {
        throw new Error(
          typeof staffPayload?.error === "string"
            ? staffPayload.error
            : th
              ? "ไม่สามารถโหลดรายชื่อเจ้าหน้าที่ได้"
              : "Unable to load staff members.",
        );
      }
      setReports(reportPayload.data as Report[]);
      setStaff(staffPayload.data as Staff[]);
      setLoadState("ready");
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : th
            ? "ไม่สามารถโหลดพื้นที่ทำงานผู้ดูแลได้"
            : "Unable to load the admin workspace.",
      );
      setLoadState("error");
    }
  }, [th]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function retryLoad() {
    setLoadState("loading");
    setLoadError("");
    void load();
  }

  useEffect(() => {
    const heading = assignment ? assignmentHeadingRef.current : confirmationHeadingRef.current;
    if (!heading) return;
    heading.focus();
    heading.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [assignment, confirmation]);

  function beginBusy(id: string) {
    if (busyRef.current.has(id)) return false;
    busyRef.current.add(id);
    setBusyIds(Array.from(busyRef.current));
    return true;
  }

  function endBusy(id: string) {
    busyRef.current.delete(id);
    setBusyIds(Array.from(busyRef.current));
  }

  function closePanel() {
    setAssignment(null);
    setConfirmation(null);
    requestAnimationFrame(() => panelTriggerRef.current?.focus());
  }

  function openAssignment(report: Report, trigger: HTMLButtonElement) {
    if (busyRef.current.has(report.id)) return;
    panelTriggerRef.current = trigger;
    setConfirmation(null);
    setAssignment(report);
    setNotice(null);
  }

  function openConfirmation(
    value: Confirmation,
    trigger: HTMLButtonElement,
  ) {
    const id = value.kind === "review" ? value.report.id : value.task.id;
    if (busyRef.current.has(id)) return;
    panelTriggerRef.current = trigger;
    setAssignment(null);
    setConfirmation(value);
    setNotice(null);
  }

  async function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmation || confirmation.kind !== "review") return;
    const { report, action } = confirmation;
    if (!beginBusy(report.id)) return;
    const data = new FormData(event.currentTarget);
    const reason = String(data.get("reason") ?? "").trim();
    const internalNote = String(data.get("internalNote") ?? "").trim();
    try {
      const response = await fetch(`/api/admin/reports/${report.id}/review`, {
        method: "PATCH",
        headers: jsonHeaders,
        body: JSON.stringify({ action, reason, internalNote }),
      });
      const payload = await readPayload(response);
      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : th
              ? "ไม่สามารถอัปเดตรายการได้"
              : "Unable to update report.",
        );
      }
      setNotice({
        tone: "success",
        text: th
          ? `${action === "approve" ? "อนุมัติ" : "ไม่อนุมัติ"} ${report.referenceNo} แล้ว`
          : `${report.referenceNo} was ${action === "approve" ? "approved" : "rejected"}.`,
      });
      setConfirmation(null);
      await load();
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : th ? "ไม่สามารถอัปเดตรายการได้" : "Unable to update report.",
      });
    } finally {
      endBusy(report.id);
    }
  }

  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assignment || !beginBusy(assignment.id)) return;
    const report = assignment;
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/tasks", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          reportId: report.id,
          assignedStaffId: data.get("assignedStaffId"),
          instruction: data.get("instruction"),
          dueDate: data.get("dueDate")
            ? new Date(String(data.get("dueDate"))).toISOString()
            : undefined,
          priority: data.get("priority"),
          estimatedCost: data.get("estimatedCost"),
        }),
      });
      const payload = await readPayload(response);
      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : th ? "ไม่สามารถมอบหมายงานได้" : "Unable to assign task.",
        );
      }
      setNotice({
        tone: "success",
        text: th ? `มอบหมาย ${report.referenceNo} แล้ว` : `${report.referenceNo} assigned successfully.`,
      });
      setAssignment(null);
      await load();
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : th ? "ไม่สามารถมอบหมายงานได้" : "Unable to assign task.",
      });
    } finally {
      endBusy(report.id);
    }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmation || confirmation.kind !== "verify") return;
    const { task, action } = confirmation;
    if (!beginBusy(task.id)) return;
    const note = String(new FormData(event.currentTarget).get("note") ?? "").trim();
    try {
      const response = await fetch(`/api/admin/tasks/${task.id}/verify`, {
        method: "PATCH",
        headers: jsonHeaders,
        body: JSON.stringify({
          action,
          note,
        }),
      });
      const payload = await readPayload(response);
      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : th ? "ไม่สามารถตรวจสอบงานได้" : "Unable to verify task.",
        );
      }
      setNotice({
        tone: "success",
        text: action === "close"
          ? th ? "ตรวจรับและปิดงานแล้ว" : "Task verified and closed."
          : th ? "ส่งงานกลับไปแก้ไขแล้ว" : "Task returned for revision.",
      });
      setConfirmation(null);
      await load();
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : th ? "ไม่สามารถตรวจสอบงานได้" : "Unable to verify task.",
      });
    } finally {
      endBusy(task.id);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7f8] p-5 text-slate-800 sm:p-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold text-[#e65d15]">
              {th ? "พื้นที่ทำงานผู้ดูแล" : "ADMIN WORKSPACE"}
            </p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
              {th ? "จัดการงานซ่อมบำรุง" : "Maintenance operations"}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {th
                ? "ตรวจสอบรายการที่แจ้ง มอบหมายเจ้าหน้าที่ และตรวจรับงานที่เสร็จแล้ว"
                : "Review incoming issues, assign staff, and verify completed work."}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-bold text-slate-700"
            >
              {th ? "พอร์ทัลผู้แจ้ง" : "Requester portal"}
            </Link>
            <LogoutButton className="rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50" />
          </div>
        </header>
        {notice && (
          <div
            role={notice.tone === "error" ? "alert" : "status"}
            aria-live={notice.tone === "error" ? "assertive" : "polite"}
            className={`mt-6 rounded-lg px-4 py-3 text-sm font-semibold ${
              notice.tone === "error"
                ? "bg-red-50 text-red-800"
                : "bg-emerald-50 text-emerald-800"
            }`}
          >
            {notice.text}
          </div>
        )}
        {loadState === "loading" && (
          <div role="status" aria-live="polite" className="mt-7 rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-600">
            {th ? "กำลังโหลดพื้นที่ทำงาน…" : "Loading admin workspace…"}
          </div>
        )}
        {loadState === "error" && (
          <div role="alert" className="mt-7 rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-sm font-semibold text-red-800">{loadError}</p>
            <button onClick={retryLoad} className="mt-4 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-bold text-white">
              {th ? "ลองอีกครั้ง" : "Retry"}
            </button>
          </div>
        )}
        {loadState === "ready" && (
          <>
        <section className="mt-7 grid gap-4 sm:grid-cols-3">
          {[
            [
              th ? "รายการใหม่" : "New reports",
              reports.filter((report) => report.status === "SUBMITTED").length,
            ],
            [
              th ? "รอมอบหมาย" : "Awaiting assignment",
              reports.filter((report) => report.status === "APPROVED").length,
            ],
            [
              th ? "รอตรวจรับ" : "Awaiting verification",
              reports
                .flatMap((report) => report.tasks)
                .filter((task) => task.status === "COMPLETED_BY_STAFF").length,
            ],
          ].map(([label, count]) => (
            <div
              key={String(label)}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <p className="text-sm font-medium text-slate-500">{label}</p>
              <p className="mt-2 text-3xl font-extrabold text-slate-900">
                {count}
              </p>
            </div>
          ))}
        </section>
        {assignment && (
          <section role="dialog" aria-labelledby="assignment-title" className="mt-7 rounded-xl border border-orange-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-[#e65d15]">
                  {th ? "มอบหมายงาน" : "ASSIGN TASK"}
                </p>
                <h2 ref={assignmentHeadingRef} id="assignment-title" tabIndex={-1} className="mt-1 text-lg font-bold outline-none">{assignment.title}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {assignment.referenceNo} · {assignment.location}
                </p>
              </div>
              <button
                onClick={closePanel}
                className="text-sm font-bold text-slate-500"
              >
                {th ? "ยกเลิก" : "Cancel"}
              </button>
            </div>
            <form onSubmit={assign} className="mt-6 grid gap-5 md:grid-cols-2">
              <label>
                <span className="field-label">
                  {th ? "เจ้าหน้าที่" : "Staff member"} <b>*</b>
                </span>
                <select
                  required
                  name="assignedStaffId"
                  className="field-input"
                  defaultValue=""
                >
                  <option value="" disabled>
                    {th ? "เลือกเจ้าหน้าที่" : "Select staff"}
                  </option>
                  {staff.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="field-label">
                  {th ? "กำหนดส่ง" : "Due date"}
                </span>
                <input
                  name="dueDate"
                  type="datetime-local"
                  className="field-input"
                />
              </label>
              <label>
                <span className="field-label">
                  {th ? "ความสำคัญ" : "Priority"} <b>*</b>
                </span>
                <select
                  required
                  name="priority"
                  className="field-input"
                  defaultValue={assignment.priority}
                >
                  <option value="LOW">{th ? "ต่ำ" : "Low"}</option>
                  <option value="MEDIUM">{th ? "ปานกลาง" : "Medium"}</option>
                  <option value="HIGH">{th ? "สูง" : "High"}</option>
                </select>
              </label>
              <label>
                <span className="field-label">
                  {th ? "ค่าใช้จ่ายโดยประมาณ" : "Estimated cost"}
                </span>
                <input
                  name="estimatedCost"
                  type="number"
                  min="0"
                  step="0.01"
                  className="field-input"
                  placeholder="0.00"
                />
              </label>
              <label className="md:col-span-2">
                <span className="field-label">
                  {th ? "คำแนะนำ" : "Instructions"}
                </span>
                <textarea
                  name="instruction"
                  className="field-input min-h-24 resize-y"
                  placeholder={
                    th
                      ? "ระบุสิ่งที่เจ้าหน้าที่ต้องดำเนินการ…"
                      : "Tell the assigned staff member what needs to be done…"
                  }
                />
              </label>
              <div className="md:col-span-2 flex justify-end">
                <button
                  disabled={busyIds.includes(assignment.id)}
                  className="rounded-lg bg-[#ee641b] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  {busyIds.includes(assignment.id)
                    ? th ? "กำลังมอบหมาย…" : "Assigning…"
                    : th ? "สร้างและมอบหมายงาน" : "Create and assign task"}
                </button>
              </div>
            </form>
          </section>
        )}
        {confirmation && (
          <section
            role="dialog"
            aria-labelledby="confirmation-title"
            className="mt-7 rounded-xl border border-orange-200 bg-white p-6 shadow-sm"
          >
            <h2
              ref={confirmationHeadingRef}
              id="confirmation-title"
              tabIndex={-1}
              className="text-lg font-bold text-slate-900 outline-none"
            >
              {confirmation.kind === "review"
                ? confirmation.action === "approve"
                  ? th ? "ยืนยันการอนุมัติ" : "Confirm approval"
                  : th ? "ยืนยันการไม่อนุมัติ" : "Confirm rejection"
                : confirmation.action === "close"
                  ? th ? "ยืนยันการตรวจรับและปิดงาน" : "Confirm verification and closure"
                  : th ? "ส่งงานกลับไปแก้ไข" : "Return task for revision"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {confirmation.kind === "review"
                ? `${confirmation.report.referenceNo} · ${confirmation.report.title}`
                : th ? "ตรวจสอบการดำเนินงานและบันทึกข้อความก่อนยืนยัน" : "Review the work and add a note before confirming."}
            </p>
            {confirmation.kind === "review" ? (
              <form onSubmit={review} className="mt-5">
                {confirmation.action === "reject" ? (
                  <label>
                    <span className="field-label">{th ? "เหตุผลที่ไม่อนุมัติ" : "Rejection reason"} <b>*</b></span>
                    <textarea name="reason" required autoFocus className="field-input mt-1 min-h-24 resize-y" />
                  </label>
                ) : (
                  <label>
                    <span className="field-label">{th ? "บันทึกภายใน (ไม่บังคับ)" : "Internal note (optional)"}</span>
                    <textarea name="internalNote" autoFocus className="field-input mt-1 min-h-24 resize-y" />
                  </label>
                )}
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={closePanel} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700">{th ? "ยกเลิก" : "Cancel"}</button>
                  <button disabled={busyIds.includes(confirmation.report.id)} className="rounded-lg bg-[#ee641b] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                    {busyIds.includes(confirmation.report.id) ? (th ? "กำลังบันทึก…" : "Saving…") : (th ? "ยืนยัน" : "Confirm")}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={verify} className="mt-5">
                <label>
                  <span className="field-label">
                    {confirmation.action === "close"
                      ? th ? "บันทึกการตรวจรับ" : "Verification note"
                      : th ? "สิ่งที่ต้องแก้ไข" : "Required revisions"} <b>*</b>
                  </span>
                  <textarea
                    name="note"
                    required
                    autoFocus
                    className="field-input mt-1 min-h-24 resize-y"
                    defaultValue={
                      confirmation.action === "close"
                        ? th ? "ตรวจสอบและอนุมัติงานแล้ว" : "Work verified and approved."
                        : th ? "โปรดตรวจสอบและดำเนินการส่วนที่เหลือให้เสร็จ" : "Please review and complete the remaining work."
                    }
                  />
                </label>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={closePanel} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700">{th ? "ยกเลิก" : "Cancel"}</button>
                  <button disabled={busyIds.includes(confirmation.task.id)} className="rounded-lg bg-[#ee641b] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                    {busyIds.includes(confirmation.task.id) ? (th ? "กำลังบันทึก…" : "Saving…") : (th ? "ยืนยัน" : "Confirm")}
                  </button>
                </div>
              </form>
            )}
          </section>
        )}
        <section className="mt-7 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-6 py-5">
            <h2 className="font-bold">
              {th ? "คิวรายการแจ้งซ่อม" : "Reports queue"}
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {reports.map((report) => (
              <article
                key={report.id}
                className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900">
                    {report.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {report.referenceNo} ·{" "}
                    {localizeCategory(report.category, language)} ·{" "}
                    {report.location} · {th ? "แจ้งโดย" : "Submitted by"}{" "}
                    {report.reporter.name}
                  </p>
                </div>
                <span
                  className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${statusTone[report.status] ?? "bg-slate-100 text-slate-600 ring-slate-200"}`}
                >
                  {localizeStatus(report.status, language)}
                </span>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/reports/${report.id}?from=admin`}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700"
                  >
                    {th ? "ดูรายละเอียด" : "View details"}
                  </Link>
                  {report.status === "SUBMITTED" && (
                    <>
                      <button
                        disabled={busyIds.includes(report.id)}
                        onClick={(event) => openConfirmation({ kind: "review", report, action: "approve" }, event.currentTarget)}
                        className="rounded-lg bg-[#ee641b] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                      >
                        {th ? "อนุมัติ" : "Approve"}
                      </button>
                      <button
                        disabled={busyIds.includes(report.id)}
                        onClick={(event) => openConfirmation({ kind: "review", report, action: "reject" }, event.currentTarget)}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50"
                      >
                        {th ? "ไม่อนุมัติ" : "Reject"}
                      </button>
                    </>
                  )}
                  {report.status === "APPROVED" && (
                    <button
                      disabled={busyIds.includes(report.id)}
                      onClick={(event) => openAssignment(report, event.currentTarget)}
                      className="rounded-lg bg-[#26333e] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                    >
                      {th ? "มอบหมายงาน" : "Assign task"}
                    </button>
                  )}
                  {report.tasks
                    .filter((task) => task.status === "COMPLETED_BY_STAFF")
                    .map((task) => (
                      <div className="flex gap-2" key={task.id}>
                        <button
                          disabled={busyIds.includes(task.id)}
                          onClick={(event) => openConfirmation({ kind: "verify", task, action: "close" }, event.currentTarget)}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                        >
                          {th ? "ตรวจรับและปิดงาน" : "Verify & close"}
                        </button>
                        <button
                          disabled={busyIds.includes(task.id)}
                          onClick={(event) => openConfirmation({ kind: "verify", task, action: "revision" }, event.currentTarget)}
                          className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-bold text-amber-700 disabled:opacity-50"
                        >
                          {th ? "ส่งกลับแก้ไข" : "Revision"}
                        </button>
                      </div>
                    ))}
                </div>
              </article>
            ))}
          </div>
        </section>
          </>
        )}
      </div>
    </main>
  );
}
