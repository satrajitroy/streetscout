package com.mcmc

import com.mcmc.dto.*
import com.mcmc.mappers.toEntity
import com.mcmc.mappers.toView
import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.coroutines.sync.withLock
import kotlin.collections.set
import io.github.smiley4.ktoropenapi.delete as docDelete
import io.github.smiley4.ktoropenapi.get as docGet
import io.github.smiley4.ktoropenapi.post as docPost
import io.github.smiley4.ktoropenapi.put as docPut

@kotlinx.serialization.Serializable
data class Page<T>(val items: List<T>, val page: Int, val size: Int, val total: Int)

private fun <T> paginate(all: List<T>, page: Int, size: Int): Page<T> {
  val sz = size.coerceIn(1, 100)
  val pg = page.coerceAtLeast(1)
  val from = (pg - 1) * sz
  val to = (from + sz).coerceAtMost(all.size)
  val slice = if (from in 0..all.size && from < to) all.subList(from, to) else emptyList()
  return Page(slice, pg, sz, all.size)
}

class AggrService : Service {
  override fun streetDef(route: Route) {
    route.apply {
      docGet("", {
        summary = "List Streets (paged)"
        request {
          queryParameter<Int>("page") { required = false; example("default") { value = 1 } }
          queryParameter<Int>("size") { required = false; example("default") { value = 8 } }
        }
        response { HttpStatusCode.OK to { body<Page<StreetView>>() } }
      }) {
        val page = call.request.queryParameters["page"]?.toIntOrNull() ?: 1
        val size = call.request.queryParameters["size"]?.toIntOrNull() ?: 8
        val all = storeMutex.withLock {
          requestStore.values.filterIsInstance<Street>().sortedBy { it.id }.map { it.toView() }
        }
        call.respond(paginate(all, page, size))
      }
      // Get details of a street given its id or essential properties
      docGet("/{id}", {
        summary = "Get Street by id"
        response {
          HttpStatusCode.OK to { body<StreetView>() }
          HttpStatusCode.NotFound to { }
        }
      }) { fetchImpl(call, null as Street?) }
      // Submit a new Street
      docPost("/submit", {
        summary = "Create/Upsert Street"
        request { body<StreetCreate>() }
        response { HttpStatusCode.OK to { body<String>() } }
      }) {
        val dto = call.receive<StreetCreate>()
        val entity = dto.toEntity()
        val id = Street.generateId(
          entity.zip,
          Street.getTypeFromName(entity.name),
          entity.name
        )

        call.setMappedEntity(entity, id)
        postStreet(call)
      }
      // Edit an existing Street
      docPut("/edit/{id}", {
        summary = "Update Street"
        request { body<StreetPatch>() }
        response { HttpStatusCode.OK to { body<String>() } }
      }) {
        val id = call.parameters["id"]?.takeIf { it.isNotBlank() }
          ?: return@docPut call.respond(HttpStatusCode.BadRequest, "Missing or blank path param: id")

        val dto = call.receive<StreetPatch>()
        call.setMappedEntity(dto.toEntity(), id)
        updateStreet(call)
      }
      // Delete an existing Street
      docDelete("/delete/{id}", {
        summary = "Delete Street"
        response { HttpStatusCode.OK to { body<String>() } }
      }) { delete(call) }
    }
  }

