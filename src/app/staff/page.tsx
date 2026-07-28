"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
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
type Notice = { tone: "success" | "error"; text: string };
type TaskAction = { task: Task; action: "start" | "complete" };

const jsonHeaders = { "Content-Type": "application/json" };

async function readPayload(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as { data?: unknown; error?: unknown };
  } catch {
    return null;
  }
}

export default function StaffPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [taskAction, setTaskAction] = useState<TaskAction | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File[]>>({});
  const busyRef = useRef(new Set<string>());
  const evidenceInputRefs = useRef(new Map<string, HTMLInputElement>());
  const actionHeadingRef = useRef<HTMLHeadingElement>(null);
  const actionTriggerRef = useRef<HTMLButtonElement | null>(null);
  const { language } = useLanguage();
  const th = language === "th";

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/staff/tasks");
      const payload = await readPayload(response);
      if (!response.ok || !payload || !Array.isArray(payload.data)) {
        const message =
          typeof payload?.error === "string"
            ? payload.error
            : th
              ? "ไม่สามารถโหลดงานที่ได้รับมอบหมายได้"
              : "Unable to load assigned tasks.";
        throw new Error(message);
      }
      setTasks(payload.data as Task[]);
      setLoadState("ready");
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : th
            ? "ไม่สามารถโหลดงานที่ได้รับมอบหมายได้"
            : "Unable to load assigned tasks.",
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
    if (!taskAction) return;
    actionHeadingRef.current?.focus();
    actionHeadingRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [taskAction]);

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

  function openTaskAction(
    task: Task,
    action: "start" | "complete",
    trigger: HTMLButtonElement,
  ) {
    if (busyRef.current.has(task.id)) return;
    actionTriggerRef.current = trigger;
    setTaskAction({ task, action });
    setNotice(null);
  }

  function closeTaskAction() {
    setTaskAction(null);
    requestAnimationFrame(() => actionTriggerRef.current?.focus());
  }

  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!taskAction || !beginBusy(taskAction.task.id)) return;
    const { task, action } = taskAction;
    const note = String(new FormData(event.currentTarget).get("note") ?? "").trim();
    try {
      const response = await fetch(`/api/staff/tasks/${task.id}`, {
        method: "PATCH",
        headers: jsonHeaders,
        body: JSON.stringify({ action, note }),
      });
      const payload = await readPayload(response);
      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : th
              ? "ไม่สามารถอัปเดตงานได้"
              : "Unable to update task.",
        );
      }
      setNotice({
        tone: "success",
        text:
          action === "complete"
            ? th
              ? "ส่งงานเพื่อรอผู้ดูแลตรวจสอบแล้ว"
              : "Completion submitted for admin verification."
            : th
              ? "เริ่มดำเนินการงานแล้ว"
              : "Task marked as in progress.",
      });
      setTaskAction(null);
      await load();
    } catch (error) {
      setNotice({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : th
              ? "ไม่สามารถอัปเดตงานได้"
              : "Unable to update task.",
      });
    } finally {
      endBusy(task.id);
    }
  }

  function selectFiles(task: Task, event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    setSelectedFiles((current) => ({ ...current, [task.id]: files }));
    setNotice(
      files.length
        ? {
            tone: "success",
            text: th
              ? `เลือกหลักฐาน ${files.length} ไฟล์แล้ว กดอัปโหลดเพื่อบันทึก`
              : `${files.length} evidence file${files.length === 1 ? "" : "s"} selected. Choose Upload to save.`,
          }
        : null,
    );
  }

  function clearSelectedFiles(taskId: string) {
    setSelectedFiles((current) => {
      const next = { ...current };
      delete next[taskId];
      return next;
    });
    const input = evidenceInputRefs.current.get(taskId);
    if (input) input.value = "";
    setNotice({
      tone: "success",
      text: th ? "นำหลักฐานที่เลือกออกแล้ว" : "Selected evidence removed.",
    });
  }

  async function upload(task: Task) {
    const files = selectedFiles[task.id] ?? [];
    if (!files.length || !beginBusy(task.id)) return;
    try {
      const data = new FormData();
      files.forEach((file) => data.append("files", file));
      const response = await fetch(`/api/tasks/${task.id}/attachments`, {
        method: "POST",
        body: data,
      });
      const payload = await readPayload(response);
      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : th
              ? "ไม่สามารถอัปโหลดไฟล์ได้"
              : "Unable to upload attachments.",
        );
      }
      setNotice({
        tone: "success",
        text: th
          ? `อัปโหลดหลักฐาน ${files.length} ไฟล์แล้ว`
          : `${files.length} evidence file${files.length === 1 ? "" : "s"} uploaded.`,
      });
      setSelectedFiles((current) => ({ ...current, [task.id]: [] }));
      await load();
    } catch (error) {
      setNotice({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : th
              ? "ไม่สามารถอัปโหลดไฟล์ได้"
              : "Unable to upload attachments.",
      });
    } finally {
      endBusy(task.id);
    }
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
            <Link href="/" className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-bold text-slate-700">
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

        {taskAction && (
          <section
            role="dialog"
            aria-labelledby="staff-action-title"
            className="mt-7 rounded-xl border border-orange-200 bg-white p-6 shadow-sm"
          >
            <h2
              ref={actionHeadingRef}
              id="staff-action-title"
              tabIndex={-1}
              className="text-lg font-bold text-slate-900 outline-none"
            >
              {taskAction.action === "complete"
                ? th
                  ? "ยืนยันการส่งงาน"
                  : "Confirm completion"
                : th
                  ? "ยืนยันการเริ่มงาน"
                  : "Confirm start"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {taskAction.task.report.referenceNo} · {taskAction.task.report.title}
            </p>
            <form onSubmit={update} className="mt-5">
              <label htmlFor="staff-action-note" className="field-label">
                {taskAction.action === "complete"
                  ? th
                    ? "สรุปงานที่ดำเนินการ"
                    : "Completion note"
                  : th
                    ? "บันทึกการเริ่มงาน"
                    : "Start note"}{" "}
                <b>*</b>
              </label>
              <textarea
                id="staff-action-note"
                name="note"
                required
                autoFocus
                className="field-input mt-1 min-h-24 resize-y"
                defaultValue={
                  taskAction.action === "complete"
                    ? th
                      ? "ดำเนินการซ่อมและตรวจสอบพื้นที่เรียบร้อยแล้ว"
                      : "Work completed and area checked."
                    : th
                      ? "เจ้าหน้าที่เริ่มดำเนินการซ่อมแล้ว"
                      : "Technician has started the repair."
                }
              />
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button type="button" onClick={closeTaskAction} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700">
                  {th ? "ยกเลิก" : "Cancel"}
                </button>
                <button disabled={busyIds.includes(taskAction.task.id)} className="rounded-lg bg-[#ee641b] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                  {busyIds.includes(taskAction.task.id)
                    ? th
                      ? "กำลังบันทึก…"
                      : "Saving…"
                    : th
                      ? "ยืนยัน"
                      : "Confirm"}
                </button>
              </div>
            </form>
          </section>
        )}

        {loadState === "loading" && (
          <div role="status" aria-live="polite" className="mt-7 rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-600">
            {th ? "กำลังโหลดงาน…" : "Loading assigned tasks…"}
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
          <section className="mt-7 space-y-4">
            {tasks.map((task) => {
              const files = selectedFiles[task.id] ?? [];
              const isBusy = busyIds.includes(task.id);
              return (
                <article key={task.id} className="rounded-xl border border-slate-200 bg-white p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#e65d15]">
                        {task.report.referenceNo} · {localizeCategory(task.report.category, language)}
                      </p>
                      <h2 className="mt-1 text-lg font-bold text-slate-900">{task.report.title}</h2>
                      <p className="mt-2 text-sm text-slate-500">{task.report.location}</p>
                      {task.instruction && <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{task.instruction}</p>}
                      {task.attachments.length > 0 && (
                        <ul className="mt-4 flex flex-wrap gap-2" aria-label={th ? "หลักฐานที่แนบ" : "Attached evidence"}>
                          {task.attachments.map((attachment) => (
                            <li key={attachment.id}>
                              <a
                                href={`/api/attachments/${attachment.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="block max-w-56 truncate rounded-lg border border-orange-100 bg-orange-50 px-3 py-2 text-xs font-semibold text-[#d94e0b]"
                                title={attachment.fileName}
                              >
                                {attachment.fileName}
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <span className="w-fit rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700">
                      {localizeStatus(task.status, language)}
                    </span>
                  </div>
                  <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                    {(task.status === "ASSIGNED" || task.status === "NEEDS_REVISION") && (
                      <button
                        disabled={isBusy}
                        onClick={(event) => openTaskAction(task, "start", event.currentTarget)}
                        className="rounded-lg bg-[#26333e] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {th ? "เริ่มงาน" : "Start task"}
                      </button>
                    )}
                    {task.status === "IN_PROGRESS" && (
                      <button
                        disabled={isBusy}
                        onClick={(event) => openTaskAction(task, "complete", event.currentTarget)}
                        className="rounded-lg bg-[#ee641b] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {th ? "แจ้งงานเสร็จ" : "Mark completed"}
                      </button>
                    )}
                    {task.status === "COMPLETED_BY_STAFF" && (
                      <p className="text-sm font-semibold text-emerald-700">
                        {th ? "รอผู้ดูแลตรวจสอบ" : "Awaiting admin verification"}
                      </p>
                    )}
                    <label className={`rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 ${isBusy ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
                      <span>{th ? "เลือกหลักฐาน" : "Choose evidence"}</span>
                      <input
                        ref={(input) => {
                          if (input) evidenceInputRefs.current.set(task.id, input);
                          else evidenceInputRefs.current.delete(task.id);
                        }}
                        disabled={isBusy}
                        onChange={(event) => selectFiles(task, event)}
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        className="sr-only"
                      />
                    </label>
                    {files.length > 0 && (
                      <>
                        <span className="max-w-full text-xs text-slate-600" aria-live="polite">
                          {files.length === 1 ? files[0].name : th ? `${files.length} ไฟล์ที่เลือก` : `${files.length} files selected`}
                        </span>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void upload(task)}
                          className="rounded-lg border border-orange-300 bg-orange-50 px-4 py-2.5 text-sm font-bold text-orange-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isBusy ? (th ? "กำลังอัปโหลด…" : "Uploading…") : th ? "อัปโหลด" : "Upload"}
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => clearSelectedFiles(task.id)}
                          className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {th ? "นำไฟล์ที่เลือกออก" : "Remove selected"}
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
            {tasks.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
                {th ? "ขณะนี้ยังไม่มีงานที่มอบหมายให้คุณ" : "No tasks are assigned to you right now."}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
