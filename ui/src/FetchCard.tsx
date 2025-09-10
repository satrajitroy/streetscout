// src/FetchCard.tsx
import * as React from "react";
import { getSpec, getResponseSchema } from "./openapi";
import type { HttpMethod } from "./openapi";

// type Page<T> = { items: T[]; page: number; size: number; total: number };
type Column = {
    header: string;
    render: (row: any) => React.ReactNode;
    tdClassName?: string;
    title?: (row: any) => string | undefined;
};

const BASE = import.meta.env.VITE_API_URL ?? "";

type Props = {
    title?: string;

    /** e.g. "/api/streetscout/street/{id}" (used for single fetch AND column inference) */
    idPath: string;
    /** method for idPath (usually "get") */
    idMethod?: HttpMethod;

    /** e.g. "/api/streetscout/street" (must support ?page=&size=) */
    listPath: string;

    /** e.g. "/api/streetscout/street/delete/{id}" */
    deletePath?: string;

    /** Optional explicit columns; if omitted, inferred from OpenAPI response schema */
    columns?: Column[];

    /** Rows per page for list mode */
    pageSize?: number;

    /** Optional row click → prefill Edit */
    onPick?: (row: any) => void;
};

export default function FetchCard({
                                      title = "Fetch",
                                      idPath,
                                      idMethod = "get",
                                      listPath,
                                      deletePath,
                                      columns,
                                      pageSize = 8,
                                      onPick,
                                  }: Props) {
    const [id, setId] = React.useState("");
    const [page, setPage] = React.useState(1);
    const [rows, setRows] = React.useState<any[]>([]);
    const [total, setTotal] = React.useState<number>(0);
    const [loading, setLoading] = React.useState(false);
    const [err, setErr] = React.useState<string>("");

    const [autoCols, setAutoCols] = React.useState<Column[] | null>(null);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    // -------- infer columns from OpenAPI (GET-by-id) --------
    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            if (columns && columns.length) { setAutoCols(null); return; }
            try {
                const spec = await getSpec();

                // Find the documented key that matches idPath (template keys may differ in doc)
                const paths = spec.paths || {};
                let docKey: string | undefined;
                if (paths[idPath]?.[idMethod]) docKey = idPath;
                if (!docKey) {
                    // try to find a template path that matches
                    for (const k of Object.keys(paths)) {
                        const rx = new RegExp("^" + k.replace(/\{[^}]+\}/g, "[^/]+") + "$");
                        if (rx.test(idPath) && paths[k]?.[idMethod]) { docKey = k; break; }
                    }
                }
                if (!docKey) return;

                // 200 JSON schema for GET-by-id
                const raw = getResponseSchema(spec, docKey, idMethod);
                if (!raw) return;

                // If it's Page<T> or array, drill to row schema
                const rowSchema = drillRowSchema(raw, spec);

                const inferred = inferColumnsFromSchema(rowSchema, {
                    max: Infinity,     // allow as many columns as exist → table can overflow
                    showCoords: true,  // include coords, rank will push them to the end
                });
                setAutoCols(inferred);
                if (!cancelled) setAutoCols(inferred);
            } catch {
                // ignore; we'll just render no auto columns
            }
        })();
        return () => { cancelled = true; };
    }, [idPath, idMethod, columns]);

    // -------- data fetching --------
    const fetchList = React.useCallback(async (p: number) => {
        setLoading(true); setErr("");
        try {
            const res = await fetch(`${BASE}${listPath}?page=${p}&size=${pageSize}`, {
                headers: { Accept: "application/json" },
            });
            if (!res.ok) throw new Error(await res.text());
            const json = await res.json();
            const items = Array.isArray(json) ? json : (json.items ?? []);
            const tot = Array.isArray(json) ? items.length : (json.total ?? items.length);
            setRows(items);
            setTotal(tot);
            setPage(p);
        } catch (e: any) {
            setErr(e.message || String(e));
            setRows([]); setTotal(0);
        } finally { setLoading(false); }
    }, [listPath, pageSize]);

    const fetchOne = React.useCallback(async (theId: string) => {
        setLoading(true); setErr("");
        try {
            const url = BASE + idPath.replace(/\{[^}]+\}/, encodeURIComponent(theId));
            const res = await fetch(url, { headers: { Accept: "application/json" } });
            if (!res.ok) throw new Error(await res.text());
            const json = await res.json();
            setRows([json]); setTotal(1); setPage(1);
        } catch (e: any) {
            setErr(e.message || String(e));
            setRows([]); setTotal(0);
        } finally { setLoading(false); }
    }, [idPath]);

    const doDelete = React.useCallback(async (row: any) => {
        if (!deletePath || !row?.id) return;
        if (!confirm(`Delete ${row.id}?`)) return;
        setLoading(true); setErr("");
        try {
            const url = BASE + deletePath.replace(/\{[^}]+\}/, encodeURIComponent(String(row.id)));
            const res = await fetch(url, { method: "DELETE" });
            if (!res.ok) throw new Error(await res.text());
            if (!id.trim()) await fetchList(page);
            else { setRows([]); setTotal(0); setId(""); await fetchList(1); }
        } catch (e: any) {
            setErr(e.message || String(e));
        } finally { setLoading(false); }
    }, [deletePath, id, fetchList, page]);

    React.useEffect(() => { if (!id) fetchList(1); }, [id, fetchList]);

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = id.trim();
        if (trimmed) fetchOne(trimmed);
        else fetchList(1);
    };

    // final columns = explicit or auto (plus actions if needed)
    const baseCols = React.useMemo<Column[]>(() => columns && columns.length ? columns : (autoCols ?? []), [columns, autoCols]);

    const liveCols = React.useMemo<Column[]>(() => {
        if (!deletePath && !onPick) return baseCols;
        return [
            ...baseCols,
            {
                header: "Actions",
                render: (r: any) => (
                    <div style={{ display: "flex", gap: 6 }}>
                        {onPick && <button onClick={() => onPick(r)}>Edit</button>}
                        {deletePath && <button onClick={() => doDelete(r)}>Delete</button>}
                    </div>
                ),
            },
        ];
    }, [baseCols, deletePath, onPick, doDelete]);

    return (
        <div className="card">
            <div style={{ fontWeight: 600, opacity: 0.9 }}>{title}</div>

            <form onSubmit={onSubmit} style={{ display: "grid", gap: 8 }}>
                <label style={{ display: "grid", gap: 4 }}>
                    <span style={{ opacity: 0.8 }}>id (optional)</span>
                    <input value={id} onChange={(e) => setId(e.target.value)} placeholder="leave blank to list" />
                </label>
                <div><button type="submit" disabled={loading}>{loading ? "Loading…" : "Fetch"}</button></div>
            </form>

            {err && <div style={{ color: "crimson", whiteSpace: "pre-wrap" }}>{err}</div>}

            <div style={{ overflowX: "auto", marginTop: 8 }}>
                <table
                    style={{
                        borderCollapse: "collapse",
                        width: "max-content", // <— allow table to grow as wide as needed
                        minWidth: "100%",     // <— but never smaller than the container
                        tableLayout: "auto",
                    }}
                >
                    <thead>
                    <tr>
                        {liveCols.map((c, i) => (
                            <th
                                key={i}
                                style={{
                                    textAlign: "left",
                                    padding: "6px 8px",
                                    borderBottom: "1px solid #333",
                                    whiteSpace: "nowrap",              // <—
                                }}
                            >
                                {c.header}
                            </th>
                        ))}
                    </tr>
                    </thead>
                    <tbody>
                    {rows.map((r, i) => (
                        <tr key={i} style={{ borderTop: "1px solid #222", cursor: onPick ? "pointer" : "default" }}
                            onClick={() => onPick?.(r)}>
                            {liveCols.map((c, j) => (
                                <td key={j} style={{padding: "6px 8px", whiteSpace: "nowrap"}}>
                                    {c.render(r)}
                                </td>
                            ))}
                        </tr>
                    ))}
                    {!loading && rows.length === 0 && (
                        <tr><td colSpan={liveCols.length} style={{ padding: 8, opacity: 0.7 }}>No data.</td></tr>
                    )}
                    </tbody>
                </table>
            </div>

            {id.trim() === "" && total > pageSize && (
                <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                        Page {page} / {Math.max(1, Math.ceil(total / pageSize))} · Total {total}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => fetchList(1)} disabled={page <= 1}>Top</button>
                        <button onClick={() => fetchList(Math.max(1, page - 1))} disabled={page <= 1}>Prev</button>
                        <button onClick={() => fetchList(page + 1)} disabled={page >= totalPages}>Next</button>
                        <button onClick={() => fetchList(totalPages)} disabled={page >= totalPages}>Bottom</button>
                    </div>
                </div>
            )}
        </div>
    );
}

