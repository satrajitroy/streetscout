// src/openApiForm.tsx
import * as React from "react";
import Form from "@rjsf/core";
import validator from "@rjsf/validator-ajv8";
import type {HttpMethod} from "./openapi";
import {getRequestSchema, getSpec} from "./openapi";

const BASE = import.meta.env.VITE_API_URL ?? "";

type Props = {
    /** OpenAPI path with placeholders, e.g. "/api/streetscout/sign/edit/{id}" */
    path: string;
    method: HttpMethod;
    uiSchema?: any;
    initialData?: any;                 // initial body form data
    onSuccess?: (res: any) => void;
};

export type OpenApiFormHandle = {
    /** Replace the request body form data */
    setBodyData: (data: any) => void;
    /** Set one path param (e.g., setPathParam("id", "123")) */
    setPathParam: (name: string, value: string) => void;
    /** Set many at once */
    setAll: (opts: { params?: Record<string, string>; body?: any }) => void;
};

function extractTemplateKeys(tpl: string): string[] {
    return Array.from(tpl.matchAll(/\{(\w+)\}/g)).map((m) => m[1]);
}

function resolvePathOrThrow(tpl: string, params: Record<string, string>) {
    return tpl.replace(/\{(\w+)\}/g, (_, k) => {
        const v = params[k];
        if (v == null || v === "") throw new Error(`Missing path param: ${k}`);
        return encodeURIComponent(String(v));
    });
}

function pickJson(content?: Record<string, any>) {
    if (!content) return;
    const keys = Object.keys(content);
    const jsonKey =
        keys.find((k) => k.toLowerCase().includes("json")) ?? keys[0];
    return jsonKey ? content[jsonKey]?.schema : undefined;
}

