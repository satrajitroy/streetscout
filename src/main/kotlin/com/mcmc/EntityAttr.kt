package com.mcmc

import io.ktor.server.routing.RoutingCall
import io.ktor.util.AttributeKey

val AttrEntity: AttributeKey<Entity> = AttributeKey("entity.preparsed")
val AttrEntityId: AttributeKey<String> = AttributeKey("entity.id")

fun RoutingCall.setMappedEntity(entity: Entity, id: String) {
  attributes.put(AttrEntity, entity)
  attributes.put(AttrEntityId, id)
}
