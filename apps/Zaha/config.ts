// Configuration locale pour Supabase — chargée directement (pas via process.env)
// IMPORTANT : sur Android, localhost = le téléphone lui-même.
// Il faut pointer vers l'IP du PC qui héberge l'API Next.js sur le réseau local.
// const LOCAL_API_HOST = '192.168.0.234';

export const config = {
  supabase: {
    url: 'https://onzyxwjxrjyrxfhujwnd.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uenl4d2p4cmp5cnhmaHVqd25kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MjkxMDksImV4cCI6MjEwMjIwNTEwOX0.XK_VTabOa5ArrBJegVIF0cU0a6npLG9sAR4e4PKCrWA',
  },
  api: {
    // baseUrl: `http://${LOCAL_API_HOST}:3000`,
    baseUrl: `https://zaha-5fsf2hacf-soad2.vercel.app/`,
  },
};