const OpenApiForm = React.forwardRef<OpenApiFormHandle, Props>(function OpenApiForm(
    {path, method, uiSchema, initialData, onSuccess}: Props,
    ref
) {
    // Operation + schema
    const [schema, setSchema] = React.useState<any>();
    const [op, setOp] = React.useState<any>();

    // Path param names & values
    const [pathParamNames, setPathParamNames] = React.useState<string[]>([]);
    const [params, setParams] = React.useState<Record<string, string>>({});

    // Body form data (controlled)
    const [bodyData, setBodyData] = React.useState<any>(initialData ?? undefined);

    const [err, setErr] = React.useState<string>("");
    const [submitting, setSubmitting] = React.useState(false);

    const [lastResult, setLastResult] = React.useState<any>(undefined);
    const [lastContentType, setLastContentType] = React.useState<string>("");

    // Expose small imperative API for external prefill
    React.useImperativeHandle(ref, () => ({
        setBodyData: (data: any) => setBodyData(data),
        setPathParam: (name: string, value: string) =>
            setParams((s) => ({...s, [name]: value})),
        setAll: ({params: p, body}) => {
            if (p) setParams((s) => ({...s, ...p}));
            if (body !== undefined) setBodyData(body);
        },
    }), []);

    // Load spec + op + path params + body schema
    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setErr("");
                setSchema(undefined);
                setOp(undefined);
                setPathParamNames([]);
                setParams({});

                setLastResult(undefined);
                setLastContentType("");

                const spec = await getSpec();
                const paths = spec.paths || {};

                // Try exact / trim-slash / add-slash
                const candidates = [
                    path,
                    path.replace(/\/$/, ""),
                    path.replace(/\/?$/, "/"),
                ];

                let foundOp: any;
                let foundKey: string | undefined;

                for (const p of candidates) {
                    if (paths[p]?.[method]) {
                        foundOp = paths[p][method];
                        foundKey = p;
                        break;
                    }
                }

                // Fallback: template match
                if (!foundOp) {
                    for (const key of Object.keys(paths)) {
                        const rx = new RegExp(
                            "^" + key.replace(/\{[^}]+\}/g, "[^/]+") + "$"
                        );
                        if (rx.test(path) && paths[key]?.[method]) {
                            foundOp = paths[key][method];
                            foundKey = key;
                            break;
                        }
                    }
                }

                if (!foundOp) {
                    throw new Error(`No operation for ${method.toUpperCase()} ${path}`);
                }

                // Path params from doc, fallback to template; de-dupe keep doc order
                const docParams: string[] = (foundOp.parameters ?? [])
                    .filter((p: any) => p.in === "path")
                    .map((p: any) => p.name as string);

                const tplParams = extractTemplateKeys(foundKey ?? path);
                const names = Array.from(new Set([...docParams, ...tplParams]));

                const initValues: Record<string, string> = {};
                names.forEach((n) => (initValues[n] = ""));

                // Request body schema (if any)
                const bodySchema =
                    getRequestSchema(spec, foundKey ?? path, method) ??
                    pickJson(foundOp.requestBody?.content);

                if (!cancelled) {
                    setOp(foundOp);
                    setPathParamNames(names);
                    setParams(initValues);
                    setSchema(bodySchema);
                    // keep any provided initialData; only reset if we changed endpoints
                    if (initialData !== undefined) setBodyData(initialData);
                }
            } catch (e: any) {
                if (!cancelled) setErr(e.message || String(e));
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [path, method, initialData]);

    if (err) {
        return (
            <pre style={{color: "crimson", whiteSpace: "pre-wrap"}}>{err}</pre>
        );
    }
    if (!op) return <p>Loading…</p>;

    async function doSubmit(body: any | undefined) {
        let url: string;
        try {
            url = BASE + resolvePathOrThrow(path, params);
        } catch (e: any) {
            setErr(e.message || String(e));
            return;
        }

        setSubmitting(true);
        try {
            const upper = method.toUpperCase();
            const hasBody =
                !!body && upper !== "GET" && upper !== "DELETE" && upper !== "HEAD";

            const res = await fetch(url, {
                method: upper,
                headers: {
                    ...(hasBody ? {"Content-Type": "application/json"} : {}),
                    Accept: "application/json",
                },
                body: hasBody ? JSON.stringify(body) : undefined,
            });

            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(text || `${res.status} ${res.statusText}`);
            }

            const ct = res.headers.get("content-type") || "";
            const data = ct.includes("application/json")
                ? await res.json()
                : await res.text();

            setLastContentType(ct);
            setLastResult(data);
            onSuccess?.(data);
        } catch (e: any) {
            setErr(e.message || String(e));
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div style={{display: "grid", gap: 12, minWidth: 0}}>
            {/* Path params (e.g., {id}) */}
            {pathParamNames.length > 0 && (
                <div style={{display: "grid", gap: 8}}>
                    {pathParamNames.map((name: string) => (
                        <label key={name} style={{display: "grid", gap: 4}}>
                            <span style={{opacity: 0.8}}>{name} *</span>
                            <input
                                value={params[name] ?? ""}
                                onChange={(e) =>
                                    setParams((s) => ({...s, [name]: e.target.value}))
                                }
                                required
                            />
                        </label>
                    ))}
                </div>
            )}

            {/* If no requestBody, render a simple submit button; else RJSF form */}
            {!schema ? (
                <button disabled={submitting} onClick={() => doSubmit(undefined)}>
                    {submitting ? "Submitting…" : "Submit"}
                </button>
            ) : (
                <Form
                    schema={schema}
                    uiSchema={uiSchema}
                    formData={bodyData}
                    validator={validator}
                    onChange={(e) => setBodyData(e.formData)}
                    onSubmit={async ({formData}) => {
                        await doSubmit(formData);
                    }}
                >
                    <button type="submit" disabled={submitting}>
                        {submitting ? "Submitting…" : "Submit"}
                    </button>
                </Form>
            )}

            {lastResult !== undefined && (
                <div style={{display: "grid", gap: 8}}>
                    <div style={{fontSize: 12, opacity: 0.7}}>
                        Response{lastContentType ? ` · ${lastContentType}` : ""}
                    </div>
                    <pre style={{background: '#f6f8fa', padding: 8, borderRadius: 6, overflow: 'auto'}}>
                      {typeof lastResult === 'string'
                          ? lastResult
                          : JSON.stringify(lastResult, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
});

export default OpenApiForm;
