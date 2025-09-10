package com.mcmc

import io.ktor.server.routing.*

interface Service {
  fun streetDef(route: Route)
  fun signDef(route: Route)
  fun xsectDef(route: Route)
}
