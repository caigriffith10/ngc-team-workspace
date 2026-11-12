export const SHEET_HOSTS = ["google.com", "www.google.com", "docs.google.com", "sheets.google.com"]

export const isHttps = (u: string) => { try { return new URL(u).protocol === "https:" } catch { return false } }
/** The spreadsheet link is fetched by the server, so only Google hosts are allowed. */
export const isSheetUrl = (u: string) => { try { const x = new URL(u); return x.protocol === "https:" && SHEET_HOSTS.includes(x.hostname) } catch { return false } }
