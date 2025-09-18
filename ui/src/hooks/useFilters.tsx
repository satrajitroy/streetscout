// src/hooks/useFilters.tsx
import * as React from "react";

export type ParamDef = {
    name: string;
    in: "query" | "path" | "header" | "cookie";
    required?: boolean;
    schema?: any; // OpenAPI SchemaObject
    description?: string;
};

type HookResult = {
    controls: React.ReactNode;
    appendTo: (qs: URLSearchParams) => void;
    reset: () => void;
    hasFilters: boolean;
};

/** Normalize an OpenAPI param or a $ref'ed param to a plain ParamDef */
function normalizeParam(x: any): ParamDef | null {
    if (!x) return null;
    // resolve $ref if the caller pre-deref'd, we just accept it as-is
    const p = x.$ref ? (x.__resolved ?? null) : x;
    if (!p) return null;
    return {
        name: String(p.name),
        in: p.in,
        required: !!p.required,
        schema: p.schema ?? {},
        description: p.description,
    };
}

/** Extract filterable query params from a GET list operation */
function toParams(listOp: any): ParamDef[] {
    const raw: any[] = Array.isArray(listOp?.parameters) ? (listOp.parameters as any[]) : [];

    const norm: ParamDef[] = raw
        .map((x: any) => normalizeParam(x))
        .filter((x: ParamDef | null): x is ParamDef => !!x)
        .filter((p: ParamDef) => p.in === "query")
        // .filter((p: ParamDef) => !/^page$/i.test(p.name) && !/^size$/i.test(p.name));

    // de-dupe by name (prefer the first)
    const seen = new Set<string>();
    return norm.filter((p: ParamDef) => (seen.has(p.name) ? false : (seen.add(p.name), true)));
}

function isEnumSchema(s: any): boolean {
    return Array.isArray(s?.enum) && s.enum.length > 0;
}
function enumValues(s: any): string[] {
    return Array.isArray(s?.enum) ? s.enum.map((v: any) => String(v)) : [];
}
function schemaType(s: any): string {
    if (!s) return "string";
    if (Array.isArray(s.type)) return s.type[0];
    return s.type ?? "string";
}

type Row = { key: string; val: string };

export function useFilters(listOp: any): HookResult {
    const params = React.useMemo<ParamDef[]>(() => toParams(listOp), [listOp]);

    // filter rows the user is composing
    const [rows, setRows] = React.useState<Row[]>([]);

    // pick the first key as a default for new rows (if any)
    const firstKey = params[0]?.name ?? "";

    const addRow = React.useCallback(() => {
        if (!params.length) return;
        setRows((r) => [...r, { key: firstKey, val: "" }]);
    }, [params, firstKey]);

    const changeKey = React.useCallback((idx: number, key: string) => {
        setRows((r) => {
            const copy = r.slice();
            copy[idx] = { key, val: "" };
            return copy;
        });
    }, []);

    const changeVal = React.useCallback((idx: number, val: string) => {
        setRows((r) => {
            const copy = r.slice();
            copy[idx] = { ...copy[idx], val };
            return copy;
        });
    }, []);

    const removeRow = React.useCallback((idx: number) => {
        setRows((r) => r.filter((_, i) => i !== idx));
    }, []);

    const reset = React.useCallback(() => setRows([]), []);

    /** Append active filter rows to the querystring */
    const appendTo = React.useCallback((qs: URLSearchParams) => {
        for (const row of rows) {
            if (!row.key || row.val == null || row.val === "") continue;
            qs.set(row.key, row.val);
        }
    }, [rows]);

    /** Build the UI */
    const controls = React.useMemo<React.ReactNode>(() => {
        if (!params.length && rows.length === 0) {
            // nothing to show yet, but keep space stable
            return <div style={{ opacity: 0.7 }}>No filterable columns.</div>;
        }

        // map of name -> schema for quick lookup when rendering value control
        const byName = new Map<string, ParamDef>(params.map((p) => [p.name, p]));

        return (
            <div style={{ display: "grid", gap: 8 }}>
                {rows.map((row, i) => {
                    const p = byName.get(row.key) || params[0];
                    const s = p?.schema ?? {};
                    const showEnum = isEnumSchema(s);
                    const label = p?.name ?? row.key;

                    return (
                        <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(160px, 240px) 1fr auto", gap: 8, alignItems: "center" }}>
                            {/* Column selector */}
                            <select
                                value={row.key}
                                onChange={(e) => changeKey(i, e.target.value)}
                                title={p?.description || label}
                            >
                                {params.map((pp) => (
                                    <option key={pp.name} value={pp.name}>{pp.name}</option>
                                ))}
                            </select>

                            {/* Value control */}
                            {showEnum ? (
                                <select
                                    value={row.val}
                                    onChange={(e) => changeVal(i, e.target.value)}
                                >
                                    <option value="">(any)</option>
                                    {enumValues(s).map((ev) => (
                                        <option key={ev} value={ev}>{ev}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    placeholder={schemaType(s)}
                                    value={row.val}
                                    onChange={(e) => changeVal(i, e.target.value)}
                                />
                            )}

                            <button type="button" onClick={() => removeRow(i)} aria-label="Remove filter">✕</button>
                        </div>
                    );
                })}

                <div>
                    <button type="button" onClick={addRow} disabled={!params.length}>+ Add filter</button>
                    {rows.length > 0 && (
                        <button type="button" onClick={reset} style={{ marginLeft: 8, opacity: 0.85 }}>
                            Clear
                        </button>
                    )}
                </div>
            </div>
        );
    }, [params, rows, changeKey, changeVal, removeRow, addRow, reset]);

    const hasFilters = (params.length > 0) || (rows.length > 0);

    return { controls, appendTo, reset, hasFilters };
}

export default useFilters;
