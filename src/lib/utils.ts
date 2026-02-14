export function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export function s(x: any) {
  return (x ?? "").toString().trim();
}

export function n(x: any): number | null {
  if (x === null || x === undefined || x === "") return null;
  if (typeof x === "number" && Number.isFinite(x)) return x;
  const v = Number(String(x).replace(/,/g, "").trim());
  return Number.isFinite(v) ? v : null;
}

export function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function parseMaybeDate(t: string): string | null {
  const x = t.trim();
  if (!x) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(x)) return x;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(x)) {
    const [mm, dd, yyyy] = x.split("/").map((z) => Number(z));
    const d = new Date(yyyy, mm - 1, dd);
    if (Number.isNaN(d.getTime())) return null;
    return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  }
  return null;
}

export function heatColor(v: number, min: number, max: number) {
  const clamped = Math.max(min, Math.min(max, v));
  const t = max === min ? 0.5 : (clamped - min) / (max - min);
  const a = 0.06 + t * 0.44;
  return `rgba(59,130,246,${a})`;
}

export function downloadJson(filename: string, obj: any) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
