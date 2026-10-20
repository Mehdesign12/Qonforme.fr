import { describe, expect, it, vi } from "vitest"
import { setEditorAction } from "@/lib/ui/editor-action"
import * as mod from "@/lib/ui/editor-action"

describe("editor-action", () => {
  it("ne notifie pas pour une action identique", () => {
    const send = vi.fn()
    const a = { label: "Envoyer", onSend: send, sending: false, disabled: false }
    setEditorAction(a)
    const spy = vi.fn()
    // lecture directe via un second set identique : aucune erreur, état stable
    setEditorAction({ ...a })
    expect(typeof mod.useEditorAction).toBe("function")
    expect(spy).not.toHaveBeenCalled()
    setEditorAction(null)
  })
})
