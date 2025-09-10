// src/discover.ts
import { getSpec } from "./openapi";
import type { HttpMethod } from "./openapi";

export type CrudPaths = {
    /** GET /{prefix}/{res}/{id} */
    idPath?: string;
    idMethod?: HttpMethod; // default "get"

    /** GET /{prefix}/{res}?page=&size= */
    listPath?: string;

    /** POST /{prefix}/{res}/submit */
    submitPath?: string;

    /** PUT /{prefix}/{res}/edit/{id} */
    editPath?: string;

    /** DELETE /{prefix}/{res}/delete/{id} */
    deletePath?: string;
};

export type ResourceDef = {
    name: string;     // "street", "sign", "xsection"
    title: string;    // "Street", "Sign", "Xsection" (humanized)
    paths: CrudPaths;
};

// Basic "Title Case"
function humanize(s: string) {
    if (!s) return s;
    return s
        .replace(/[_\-]+/g, " ")
        .replace(/\b\w/g, (m) => m.toUpperCase());
}

/**
 * Discover resources under a base prefix, e.g. "/api/streetscout".
 * Looks for the conventional routes:
 *  - GET    /{prefix}/{res}                 -> list
 *  - GET    /{prefix}/{res}/{id}            -> fetch by id
 *  - POST   /{prefix}/{res}/submit          -> create
 *  - PUT    /{prefix}/{res}/edit/{id}       -> update
 *  - DELETE /{prefix}/{res}/delete/{id}     -> delete
 */
export async function discoverResources(prefix = "/api/streetscout"): Promise<ResourceDef[]> {
    const spec = await getSpec();
    const paths = spec.paths || {};
    const out = new Map<string, ResourceDef>();

    const norm = (p: string) => p.replace(/\/+$/, ""); // trim trailing slash
    const base = norm(prefix);

    for (const rawPath of Object.keys(paths)) {
        const p = norm(rawPath);
        if (!p.startsWith(base + "/")) continue;

        // e.g. /api/streetscout/street/edit/{id}
        const segs = p.split("/").filter(Boolean);
        // [ "api", "streetscout", "<res>", ...rest ]
        if (segs.length < 3) continue;

        const res = segs[2];           // resource segment
        const tail = segs.slice(3);    // remainder

        const rec = out.get(res) ?? {
            name: res,
            title: humanize(res),
            paths: {}
        };

        const opObj = paths[rawPath] || paths[p] || {};
        const has = (m: string) => !!opObj[m];

        // Heuristics for conventional endpoints
        if (tail.length === 0 && has("get")) {
            rec.paths.listPath = p; // GET /{prefix}/{res}
        }
        if (tail.length === 1 && tail[0] === "{id}" && has("get")) {
            rec.paths.idPath = p;
            rec.paths.idMethod = "get";
        }
        if (tail.length === 1 && tail[0] === "submit" && has("post")) {
            rec.paths.submitPath = p;
        }
        if (tail.length === 2 && tail[0] === "edit" && tail[1] === "{id}" && has("put")) {
            rec.paths.editPath = p;
        }
        if (tail.length === 2 && tail[0] === "delete" && tail[1] === "{id}" && has("delete")) {
            rec.paths.deletePath = p;
        }

        out.set(res, rec);
    }

    // Only keep resources that have at least one meaningful path
    return Array.from(out.values()).filter(r => {
        const p = r.paths;
        return p.listPath || p.idPath || p.submitPath || p.editPath || p.deletePath;
    }).sort((a, b) => a.title.localeCompare(b.title));
}

/** Optional: per-resource small UI tweaks */
export type UiOverrides = Record<string, { create?: any; edit?: any }>;
