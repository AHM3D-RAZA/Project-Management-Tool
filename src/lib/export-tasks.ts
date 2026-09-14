import type { Task, Project, StatusConfig, WorkspaceMemberWithRole, CustomFieldDefinition } from '@/lib/types';

function resolveStatusName(statusId: string, pipelines: StatusConfig[]): string {
  return pipelines.find((s) => s.id === statusId)?.name || statusId;
}

function resolveAssigneeNames(assigneeUserIds: string[] | undefined, members: WorkspaceMemberWithRole[]): string {
  if (!assigneeUserIds || assigneeUserIds.length === 0) return 'Unassigned';
  return assigneeUserIds
    .map((id) => members.find((m) => m.userId === id)?.displayName || 'Unknown')
    .join(', ');
}

function formatDueDate(dueDate: string | null | undefined): string {
  if (!dueDate) return '';
  try {
    return new Date(dueDate).toLocaleDateString();
  } catch {
    return dueDate;
  }
}

/** Escapes a single CSV field per RFC 4180: wraps in quotes and doubles any embedded quotes whenever the value contains a comma, quote, or newline. */
function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function safeFilenamePart(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'export';
}

export function exportTasksToCsv(
  project: Project,
  tasks: Task[],
  pipelines: StatusConfig[],
  members: WorkspaceMemberWithRole[],
  customFieldDefinitions: CustomFieldDefinition[]
) {
  const headers = [
    'Title',
    'Description',
    'Status',
    'Priority',
    'Assignees',
    'Due Date',
    'Tags',
    ...customFieldDefinitions.map((f) => f.name),
    'Created At',
  ];

  const rows = tasks.map((task) => [
    task.title || '',
    task.description || '',
    resolveStatusName(task.status, pipelines),
    task.priority || '',
    resolveAssigneeNames(task.assigneeUserIds, members),
    formatDueDate(task.dueDate),
    (task.tags || []).join('; '),
    ...customFieldDefinitions.map((f) => task.customFields?.[f.id] || ''),
    task.createdAt ? new Date(task.createdAt).toLocaleDateString() : '',
  ]);

  const csvLines = [headers, ...rows].map((row) => row.map((cell) => escapeCsvField(String(cell))).join(','));
  const csvContent = csvLines.join('\r\n');

  // Leading BOM so Excel opens UTF-8 CSVs with correct character rendering.
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${safeFilenamePart(project.name)}-tasks.csv`);
}

export async function exportTasksToPdf(
  project: Project,
  tasks: Task[],
  pipelines: StatusConfig[],
  members: WorkspaceMemberWithRole[]
) {
  // Loaded on demand rather than at the top of the file — jsPDF + the
  // autotable plugin add real weight (~140kB) that most sessions never
  // need, since most people export as CSV or don't export at all.
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  doc.setFontSize(18);
  doc.text(project.name, margin, 20);

  doc.setFontSize(10);
  doc.setTextColor(100);
  const generatedLine = `Generated ${new Date().toLocaleDateString()} \u00b7 ${tasks.length} task${tasks.length === 1 ? '' : 's'}`;
  doc.text(generatedLine, margin, 27);

  let cursorY = 27;
  if (project.description) {
    doc.setFontSize(10);
    doc.setTextColor(60);
    const descLines = doc.splitTextToSize(project.description, pageWidth - margin * 2);
    doc.text(descLines, margin, 34);
    cursorY = 34 + descLines.length * 4.5;
  }

  const statusCounts = new Map<string, number>();
  for (const task of tasks) {
    const name = resolveStatusName(task.status, pipelines);
    statusCounts.set(name, (statusCounts.get(name) || 0) + 1);
  }
  const summaryLine = Array.from(statusCounts.entries())
    .map(([name, count]) => `${name}: ${count}`)
    .join('   \u00b7   ');
  if (summaryLine) {
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(summaryLine, margin, cursorY + 6);
    cursorY += 6;
  }

  autoTable(doc, {
    startY: cursorY + 10,
    head: [['Title', 'Status', 'Priority', 'Assignees', 'Due Date']],
    body: tasks.map((task) => [
      task.title || '',
      resolveStatusName(task.status, pipelines),
      task.priority || '',
      resolveAssigneeNames(task.assigneeUserIds, members),
      formatDueDate(task.dueDate),
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [69, 46, 210] },
    margin: { left: margin, right: margin },
  });

  doc.save(`${safeFilenamePart(project.name)}-tasks.pdf`);
}
