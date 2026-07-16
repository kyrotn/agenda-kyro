# Kyro Agenda Particular

Agenda pessoal hospedada no GitHub Pages, com login Google, dados privados no Supabase e sincronizacao com o Google Agenda.

## Configuracao

1. Crie um projeto no Supabase e execute o arquivo de `supabase/migrations` no SQL Editor.
2. Ative o provedor Google no Supabase Authentication.
3. Configure a URL do GitHub Pages em Authentication > URL Configuration.
4. No GitHub, cadastre `VITE_SUPABASE_URL` como variable e `VITE_SUPABASE_ANON_KEY` como secret.
5. Em Settings > Pages, selecione GitHub Actions como fonte de publicacao.

Os dados sao protegidos por Row Level Security e cada conta Google acessa somente seus proprios registros.
