package com.mcmc

import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.coroutines.sync.withLock

class AggrService : Service {
    override fun streetDef(route: Route) {
        route.apply {
            // Get details of a street given its id or essential properties
            get("/{id}") { fetch(call) }
            // Submit a new Strett
            post("/submit") { post<Street>(call) }
            // Edit an existing Street
            put("/edit/{id}") { update<Street>(call) }
            // Delete an existing Street
            delete("/delete/{id}") { delete(call) }
        }
    }

    override fun signDef(route: Route) {
        route.apply {
            // Get details of a street sign given its id
            get("/{id}") { fetchSign(call) }
            // Submit a new street sign
            post("/submit") { postSign(call) }
            // Edit an existing street sign
            put("/edit/{id}") { updateSign<StreetSign>(call) }
            // Delete an existing street sign
            delete("/delete/{id}") { deleteSign(call) }
        }
    }

    override fun xsectDef(route: Route) {
        route.apply {
            // Get details of an Intersection given its id
            get("/{id}") { fetchIntersection(call) }
            // Submit a new Intersection
            post("/submit") { postIntersection(call) }
            // Edit an existing Intersection
            put("/edit/{id}") { updateIntersection(call) }
            // Delete an existing Intersection
            delete("/delete/{id}") { deleteIntersection(call) }
        }
    }

    private suspend inline fun fetchIntersection(call: RoutingCall) {
        val xsect = getIntersectionAndId(call)
        if (xsect.second == null) {
            // In case ID is missing, probably should return all signs
            // but that could be a lot of data
            call.respondText("Intersection ${xsect.first} not found")
            return
        }

        call.respond(xsect.second!!)
    }

    private suspend inline fun deleteIntersection(call: RoutingCall) {
        val xsect = getIntersectionAndId(call)
        if (xsect.second == null) {
            call.respondText("Intersection ${xsect.first} not found")
            return
        }

        storeMutex.withLock { requestStore.remove(xsect.first) }
        call.respondText("Intersection ${xsect.first} deleted successfully")
    }

    private suspend inline fun updateIntersection(call: RoutingCall) {
        val xsect = getIntersectionAndId(call)
        if (xsect.second == null) {
            call.respondText("Intersection ${xsect.first} not found")
            return
        }

        val street = storeMutex.withLock {
            requestStore[xsect.second!!.streetId!!]
        } as Street

        xsect.second!!.updateIntersection(
            call.receive<Entity>() as Intersection,
            street
        )

        storeMutex.withLock { requestStore[street.id] = street }
        storeMutex.withLock { requestStore[xsect.first!!] = xsect.second!! }
        call.respondText("Intersection ${xsect.first} updated successfully")
    }

    private suspend inline fun postIntersection(call: RoutingCall) {
        val xsect = getIntersectionAndId(call)
        val newXsect = call.receive<Entity>() as Intersection
        val street = storeMutex.withLock {
            requestStore[newXsect.streetId!!]
        } as Street

        if (xsect.second != null) {
            xsect.second!!.updateIntersection(newXsect, street)
            storeMutex.withLock { requestStore[street.id] = street }
            storeMutex.withLock { requestStore[xsect.first!!] = xsect.second!! }
            call.respondText("Intersection ${xsect.first} already exists. Updating intersection instance.")
            return
        }

        street.addIntersection(newXsect.id)
        storeMutex.withLock { requestStore[street.id] = street }
        storeMutex.withLock { requestStore[newXsect.id] = newXsect }
        call.respondText("Intersection submitted for processing with ID: ${newXsect.id}")
    }

    private suspend inline fun fetchSign(call: RoutingCall) {
        val sign = getStreetSignAndId(call)
        if (sign.second == null) {
            // In case ID is missing, probably should return all signs
            // but that could be a lot of data
            call.respondText("Sign ${sign.first} not found")
            return
        }

        call.respond(sign.second!!)
    }

    private suspend inline fun deleteSign(call: RoutingCall) {
        val sign = getStreetSignAndId(call)
        if (sign.second == null) {
            call.respondText("Street Sign ${sign.first} not found")
            return
        }

        storeMutex.withLock { requestStore.remove(sign.first) }
        call.respondText("Sign ${sign.first} deleted successfully")
    }

