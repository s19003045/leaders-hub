import type { Snapshot } from "./types";
import { assignmentStats, courseCompletion, formStats, groupCompletion, questionStats, studentCompletion, userName } from "./selectors";
import { fmtDateTime, submitStatusLabel, reviewStatusLabel } from "./format";

/**
 * 匯出資料整理：對應需求書第八章的 8 個工作表。
 * 第一階段輸出 CSV；第四階段以 ExcelJS 寫入同一組 sheets 並加上圖表。
 */
export interface Sheet {
  name: string;
  rows: (string | number)[][];
}

export function buildExportSheets(data: Snapshot, opts: { courseId?: string; anonymous?: boolean } = {}): Sheet[] {
  const name = (id: string) => (opts.anonymous ? id : userName(data, id));
  const inScope = (courseId: string) => !opts.courseId || courseId === opts.courseId;
  const course = (id: string) => data.courses.find((c) => c.id === id)?.unit ?? "";
  const groupName = (id: string) => data.groups.find((g) => g.id === id)?.name ?? id;

  const formAnswers: Sheet = { name: "1 表單原始回答", rows: [["表單", "課程", "學員", "題號", "題目", "回答", "送出時間"]] };
  for (const f of data.forms.filter((f) => inScope(f.courseId))) {
    for (const s of data.formSubmissions.filter((s) => s.formId === f.id && s.status === "submitted")) {
      f.questions.forEach((q, i) => {
        const v = s.answers[q.id];
        const text = Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : x.name)).join("；") : v === null || v === undefined ? "" : String(v);
        formAnswers.rows.push([f.title, course(f.courseId), name(s.userId), i + 1, q.title, text, s.submittedAt ? fmtDateTime(s.submittedAt) : ""]);
      });
    }
  }

  const individual: Sheet = { name: "2 個人作業繳交紀錄", rows: [["作業", "課程", "學員", "繳交狀態", "批改狀態", "版本數", "最後繳交時間", "分數", "評語"]] };
  const group: Sheet = { name: "3 分組作業繳交紀錄", rows: [["作業", "課程", "小組", "實際提交者", "繳交狀態", "批改狀態", "版本數", "最後繳交時間", "評語"]] };
  for (const a of data.assignments.filter((a) => inScope(a.courseId))) {
    for (const s of data.assignmentSubmissions.filter((s) => s.assignmentId === a.id && s.versions.length > 0)) {
      const last = s.versions[s.versions.length - 1];
      if (a.type === "individual") individual.rows.push([a.title, course(a.courseId), name(s.ownerId), submitStatusLabel[s.submitStatus], reviewStatusLabel[s.reviewStatus], s.versions.length, fmtDateTime(last.submittedAt), s.review?.score ?? "", s.review?.comment ?? ""]);
      else group.rows.push([a.title, course(a.courseId), groupName(s.ownerId), name(last.submittedById), submitStatusLabel[s.submitStatus], reviewStatusLabel[s.reviewStatus], s.versions.length, fmtDateTime(last.submittedAt), s.review?.comment ?? ""]);
    }
  }

  const sc = studentCompletion(data);
  const perStudent: Sheet = { name: "4 各學員完成率", rows: [["學員", "小組", "表單完成", "表單總數", "個人作業完成", "個人作業總數", "分組作業完成", "分組作業總數", "逾期次數"]] };
  for (const r of sc) perStudent.rows.push([name(r.user.id), r.group?.name ?? "", r.forms.done, r.forms.total, r.individual.done, r.individual.total, r.group_.done, r.group_.total, r.late]);

  const perGroup: Sheet = { name: "5 各小組完成率", rows: [["小組", "組長", "已完成", "應完成", "完成率 %"]] };
  for (const g of groupCompletion(data)) perGroup.rows.push([g.group.name, g.leader ? name(g.leader.id) : "", g.done, g.total, g.total ? Math.round((g.done / g.total) * 1000) / 10 : 0]);

  const perCourse: Sheet = { name: "6 各課程完成率", rows: [["課程", "作業數", "表單數", "已完成", "應完成", "完成率 %"]] };
  for (const c of courseCompletion(data).filter((c) => inScope(c.course.id))) perCourse.rows.push([`${c.course.unit} ${c.course.title}`, c.assignments, c.forms, c.done, c.expected, c.rate]);

  const qStats: Sheet = { name: "7 表單題目統計", rows: [["表單", "題號", "題目", "類型", "統計", "數值"]] };
  for (const f of data.forms.filter((f) => inScope(f.courseId))) {
    questionStats(data, f).forEach((q, i) => {
      if (q.kind === "choice") for (const [o, n] of Object.entries(q.counts)) qStats.rows.push([f.title, i + 1, q.question.title, "選項", o, n]);
      else if (q.kind === "rating") { qStats.rows.push([f.title, i + 1, q.question.title, "評分", "平均", q.avg]); for (const [k, n] of Object.entries(q.dist)) qStats.rows.push([f.title, i + 1, q.question.title, "評分", `${k} 分人數`, n]); }
      else qStats.rows.push([f.title, i + 1, q.question.title, "文字", "回答數", q.total]);
    });
  }

  const charts: Sheet = { name: "8 統計圖表", rows: [["圖表", "項目", "完成率 %"]] };
  for (const s of assignmentStats(data).filter((s) => inScope(s.assignment.courseId))) charts.rows.push(["作業完成率", s.assignment.title, s.rate]);
  for (const s of formStats(data).filter((s) => inScope(s.form.courseId))) charts.rows.push(["表單填寫率", s.form.title, s.rate]);

  return [formAnswers, individual, group, perStudent, perGroup, perCourse, qStats, charts];
}

function toCsv(rows: (string | number)[][]) {
  return "﻿" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
}

/** 第一階段：每個工作表下載為一個 CSV（Excel 可直接開啟，含 BOM 避免中文亂碼）。 */
export function downloadCsvBundle(sheets: Sheet[], baseName: string) {
  sheets.forEach((s, i) => {
    const blob = new Blob([toCsv(s.rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName}_${s.name}.csv`;
    setTimeout(() => {
      a.click();
      URL.revokeObjectURL(url);
    }, i * 250);
  });
}
