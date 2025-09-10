package com.mcmc

import io.github.smiley4.ktoropenapi.OpenApi
import io.github.smiley4.ktoropenapi.config.SchemaGenerator
import io.github.smiley4.ktoropenapi.openApi
import io.github.smiley4.ktorswaggerui.swaggerUI
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.http.content.*
import io.ktor.server.netty.*
import io.ktor.server.plugins.calllogging.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.serialization.json.Json
import kotlinx.serialization.modules.SerializersModule
import kotlinx.serialization.modules.polymorphic
import org.slf4j.event.Level


lateinit var aggrService: Service

val requestStore = mutableMapOf<String, Entity>()
val storeMutex = Mutex()

fun Application.module() {
  install(OpenApi) {
    schemas {
      generator = SchemaGenerator.kotlinx(
        Json { ignoreUnknownKeys = true; explicitNulls = false; encodeDefaults = true }
      )
    }
  }

  // install(CallLogging) { level = Level.INFO }
  // install(IgnoreTrailingSlash)
  //
  // // runs for every request (set up once at startup)
  // intercept(ApplicationCallPipeline.Setup) {
  //   application.log.info(
  //     "REQ ${call.request.httpMethod.value} ${call.request.uri}  " +
  //         "CT=${call.request.contentType()}  Accept=${call.request.acceptItems().joinToString()}"
  //   )
  // }

  install(ContentNegotiation) {
    json(Json {
      // tolerant decoding / partial updates
      ignoreUnknownKeys = true
      coerceInputValues = true
      explicitNulls = false

      // (optional but recommended for polymorphism)
      classDiscriminator = "type"

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

  install(CORS) {
    allowHost("localhost:5173")
    allowHeader(HttpHeaders.ContentType)
    allowMethod(HttpMethod.Get)
    allowMethod(HttpMethod.Post)
    allowMethod(HttpMethod.Put)
    allowMethod(HttpMethod.Delete)
  }

  routing {
    // enable routing trace (set up once at startup)
    // trace { application.log.info(it.buildText()) }

    route("api.json") { openApi() }             // generated OpenAPI 3.1
    route("swagger") { swaggerUI("/api.json") } // Swagger UI

    route("/api/streetscout/street") { aggrService.streetDef(this@route) }
    route("/api/streetscout/sign") { aggrService.signDef(this@route) }
    route("/api/streetscout/xsection") { aggrService.xsectDef(this@route) }
    staticResources("/assets", "static/assets")
    get("/favicon.ico") { call.respond(HttpStatusCode.NoContent) }

    get("{...}") {
      call.respondBytes(
        this::class.java.classLoader.getResource("static/index.html")!!.readBytes(),
        ContentType.Text.Html
      )
    }
  }
}

fun main() {
  aggrService = AggrService()
  embeddedServer(Netty, port = 8082) {
    module()
  }.start(wait = true)
}