  override fun signDef(route: Route) {
    route.apply {
      docGet("", {
        summary = "List Street Signs (paged)"
        request {
          queryParameter<Int>("page") { required = false; example("default") { value = 1 } }
          queryParameter<Int>("size") { required = false; example("default") { value = 8 } }
        }
        response { HttpStatusCode.OK to { body<Page<StreetSignView>>() } }
      }) {
        val page = call.request.queryParameters["page"]?.toIntOrNull() ?: 1
        val size = call.request.queryParameters["size"]?.toIntOrNull() ?: 8
        val all = storeMutex.withLock {
          requestStore.values.filterIsInstance<StreetSign>().sortedBy { it.id }.map { it.toView() }
        }
        call.respond(paginate(all, page, size))
      }
      // Get details of a street sign given its id
      docGet("/{id}", {
        summary = "Get Street Sign by id"
        response {
          HttpStatusCode.OK to { body<StreetSignView>() }
          HttpStatusCode.NotFound to { }
        }
      }) { fetchImpl(call, null as StreetSign?) }
      // Submit a new street sign
      docPost("/submit", {
        summary = "Create/Upsert Street Sign"
        request { body<StreetSignCreate>() }
        response { HttpStatusCode.OK to { body<String>() } }
      }) {
        val dto = try {
          call.receive<StreetSignCreate>()
        } catch (e: Exception) {
          return@docPost call.respond(HttpStatusCode.BadRequest, "Invalid JSON: ${e.message}")
        }

        val id = StreetSign.generateId()
        call.setMappedEntity(dto.toEntity(), id)
        postSign(call)
      }
      // Edit an existing street sign
      docPut("/edit/{id}", {
        summary = "Update Street Sign"
        request { body<StreetSignPatch>() }
        response { HttpStatusCode.OK to { body<String>() } }
      }) {
        val dto = call.receive<StreetSignPatch>()
        val id = call.parameters["id"]?.takeIf { it.isNotBlank() }
          ?: return@docPut call.respond(HttpStatusCode.BadRequest, "Missing or blank path param: id")

        call.setMappedEntity(dto.toEntity(), id)
        putSign(call)
      }
      // Delete an existing street sign
      docDelete("/delete/{id}", {
        summary = "Delete Street Sign"
        response { HttpStatusCode.OK to { body<String>() } }
      }) { delete(call) }
    }
  }

  override fun xsectDef(route: Route) {
    route.apply {
      docGet("", {
        summary = "List Intersections (paged)"
        request {
          queryParameter<Int>("page") { required = false; example("default") { value = 1 } }
          queryParameter<Int>("size") { required = false; example("default") { value = 8 } }
        }
        response { HttpStatusCode.OK to { body<Page<IntersectionView>>() } }
      }) {
        val page = call.request.queryParameters["page"]?.toIntOrNull() ?: 1
        val size = call.request.queryParameters["size"]?.toIntOrNull() ?: 8
        val all = storeMutex.withLock {
          requestStore.values.filterIsInstance<Intersection>().sortedBy { it.id }.map { it.toView() }
        }
        call.respond(paginate(all, page, size))
      }
      // Get details of an Intersection given its id
      docGet("/{id}", {
        summary = "Get Street Intersection by id"
        response {
          HttpStatusCode.OK to { body<IntersectionView>() }
          HttpStatusCode.NotFound to { }
        }
      }) { fetchImpl(call, null as Intersection?) }
      // Submit a new Intersection
      docPost("/submit", {
        summary = "Create/Upsert Street Intersection"
        request { body<IntersectionCreate>() }
        response { HttpStatusCode.OK to { body<String>() } }
      }) {
        val dto = call.receive<IntersectionCreate>()
        val id = Intersection.generateId()
        call.setMappedEntity(dto.toEntity(), id)
        postIntersection(call)
      }
      // Edit an existing Intersection
      docPut("/edit/{id}", {
        summary = "Update Street Intersection"
        request { body<IntersectionPatch>() }
        response { HttpStatusCode.OK to { body<String>() } }
      }) {
        val dto = call.receive<IntersectionPatch>()
        val id = call.parameters["id"]?.takeIf { it.isNotBlank() }
          ?: return@docPut call.respond(HttpStatusCode.BadRequest, "Missing or blank path param: id")

        call.setMappedEntity(dto.toEntity(), id)
        putIntersection(call)
      }
      // Delete an existing Intersection
      docDelete("/delete/{id}", {
        summary = "Delete Street Intersection"
        response { HttpStatusCode.OK to { body<String>() } }
      }) { delete(call) }
    }
  }

