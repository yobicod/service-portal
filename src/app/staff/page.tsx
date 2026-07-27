"use client";

import { ChangeEvent, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { LogoutButton } from "@/components/logout-button";
import { useLanguage } from "@/components/language-provider";
import { localizeCategory, localizeStatus } from "@/lib/localization";

type Attachment = { id: string; fileName: string; mimeType: string };
type Task = {
  id: string;
  status: string;
  dueDate: string | null;
  instruction: string | null;
  attachments: Attachment[];
  report: {
    referenceNo: string;
    title: string;
    category: string;
    location: string;
    priority: string;
  };
};
const jsonHeaders = { "Content-Type": "application/json" };

export default function StaffPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const { language } = useLanguage();
  const th = language === "th";

  async function load() {
    const response = await fetch("/api/staff/tasks");
    if (response.ok) setTasks((await response.json()).data);
  }

  useEffect(() => {
    async function loadInitialTasks() {
      await load();
    }
    void loadInitialTasks();
  }, []);

  async function update(task: Task, action: "start" | "complete") {
    setBusy(task.id);
    const response = await fetch(`/api/staff/tasks/${task.id}`, {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({
        action,
        note:
          action === "complete"
            ? "Work completed and area checked."
            : "Technician has started the repair.",
      }),
    });
    setMessage(
      response.ok
        ? action === "complete"
          ? th
            ? "ส่งงานเพื่อรอผู้ดูแลตรวจสอบแล้ว"
            : "Completion submitted for admin verification."
          : th
            ? "เริ่มดำเนินการงานแล้ว"
            : "Task marked as in progress."
        : ((await response.json()).error ??
            (th ? "ไม่สามารถอัปเดตงานได้" : "Unable to update task.")),
    );
    setBusy(null);
    await load();
  }

  async function upload(task: Task, event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setBusy(task.id);
    const data = new FormData();
    files.forEach((file) => data.append("files", file));
    const response = await fetch(`/api/tasks/${task.id}/attachments`, {
      method: "POST",
      body: data,
    });
    setMessage(
      response.ok
        ? th
          ? "อัปโหลดไฟล์หลักฐานแล้ว"
          : "Task attachments uploaded."
        : ((await response.json()).error ??
            (th ? "ไม่สามารถอัปโหลดไฟล์ได้" : "Unable to upload attachments.")),
    );
    event.target.value = "";
    setBusy(null);
    await load();
  }

  return (
    <main className="min-h-screen bg-[#f6f7f8] p-5 text-slate-800 sm:p-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold text-[#e65d15]">
              {th ? "พื้นที่ทำงานเจ้าหน้าที่" : "STAFF WORKSPACE"}
            </p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
              {th ? "งานที่ได้รับมอบหมาย" : "My assigned tasks"}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {th
                ? "เริ่มงาน บันทึกหลักฐานการซ่อม และส่งงานให้ตรวจสอบ"
                : "Start work, record repair evidence, and submit completion for verification."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
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
        <section className="mt-7 space-y-4">
          {tasks.map((task) => (
            <article
              key={task.id}
              className="rounded-xl border border-slate-200 bg-white p-6"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold text-[#e65d15]">
                    {task.report.referenceNo} ·{" "}
                    {localizeCategory(task.report.category, language)}
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">
                    {task.report.title}
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    {task.report.location}
                  </p>
                  {task.instruction && (
                    <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                      {task.instruction}
                    </p>
                  )}
                  {task.attachments.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-3">
                      {task.attachments.map((attachment) => (
                        <a
                          key={attachment.id}
                          href={`/api/attachments/${attachment.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="group block overflow-hidden rounded-lg border border-orange-100 bg-orange-50 text-xs font-semibold text-[#d94e0b]"
                        >
                          {attachment.mimeType.startsWith("image/") && (
                            <Image
                              unoptimized
                              src={`/api/attachments/${attachment.id}`}
                              alt={attachment.fileName}
                              width={128}
                              height={96}
                              className="h-24 w-32 object-cover transition group-hover:scale-105"
                            />
                          )}
                          <span
                            className="block max-w-32 truncate px-3 py-2"
                            title={attachment.fileName}
                          >
                            {attachment.fileName}
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <span className="w-fit rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700">
                  {localizeStatus(task.status, language)}
                </span>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                {(task.status === "ASSIGNED" ||
                  task.status === "NEEDS_REVISION") && (
                  <button
                    disabled={busy === task.id}
                    onClick={() => update(task, "start")}
                    className="rounded-lg bg-[#26333e] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {th ? "เริ่มงาน" : "Start task"}
                  </button>
                )}
                {task.status === "IN_PROGRESS" && (
                  <button
                    disabled={busy === task.id}
                    onClick={() => update(task, "complete")}
                    className="rounded-lg bg-[#ee641b] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {th ? "แจ้งงานเสร็จ" : "Mark completed"}
                  </button>
                )}
                {task.status === "COMPLETED_BY_STAFF" && (
                  <p className="text-sm font-semibold text-emerald-700">
                    {th ? "รอผู้ดูแลตรวจสอบ" : "Awaiting admin verification"}
                  </p>
                )}
                <label className="cursor-pointer rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700">
                  <span>{th ? "แนบหลักฐาน" : "Attach evidence"}</span>
                  <input
                    disabled={busy === task.id}
                    onChange={(event) => upload(task, event)}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="sr-only"
                  />
                </label>
              </div>
            </article>
          ))}
          {tasks.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
              {th
                ? "ขณะนี้ยังไม่มีงานที่มอบหมายให้คุณ"
                : "No tasks are assigned to you right now."}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
