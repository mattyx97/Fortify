import { matcher } from 'glob-url'

//  Matching is case-insensitive
//  Matches all characters until the next /, except it is at the end of the pattern, then it matches (literally) everything.
//  Examples:
//    - /user/* — will match anything after user/ including /user/peter/pets/etc
//    - /user/John — will only match /user/John
//    - /user/*/pets — will match /user/John/pets, /user/Ann/pets
//    - /*/dashboard — will match /blue/dashboard, /green/dashboard, etc...
const AUTH_ROUTES = {
  // Routes that must only be accessible with authentication
  PROTECTED: {
    routes: ['/', '/organizations/*'],
    redirectTo: '/login',
  },
  GUEST: {
    routes: ['/login', '/register'],
    redirectTo: '/',
  },
}

export default defineNuxtRouteMiddleware(async (to) => {
  const { loggedIn, fetchSession } = useAuth()

  // Check PROTECTED routes first
  if (isRouteInCategory(to.path, AUTH_ROUTES.PROTECTED.routes)) {
    if (!loggedIn.value) {
      await fetchSession()
    }
    if (!loggedIn.value) {
      return navigateTo(AUTH_ROUTES.PROTECTED.redirectTo)
    }
    return
  }

  // Check GUEST routes
  if (isRouteInCategory(to.path, AUTH_ROUTES.GUEST.routes)) {
    if (!loggedIn.value) {
      await fetchSession()
    }
    if (loggedIn.value) {
      return navigateTo(AUTH_ROUTES.GUEST.redirectTo)
    }
  }
})

function isRouteInCategory(routePath: string, routes: string[]) {
  // Expand routes with /* to also match base path
  const expandedRoutes = routes.flatMap((route) => {
    if (route.endsWith('/*')) {
      const basePath = route.slice(0, -2) // Remove /*
      return [basePath, route]
    }
    return [route]
  })

  return expandedRoutes.some(route => matcher.match(route, routePath))
}
