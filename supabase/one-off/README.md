# Corrections de données ponctuelles (à lancer à la main dans Supabase › SQL Editor)

Ce dossier n'est **pas** celui des migrations : rien ici n'est appliqué automatiquement.
Chaque fichier est un correctif de données, à lancer une seule fois, avec ses étapes de vérification et de sauvegarde.

| Fichier | Rôle |
|---|---|
| `20261015_supprimer_articles_blog_hors_sujet.sql` | Supprime 5 articles de blog hors bâtiment (lancé le 15/10/2026). |
| `20261015_corriger_articles_blog.sql` | Un seul bloc : sauvegarde 15 articles puis corrige les erreurs juridiques (seuils de TVA et de micro, seuil de devis de 150 €, « certifié », « essai gratuit »), tout ou rien. |
| `20261015_supprimer_doublons_et_faux_temoignage.sql` | Supprime 4 articles : un faux témoignage de plombier et 3 doublons à 97-98 % (à lancer **avant** le correctif des articles). |
| `20261015_blog_a_corriger.md` | Passages relevés par `lib/blog-audit.ts` à l'origine de ces correctifs. |
