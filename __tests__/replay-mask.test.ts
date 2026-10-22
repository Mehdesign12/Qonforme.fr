// @vitest-environment happy-dom
/**
 * Enregistrement des sessions (22/10/2026) : dans l'application, aucun texte de
 * donnée (client, montant, numéro) ne doit partir en clair ; seuls les libellés
 * d'interface restent lisibles. Les pages publiques de la liste blanche sont en clair.
 */
import { describe, expect, it } from "vitest"
import { maskReplayText, REPLAY_CLEAR_TEXT_PATHS, SESSION_RECORDING_CONFIG } from "@/lib/replay"

function el(html: string): Element {
  const root = document.createElement("div")
  root.innerHTML = html
  return root.firstElementChild!.querySelector("[data-t]") ?? root.firstElementChild!
}

describe("maskReplayText", () => {
  it("laisse le texte en clair sur les pages publiques de la liste blanche", () => {
    for (const path of ["/", "/blog/un-article", "/pricing", "/demo/invoices", "/login", "/signup", "/guide/tva-travaux"]) {
      expect(maskReplayText("Dupont 1 234,50 €", el("<p data-t>x</p>"), path)).toBe("Dupont 1 234,50 €")
    }
  })

  it("masque tout texte hors liste blanche, y compris une route inconnue", () => {
    for (const path of ["/dashboard", "/invoices/abc", "/clients", "/settings/company", "/nouvelle-route"]) {
      expect(maskReplayText("Dupont Bâtiment", el("<p data-t>x</p>"), path)).toBe("****** ********")
    }
  })

  it("garde les espaces pour que la mise en page reste lisible", () => {
    expect(maskReplayText("a b", el("<p data-t>x</p>"), "/dashboard")).toBe("* *")
  })

  it("garde les libellés d'interface sans chiffre dans l'application", () => {
    expect(maskReplayText("Enregistrer le brouillon", el("<button data-t>x</button>"), "/invoices/new")).toBe("Enregistrer le brouillon")
    expect(maskReplayText("Client", el("<label data-t>x</label>"), "/invoices/new")).toBe("Client")
    expect(maskReplayText("Montant", el("<table><thead><tr><th data-t>x</th></tr></thead></table>"), "/invoices")).toBe("Montant")
  })

  it("masque un libellé qui contient un chiffre ou qui est trop long", () => {
    expect(maskReplayText("Payer 24 €", el("<button data-t>x</button>"), "/settings/billing")).toBe("***** ** *")
    expect(maskReplayText("x".repeat(31), el("<button data-t>x</button>"), "/invoices")).toBe("*".repeat(31))
  })

  it("masque un bouton qui ouvre une liste (sélecteur de client, menu du compte)", () => {
    expect(maskReplayText("Dupont", el("<button aria-haspopup='listbox' data-t>x</button>"), "/invoices/new")).toBe("******")
    expect(maskReplayText("Dupont", el("<button role='combobox' data-t>x</button>"), "/invoices/new")).toBe("******")
  })

  it("laisse lisible un bloc marqué data-replay-clear, sauf la donnée marquée data-replay-mask", () => {
    const root = document.createElement("div")
    root.innerHTML = "<div data-replay-clear><p id='a'>x</p><p>Votre facture <span data-replay-mask id='b'>F-2026-004</span></p></div>"
    expect(maskReplayText("Vos devis restent gratuits.", root.querySelector("#a"), "/invoices/abc")).toBe("Vos devis restent gratuits.")
    expect(maskReplayText("F-2026-004", root.querySelector("#b"), "/invoices/abc")).toBe("**********")
  })

  it("masque le texte sans élément connu", () => {
    expect(maskReplayText("Dupont", undefined, "/dashboard")).toBe("******")
  })
})

describe("réglages de l'enregistrement", () => {
  it("masque tous les champs de saisie", () => {
    expect(SESSION_RECORDING_CONFIG.maskAllInputs).toBe(true)
    expect(SESSION_RECORDING_CONFIG.maskTextFn).toBe(maskReplayText)
  })

  it("ne met pas en clair les routes de l'application", () => {
    for (const path of ["/dashboard", "/invoices", "/quotes", "/clients", "/products", "/credit-notes", "/purchase-orders",
      "/settings", "/chantiers", "/relances", "/tresorerie", "/received-invoices", "/comptable", "/demarrer"]) {
      expect(REPLAY_CLEAR_TEXT_PATHS.test(path)).toBe(false)
    }
  })
})
