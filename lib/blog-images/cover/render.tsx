/**
 * Rendu de la couverture d'un article en PNG 1 600 × 900 (moteur d'images de
 * Next.js, satori : mise en page « flex », polices embarquées). L'image
 * passe ensuite par `storeBlogImage` (lib/blog-images/server.ts) : WebP,
 * métadonnées propres, stockage du blog.
 *
 * Même rendu pour un titre donné (icônes tirées d'une graine fixée par le titre).
 *
 * Serveur seulement (Node).
 */
import { ImageResponse } from "next/og"
import { LOGO_PNG_BASE64, SANS_FONT_BASE64, SERIF_FONT_BASE64 } from "@/lib/blog-images/cover/assets.generated"
import { pickCoverIcons, seedOf, type CoverFamily } from "@/lib/blog-images/cover/icons"
import { COVER_COLORS, COVER_HEIGHT, COVER_WIDTH, ICON_SLOTS, LOGO, TITLE_OFFSET_TOP, iconDataUri, layoutTitle, type TitleLayout } from "@/lib/blog-images/cover/layout"

const SANS_FAMILY = "Bricolage Grotesque"
const SERIF_FAMILY = "Instrument Serif"

export interface CoverInput {
  title: string
  keyword?: string | null
}

export interface CoverRender {
  png: Buffer
  family: CoverFamily
  layout: TitleLayout
}

const LOGO_URI = `data:image/png;base64,${LOGO_PNG_BASE64}`

/** Couverture en PNG. */
export async function renderCoverPng(input: CoverInput): Promise<CoverRender> {
  const title = input.title.trim()
  if (!title) throw new Error("Titre vide : pas de couverture à dessiner.")
  const layout = layoutTitle(title)
  const { family, icons } = pickCoverIcons({ title, keyword: input.keyword }, seedOf(title))
  const logoHeight = LOGO.height
  const logoWidth = Math.round(LOGO.height * LOGO.ratio)

  const element = (
    <div style={{ display: "flex", position: "relative", width: COVER_WIDTH, height: COVER_HEIGHT, background: COVER_COLORS.background }}>
      <div style={{ display: "flex", position: "absolute", left: 0, top: LOGO.top, width: COVER_WIDTH, justifyContent: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={LOGO_URI} width={logoWidth} height={logoHeight} />
      </div>
      {ICON_SLOTS.map((slot, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            position: "absolute",
            left: slot.left,
            top: slot.top,
            width: slot.size,
            height: slot.size,
            transform: `rotate(${slot.rotate}deg)`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img src={iconDataUri(icons[i], slot.size, slot.accent ? COVER_COLORS.blue : COVER_COLORS.soft)} width={slot.size} height={slot.size} />
        </div>
      ))}
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 0,
          top: 0,
          width: COVER_WIDTH,
          height: COVER_HEIGHT,
          paddingTop: TITLE_OFFSET_TOP,
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {layout.lines.map((line, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              whiteSpace: "nowrap",
              fontFamily: line.kind === "sans" ? SANS_FAMILY : SERIF_FAMILY,
              fontWeight: line.kind === "sans" ? 700 : 400,
              fontStyle: line.kind === "sans" ? "normal" : "italic",
              fontSize: line.size,
              lineHeight: `${line.height}px`,
              height: line.height,
              letterSpacing: line.letterSpacing,
              color: line.kind === "sans" ? COVER_COLORS.ink : COVER_COLORS.blue,
              // Un espace entre la voix en gras et la voix en italique
              marginTop: i > 0 && line.kind === "serif" && layout.lines[i - 1].kind === "sans" ? 12 : 0,
            }}
          >
            {line.text}
          </div>
        ))}
      </div>
    </div>
  )

  const response = new ImageResponse(element, {
    width: COVER_WIDTH,
    height: COVER_HEIGHT,
    fonts: [
      { name: SANS_FAMILY, data: Buffer.from(SANS_FONT_BASE64, "base64"), weight: 700, style: "normal" },
      { name: SERIF_FAMILY, data: Buffer.from(SERIF_FONT_BASE64, "base64"), weight: 400, style: "italic" },
    ],
  })
  const png = Buffer.from(await response.arrayBuffer())
  return { png, family, layout }
}
