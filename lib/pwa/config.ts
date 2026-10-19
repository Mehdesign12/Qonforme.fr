/**
 * Invite « Installer Qonforme » (components/pwa/InstallPrompt.tsx).
 *
 * Désactivée partout sur décision du fondateur (19/10/2026) : sur téléphone elle
 * recouvrait les formulaires et le bandeau de cookies. L'application reste
 * installable depuis le menu du navigateur (manifest et service worker inchangés).
 * Repasser à `true` l'affiche de nouveau, sur le tableau de bord seulement.
 */
export const INSTALL_PROMPT_ENABLED = false
