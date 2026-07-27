"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
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

export default function AdminPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [assignment, setAssignment] = useState<Report | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const { language } = useLanguage();
  const th = language === "th";

  async function load() {
    const [reportResponse, staffResponse] = await Promise.all([
      fetch("/api/admin/reports"),
      fetch("/api/admin/staff"),
    ]);
    if (reportResponse.ok) setReports((await reportResponse.json()).data);
    if (staffResponse.ok) setStaff((await staffResponse.json()).data);
  }

  useEffect(() => {
    async function loadInitialData() {
      const [reportResponse, staffResponse] = await Promise.all([
        fetch("/api/admin/reports"),
        fetch("/api/admin/staff"),
      ]);
      if (reportResponse.ok) setReports((await reportResponse.json()).data);
      if (staffResponse.ok) setStaff((await staffResponse.json()).data);
    }
    void loadInitialData();
  }, []);

  async function review(report: Report, action: "approve" | "reject") {
    const reason =
      action === "reject"
        ? window
            .prompt(
              th
                ? "โปรดระบุเหตุผลที่ไม่อนุมัติรายการนี้"
                : "Why is this request being rejected?",
            )
            ?.trim()
        : undefined;
    if (action === "reject" && !reason) return;
    setBusy(report.id);
    const response = await fetch(`/api/admin/reports/${report.id}/review`, {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({ action, reason }),
    });
    setMessage(
      response.ok
        ? th
          ? `${action === "approve" ? "อนุมัติ" : "ไม่อนุมัติ"} ${report.referenceNo} แล้ว`
          : `${report.referenceNo} was ${action}d.`
        : ((await response.json()).error ??
            (th ? "ไม่สามารถอัปเดตรายการได้" : "Unable to update report.")),
    );
    setBusy(null);
    await load();
  }

  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assignment) return;
    setBusy(assignment.id);
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/tasks", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        reportId: assignment.id,
        assignedStaffId: data.get("assignedStaffId"),
        instruction: data.get("instruction"),
        dueDate: data.get("dueDate")
          ? new Date(String(data.get("dueDate"))).toISOString()
          : undefined,
        priority: data.get("priority"),
        estimatedCost: data.get("estimatedCost"),
      }),
    });
    setMessage(
      response.ok
        ? th
          ? `มอบหมาย ${assignment.referenceNo} แล้ว`
          : `${assignment.referenceNo} assigned successfully.`
        : ((await response.json()).error ??
            (th ? "ไม่สามารถมอบหมายงานได้" : "Unable to assign task.")),
    );
    setBusy(null);
    if (response.ok) setAssignment(null);
    await load();
  }

  async function verify(task: Task, close: boolean) {
    setBusy(task.id);
    const response = await fetch(`/api/admin/tasks/${task.id}/verify`, {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({
        action: close ? "close" : "revision",
        note: close
          ? th
            ? "ตรวจสอบและอนุมัติงานแล้ว"
            : "Work verified and approved."
          : th
            ? "โปรดตรวจสอบและดำเนินการส่วนที่เหลือให้เสร็จ"
            : "Please review and complete the remaining work.",
      }),
    });
    setMessage(
      response.ok
        ? close
          ? th
            ? "ปิดงานแล้ว"
            : "Task closed."
          : th
            ? "ส่งงานกลับไปแก้ไขแล้ว"
            : "Task returned for revision."
        : ((await response.json()).error ??
            (th ? "ไม่สามารถตรวจสอบงานได้" : "Unable to verify task.")),
    );
    setBusy(null);
    await load();
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
        {message && (
          <div className="mt-6 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            {message}
          </div>
        )}
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
          <section className="mt-7 rounded-xl border border-orange-200 bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-[#e65d15]">
                  {th ? "มอบหมายงาน" : "ASSIGN TASK"}
                </p>
                <h2 className="mt-1 text-lg font-bold">{assignment.title}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {assignment.referenceNo} · {assignment.location}
                </p>
              </div>
              <button
                onClick={() => setAssignment(null)}
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
                  disabled={busy === assignment.id}
                  className="rounded-lg bg-[#ee641b] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  {th ? "สร้างและมอบหมายงาน" : "Create and assign task"}
                </button>
              </div>
            </form>
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
                    href={`/reports/${report.id}`}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700"
                  >
                    {th ? "ดูรายละเอียด" : "View details"}
                  </Link>
                  {report.status === "SUBMITTED" && (
                    <>
                      <button
                        disabled={busy === report.id}
                        onClick={() => review(report, "approve")}
                        className="rounded-lg bg-[#ee641b] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                      >
                        {th ? "อนุมัติ" : "Approve"}
                      </button>
                      <button
                        disabled={busy === report.id}
                        onClick={() => review(report, "reject")}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50"
                      >
                        {th ? "ไม่อนุมัติ" : "Reject"}
                      </button>
                    </>
                  )}
                  {report.status === "APPROVED" && (
                    <button
                      disabled={busy === report.id}
                      onClick={() => setAssignment(report)}
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
                          disabled={busy === task.id}
                          onClick={() => verify(task, true)}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                        >
                          {th ? "ตรวจรับและปิดงาน" : "Verify & close"}
                        </button>
                        <button
                          disabled={busy === task.id}
                          onClick={() => verify(task, false)}
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
      </div>
    </main>
  );
}
