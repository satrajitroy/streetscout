import * as React from "react";
import { getSpec, getResponseSchema } from "./openapi";
import type { HttpMethod } from "./openapi";
import { useFilters } from "./hooks/useFilters";

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
    listOp?: any; // OpenAPI op for GET list

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
                                      listOp,
                                      deletePath,
                                      columns,
                                      pageSize = 8,
                                      onPick,
                                  }: Props) {
    const [idInput, setIdInput] = React.useState("");
    const [page, setPage] = React.useState(1);
    const [rows, setRows] = React.useState<any[]>([]);
    const [total, setTotal] = React.useState<number>(0);
    const [loading, setLoading] = React.useState(false);
    const [err, setErr] = React.useState<string>("");
    const [serverSize, setServerSize] = React.useState<number | undefined>(undefined);
    const [autoCols, setAutoCols] = React.useState<Column[] | null>(null);

    // inferred pk used everywhere
    const [primaryKey, setPrimaryKey] = React.useState<string>("id");

    const { controls, appendTo, reset, hasFilters } = useFilters(listOp);

    // ---- infer columns + pk from OpenAPI (id GET) ----
    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const spec = await getSpec();

                // find the path key in the doc that matches idPath (templated)
                const paths = spec.paths || {};
                let docKey: string | undefined;
                if (paths[idPath]?.[idMethod]) docKey = idPath;
                if (!docKey) {
                    for (const k of Object.keys(paths)) {
                        const rx = new RegExp("^" + k.replace(/\{[^}]+\}/g, "[^/]+") + "$");
                        if (rx.test(idPath) && paths[k]?.[idMethod]) { docKey = k; break; }
                    }
                }
                if (!docKey) {
                    if (!cancelled) { setAutoCols(columns ?? null); setPrimaryKey("id"); }
                    return;
                }

                const raw = getResponseSchema(spec, docKey, idMethod);
                if (!raw) {
                    if (!cancelled) { setAutoCols(columns ?? null); setPrimaryKey("id"); }
                    return;
                }

                const rowSchema = drillRowSchema(raw, spec);

                const pkFromSchema = inferPkFromSchema(rowSchema);
                const pkFromPath   = inferPkFromPathParam(docKey);
                const pk = pkFromSchema ?? pkFromPath ?? "id";
                if (!cancelled) setPrimaryKey(pk);

                if (columns && columns.length) {
                    if (!cancelled) setAutoCols(null);
                } else {
                    const inferred = inferColumnsFromSchema(rowSchema, pk, {
                        max: Infinity,
                        showCoords: true,
                    });
                    if (!cancelled) setAutoCols(inferred);
                }
            } catch {
                if (!cancelled) { setAutoCols(columns ?? null); setPrimaryKey("id"); }
            }
        })();
        return () => { cancelled = true; };
    }, [idPath, idMethod, columns]);

    // ---- data fetching ----
    function isZeroBased(listOp: any): boolean {
        const params: any[] = Array.isArray(listOp?.parameters) ? listOp.parameters : [];
        const p = params.find((pp) => (pp?.name ?? "").toLowerCase() === "page");
        const s = p?.schema ?? {};
        return s.minimum === 0 || s.default === 0; // common Spring convention
    }

    const fetchList = React.useCallback(async (uiPageRequested: number) => {
        setLoading(true); setErr("");

        // Step A: collect filter rows into a temporary qs, so we can see if user set page/size there
        const tmp = new URLSearchParams();
        appendTo(tmp); // DO NOT send this directly; just read and recompose

        // Parse optional overrides from filters
        const rawFilterPage = tmp.get("page");
        const rawFilterSize = tmp.get("size");

        // Sanitize numbers
        const parsedFilterPage = rawFilterPage != null && rawFilterPage !== "" ? Number(rawFilterPage) : NaN;
        const parsedFilterSize = rawFilterSize != null && rawFilterSize !== "" ? Number(rawFilterSize) : NaN;

        // UI page (1-based) – prefer user filter override if provided
        let uiPage: number;
        if (!Number.isNaN(parsedFilterPage)) {
            // Convert *backend* value to UI value if backend is 0-based
            uiPage = isZeroBased(listOp) ? Math.max(1, parsedFilterPage + 1) : Math.max(1, parsedFilterPage);
        } else {
            uiPage = Math.max(1, uiPageRequested);
        }

        // Page size – prefer user filter override if provided
        const effPageSize = !Number.isNaN(parsedFilterSize) && parsedFilterSize >= 1 ? parsedFilterSize : pageSize;

        // Step B: build the actual qs to send
        const qs = new URLSearchParams();

        // Copy all filters EXCEPT page/size (we’ll re-add normalized values below)
        tmp.forEach((v, k) => {
            const kl = k.toLowerCase();
            if (kl !== "page" && kl !== "size") qs.set(k, v);
        });

        // Translate UI(1-based) -> backend page index
        const zeroBased = isZeroBased(listOp);
        const backendPage = zeroBased ? Math.max(0, uiPage - 1) : Math.max(1, uiPage);

        qs.set("page", String(backendPage));
        qs.set("size", String(effPageSize));

        const url = `${BASE}${listPath}?${qs.toString()}`;

        try {
            const res = await fetch(url, { headers: { Accept: "application/json" } });
            if (!res.ok) throw new Error(await res.text());
            const json = await res.json();

            const items = Array.isArray(json) ? json : (json.items ?? []);
            const totRaw = Array.isArray(json) ? items.length : json.total;
            const sizeRaw = Array.isArray(json) ? effPageSize : json.size;

            setRows(items);
            setTotal(typeof totRaw === "number" ? totRaw : items.length);
            setServerSize(typeof sizeRaw === "number" ? sizeRaw : undefined);
            setPage(uiPage); // store UI page (always 1-based in state)
        } catch (e: any) {
            setErr(e.message || String(e));
            setRows([]); setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [listPath, pageSize, appendTo, listOp]);

    const fetchOne = React.useCallback(async (theId: string) => {
        setLoading(true); setErr("");
        try {
            const url = BASE + idPath.replace(/\{[^}]+\}/, encodeURIComponent(theId));
            const res = await fetch(url, { headers: { Accept: "application/json" } });
            if (!res.ok) throw new Error(await res.text());
            const json = await res.json();
            setRows([json]);
            setTotal(1);
        } catch (e: any) {
            setErr(e.message || String(e));
            setRows([]);
            setTotal(0);
        } finally { setLoading(false); }
    }, [idPath]);

    // guess pk from an actual row (fallback if inference missed)
    const guessPkFromRow = React.useCallback((row: any): string | null => {
        if (!row || typeof row !== "object") return null;
        const keys = Object.keys(row);
        const norm = (s: string) => normKey(s).toLowerCase();

        // prefer exact primaryKey if present
        if (keys.some(k => norm(k) === norm(primaryKey))) return primaryKey;

        // id-like patterns
        const idish = keys.find(isIdLike);
        if (idish) return idish;

        // literal id
        const plain = keys.find(k => /^id$/i.test(k));
        if (plain) return plain;

        return null;
    }, [primaryKey]);

    const handlePick = React.useCallback((row: any) => {
        if (!onPick) return;
        const pkName = guessPkFromRow(row) ?? primaryKey ?? "id";
        const idVal = row?.[pkName];
        // Alias to id so downstream edit forms that expect 'id' continue to work.
        const payload = { ...row, id: idVal, __pkName: pkName };
        onPick(payload);
    }, [onPick, guessPkFromRow, primaryKey]);

    const doDelete = React.useCallback(async (row: any) => {
        if (!deletePath) return;
        // use the best-known pk from this row
        const pkName = guessPkFromRow(row) ?? primaryKey ?? "id";
        const rid = row?.[pkName];
        if (rid == null) return;
        if (!confirm(`Delete ${rid}?`)) return;
        setLoading(true); setErr("");
        try {
            const url = BASE + deletePath.replace(/\{[^}]+\}/, encodeURIComponent(String(rid)));
            const res = await fetch(url, { method: "DELETE" });
            if (!res.ok) throw new Error(await res.text());
            if (!idInput.trim()) await fetchList(page);
            else { setRows([]); setTotal(0); setIdInput(""); await fetchList(1); }
        } catch (e: any) {
            setErr(e.message || String(e));
        } finally { setLoading(false); }
    }, [deletePath, idInput, fetchList, page, guessPkFromRow, primaryKey]);

    React.useEffect(() => { if (!idInput) fetchList(1); }, [idInput, fetchList]);

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = idInput.trim();
        if (trimmed) fetchOne(trimmed);
        else fetchList(1);
    };

    // final columns = explicit or auto (plus actions if needed)
    const baseCols = React.useMemo<Column[]>(() => columns && columns.length ? columns : (autoCols ?? []), [columns, autoCols]);

    const liveCols = React.useMemo<Column[]>(() => {
        if (!onPick && !deletePath) return baseCols;
        return [
            ...baseCols,
            {
                header: "Actions",
                render: (r: any) => (
                    <div style={{ display: "flex", gap: 6 }}>
                        {onPick && <button onClick={(e) => { e.stopPropagation(); handlePick(r); }}>Edit</button>}
                        {deletePath && <button onClick={(e) => { e.stopPropagation(); doDelete(r); }}>Delete</button>}
                    </div>
                ),
            },
        ];
    }, [baseCols, onPick, deletePath, handlePick, doDelete]);

    const effSize = serverSize ?? pageSize;
    const totalPages = Math.max(1, Math.ceil(total / effSize));
    const isListMode = !idInput || idInput.trim() === "";
    const showPager = isListMode && totalPages > 1;

    return (
        <div className="card">
            <div style={{ fontWeight: 600, opacity: 0.9 }}>{title}</div>

            <form onSubmit={onSubmit} style={{ display: "grid", gap: 8 }}>
                <label style={{ display: "grid", gap: 4 }}>
                    <span style={{ opacity: 0.8 }}>{primaryKey} (optional)</span>
                    <input
                        value={idInput}
                        onChange={(e) => setIdInput(e.target.value)}
                        placeholder={`leave blank to list; provide ${primaryKey} to fetch one`}
                    />
                </label>
                <div><button type="submit" disabled={loading}>{loading ? "Loading…" : "Fetch"}</button></div>
            </form>

            {err && <div style={{ color: "crimson", whiteSpace: "pre-wrap" }}>{err}</div>}

            <div className="table-wrap" style={{ marginTop: 8, maxWidth: '80vw', overflowX: 'auto' }}>
                <table
                    style={{
                        borderCollapse: "collapse",
                        width: "max-content",
                        minWidth: "100%",
                        tableLayout: "fixed",
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
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    maxWidth: "24ch"
                                }}
                            >
                                {c.header}
                            </th>
                        ))}
                    </tr>
                    </thead>
                    <tbody>
                    {rows.map((r, i) => (
                        <tr
                            key={i}
                            role={onPick ? "button" : undefined}
                            tabIndex={onPick ? 0 : -1}
                            style={{ borderTop: "1px solid #222", cursor: onPick ? "pointer" : "default" }}
                            onClick={() => onPick && handlePick(r)}
                            onKeyDown={(e) => { if (onPick && (e.key === "Enter" || e.key === " ")) handlePick(r); }}
                        >
                            {liveCols.map((c, j) => (
                                <td key={j} style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>
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

            {hasFilters && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
                    {controls}
                    <button type="button" onClick={() => fetchList(0)}>Apply</button>
                    <button type="button" onClick={() => { reset(); fetchList(0); }} style={{ opacity: .85 }}>
                        Reset
                    </button>
                </div>
            )}

            {showPager && (
                <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                        Page {page} / {totalPages} · Total {total}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                        <button type="button" onClick={() => fetchList(1)} disabled={page <= 1}>Top</button>
                        <button type="button" onClick={() => fetchList(Math.max(1, page-1))} disabled={page <= 1}>Prev</button>
                        <button type="button" onClick={() => fetchList(page + 1)} disabled={page >= totalPages}>Next</button>
                        <button type="button" onClick={() => fetchList(totalPages)} disabled={page >= totalPages}>Bottom</button>
                    </div>
                </div>
            )}
        </div>
    );
}

/** ---- helpers to drill row schema & infer columns/primary key ---- */
function drillRowSchema(schema: any, spec: any): any {
    if (schema?.properties?.items) {
        const items = schema.properties.items;
        const inner = items.items ?? items;
        return deref(inner, spec);
    }
    if (schema?.type === "array" && schema.items) return deref(schema.items, spec);
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
            if (Array.isArray(d?.required)) {
                merged.required = Array.from(new Set([...(merged.required ?? []), ...d.required]));
            }
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
        } catch { /* ignore */ }
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

/* ---------------- pk inference ---------------- */

const normDash = (s: string) => s.replace(/[‐‒–—―⁃−]/g, "-");
const normKey = (raw: string) => normDash(String(raw ?? "")).normalize("NFKC").trim();

/** Match id, _id, row_id, row-id, camel rowId/streetId, etc. */
const isIdLike = (raw: string) => {
    const k = normKey(raw);
    return (
        /^_?id$/i.test(k) ||        // id / _id
        /(?:^|[_-])id$/i.test(k) || // row_id / row-id / ...-id / ..._id
        /[A-Za-z0-9]Id$/.test(k)    // rowId / streetId
    );
};

const isPrimitiveSchema = (p: any) => {
    const t = p?.type;
    return t === "string" || t === "integer" || t === "number" || t === "boolean";
};

function inferPkFromSchema(rowSchema: any): string | null {
    const props: Record<string, any> = rowSchema?.properties ?? {};
    const keys = Object.keys(props);
    if (!keys.length) return null;

    if (typeof rowSchema?.["x-primary-key"] === "string") {
        const k = rowSchema["x-primary-key"];
        if (props[k]) return k;
    }

    const required: string[] = Array.isArray(rowSchema?.required) ? rowSchema.required : [];

    const reqId = required.find((k) => isIdLike(k) && isPrimitiveSchema(props[k]));
    if (reqId) return reqId;

    const idish = keys.find((k) => isIdLike(k) && isPrimitiveSchema(props[k]));
    if (idish) return idish;

    const litId = keys.find((k) => /^id$/i.test(k) && isPrimitiveSchema(props[k]));
    if (litId) return litId;

    const reqPrim = required.filter((k) => isPrimitiveSchema(props[k]));
    if (reqPrim.length === 1) return reqPrim[0];

    const firstPrim = keys.find((k) => isPrimitiveSchema(props[k]));
    return firstPrim ?? null;
}

function inferPkFromPathParam(docKey: string): string | null {
    const m = docKey.match(/\{([^}]+)\}/);
    return m?.[1] ?? null;
}

/** Build columns from object schema; arrays as dropdowns; use pk for ranking/id styling. */
function inferColumnsFromSchema(
    rowSchema: any,
    pk: string,
    opts?: { max?: number; showCoords?: boolean }
): Column[] {
    const props: Record<string, any> = rowSchema?.properties ?? {};
    const keys = Object.keys(props);
    const maxCols = opts?.max ?? Infinity;

    const isPk         = (k: string) => normKey(k).toLowerCase() === normKey(pk).toLowerCase();
    const isIdish      = (k: string) => isIdLike(k);
    const isName       = (k: string) => /(^|[_-])name$/i.test(k);
    const isZip        = (k: string) => /(zip|code)$/i.test(k);
    const isType       = (k: string) => /(roadType|signType|intersectionType|(^|[_-])type$)/i.test(k);
    const isCoord      = (k: string) => /^(lat|latitude|lon|lng|longitude|altitude)$/i.test(k);
    const isTimeLike   = (k: string) => /(timestamp|created|updated|.*At|time)$/i.test(k);

    const rank = (k: string) =>
        isPk(k)         ? 0
            : isName(k)     ? 1
                : (isIdish(k) && !isPk(k)) ? 2
                    : isZip(k)      ? 3
                        : isType(k)     ? 4
                            : isTimeLike(k) ? 98
                                : isCoord(k)    ? 99
                                    : 50;

    const selectedKeys = keys
        .filter(k => {
            const t = props[k]?.type;
            if (t === 'object') return false;
            if (!opts?.showCoords && isCoord(k)) return false;
            return true;
        })
        .sort((a, b) => {
            const da = rank(a), db = rank(b);
            return da !== db ? da - db : a.localeCompare(b);
        })
        .slice(0, maxCols);

    return selectedKeys.map<Column>(k => {
        const header = k;

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

        return {
            header,
            tdClassName: 'cell-list',
            title: (r) => {
                const arr = toArray(r?.[k]);
                return arr.length > 1 ? `${arr.length} item(s)` : undefined;
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
                        className={isPk(k) ? 'cell-id' : undefined}
                        title={isPk(k) && raw != null ? String(raw) : undefined}
                    >
            {formatCell(raw)}
          </span>
                );
            },
        };
    });
}
