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

/** Try to grab the 200/OK application/json schema from an op */
function get200SchemaFromOp(op: any): any | null {
    const res = op?.responses?.["200"] ?? op?.responses?.["201"];
    const content = res?.content ?? {};
    const media = content["application/json"] ?? content["*/*"];
    return media?.schema ?? null;
}

/** If schema is Page<T> or array<T>, return T (row schema) */
function drillRowSchemaFromAny(schema: any): any {
    if (!schema) return null;
    const deref = (s: any): any => {
        if (!s) return s;
        if (s.$ref) {
            // best-effort: some callers pre-deref; we just return as-is if $ref
            return s;
        }
        if (Array.isArray(s.allOf)) {
            // shallow merge properties
            const merged: any = { ...s };
            for (const piece of s.allOf) {
                const d = deref(piece);
                if (d?.properties) merged.properties = { ...(merged.properties ?? {}), ...d.properties };
            }
            return merged;
        }
        return s;
    };

    // Page<T>
    if (schema?.properties?.items) {
        const items = schema.properties.items;
        const inner = items?.items ?? items;
        return deref(inner);
    }
    // array<T>
    if (schema?.type === "array" && schema.items) return deref(schema.items);

    return deref(schema);
}

/** Extract filterable query params from a GET list operation, with fallbacks */
function toParams(listOp: any): ParamDef[] {
    const raw: any[] = Array.isArray(listOp?.parameters) ? (listOp.parameters as any[]) : [];

    const fromParams: ParamDef[] = raw
        .map((x: any) => normalizeParam(x))
        .filter((x: ParamDef | null): x is ParamDef => !!x)
        .filter((p: ParamDef) => p.in === "query")
        // drop common non-data params
        .filter((p: ParamDef) => !/^(page|size|sort)$/i.test(p.name));

    if (fromParams.length > 0) {
        // de-dupe by name (prefer the first)
        const seen = new Set<string>();
        return fromParams.filter((p: ParamDef) => (seen.has(p.name) ? false : (seen.add(p.name), true)));
    }

    // Fallback: infer from response schema (row properties)
    const s = get200SchemaFromOp(listOp);
    const row = drillRowSchemaFromAny(s);
    const props: Record<string, any> = row?.properties ?? {};
    const names = Object.keys(props);

    return names
        .filter((n) => !/^(page|size|sort)$/i.test(n))
        .map((name) => ({
            name,
            in: "query" as const,
            required: false,
            schema: props[name] ?? {},
            description: undefined,
        }));
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
