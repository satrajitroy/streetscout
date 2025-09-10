// openapi.ts
export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete'
const BASE = import.meta.env.VITE_API_URL ?? ''

let cachedSpec: any

export async function getSpec(): Promise<any> {
    if (cachedSpec) return cachedSpec
    const res = await fetch(`${BASE}/api.json`)
    if (!res.ok) throw new Error(`Failed to load OpenAPI: ${res.status}`)
    cachedSpec = await res.json()
    return cachedSpec
}

function pickJson(content?: Record<string, any>) {
    if (!content) return
    const k = Object.keys(content).find(x => x.toLowerCase().includes('json')) ?? Object.keys(content)[0]
    return k ? content[k]?.schema : undefined
}

// ---- transforms ----
function rewriteRefs(n: any): any {
    if (!n || typeof n !== 'object') return n
    if (typeof n.$ref === 'string' && n.$ref.startsWith('#/components/schemas/')) {
        return {...n, $ref: n.$ref.replace('#/components/schemas/', '#/$defs/')}
    }
    if (Array.isArray(n)) return n.map(rewriteRefs)
    const out: any = {};
    for (const [k, v] of Object.entries(n)) out[k] = rewriteRefs(v);
    return out
}

function resolveLocalRef(n: any, defs: Record<string, any>) {
    if (n && typeof n === 'object' && typeof n.$ref === 'string' && n.$ref.startsWith('#/$defs/')) {
        const key = n.$ref.slice('#/$defs/'.length)
        return defs[key] ?? n
    }
    return n
}

// collapse oneOf/anyOf of enums/consts to a simple enum **without null**
function collapseToEnum(n: any, defs: Record<string, any>): any {
    if (!n || typeof n !== 'object') return n
    const r = resolveLocalRef(n, defs);
    if (r !== n) return collapseToEnum(r, defs)

    const extract = (alt: any): any[] | null => {
        const u = resolveLocalRef(alt, defs)
        if (Array.isArray(u?.enum)) return u.enum
        if (Object.prototype.hasOwnProperty.call(u ?? {}, 'const')) return [u.const]
        if (u?.type === 'null') return [null]
        return null
    }
    const maybeCollapse = (alts?: any[]) => {
        if (!Array.isArray(alts)) return null
        const lists = alts.map(extract)
        if (lists.some(x => x == null)) return null
        const vals = lists.flat().filter(v => v !== null)     // <- drop null
        if (vals.length === 0) return {type: 'string', enum: []}
        if (!vals.every(v => typeof v === 'string')) return null
        return {type: 'string', enum: vals}
    }

    const c1 = maybeCollapse(n.oneOf);
    if (c1) return c1
    const c2 = maybeCollapse(n.anyOf);
    if (c2) return c2

    if (Array.isArray(n)) return n.map(x => collapseToEnum(x, defs))
    const out: any = {};
    for (const [k, v] of Object.entries(n)) out[k] = collapseToEnum(v, defs);
    return out
}

// remove generic/noisy titles so fields are labeled by **key**, not “String/Int/…”
const BAD_TITLE = /^(String|Int|Double|Boolean|Long|Array|Object|LinkedHashMap.*|LinkedHashSet.*|java\..*|kotlin\..*|Street)$/i

function stripNoisyTitles(n: any): any {
    if (!n || typeof n !== 'object') return n
    if (Array.isArray(n)) return n.map(stripNoisyTitles)
    const out: any = {}
    for (const [k, v] of Object.entries(n)) {
        let nv: any = stripNoisyTitles(v)
        if (nv && typeof nv === 'object' && typeof nv.title === 'string' && BAD_TITLE.test(nv.title)) {
            const {title, ...rest} = nv;
            nv = rest
        }
        out[k] = nv
    }
    return out
}

// hide server-only props
function pruneProps(schema: any, remove: string[]): any {
    if (!schema || typeof schema !== 'object') return schema
    if (Array.isArray(schema)) return schema.map(s => pruneProps(s, remove))
    const out: any = {}
    for (const [k, v] of Object.entries(schema)) {
        if (k === 'properties' && v && typeof v === 'object' && !Array.isArray(v)) {
            const props: any = {}
            for (const [pk, pv] of Object.entries(v as any)) {
                if (!remove.includes(pk)) props[pk] = pruneProps(pv, remove)
            }
            out[k] = props
        } else out[k] = pruneProps(v, remove)
    }
    return out
}

export function getRequestSchema(spec: any, path: string, method: HttpMethod) {
    const op = spec.paths?.[path]?.[method]
    const base0 = pickJson(op?.requestBody?.content)
    if (!base0) return

    // 1) rewrite refs everywhere
    const base = rewriteRefs(base0)
    const defs0 = spec.components?.schemas ?? {}
    const defs = Object.fromEntries(Object.entries(defs0).map(([k, v]) => [k, rewriteRefs(v)]))

    // 2) collapse enum unions to plain enums (no nulls)
    const cDefs = Object.fromEntries(Object.entries(defs).map(([k, v]) => [k, collapseToEnum(v, defs)]))
    let schema = collapseToEnum({$defs: cDefs, ...base}, cDefs)

    // 3) strip noisy titles & prune internal props
    schema = stripNoisyTitles(schema)
    schema = pruneProps(schema, ['segments', 'signs', 'intersections', 'timestamp'])

    return schema
}

/** Resolve a local $ref like "#/components/schemas/X" */
function deref(schema: any, spec: any): any {
    if (!schema) return schema;
    if (schema.$ref) {
        const parts = schema.$ref.replace(/^#\//, "").split("/");
        let cur: any = spec;
        for (const p of parts) cur = cur?.[p];
        return deref(cur, spec);
    }
    if (Array.isArray(schema.allOf)) {
        // naive merge of allOf objects' properties
        const merged: any = { ...schema };
        for (const s of schema.allOf) {
            const d = deref(s, spec);
            if (d?.properties) {
                merged.properties = { ...(merged.properties ?? {}), ...d.properties };
            }
        }
        return merged;
    }
    return schema;
}

/** Get the 200 JSON response schema for a path+method (deref'd). */
export function getResponseSchema(spec: any, path: string, method: HttpMethod, status = 200) {
    const op = spec?.paths?.[path]?.[method];
    if (!op) return undefined;
    const resp = op.responses?.[String(status)] ?? op.responses?.default;
    if (!resp?.content) return undefined;
    const key = Object.keys(resp.content).find(k => k.toLowerCase().includes("json")) ?? Object.keys(resp.content)[0];
    if (!key) return undefined;
    return deref(resp.content[key]?.schema, spec);
}

/** Convenience wrapper: fetch spec then read response schema */
export async function getResponseSchemaFor(path: string, method: HttpMethod, status = 200) {
    const spec = await getSpec();
    return getResponseSchema(spec, path, method, status);
}

