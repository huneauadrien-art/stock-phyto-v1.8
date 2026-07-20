# Version 1.4.0 — Registre phytosanitaire

## Nouveauté

Une nouvelle rubrique **Registre** a été ajoutée.

Fonctionnement :
1. Créer un traitement avec sa date, sa culture et les produits prévus avec leurs doses/ha.
2. Ajouter chaque plein du pulvérisateur en indiquant le litrage/ha, l'eau chargée et les quantités réellement mises.
3. Le stock est retiré dès l'enregistrement du plein.
4. Ajouter ensuite les parcelles réellement traitées, sans avoir à les prévoir à l'avance.
5. Terminer le traitement lorsque le chantier est fini.

## Étape Supabase obligatoire

Avant d'utiliser le registre sur plusieurs appareils, ouvrir Supabase > SQL Editor et exécuter la partie `public.treatments` située à la fin du fichier `supabase-schema.sql`.

Le script peut aussi être exécuté entièrement : les commandes sont prévues pour ne pas recréer les tables déjà existantes.

## Sécurité des suppressions

La suppression d'un traitement remet automatiquement en stock toutes les quantités enregistrées dans ses pleins et retire les mouvements correspondants de l'historique.
