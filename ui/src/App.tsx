// src/App.tsx
import * as React from "react";
import FetchCard from "./FetchCard";
import OpenApiForm, {type OpenApiFormHandle} from "./openApiForm";

const BASE = "/api/streetscout";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section style={{ display: "grid", gap: 12 }}>
            <h2 style={{ margin: 0 }}>{title}</h2>
            {children}
        </section>
    );
}

export default function App() {
    const streetEditRef = React.useRef<OpenApiFormHandle>(null);
    const signEditRef = React.useRef<OpenApiFormHandle>(null);
    const xsecnEditRef = React.useRef<OpenApiFormHandle>(null);
    return (
        <div style={{ display: "grid", gap: 28, padding: 16 }}>
            {/* ========== Street (stack 1) ========== */}
            <Section title="Street">
                <div className="rowFetch3">
                    <FetchCard
                        title="Fetch Street(s)"
                        idPath={`${BASE}/street/{id}`}
                        listPath={`${BASE}/street`}
                        deletePath={`${BASE}/street/delete/{id}`}
                        onPick={(row) => {
                            if (row?.id) streetEditRef.current?.setAll({ params: { id: String(row.id) }, body: row });
                        }}
                    />

                    <div className="card">
                        <div style={{ fontWeight: 600, opacity: 0.9 }}>Create Street</div>
                        <OpenApiForm method="post" path={`${BASE}/street/submit`} />
                    </div>

                    <div className="card">
                        <div style={{ fontWeight: 600, opacity: 0.9 }}>Edit Street</div>
                        <OpenApiForm ref={streetEditRef} method="put" path={`${BASE}/street/edit/{id}`} />
                    </div>
                </div>
            </Section>

            {/* ========== Street Sign (stack 2) ========== */}
            <Section title="Street Sign">
                <div className="rowFetch3">
                    <FetchCard
                        title="Fetch Street Sign(s)"
                        idPath={`${BASE}/sign/{id}`}
                        listPath={`${BASE}/sign`}
                        deletePath={`${BASE}/sign/delete/{id}`}
                        onPick={(row) => {
                            if (row?.id) signEditRef.current?.setAll({ params: { id: String(row.id) }, body: row });
                        }}
                    />

                    <div className="card">
                        <div style={{ fontWeight: 600, opacity: 0.9 }}>Create Sign</div>
                        <OpenApiForm method="post" path={`${BASE}/sign/submit`} />
                    </div>
                    <div className="card">
                        <div style={{ fontWeight: 600, opacity: 0.9 }}>Edit Sign</div>
                        <OpenApiForm ref={signEditRef} method="put" path={`${BASE}/sign/edit/{id}`} />
                    </div>
                </div>
            </Section>


            {/* ========== Street Sign (stack 2) ========== */}
            <Section title="Street Intersection">
                <div className="rowFetch3">
                    <FetchCard
                        title="Fetch Street Intersection(s)"
                        idPath={`${BASE}/xsection/{id}`}
                        listPath={`${BASE}/xsection`}
                        deletePath={`${BASE}/xsection/delete/{id}`}
                        onPick={(row) => {
                            if (row?.id) xsecnEditRef.current?.setAll({ params: { id: String(row.id) }, body: row });
                        }}
                    />

                    <div className="card">
                        <div style={{ fontWeight: 600, opacity: 0.9 }}>Create Intersection</div>
                        <OpenApiForm method="post" path={`${BASE}/xsection/submit`} />
                    </div>
                    <div className="card">
                        <div style={{ fontWeight: 600, opacity: 0.9 }}>Edit Intersection</div>
                        <OpenApiForm ref={xsecnEditRef} method="put" path={`${BASE}/xsection/edit/{id}`} />
                    </div>
                </div>
            </Section>
        </div>
    );
}
