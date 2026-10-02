// TEMPORAIRE — aperçu de la mise en page d'un article sans Supabase. À supprimer.
import ArticleView from "@/components/blog/ArticleView"
import { markdownToHtml } from "@/lib/markdown"
import { autoLinkPseo } from "@/lib/blog-autolink"
import { extractHeadings } from "@/lib/blog-utils"

const MD = `Depuis le 1er septembre 2026, les grandes entreprises doivent pouvoir recevoir des factures électroniques. Pour un artisan, la question n'est plus de savoir si la réforme le concerne, mais quand et comment s'y préparer sans perdre de temps.

## Ce qui change pour les artisans

La facture papier ou le simple PDF envoyé par email ne suffiront plus pour les **clients professionnels**. Les factures devront transiter par une plateforme agréée, au format structuré.

- Réception obligatoire pour toutes les entreprises dès 2026
- Émission obligatoire pour les TPE à partir du 1er septembre 2027
- Les ventes aux particuliers restent hors du champ

### Les mentions obligatoires restent les mêmes

Numéro de facture, SIREN, TVA, date d'échéance : rien ne disparaît. Consultez notre guide des mentions obligatoires sur une facture.

> Une facture émise ne se modifie ni ne se supprime : toute erreur se corrige par un avoir.

## Comment s'y préparer

1. Vérifiez votre numéro SIREN et votre adresse de facturation
2. Choisissez un outil qui numérote vos factures sans trou
3. Gardez vos devis signés : ils valent commande

Le code \`F-2026-0142\` illustre une numérotation continue.

---

## Questions à se poser

### Dois-je changer de logiciel ?

Pas forcément. L'important est que votre outil sache produire le bon format.
`

export default function Page() {
  const html = autoLinkPseo(markdownToHtml(MD))
  return (
    <ArticleView
      post={{ slug: "apercu", title: "Facture électronique 2026 : ce qui change vraiment pour les artisans du bâtiment", excerpt: "Calendrier, obligations et mentions : l'essentiel de la réforme pour facturer vos chantiers sereinement.", cover_url: "/landing/photos/peintre-renovation.webp", published_at: "2026-09-28T08:00:00Z" }}
      category="réglementation"
      readingTime={6}
      keywords={["facture électronique", "réforme 2026", "artisan"]}
      headings={extractHeadings(MD)}
      contentHtml={html}
      similar={[
        { slug: "a", title: "Devis de travaux : les mentions qui protègent l'artisan", excerpt: "Durée de validité, assurance décennale, conditions de paiement.", cover_url: null, published_at: "2026-09-20T08:00:00Z", category: "guide", readingTime: 5 },
        { slug: "b", title: "Relancer une facture impayée sans froisser le client", excerpt: "Les étapes et les délais légaux.", cover_url: "/landing/photos/artisan-client.webp", published_at: "2026-09-12T08:00:00Z", category: "pratique", readingTime: 4 },
        { slug: "c", title: "Autoliquidation de TVA dans la sous-traitance", excerpt: "Qui facture quoi, et avec quelle mention.", cover_url: null, published_at: "2026-09-02T08:00:00Z", category: "comptabilité", readingTime: 7 },
      ]}
      adjacent={{ prev: { slug: "p", title: "Délais de paiement : ce que dit la loi" }, next: { slug: "n", title: "Acompte ou situation de travaux : comment choisir" } }}
    />
  )
}
