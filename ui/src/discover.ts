// src/discover.ts
import { getSpec } from "./openapi";

/** Paths discovered for a resource */
export type Paths = {
    listPath?: string;    // GET /{resource}
    idPath?: string;      // GET /{resource}/{id}
    submitPath?: string;  // POST /{resource} or /{resource}/<any-suffix>
    editPath?: string;    // PUT/PATCH .../{id} (suffix allowed)
    deletePath?: string;  // DELETE .../{id} (suffix allowed)
};

/** Resource description returned to the UI */
export type ResourceDef = {
    name: string;   // e.g. "street", "sign", "xsection", "tasks"
    title: string;  // e.g. "Street"
    paths: Paths;
    ops?: {
        list?: any;
        getById?: any;
        create?: any;
        edit?: any;
        delete?: any;
    };
};

/** Kept for your imports in App.tsx, even if you don't use it here */
export type UiOverrides = Record<string, { create?: any; edit?: any }>;

const isParam = (s: string) => s.startsWith("{") && s.endsWith("}");
const split = (p: string) => p.split("/").filter(Boolean);

/** Return path segments after a given prefix (segment-aware). Empty array if not under prefix. */
function stripPrefix(path: string, prefix = ""): string[] {
    if (!prefix) return split(path);
    const segs = split(path);
    const pre = split(prefix);
    for (let i = 0; i < pre.length; i++) {
        if (segs[i] !== pre[i]) return [];
    }
    return segs.slice(pre.length);
}

/** Indices of non-parameter segments */
function nonParamIdxs(segs: string[]): number[] {
    const out: number[] = [];
    for (let i = 0; i < segs.length; i++) if (!isParam(segs[i])) out.push(i);
    return out;
}

/**
 * Choose the resource segment index from path + method, without knowing action names.
 * - For POST/PUT/PATCH/DELETE: if there are ≥2 non-param segments, treat the LAST one
 *   as an action-ish suffix and use the PREVIOUS non-param segment as the resource.
 * - Otherwise (GET or only one non-param): use the last non-param as the resource.
 */
function computeResourceIdx(segs: string[], method: string): number {
    const nps = nonParamIdxs(segs);
    if (nps.length === 0) return -1;
    const m = method.toLowerCase();
    if ((m === "post" || m === "put" || m === "patch" || m === "delete") && nps.length >= 2) {
        return nps[nps.length - 2];
    }
    return nps[nps.length - 1];
}

/** Is there a path parameter after the resource segment? (i.e., .../{id}) */
function hasParamAfter(segs: string[], idx: number): boolean {
    for (let i = idx + 1; i < segs.length; i++) if (isParam(segs[i])) return true;
    return false;
}

/** Prefer the "shorter" (more canonical) candidate path when multiple match. */
function prefer(existing?: string, candidate?: string): string | undefined {
    if (!existing) return candidate;
    if (!candidate) return existing;
    return candidate.length < existing.length ? candidate : existing;
}

/** Does an operation declare JSON-ish response content (used to drop favicon/assets)? */
function hasJsonContent(op: any): boolean {
    const res = op?.responses;
    if (!res) return false;
    for (const code of Object.keys(res)) {
        const content = res[code]?.content;
        if (!content) continue;
        if (content["application/json"] || content["*/*"] || content["text/plain"]) return true;
    }
    return false;
}

/** Keep resources that look like real APIs: list/id/create/edit have some JSON-ish response. */
function looksApiLike(r: ResourceDef): boolean {
    const ok =
        hasJsonContent(r.ops?.list) ||
        hasJsonContent(r.ops?.getById) ||
        hasJsonContent(r.ops?.create) ||
        hasJsonContent(r.ops?.edit) ||
        hasJsonContent(r.ops?.delete);
    const notJunkName = !/^(assets?|favicon\.ico|root)$/i.test(r.name);
    return ok && notJunkName;
}

/**
 * Discover resources and CRUD endpoints from the OpenAPI spec.
 * @param prefix only consider paths under this URL prefix (e.g., "/api/streetscout" or "/api")
 */
export async function discoverResources(prefix = ""): Promise<ResourceDef[]> {
    const spec = await getSpec();
    const pathsObj = (spec?.paths ?? {}) as Record<string, any>;
    const byName = new Map<string, ResourceDef>();

    for (const [path, rawOps] of Object.entries(pathsObj)) {
        const segs = stripPrefix(path, prefix);
        if (segs.length === 0) continue;

        const ops = rawOps ?? {};
        for (const [m, op] of Object.entries(ops as Record<string, any>)) {
            const method = m.toLowerCase();

            // Decide which segment is the resource for THIS (path, method)
            const resIdx = computeResourceIdx(segs, method);
            if (resIdx < 0) continue;
            const resourceName = segs[resIdx];
            if (!resourceName || isParam(resourceName)) continue;

            const res =
                byName.get(resourceName) ??
                {
                    name: resourceName,
                    title: resourceName.charAt(0).toUpperCase() + resourceName.slice(1),
                    paths: {},
                    ops: {},
                };
            byName.set(resourceName, res);

            const paramAfter = hasParamAfter(segs, resIdx);

            if (method === "get") {
                if (paramAfter) {
                    res.paths.idPath = prefer(res.paths.idPath, path);
                    res.ops!.getById = op;
                } else {
                    res.paths.listPath = prefer(res.paths.listPath, path);
                    res.ops!.list = op;
                }
                continue;
            }

            if (method === "post") {
                // create on collection or with any suffix; must NOT require id param after resource
                if (!paramAfter) {
                    res.paths.submitPath = prefer(res.paths.submitPath, path);
                    res.ops!.create = op;
                }
                continue;
            }

            if (method === "put" || method === "patch") {
                // update must identify a target (…/{id})
                if (paramAfter) {
                    res.paths.editPath = prefer(res.paths.editPath, path);
                    res.ops!.edit = op;
                }
                continue;
            }

            if (method === "delete") {
                // delete must identify a target (…/{id})
                if (paramAfter) {
                    res.paths.deletePath = prefer(res.paths.deletePath, path);
                    res.ops!.delete = op;
                }
                continue;
            }
        }
    }

    // Final filter & return
    return Array.from(byName.values())
        .filter(looksApiLike)
        .filter(
            (r) =>
                r.paths.listPath ||
                r.paths.idPath ||
                r.paths.submitPath ||
                r.paths.editPath ||
                r.paths.deletePath
        );
}