  @PublishedApi
  internal suspend inline fun <reified T> fetchImpl(
    call: RoutingCall,
    @Suppress("UNUSED_PARAMETER") dummy: Any?
  ) {
    val id = call.parameters["id"]?.takeIf { it.isNotBlank() }
      ?: return call.respond(HttpStatusCode.BadRequest, "Missing or blank path param: id")

    val tmp = storeMutex.withLock { requestStore[id] } as? T
    if (tmp == null) return call.respond(HttpStatusCode.NotFound, "Not found: $id")

    // Default: if you hit this branch, you forgot a specialization below.
    call.respond(HttpStatusCode.NotImplemented, "No view mapper for ${T::class.simpleName}")
  }

  // Street → StreetView
  @PublishedApi
  internal suspend inline fun fetchImpl(
    call: RoutingCall,
    @Suppress("UNUSED_PARAMETER") dummy: Street?
  ) {
    val id = call.parameters["id"]?.trim()
      ?: return call.respond(HttpStatusCode.NotFound, "Id not specified")
    val e = storeMutex.withLock { requestStore[id] } as? Street
      ?: return call.respond(HttpStatusCode.NotFound, "Not found: $id")
    call.respond(e.toView())
  }

  // StreetSign → StreetSignView
  @PublishedApi
  internal suspend inline fun fetchImpl(
    call: RoutingCall,
    @Suppress("UNUSED_PARAMETER") dummy: StreetSign?
  ) {
    val id = call.parameters["id"]!!.trim()
    val e = storeMutex.withLock { requestStore[id] } as? StreetSign
      ?: return call.respond(HttpStatusCode.NotFound, "Not found: $id")
    call.respond(e.toView())
  }

  // Intersection → IntersectionView
  @PublishedApi
  internal suspend inline fun fetchImpl(
    call: RoutingCall,
    @Suppress("UNUSED_PARAMETER") dummy: Intersection?
  ) {
    val id = call.parameters["id"]!!.trim()
    val e = storeMutex.withLock { requestStore[id] } as? Intersection
      ?: return call.respond(HttpStatusCode.NotFound, "Not found: $id")
    call.respond(e.toView())
  }

  private suspend inline fun delete(call: RoutingCall) {
    val id = call.parameters["id"]
    id?.let {
      val old = storeMutex.withLock { requestStore.remove(id) }
      old?.let { call.respondText("Street $id deleted successfully") }
        ?: call.respond(HttpStatusCode.NotFound, "Not found: $id")
    }
  }

  private suspend inline fun putIntersection(call: RoutingCall) {
    postIntersection(call)
  }

  private suspend inline fun postIntersection(call: RoutingCall) {
    val (id, old, new) = getIntersectionAndId(call)
    if (new == null) {
      call.respond(HttpStatusCode.BadRequest, "Missing new instance in request.")
      return
    }

    old?.let {
      val street = storeMutex.withLock { requestStore[it.streetId!!] } as Street
      upDateIntersection(id, old, new, street, call)
    } ?: run {
      val street = storeMutex.withLock { requestStore[new.streetId!!] } as? Street
      street?.let { addIntersection(id, new, street, call) }
        ?: call.respond(HttpStatusCode.BadRequest, "Missing parent street in new instance.")
    }
  }

  private suspend fun addIntersection(id: String, new: Intersection, street: Street, call: RoutingCall) {
    street.addIntersection(id)
    storeMutex.withLock { requestStore[street.id] = street }

    new.id=id
    storeMutex.withLock { requestStore[id] = new }
    // call.respond(new.toView())
    call.respond("Intersection submitted for processing: ${id}")
  }

  private suspend fun upDateIntersection(id: String, old: Intersection, new: Intersection, street: Street, call: RoutingCall) {
    old.updateIntersection(new, street)
    storeMutex.withLock { requestStore[street.id] = street }
    storeMutex.withLock { requestStore[id] = old }
    // call.respond(new.toView())
    call.respondText("Intersection ${id} already exists. Updating with new instance.")
  }

