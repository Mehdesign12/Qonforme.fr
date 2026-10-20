// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest"
import { downloadPdf, PdfDownloadError } from "@/lib/utils/download-pdf"

const pdf = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n")
function mockFetch(body: Uint8Array, ok = true) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok, arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) })))
  URL.createObjectURL = vi.fn(() => "blob:x")
  URL.revokeObjectURL = vi.fn()
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe("downloadPdf", () => {
  it("télécharge un vrai PDF et libère l'adresse plus tard", async () => {
    vi.useFakeTimers()
    mockFetch(pdf)
    await downloadPdf("/api/x", "d.pdf")
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    vi.advanceTimersByTime(60_000)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:x")
  })
  it("refuse une réponse qui n'est pas un PDF", async () => {
    mockFetch(new TextEncoder().encode("<html>connexion</html>"))
    await expect(downloadPdf("/api/x", "d.pdf")).rejects.toBeInstanceOf(PdfDownloadError)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })
  it("refuse une erreur serveur", async () => {
    mockFetch(pdf, false)
    await expect(downloadPdf("/api/x", "d.pdf")).rejects.toBeInstanceOf(PdfDownloadError)
  })
})
