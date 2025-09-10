package com.mcmc.http

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.github.smiley4.ktoropenapi.delete as docDelete
import io.github.smiley4.ktoropenapi.get as docGet
import io.github.smiley4.ktoropenapi.post as docPost
import io.github.smiley4.ktoropenapi.put as docPut

inline fun <reified Res : Any> Route.docGetJson(
  path: String,
  summary: String,
  crossinline handler: suspend (ApplicationCall) -> Res
) {
  docGet(path, {
    this.summary = summary
    response { HttpStatusCode.OK to { body<Res>() } }
  }) { call.respond(handler(call)) }
}

inline fun <reified Req : Any, reified Res : Any> Route.docPostJson(
  path: String,
  summary: String,
  crossinline handler: suspend (ApplicationCall, Req) -> Res
) {
  docPost(path, {
    this.summary = summary
    request { body<Req>() }
    response { HttpStatusCode.OK to { body<Res>() } }
  }) {
    val req = call.receive<Req>()
    call.respond(handler(call, req))
  }
}

inline fun <reified Req : Any, reified Res : Any> Route.docPutJson(
  path: String,
  summary: String,
  crossinline handler: suspend (ApplicationCall, Req) -> Res
) {
  docPut(path, {
    this.summary = summary
    request { body<Req>() }
    response { HttpStatusCode.OK to { body<Res>() } }
  }) {
    val req = call.receive<Req>()
    call.respond(handler(call, req))
  }
}

inline fun Route.docDeleteText(
  path: String,
  summary: String,
  crossinline handler: suspend (ApplicationCall) -> String
) {
  docDelete(path, {
    this.summary = summary
    response { HttpStatusCode.OK to { body<String>() } }
  }) {
    call.respondText(handler(call))
  }
}