/** ---- helpers to drill row schema & infer columns ---- */

function drillRowSchema(schema: any, spec: any): any {
    // If schema is Page<T>, find properties.items.items.$ref or similar
    if (schema?.properties?.items) {
        const items = schema.properties.items;
        const inner = items.items ?? items; // array -> items; already an object -> itself
        return deref(inner, spec);
    }
    // If schema is array -> use its items
    if (schema?.type === "array" && schema.items) return deref(schema.items, spec);
    // Otherwise expect an object row
    return schema;
}

function deref(s: any, spec: any): any {
    if (!s) return s;
    if (s.$ref) {
        const parts = s.$ref.replace(/^#\//, "").split("/");
        let cur: any = spec;
        for (const p of parts) cur = cur?.[p];
        return deref(cur, spec);
    }
    if (Array.isArray(s.allOf)) {
        const merged: any = { ...s };
        for (const piece of s.allOf) {
            const d = deref(piece, spec);
            if (d?.properties) merged.properties = { ...(merged.properties ?? {}), ...d.properties };
        }
        return merged;
    }
    return s;
}

function looksLikeJson(s: string) {
    const t = s.trim();
    return (t.startsWith('[') && t.endsWith(']')) || (t.startsWith('{') && t.endsWith('}'));
}

function toArray(val: any): any[] {
    if (val == null) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string' && looksLikeJson(val)) {
        try {
            const parsed = JSON.parse(val);
            if (Array.isArray(parsed)) return parsed;
            if (parsed && typeof parsed === 'object') return [parsed];
        } catch {/* ignore */}
    }
    if (typeof val === 'object') return [val];
    return [val];
}