    private suspend inline fun <T : Entity> updateSign(call: RoutingCall) {
        val sign = getStreetSignAndId(call)
        if (sign.second == null) {
            call.respondText("Street sign ${sign.first} not found")
            return
        }

        val street = storeMutex.withLock {
            requestStore[sign.second!!.streetId!!]
        } as Street

        sign.second!!.updateSign(
            call.receive<Entity>() as StreetSign,
            street
        )

        storeMutex.withLock { requestStore[street.id] = street }
        storeMutex.withLock { requestStore[sign.first!!] = sign.second!! }
        call.respondText("Street ${sign.first} -> ${sign.second} updated successfully")
    }

    private suspend inline fun postSign(call: RoutingCall) {
        val sign = getStreetSignAndId(call)
        val newSign = call.receive<Entity>() as StreetSign
        val street = try {
            storeMutex.withLock {
                requestStore[newSign.streetId!!]
            } as Street
        } catch (e: Exception) {
            call.respondText("Street ${newSign.streetId} not found")
            return
        }

        if (sign.second != null) {
            sign.second!!.updateSign(newSign, street)
            println("Updating Sign $newSign.id")
            storeMutex.withLock { requestStore[street.id] = street }
            storeMutex.withLock { requestStore[sign.first!!] = sign.second!! }
            call.respondText("Sign ${sign.first} already exists. Updating sign instance.")
            return
        }

        street.addSign(newSign.id)
        storeMutex.withLock { requestStore[street.id] = street }
        storeMutex.withLock { requestStore[newSign.id] = newSign }
        call.respondText("Sign submitted for processing with ID: ${newSign.id}")
    }

    private suspend inline fun fetch(call: RoutingCall) {
        // In case name is missing, probably return all streets in the given zip
        // but that could be a lot of data
        storeMutex.withLock { requestStore[call.parameters["id"]] }?.let { call.respond(it) }
    }

    private suspend inline fun delete(call: RoutingCall) {
        val  id = call.parameters["id"]
        storeMutex.withLock { requestStore.remove(id) }
        call.respondText("Street $id deleted successfully")
    }

    private suspend inline fun <T : Entity> update(call: RoutingCall) {
        var id = call.parameters["id"]
        println("Id: $id")
        val street = getStreetAndId(call)
        if (street.second == null) {
            call.respondText("Street ${street.first} not found")
            return
        }

        street.second!!.updateStreet(street.third)
        storeMutex.withLock { requestStore[street.first!!] = street.second!! }
        call.respondText("Street ${street.first} updated successfully")
    }

    private suspend inline fun <T : Entity> post(call: RoutingCall) {
        val street = getStreetAndId(call)
        if (street.second != null) {
            street.second!!.updateStreet(street.third)
            storeMutex.withLock { requestStore[street.first!!] = street.second!! }
            call.respondText("Street ${street.first} already exists. Updating street instance.")
            return
        }

        storeMutex.withLock { requestStore[street.first!!] = street.third }
        call.respondText("Street submitted for processing: ${street.first} -> ${street.third}")
    }

    suspend fun getStreetAndId(call: RoutingCall): Triple<String?, Street?, Street> {
        val streetUpdate = call.receive<Entity>() as Street
        val id = try {
            Street.generateId(
                streetUpdate.zip!!,
                Street.getTypeFromName(streetUpdate.name!!),
                streetUpdate.name!!
            )
        } catch (e: Exception) {
            println(streetUpdate)
            return Triple(null, null, streetUpdate)
        }

        println("id: $id")
        val street = storeMutex.withLock { requestStore[id] } as Street?
        return Triple(id, street, streetUpdate)
    }

    private suspend fun getStreetSignAndId(call: RoutingCall): Pair<String?, StreetSign?> {
        // Given constructing the ID for the street signs is difficult
        // deciding to rely solely on correct id as input parameter
        val id = call.parameters["id"]
        val sign = storeMutex.withLock { requestStore[id] } as StreetSign?
        return Pair(id, sign)
    }

    private suspend fun getIntersectionAndId(call: RoutingCall): Pair<String?, Intersection?> {
        // Given constructing the ID for the intersections is difficult
        // deciding to rely solely on correct id as input parameter
        val id = call.parameters["id"]
        val xsect = storeMutex.withLock { requestStore[id] } as Intersection?
        return Pair(id, xsect)
    }
}