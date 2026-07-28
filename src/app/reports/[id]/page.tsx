"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { attachmentSelectionError } from "@/lib/attachment-selection";
import {
  localizeCategory,
  localizePriority,
  localizeStatus,
} from "@/lib/localization";

type Attachment = { id: string; fileName: string; mimeType: string };
type Task = {
  id: string;
  status: string;
  instruction: string | null;
  dueDate: string | null;
  assignedStaff: { name: string };
  attachments: Attachment[];
};
type Activity = {
  id: string;
  toStatus: string;
  comment: string | null;
  createdAt: string;
  changedBy: { name: string; role: string };
};
type Comment = {
  id: string;
  message: string;
  createdAt: string;
  author: { name: string; role: string };
  attachments: Attachment[];
};
type Report = {
  referenceNo: string;
  title: string;
  description: string;
  category: string;
  location: string;
  latitude: string | number | null;
  longitude: string | number | null;
  priority: string;
  status: string;
  createdAt: string;
  reporter: { name: string };
  tasks: Task[];
  statusLogs: Activity[];
  comments: Comment[];
  attachments: Attachment[];
};

const jsonHeaders = { "Content-Type": "application/json" };
type JsonBody = { data?: unknown; error?: unknown };
async function readJson(response: Response): Promise<JsonBody | null> {
  try {
    return (await response.json()) as JsonBody;
  } catch {
    return null;
  }
}
const dateTime = (value: string, language: "th" | "en") =>
  new Intl.DateTimeFormat(language === "th" ? "th-TH" : "en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

function AttachmentLinks({ attachments }: { attachments: Attachment[] }) {
  if (!attachments.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-3">
      {attachments.map((attachment) => (
        <a
          key={attachment.id}
          href={`/api/attachments/${attachment.id}`}
          target="_blank"
          rel="noreferrer"
          className="group block overflow-hidden rounded-lg border border-orange-100 bg-orange-50 text-xs font-semibold text-[#d94e0b]"
        >
          {attachment.mimeType.startsWith("image/") ? (
            <Image
              unoptimized
              src={`/api/attachments/${attachment.id}`}
              alt={attachment.fileName}
              width={128}
              height={96}
              className="h-24 w-32 object-cover transition group-hover:scale-105"
            />
          ) : null}
          <span
            className="block max-w-32 truncate px-3 py-2"
            title={attachment.fileName}
          >
            {attachment.fileName}
          </span>
        </a>
      ))}
    </div>
  );
}

function RequestLocationMap({
  latitude,
  longitude,
  location,
  th,
}: {
  latitude: string | number | null;
  longitude: string | number | null;
  location: string;
  th: boolean;
}) {
  const hasSavedCoordinates =
    latitude !== null &&
    latitude !== "" &&
    longitude !== null &&
    longitude !== "";
  const lat = hasSavedCoordinates ? Number(latitude) : Number.NaN;
  const lng = hasSavedCoordinates ? Number(longitude) : Number.NaN;
  const hasCoordinates =
    hasSavedCoordinates && Number.isFinite(lat) && Number.isFinite(lng);
  const mapSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;

  return (
    <div className="mt-6 border-t border-slate-100 pt-5">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
        {th ? "แผนที่ตำแหน่ง" : "Location map"}
      </p>
      {hasCoordinates ? (
        <iframe
          title={th ? "แผนที่ตำแหน่งรายการแจ้งซ่อม" : "Request location map"}
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.004}%2C${lat - 0.0025}%2C${lng + 0.004}%2C${lat + 0.0025}&layer=mapnik&marker=${lat}%2C${lng}`}
          loading="lazy"
          className="mt-3 h-56 w-full rounded-lg border border-slate-200"
        />
      ) : (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-bold text-slate-800">
            {th ? "ไม่มีพิกัดที่บันทึกไว้" : "Saved coordinates unavailable"}
          </p>
          <p className="mt-2 text-sm text-slate-600">{location}</p>
          <a
            href={mapSearchUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex text-sm font-bold text-[#d94e0b] underline underline-offset-2"
          >
            {th ? "ค้นหาสถานที่นี้บนแผนที่" : "Search this place on a map"}
            <span className="sr-only">
              {th ? " (เปิดในแท็บใหม่)" : " (opens in a new tab)"}
            </span>
          </a>
          <p className="mt-2 text-xs text-slate-500">
          {th
              ? "ตรวจสอบผลการค้นหาก่อนเดินทาง เนื่องจากคำอธิบายสถานที่อาจไม่ระบุตำแหน่งที่แน่นอน"
              : "Verify the search result before travelling because the place description may not identify an exact location."}
          </p>
        </div>
      )}
    </div>
  );
}

export default function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [report, setReport] = useState<Report | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    tone: "success" | "error";
    th: string;
    en: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [commentPending, setCommentPending] = useState(false);
  const commentPendingRef = useRef(false);
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const [commentFileError, setCommentFileError] = useState("");
  const commentFileInputRef = useRef<HTMLInputElement>(null);
  const [backDestination, setBackDestination] = useState<{
    href: string;
    admin: boolean;
  }>({ href: "/?view=reports", admin: false });
  const { language } = useLanguage();
  const th = language === "th";

  async function load(id: string) {
    let response: Response;
    try {
      response = await fetch(`/api/reports/${id}`);
    } catch {
      setError("Unable to load this report.");
      return;
    }
    const body = await readJson(response);
    if (!response.ok || !body?.data) {
      setError(
        typeof body?.error === "string"
          ? body.error
          : "Unable to load this report.",
      );
      return;
    }
    setReport(body.data as Report);
  }

  useEffect(() => {
    void (async () => {
      const { id } = await params;
      setReportId(id);
      const from = new URLSearchParams(window.location.search).get("from");
      setBackDestination(
        from === "admin"
          ? { href: "/admin", admin: true }
          : { href: "/?view=reports", admin: false },
      );
      await load(id);
    })();
  }, [params]);

  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reportId || commentPendingRef.current) return;
    commentPendingRef.current = true;
    setCommentPending(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    let response: Response;
    try {
      response = await fetch(`/api/reports/${reportId}/comments`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ message: data.get("message") }),
      });
    } catch {
      setNotice({
        tone: "error",
        th: "ไม่สามารถเพิ่มความคิดเห็นได้ โปรดลองอีกครั้ง",
        en: "Unable to add comment. Please try again.",
      });
      commentPendingRef.current = false;
      setCommentPending(false);
      return;
    }
    const body = await readJson(response);
    if (!response.ok || !body?.data) {
      const fallback = "Unable to add comment. Please try again.";
      const bodyError = typeof body?.error === "string" ? body.error : fallback;
      setNotice({ tone: "error", th: bodyError, en: bodyError });
      commentPendingRef.current = false;
      setCommentPending(false);
      return;
    }
    const files = commentFiles;
    if (files.length) {
      const uploadData = new FormData();
      files.forEach((file) => uploadData.append("files", file));
      let uploadSucceeded = false;
      try {
        const uploadResponse = await fetch(
          `/api/comments/${(body.data as { id: string }).id}/attachments`,
          { method: "POST", body: uploadData },
        );
        uploadSucceeded = uploadResponse.ok;
      } catch {
        uploadSucceeded = false;
      }
      if (!uploadSucceeded) {
        setNotice({
          tone: "error",
          th: "เพิ่มความคิดเห็นแล้ว แต่ไม่สามารถอัปโหลดไฟล์แนบได้",
          en: "Comment added, but its attachment could not be uploaded.",
        });
        commentPendingRef.current = false;
        setCommentPending(false);
        await load(reportId);
        return;
      }
    }
    form.reset();
    setCommentFiles([]);
    setNotice({
      tone: "success",
      th: "เพิ่มความคิดเห็นแล้ว",
      en: "Comment added.",
    });
    await load(reportId);
    commentPendingRef.current = false;
    setCommentPending(false);
  }

  function writeCommentFiles(nextFiles: File[]) {
    setCommentFiles(nextFiles);
    if (commentFileInputRef.current) {
      const transfer = new DataTransfer();
      nextFiles.forEach((file) => transfer.items.add(file));
      commentFileInputRef.current.files = transfer.files;
    }
  }

  function selectCommentFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    const valid = selected.filter((file) => !attachmentSelectionError(file));
    const invalidType = selected.some(
      (file) => attachmentSelectionError(file) === "type",
    );
    const invalidSize = selected.some(
      (file) => attachmentSelectionError(file) === "size",
    );
    setCommentFileError(
      invalidType
        ? th
          ? "เลือกได้เฉพาะไฟล์ JPG, PNG, WEBP หรือ PDF"
          : "Only JPG, PNG, WEBP, and PDF files are allowed."
        : invalidSize
          ? th
            ? "แต่ละไฟล์ต้องมีขนาดไม่เกิน 10MB"
            : "Each file must be 10MB or smaller."
          : "",
    );
    writeCommentFiles(valid);
  }

  if (error)
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f7f8] p-6">
        <div className="rounded-xl bg-white p-8 text-center shadow-sm">
          <p className="font-bold text-red-700">{error}</p>
          <Link
            href={backDestination.href}
            className="mt-4 inline-block text-sm font-bold text-[#e65d15]"
          >
            {backDestination.admin
              ? th
                ? "กลับไปพื้นที่ผู้ดูแล"
                : "Return to admin workspace"
              : th
                ? "กลับไปรายการของฉัน"
                : "Return to my reports"}
          </Link>
        </div>
      </main>
    );
  if (!report)
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f7f8] text-sm font-semibold text-slate-500">
        {th ? "กำลังโหลดรายการ…" : "Loading report…"}
      </main>
    );

  return (
    <main className="min-h-screen bg-[#f6f7f8] p-5 text-slate-800 sm:p-10">
      <div className="mx-auto max-w-5xl">
        <Link
          href={backDestination.href}
          className="text-sm font-bold text-[#e65d15]"
        >
          ←{" "}
          {backDestination.admin
            ? th
              ? "พื้นที่ผู้ดูแล"
              : "Admin workspace"
            : th
              ? "รายการของฉัน"
              : "My reports"}
        </Link>
        <header className="mt-5 flex flex-col gap-4 border-b border-slate-200 pb-7 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-bold text-[#e65d15]">
              {report.referenceNo}
            </p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
              {report.title}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {th ? "สร้างเมื่อ" : "Created"}{" "}
              {dateTime(report.createdAt, language)} {th ? "โดย" : "by"}{" "}
              {report.reporter.name}
            </p>
          </div>
          <span className="w-fit rounded-full bg-violet-50 px-3 py-1.5 text-sm font-bold text-violet-700">
            {localizeStatus(report.status, language)}
          </span>
        </header>
        {notice && (
          <p
            role={notice.tone === "error" ? "alert" : "status"}
            className={`mt-5 rounded-lg px-4 py-3 text-sm font-semibold ${
              notice.tone === "error"
                ? "bg-red-50 text-red-800"
                : "bg-emerald-50 text-emerald-800"
            }`}
          >
            {th ? notice.th : notice.en}
          </p>
        )}
        <section className="mt-7 grid gap-6 lg:grid-cols-[1.45fr_1fr]">
          <div className="space-y-6">
            <article className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="font-bold text-slate-900">
                {th ? "รายละเอียดปัญหา" : "Issue details"}
              </h2>
              <dl className="mt-5 grid gap-5 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    {th ? "หมวดหมู่" : "Category"}
                  </dt>
                  <dd className="mt-1 text-sm font-semibold">
                    {localizeCategory(report.category, language)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    {th ? "ความสำคัญ" : "Priority"}
                  </dt>
                  <dd className="mt-1 text-sm font-semibold">
                    {localizePriority(report.priority, language)}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    {th ? "สถานที่" : "Location"}
                  </dt>
                  <dd className="mt-1 text-sm font-semibold">
                    {report.location}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    {th ? "รายละเอียด" : "Description"}
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                    {report.description}
                  </dd>
                </div>
              </dl>
              <RequestLocationMap
                latitude={report.latitude}
                longitude={report.longitude}
                location={report.location}
                th={th}
              />
              {report.attachments.length > 0 && (
                <div className="mt-6 border-t border-slate-100 pt-5">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    {th ? "ไฟล์แนบ" : "Attachments"}
                  </p>
                  <AttachmentLinks attachments={report.attachments} />
                </div>
              )}
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="font-bold text-slate-900">
                {th ? "ความคิดเห็น" : "Comments"}
              </h2>
              <form onSubmit={addComment} className="mt-4 space-y-3">
                <input
                  required
                  name="message"
                  className="field-input"
                  placeholder={
                    th
                      ? "เพิ่มความคิดเห็นหรือรายละเอียด…"
                      : "Add a comment or extra detail…"
                  }
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <input
                    ref={commentFileInputRef}
                    name="attachments"
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="text-xs text-slate-500"
                    onChange={selectCommentFiles}
                  />
                  <button
                    disabled={commentPending}
                    className="rounded-lg bg-[#ee641b] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {commentPending
                      ? th
                        ? "กำลังส่ง…"
                        : "Sending…"
                      : th
                        ? "ส่ง"
                        : "Send"}
                  </button>
                </div>
                <div aria-live="polite">
                  {commentFileError && (
                    <p className="text-xs font-semibold text-red-700">
                      {commentFileError}
                    </p>
                  )}
                  {commentFiles.length > 0 && (
                    <>
                    <p className="mb-2 text-xs font-semibold text-slate-600">
                      {th
                        ? `เลือกแล้ว ${commentFiles.length} ไฟล์`
                        : `${commentFiles.length} file${commentFiles.length === 1 ? "" : "s"} selected`}
                    </p>
                    <ul className="space-y-2">
                      {commentFiles.map((file, index) => (
                        <li
                          key={`${file.name}-${file.size}-${index}`}
                          className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2"
                        >
                          <span className="min-w-0 truncate text-xs text-slate-600">
                            {file.name}
                          </span>
                          <button
                            type="button"
                            disabled={commentPending}
                            onClick={() =>
                              writeCommentFiles(
                                commentFiles.filter(
                                  (_, item) => item !== index,
                                ),
                              )
                            }
                            className="shrink-0 text-xs font-bold text-red-700 disabled:opacity-50"
                            aria-label={
                              th ? `นำ ${file.name} ออก` : `Remove ${file.name}`
                            }
                          >
                            {th ? "นำออก" : "Remove"}
                          </button>
                        </li>
                      ))}
                    </ul>
                    </>
                  )}
                </div>
              </form>
              <div className="mt-6 space-y-5">
                {report.comments.map((comment) => (
                  <div key={comment.id}>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-bold">{comment.author.name}</p>
                      <p className="text-xs text-slate-400">
                        {dateTime(comment.createdAt, language)}
                      </p>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {comment.message}
                    </p>
                    <AttachmentLinks attachments={comment.attachments} />
                  </div>
                ))}
                {report.comments.length === 0 && (
                  <p className="text-sm text-slate-500">
                    {th ? "ยังไม่มีความคิดเห็น" : "No comments yet."}
                  </p>
                )}
              </div>
            </article>
          </div>
          <aside className="space-y-6">
            <article className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="font-bold text-slate-900">
                {th ? "งานที่มอบหมาย" : "Assigned work"}
              </h2>
              <div className="mt-4 space-y-4">
                {report.tasks.map((task) => (
                  <div key={task.id} className="rounded-lg bg-slate-50 p-4">
                    <p className="text-sm font-bold">
                      {localizeStatus(task.status, language)}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {th ? "มอบหมายให้" : "Assigned to"}{" "}
                      {task.assignedStaff.name}
                    </p>
                    {task.dueDate && (
                      <p className="mt-1 text-xs text-slate-400">
                        {th ? "ครบกำหนด" : "Due"}{" "}
                        {dateTime(task.dueDate, language)}
                      </p>
                    )}
                    {task.instruction && (
                      <p className="mt-3 text-sm text-slate-600">
                        {task.instruction}
                      </p>
                    )}
                    <AttachmentLinks attachments={task.attachments} />
                  </div>
                ))}
                {report.tasks.length === 0 && (
                  <p className="text-sm text-slate-500">
                    {th
                      ? "รอการตรวจสอบและมอบหมายงาน"
                      : "Awaiting review and assignment."}
                  </p>
                )}
              </div>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="font-bold text-slate-900">
                {th ? "ลำดับสถานะ" : "Status timeline"}
              </h2>
              <ol className="mt-5 space-y-5 border-l-2 border-slate-100 pl-5">
                {report.statusLogs.map((activity) => (
                  <li key={activity.id} className="relative">
                    <span className="absolute -left-[1.8rem] top-1 h-3 w-3 rounded-full border-2 border-white bg-[#ee641b]" />
                    <p className="text-sm font-bold">
                      {localizeStatus(activity.toStatus, language)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {activity.changedBy.name} ·{" "}
                      {dateTime(activity.createdAt, language)}
                    </p>
                    {activity.comment && (
                      <p className="mt-1 text-sm text-slate-600">
                        {activity.comment}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </article>
          </aside>
        </section>
      </div>
    </main>
  );
}