function segmentLabel(seg: any) {
    if (!seg || typeof seg !== 'object') return String(seg ?? '');
    const parts: string[] = [];
    if (seg.location != null) parts.push(String(seg.location));
    if (seg.surface)         parts.push(String(seg.surface));
    if (seg.condition)       parts.push(String(seg.condition));
    if (seg.width != null)   parts.push(`w=${seg.width}`);
    if (seg.lanes != null)   parts.push(`lanes=${seg.lanes}`);
    return parts.join(' · ');
}

function genericItemLabel(item: any) {
    return typeof item === 'object' ? JSON.stringify(item) : String(item);
}

function formatCell(v: any) {
    if (v == null) return '';
    if (Array.isArray(v)) return v.join(', ');
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
}

/** Build columns from object schema; force coords/time last; arrays as dropdowns. */
function inferColumnsFromSchema(
    rowSchema: any,
    opts?: { max?: number; showCoords?: boolean }
): Column[] {
    const props: Record<string, any> = rowSchema?.properties ?? {};
    const keys = Object.keys(props);
    const maxCols = opts?.max ?? Infinity;

    const isIdLike    = (k: string) => /(^|_)id$/i.test(k);
    const isPrimaryId = (k: string) => k.toLowerCase() === 'id';
    const isName      = (k: string) => /(^|_)name$/i.test(k);
    const isZip       = (k: string) => /(zip|code)$/i.test(k);
    const isType      = (k: string) => /(roadType|signType|intersectionType|type)$/i.test(k);
    const isCoord     = (k: string) => /^(lat|latitude|lon|lng|longitude|altitude)$/i.test(k);
    const isTimeLike  = (k: string) => /(timestamp|created|updated|.*At|time)$/i.test(k);

    // smaller rank = earlier column
    const rank = (k: string) =>
        isPrimaryId(k) ? 0
            : isName(k)      ? 1
                : (isIdLike(k) && !isPrimaryId(k)) ? 2 // e.g., streetId
                    : isZip(k)       ? 3
                        : isType(k)      ? 4
                            : isTimeLike(k)  ? 98
                                : isCoord(k)     ? 99
                                    : 50;
    const selectedKeys = keys
        .filter(k => {
            const t = props[k]?.type;
            if (t === 'object') return false;
            if (!opts?.showCoords && isCoord(k)) return false; // hide coords unless requested
            return true;
        })
        .sort((a, b) => {
            const da = rank(a), db = rank(b);
            return da !== db ? da - db : a.localeCompare(b);
        })
        .slice(0, maxCols);

    return selectedKeys.map<Column>(k => {
        const header = k;                     // <-- use the field name only
        const idCell = /(^|_)id$/i.test(k);

        // Nice labels for "segments"
        if (k === 'segments') {
            return {
                header,
                tdClassName: 'cell-list',
                title: (r) => {
                    const arr = toArray(r?.segments);
                    return arr.length ? `${arr.length} segment(s)` : '0 segment(s)';
                },
                render: (r) => {
                    const arr = toArray(r?.segments);
                    if (!arr.length) return <span style={{ opacity: 0.7 }}>0</span>;
                    return (
                        <select
                            className="cell-select"
                            // NOTE: not disabled ⇒ you can open it
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            title={`${arr.length} segment(s)`}
                        >
                            {arr.map((seg, i) => (
                                <option key={i} value={String(i)}>
                                    {segmentLabel(seg)}
                                </option>
                            ))}
                        </select>
                    );
                },
            };
        }

        // Generic: arrays -> dropdown (openable), primitives -> text
        return {
            header,
            tdClassName: 'cell-list',
            title: (r) => {
                const arr = toArray(r?.[k]);
                return arr.length ? `${arr.length} item(s)` : undefined;
            },
            render: (r) => {
                const raw = r?.[k];
                const arr = toArray(raw);

                if (arr.length > 1) {
                    return (
                        <select
                            className="cell-select"
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            title={`${arr.length} item(s)`}
                        >
                            {arr.map((it, i) => (
                                <option key={i} value={String(i)}>
                                    {k === 'segments' ? segmentLabel(it) : genericItemLabel(it)}
                                </option>
                            ))}
                        </select>
                    );
                }

                return (
                    <span
                        className={idCell ? 'cell-id' : undefined}
                        title={idCell && raw != null ? String(raw) : undefined}
                    >
          {formatCell(raw)}
        </span>
                );
            },
        };
    });
}
