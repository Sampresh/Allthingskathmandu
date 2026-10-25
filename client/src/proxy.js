import { NextResponse } from 'next/server'

// The API sets this non-secret hint cookie at login and clears it at logout. It only decides
// whether to send a visitor to /login; every protected request is still checked by the API.
const SESSION_HINT_COOKIE = 'atk_session'

// The admin login page sits under /admin but must stay reachable when logged out.
const PUBLIC_PATHS = ['/admin/login']

export function proxy(request) {
  if (PUBLIC_PATHS.includes(request.nextUrl.pathname)) return NextResponse.next()
  if (request.cookies.get(SESSION_HINT_COOKIE)?.value === '1') return NextResponse.next()

  // Staff use the separate admin login (Part 3 §10).
  const loginPath = request.nextUrl.pathname.startsWith('/admin') ? '/admin/login' : '/login'
  const login = new URL(loginPath, request.url)
  login.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`)
  return NextResponse.redirect(login)
}

export const config = {
  matcher: ['/account/:path*', '/business/:path*', '/admin/:path*'],
}
