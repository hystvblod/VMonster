VMonster Sort - Base HTML/CSS/JS

Structure :
- 1 seul index.html
- écrans internes gérés par router.js
- canvas pour le jeu
- i18n dans data/i18n
- shop/skins/levels dans data
- assets WebP à placer dans assets/

Test :
Ouvre index.html dans un navigateur.
Pour Capacitor, place tout le dossier dans www puis lance npx cap sync.

Important :
Les images WebP ne sont pas incluses. Le moteur affiche des formes fallback si les assets manquent.
