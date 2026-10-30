import { buildLlmsTxt } from "@/lib/seo/llms"

/* /llms.txt : résumé du site pour les assistants IA (contenu dans lib/seo/llms.ts). */

export const dynamic = "force-static"

export function GET() {
  return new Response(buildLlmsTxt(), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  })
}
