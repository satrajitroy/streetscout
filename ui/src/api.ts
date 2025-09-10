const BASE = import.meta.env.VITE_API_URL ?? '' // use Vite proxy in dev

async function handle<T = any>(res: Response): Promise<T> {
    if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`${res.status} ${res.statusText} ${text}`.trim())
    }
    // Your Ktor handlers often return plain text; sniff content-type
    const ct = res.headers.get('content-type') || ''
    if (res.status === 204) return null as T
    if (ct.includes('application/json')) return res.json()
    return (await res.text()) as T
}

// ---- Streets ----
export const fetchStreet = (id: string) =>
    fetch(`${BASE}/api/streetscout/street/${encodeURIComponent(id)}`).then(handle)

export const submitStreet = (payload: any) =>
    fetch(`${BASE}/api/streetscout/street/submit`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
    }).then(handle)

export const editStreet = (id: string, payload: any) =>
    fetch(`${BASE}/api/streetscout/street/edit/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    }).then(handle)

export const deleteStreet = (id: string) =>
    fetch(`${BASE}/api/streetscout/street/delete/${encodeURIComponent(id)}`, {method: 'DELETE'}).then(handle)

// ---- Signs ----
export const fetchSign = (id: string) =>
    fetch(`${BASE}/api/streetscout/sign/${encodeURIComponent(id)}`).then(handle)

export const submitSign = (payload: any) =>
    fetch(`${BASE}/api/streetscout/sign/submit`, {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
    }).then(handle)

export const editSign = (id: string, payload: any) =>
    fetch(`${BASE}/api/streetscout/sign/edit/${encodeURIComponent(id)}`, {
        method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
    }).then(handle)

export const deleteSign = (id: string) =>
    fetch(`${BASE}/api/streetscout/sign/delete/${encodeURIComponent(id)}`, {method: 'DELETE'}).then(handle)

// ---- Intersections ----
export const fetchXsection = (id: string) =>
    fetch(`${BASE}/api/streetscout/xsection/${encodeURIComponent(id)}`).then(handle)

export const submitXsection = (payload: any) =>
    fetch(`${BASE}/api/streetscout/xsection/submit`, {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
    }).then(handle)

export const editXsection = (id: string, payload: any) =>
    fetch(`${BASE}/api/streetscout/xsection/edit/${encodeURIComponent(id)}`, {
        method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
    }).then(handle)

export const deleteXsection = (id: string) =>
    fetch(`${BASE}/api/streetscout/xsection/delete/${encodeURIComponent(id)}`, {method: 'DELETE'}).then(handle)
