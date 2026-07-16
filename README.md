# Kyro Agenda Particular

Agenda pessoal hospedada no GitHub Pages, com login Google, dados privados no Firebase e sincronizacao com o Google Agenda.

## Configuracao

1. Crie um projeto Firebase e registre um aplicativo Web.
2. Ative Google em Authentication e crie o banco Cloud Firestore.
3. Publique as regras de `firestore.rules`.
4. No GitHub, cadastre as variaveis `VITE_FIREBASE_*` do aplicativo Web.
5. Em Settings > Pages, selecione GitHub Actions como fonte de publicacao.

As regras do Firestore garantem que cada conta Google acesse somente seus proprios registros.
