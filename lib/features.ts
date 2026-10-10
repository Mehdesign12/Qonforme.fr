/**
 * Interrupteurs des fonctions qui dépendent d'une migration Supabase.
 *
 * Chaque push sur une branche claude/** est fusionné automatiquement dans main
 * (.github/workflows/auto-merge-claude.yml), donc déployé. Une page qui lit une
 * table pas encore créée en production casserait pour tous les utilisateurs :
 * elle reste masquée (navigation) et inaccessible (pages, API) tant que la
 * variable d'environnement correspondante n'est pas à "true" dans Vercel.
 *
 * Pour activer une fonction : appliquer sa migration (supabase/migrations/),
 * puis définir la variable dans Vercel → Settings → Environment Variables.
 */
export const FEATURES = {
  /** supabase/migrations/20261010_create_chantiers.sql */
  chantiers: process.env.NEXT_PUBLIC_FEATURE_CHANTIERS === "true",
} as const
