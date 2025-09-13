// discover.ts
import { getSpec } from "./openapi";

const isParam = (s: string) => s.startsWith("{") && s.endsWith("}");

function stripPrefixSegments(path: string, prefix = ""): string[] {
    const segs = path.split("/").filter(Boolean);
    if (!prefix) return segs;
    const pre = prefix.split("/").filter(Boolean);
    let i = 0;
    while (i < pre.length && i < segs.length && pre[i] === segs[i]) i++;
    return segs.slice(i);
}

function pickResourceName(segments: string[]): { name: string; idx: number } {
    for (let i = segments.length - 1; i >= 0; i--) {
        if (!isParam(segments[i])) return { name: segments[i], idx: i };
    }
    return { name: "root", idx: -1 };
}

function hasIdAfterResource(segments: string[], resourceIdx: number): boolean {
    for (let i = resourceIdx + 1; i < segments.length; i++) {
        if (isParam(segments[i])) return true;
    }
    return false;
}

function isAtResourceBase(segments: string[], resourceIdx: number): boolean {
    return resourceIdx >= 0 && resourceIdx === segments.length - 1;
}

export async function discoverResources(prefix = "") {
    const spec = await getSpec();
    const byName = new Map<string, any>();

    for (const [path, rawOps] of Object.entries(spec?.paths ?? {})) {
        const segs = stripPrefixSegments(path, prefix);
        if (!segs.length) continue;

        const { name, idx } = pickResourceName(segs);
        const idAfter = hasIdAfterResource(segs, idx);
        const atBase = isAtResourceBase(segs, idx);

        const res = byName.get(name) ?? { name, title: name[0]?.toUpperCase() + name.slice(1), paths: {}, ops: {} };
        byName.set(name, res);

        for (const [m, op] of Object.entries(rawOps as Record<string, any>)) {
            const method = m.toLowerCase();
            if (method === "get" && idAfter) { res.paths.idPath = path; res.ops.getById = op; }
            else if (method === "get" && atBase) { res.paths.listPath = path; res.ops.list = op; }
            else if (method === "post" && atBase) { res.paths.submitPath = path; res.ops.create = op; }
            else if ((method === "put" || method === "patch") && idAfter) { res.paths.editPath = path; res.ops.edit = op; }
            else if (method === "delete" && idAfter) { res.paths.deletePath = path; res.ops.delete = op; }
        }
    }

    // Safety: drop accidental "{id}" resources if any slip through
    return Array.from(byName.values()).filter(r => !isParam(r.name) && (
        r.paths.listPath || r.paths.idPath || r.paths.submitPath || r.paths.editPath || r.paths.deletePath
    ));
}