  private suspend inline fun putSign(call: RoutingCall) {
    postSign(call)
  }

  private suspend inline fun postSign(call: RoutingCall) {
    val (id, old, new) = getStreetSignAndId(call)
    if (new == null) {
      call.respond(HttpStatusCode.BadRequest, "Missing new instance in request.")
      return
    }

    old?.let {
      val street = storeMutex.withLock { requestStore[it.streetId!!] } as Street
      upDateSign(id, old, new, street, call)
    } ?: run {
      val street = storeMutex.withLock { requestStore[new.streetId!!] } as? Street
      street?.let { addSign(id, new, street, call) }
        ?: call.respond(HttpStatusCode.BadRequest, "Missing parent street in new instance.")
    }
  }

  private suspend fun addSign(id: String, new: StreetSign, street: Street, call: RoutingCall) {
    street.addSign(id)
    storeMutex.withLock { requestStore[street.id] = street }

    new.id=id
    storeMutex.withLock { requestStore[id] = new }
    // call.respond(new.toView())
    call.respondText("Street Sign submitted for processing: ${id}")
  }

  private suspend fun upDateSign(id: String, old: StreetSign, new: StreetSign, street: Street, call: RoutingCall) {
    old.updateSign(new, street)
    storeMutex.withLock { requestStore[street.id] = street }
    storeMutex.withLock { requestStore[id] = old }
    // call.respond(new.toView())
    call.respondText("Street Sign ${id} already exists. Updating with new instance.")
  }

  private suspend inline fun updateStreet(call: RoutingCall) {
    postStreet(call)
  }

  private suspend inline fun postStreet(call: RoutingCall) {
    val (id, old, new) = getStreetAndId(call)
    if (new == null) {
      call.respondText("Create / Upsert failed. New instance not found in request")
      return
    }

    old?.let {
      it.updateStreet(new)
      storeMutex.withLock { requestStore[id!!] = it }
      // call.respond(old.toView())
      call.respondText("Street ${id} already exists. Updating street instance.")
      return
    }

    id?.let {
      new.id = it
      storeMutex.withLock { requestStore[it] = new }
      // call.respond(new.toView())
      call.respondText("Street submitted for processing: ${it}")
    }
  }

  private suspend inline fun getStreetAndId(call: RoutingCall): Triple<String?, Street?, Street?> {
    // Prefer pre-mapped values injected by the route
    val new = call.attributes.getOrNull(AttrEntity) as? Street
    val injectedId = call.attributes.getOrNull(AttrEntityId)

    val id = injectedId ?: new?.let {
      Street.generateId(
        new.zip,
        Street.getTypeFromName(new.name),
        new.name
      )
    }

    val old = id?.let { storeMutex.withLock { requestStore[id] } as? Street }
    return Triple(id, old, new)
  }

  private suspend fun getStreetSignAndId(call: RoutingCall): Triple<String, StreetSign?, StreetSign?> {
    // Prefer pre-mapped values injected by the route
    val new = call.attributes.getOrNull(AttrEntity) as? StreetSign
    val injectedId = call.attributes.getOrNull(AttrEntityId)

    val id: String = injectedId?.let { injectedId } ?: StreetSign.generateId()
    val old = storeMutex.withLock { requestStore[injectedId] } as? StreetSign
    return Triple(id, old, new)
  }

  private suspend fun getIntersectionAndId(call: RoutingCall): Triple<String, Intersection?, Intersection?> {
    // Prefer pre-mapped values injected by the route
    val new = call.attributes.getOrNull(AttrEntity) as? Intersection
    val injectedId = call.attributes.getOrNull(AttrEntityId)

    val id: String = injectedId?.let { injectedId } ?: Intersection.generateId()
    val old = storeMutex.withLock { requestStore[injectedId] } as? Intersection
    return Triple(id, old, new)
  }
}