"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { useLanguage } from "@/components/language-provider";
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
  const lat = Number(latitude);
  const lng = Number(longitude);
  const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lng);
  const source = hasCoordinates
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.004}%2C${lat - 0.0025}%2C${lng + 0.004}%2C${lat + 0.0025}&layer=mapnik&marker=${lat}%2C${lng}`
    : `https://www.google.com/maps?q=${encodeURIComponent(location)}&output=embed`;

  return (
    <div className="mt-6 border-t border-slate-100 pt-5">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
        {th ? "แผนที่ตำแหน่ง" : "Location map"}
      </p>
      <iframe
        title={th ? "แผนที่ตำแหน่งรายการแจ้งซ่อม" : "Request location map"}
        src={source}
        loading="lazy"
        className="mt-3 h-56 w-full rounded-lg border border-slate-200"
      />
      {!hasCoordinates && (
        <p className="mt-2 text-xs text-slate-500">
          {th
            ? "แสดงแผนที่จากคำอธิบายสถานที่ เนื่องจากไม่มีพิกัดที่บันทึกไว้"
            : "Showing a map search from the place description because saved coordinates are unavailable."}
        </p>
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
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { language } = useLanguage();
  const th = language === "th";

  async function load(id: string) {
    const response = await fetch(`/api/reports/${id}`);
    if (!response.ok) {
      setError((await response.json()).error ?? "Unable to load this report.");
      return;
    }
    setReport((await response.json()).data);
  }

  useEffect(() => {
    void (async () => {
      const { id } = await params;
      setReportId(id);
      await load(id);
    })();
  }, [params]);

  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reportId) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await fetch(`/api/reports/${reportId}/comments`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ message: data.get("message") }),
    });
    const body = await response.json();
    if (!response.ok) {
      setMessage(body.error ?? "Unable to add comment.");
      return;
    }
    const files = data
      .getAll("attachments")
      .filter(
        (value): value is File => value instanceof File && value.size > 0,
      );
    if (files.length) {
      const uploadData = new FormData();
      files.forEach((file) => uploadData.append("files", file));
      const uploadResponse = await fetch(
        `/api/comments/${body.data.id}/attachments`,
        { method: "POST", body: uploadData },
      );
      if (!uploadResponse.ok) {
        setMessage(
          th
            ? "เพิ่มความคิดเห็นแล้ว แต่ไม่สามารถอัปโหลดไฟล์แนบได้"
            : "Comment added, but its attachment could not be uploaded.",
        );
        await load(reportId);
        return;
      }
    }
    form.reset();
    setMessage(th ? "เพิ่มความคิดเห็นแล้ว" : "Comment added.");
    await load(reportId);
  }

  if (error)
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f7f8] p-6">
        <div className="rounded-xl bg-white p-8 text-center shadow-sm">
          <p className="font-bold text-red-700">{error}</p>
          <Link
            href="/"
            className="mt-4 inline-block text-sm font-bold text-[#e65d15]"
          >
            {th ? "กลับไปรายการของฉัน" : "Return to my reports"}
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
        <Link href="/" className="text-sm font-bold text-[#e65d15]">
          ← {th ? "รายการของฉัน" : "My reports"}
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
        {message && (
          <p className="mt-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            {message}
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
                    name="attachments"
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="text-xs text-slate-500"
                  />
                  <button className="rounded-lg bg-[#ee641b] px-4 py-2 text-sm font-bold text-white">
                    {th ? "ส่ง" : "Send"}
                  </button>
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
