// src/App.tsx
import * as React from "react";
import OpenApiForm from "./openApiForm";
import FetchCard from "./FetchCard";
import { discoverResources } from "./discover";

const BASE_API_PREFIX = import.meta.env.VITE_API_URL || ""; // change if your base changes
const DISCOVERY_PREFIX = (import.meta as any).env?.VITE_DISCOVERY_PREFIX ?? "";
console.log("DISCOVERY_PREFIX =", DISCOVERY_PREFIX);


// ---- Types you want to import elsewhere ----
type Paths = {
    listPath?: string;
    idPath?: string;
    submitPath?: string;  // POST create
    editPath?: string;    // PUT/PATCH update
    deletePath?: string;
};

type ResourceDef = {
    name: string;
    title: string;
    paths: Paths;
    ops?: {
        list?: any;
        getById?: any;
        create?: any;
        edit?: any;
        delete?: any;
    };
};

type UiOverrides = Record<string, { create?: any; edit?: any }>;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section style={{ display: "grid", gap: 12 }}>
            <h2 style={{ margin: 0 }}>{title}</h2>
            {children}
        </section>
    );
}

// Row3: simple container
function Row3({ children }: { children: React.ReactNode }) {
    return <div className="row3">{children}</div>;
}

// Card with variant
function Card({
                  title,
                  variant = "form", // "form" | "table"
                  children,
              }: {
    title: string;
    variant?: "form" | "table";
    children: React.ReactNode;
}) {
    return (
        <div className={`card ${variant === "table" ? "card--table" : "card--form"}`}>
            <div>{title}</div>
            {children}
        </div>
    );
}

// Optional: small per-resource UI tweaks for RJSF
const UI_OVERRIDES: UiOverrides = {
    street: {
        create: {
            "ui:title": "Create Street",
            "ui:order": ["name", "zip", "*"],
            zip: { "ui:widget": "text" },
        },
        edit: {
            "ui:title": "Edit Street",
            "ui:order": ["name", "zip", "*"],
        },
    },
    // sign: { create: {...}, edit: {...} },
    // xsection: { create: {...}, edit: {...} },
};

function ResourceSection({ r }: { r: ResourceDef }) {
    const editRef = React.useRef<{ setAll: (x: { params?: any; body?: any }) => void } | null>(null);

    return (
        <Section title={r.title}>
            <Row3>
                {/* Fetch / list */}
                {(r.paths.idPath || r.paths.listPath) && (
                    <Card title="Fetch" variant="table">
                        <FetchCard
                            title={`Fetch ${r.title}(s)`}
                            idPath={r.paths.idPath ?? `${BASE_API_PREFIX}/${r.name}/{id}`}
                            idMethod="get"
                            listPath={r.paths.listPath ?? `${BASE_API_PREFIX}/${r.name}`}
                            listOp={r.ops?.list}
                            deletePath={r.paths.deletePath}
                            onPick={(row) => {
                                // Prefill Edit: set {id} param and body
                                if (row?.id && editRef.current) {
                                    editRef.current.setAll({
                                        params: { id: String(row.id) },
                                        body: row,
                                    });
                                }
                            }}
                        />
                    </Card>
                )}

                {/* Create */}
                {r.paths.submitPath && (
                    <Card title="Create" variant="form">
                        <OpenApiForm
                            path={r.paths.submitPath}
                            method="post"
                            uiSchema={UI_OVERRIDES[r.name]?.create}
                            onSuccess={() => {
                                // Optionally refresh list after create (if you want)
                                // You could expose a ref API on FetchCard to trigger refetch.
                            }}
                        />
                    </Card>
                )}

                {/* Edit */}
                {r.paths.editPath && (
                    <Card title="Edit" variant="form">
                        <OpenApiForm
                            ref={editRef as any}
                            path={r.paths.editPath}
                            method="put"
                            uiSchema={UI_OVERRIDES[r.name]?.edit}
                        />
                    </Card>
                )}
            </Row3>
        </Section>
    );
}

export default function App() {
    const [resources, setResources] = React.useState<ResourceDef[] | null>(null);
    const [err, setErr] = React.useState<string>("");

    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setErr("");

                // Run your existing discovery (pass the prefix if your helper accepts it)
                const raw = await discoverResources(DISCOVERY_PREFIX);
                console.table(raw.map(r => ({
                    name: r.name,
                    list: r.paths.listPath,
                    id: r.paths.idPath,
                    create: r.paths.submitPath,
                    edit: r.paths.editPath,
                    del: r.paths.deletePath
                })));

                // Gate 1: keep only resources whose discovered paths live under the prefix
                const prefix = DISCOVERY_PREFIX.replace(/\/+$/, ""); // trim trailing /
                const keepByPrefix = (r: any) => {
                    if (!prefix) return true; // allow all when empty (e.g., Spring)
                    const paths = Object.values(r?.paths || {}) as (string | undefined)[];
                    return paths.some(
                        (p) => typeof p === "string" && (p === prefix || p.startsWith(prefix + "/"))
                    );
                };

                // Gate 2: keep only resources whose list/get-by-id returns JSON
                const hasJson = (r: any) => {
                    const c =
                        r?.ops?.list?.responses?.["200"]?.content ??
                        r?.ops?.list?.responses?.["201"]?.content ??
                        r?.ops?.getById?.responses?.["200"]?.content ??
                        r?.ops?.getById?.responses?.["201"]?.content;
                    return !!(c?.["application/json"] || c?.["*/*"]);
                };

                // Optional: drop obvious junk names
                const notJunkName = (r: any) => !/^(assets?|favicon\.ico|root)$/i.test(r?.name ?? "");

                const filtered = raw.filter(keepByPrefix).filter(hasJson).filter(notJunkName);

                if (!cancelled) setResources(filtered);
                console.log("resources:", filtered.map((r: any) => r.name));
            } catch (e: any) {
                if (!cancelled) setErr(e.message || String(e));
            }
        })();
        return () => { cancelled = true; };
    }, [DISCOVERY_PREFIX]);

    if (err) return <pre style={{ color: "crimson", whiteSpace: "pre-wrap" }}>{err}</pre>;
    if (!resources) return <p>Loading…</p>;
    if (resources.length === 0) return <p>No resources discovered under {BASE_API_PREFIX}.</p>;

    return (
        <div style={{ display: "grid", gap: 28, padding: 16 }}>
            {resources.map((r) => <ResourceSection key={r.name} r={r} />)}
        </div>
    );
}
