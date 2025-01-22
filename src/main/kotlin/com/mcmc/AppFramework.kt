package com.mcmc.com.mcmc

import com.mcmc.Service
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.routing.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.serialization.json.Json
import kotlinx.serialization.modules.SerializersModule
import kotlinx.serialization.modules.polymorphic

lateinit var aggrService: Service

val requestStore = mutableMapOf<String, Entity>()
val storeMutex = Mutex()

fun Application.module() {
    install(ContentNegotiation) {
        json(Json {
            // Enable polymorphic (de)serialization support
            serializersModule = SerializersModule {
                polymorphic(Entity::class) {
                    subclass(Street::class, Street.serializer())
                    subclass(StreetSign::class, StreetSign.serializer())
                    subclass(Intersection::class, Intersection.serializer())
                }
            }
        })
    }

    routing {
        route("/api/streetscout/street") { aggrService.streetDef(this@route) }
        route("/api/streetscout/sign") { aggrService.signDef(this@route) }
        route("/api/streetscout/xsection") { aggrService.xsectDef(this@route) }
    }
}

fun main() {
    aggrService = AggrService()
    embeddedServer(Netty, port = 8080) {
        module()
    }.start(wait = true)
}
