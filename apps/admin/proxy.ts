import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/lib/supabase/database.types';

/**
 * Proxy (ex-Middleware, Next.js 16) :
 * - rafraîchit la session Supabase (rotation des tokens)
 * - redirige les non-connectés vers /login (vérification optimiste —
 *   la vérification admin réelle est faite par requireAdmin() côté serveur)
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === '/login';

  // Page de login : getUser() (appel réseau) pour ne jamais rediriger sur une
  // session invalide (évite une boucle /login <-> /).
  // Autres pages : lecture du cookie (sans appel réseau, rafraîchit le token si
  // expiré). Simple garde optimiste : requireAdmin() revérifie côté serveur.
  const loggedIn = isLoginPage
    ? !!(await supabase.auth.getUser()).data.user
    : !!(await supabase.auth.getSession()).data.session;

  if (!loggedIn && !isLoginPage) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (loggedIn && isLoginPage) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/';
    redirectUrl.search = '';
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)'],
};
