import { NextResponse } from 'next/server'

// The API sets this non-secret hint cookie at login and clears it at logout. It only decides
// whether to send a visitor to /login; every protected request is still checked by the API.
const SESSION_HINT_COOKIE = 'atk_session'

export function proxy(request) {
  if (request.cookies.get(SESSION_HINT_COOKIE)?.value === '1') return NextResponse.next()

  const login = new URL('/login', request.url)
  login.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`)
  return NextResponse.redirect(login)
}

export const config = {
  matcher: ['/account/:path*', '/business/:path*', '/admin/:path*'],
}
