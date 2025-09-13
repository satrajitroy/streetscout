// src/hooks/useFilters.tsx
import * as React from "react";

type Schemaish = {
    type?: "string" | "number" | "integer" | "boolean" | "array" | "object";
    format?: "date" | "date-time" | string;
    enum?: any[];
    default?: any;
};

export type QueryDef = {
    name: string;
    required?: boolean;
    schema?: Schemaish;
    explode?: boolean;
};

function readQueryDefs(listOp: any): QueryDef[] {
    const params: any[] = Array.isArray(listOp?.parameters) ? listOp.parameters : [];
    return params
        .filter(p => p?.in === "query")
        .map((p): QueryDef => ({
            name: String(p.name),
            required: !!p.required,
            schema: p.schema as Schemaish,
            explode: !!p.explode,
        }));
}

export function useFilters(listOp?: any) {
    const defs = React.useMemo<QueryDef[]>(() => readQueryDefs(listOp), [listOp]);

    const [filters, setFilters] = React.useState<Record<string, unknown>>({});

    React.useEffect(() => {
        const init: Record<string, unknown> = {};
        for (const d of defs) {
            const dflt = d.schema?.default;
            if (dflt !== undefined) init[d.name] = dflt;
        }
        setFilters(init);
    }, [defs]);

    const appendTo = React.useCallback((qs: URLSearchParams) => {
        for (const d of defs) {
            const val = filters[d.name];
            if (val === undefined || val === "" || val === null) continue;
            if (Array.isArray(val)) {
                if (d.explode) val.forEach(v => qs.append(d.name, String(v)));
                else qs.set(d.name, val.map(v => String(v)).join(","));
            } else {
                qs.set(d.name, String(val));
            }
        }
    }, [defs, filters]);

    const reset = React.useCallback(() => setFilters({}), []);

    const controls = React.useMemo<React.ReactNode>(() => {
        if (!defs.length) return null;
        return (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <strong>Filters:</strong>
                {defs.map((d: QueryDef) => {
                    const s = d.schema ?? {};
                    const v = (filters[d.name] ?? "") as unknown;

                    // enum → dropdown
                    if (Array.isArray(s.enum) && s.enum.length > 0) {
                        return (
                            <label key={d.name} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                                {d.name}
                                <select
                                    value={typeof v === "string" ? v : ""}
                                    onChange={e => setFilters(f => ({ ...f, [d.name]: e.target.value || undefined }))}
                                >
                                    <option value="">{d.required ? "(choose)" : "(any)"}</option>
                                    {s.enum.map((opt: any) => (
                                        <option key={String(opt)} value={String(opt)}>{String(opt)}</option>
                                    ))}
                                </select>
                            </label>
                        );
                    }

                    // date / datetime
                    if (s.type === "string" && s.format === "date") {
                        return (
                            <label key={d.name} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                                {d.name}
                                <input
                                    type="date"
                                    value={typeof v === "string" ? v : ""}
                                    onChange={e => setFilters(f => ({ ...f, [d.name]: e.target.value || undefined }))}
                                />
                            </label>
                        );
                    }
                    if (s.type === "string" && s.format === "date-time") {
                        return (
                            <label key={d.name} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                                {d.name}
                                <input
                                    type="datetime-local"
                                    value={typeof v === "string" ? v : ""}
                                    onChange={e => setFilters(f => ({ ...f, [d.name]: e.target.value || undefined }))}
                                />
                            </label>
                        );
                    }

                    // boolean
                    if (s.type === "boolean") {
                        const val = v === true ? "true" : v === false ? "false" : "";
                        return (
                            <label key={d.name} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                                {d.name}
                                <select
                                    value={val}
                                    onChange={e => {
                                        const next = e.target.value;
                                        setFilters(f => ({ ...f, [d.name]: next === "" ? undefined : next === "true" }));
                                    }}
                                >
                                    <option value="">{d.required ? "(choose)" : "(any)"}</option>
                                    <option value="true">true</option>
                                    <option value="false">false</option>
                                </select>
                            </label>
                        );
                    }

                    // number / integer
                    if (s.type === "number" || s.type === "integer") {
                        return (
                            <label key={d.name} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                                {d.name}
                                <input
                                    type="number"
                                    value={typeof v === "number" || typeof v === "string" ? String(v) : ""}
                                    onChange={e => {
                                        const t = e.target.value;
                                        setFilters(f => ({ ...f, [d.name]: t === "" ? undefined : Number(t) }));
                                    }}
                                />
                            </label>
                        );
                    }

                    // default text
                    return (
                        <label key={d.name} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                            {d.name}
                            <input
                                type="text"
                                value={typeof v === "string" ? v : ""}
                                onChange={e => setFilters(f => ({ ...f, [d.name]: e.target.value || undefined }))}
                            />
                        </label>
                    );
                })}
            </div>
        );
    }, [defs, filters]);

    return { controls, appendTo, reset, hasFilters: defs.length > 0 };
}
