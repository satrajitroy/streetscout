package com.mcmc.mappers

import com.mcmc.Condition
import com.mcmc.Street
import com.mcmc.Surface
import com.mcmc.Width
import com.mcmc.dto.StreetCreate
import com.mcmc.dto.StreetPatch
import com.mcmc.dto.StreetView

fun StreetCreate.toEntity(): Street = Street(
  name = name,
  roadType = roadType ?: Street.getTypeFromName(name),
  routeNumber = routeNumber,
  town = town,
  county = county,
  state = state,
  zip = zip,
  surface = surface ?: Surface.Unknown,
  condition = condition ?: Condition.Unknown,
  width = width ?: Width.Unknown,
  lanes = lanes ?: 2,
  latitude = latitude ?: 0.0,
  longitude = longitude ?: 0.0,
  altitude = altitude ?: 0.0
)

fun StreetPatch.toEntity(): Street = Street(
  routeNumber = routeNumber,
  town = town,
  county = county,
  state = state,
  surface = surface ?: Surface.Unknown,
  condition = condition ?: Condition.Unknown,
  width = width ?: Width.Unknown,
  lanes = lanes ?: 2,
  latitude = latitude ?: 0.0,
  longitude = longitude ?: 0.0,
  altitude = altitude ?: 0.0
)

suspend fun Street.apply(p: StreetPatch) {
  val updated = copy(
    routeNumber = p.routeNumber ?: routeNumber,
    town = p.town ?: town,
    county = p.county ?: county,
    state = p.state ?: state,
    surface = p.surface ?: surface,
    condition = p.condition ?: condition,
    width = p.width ?: width,
    lanes = p.lanes ?: lanes,
    latitude = p.latitude ?: latitude,
    longitude = p.longitude ?: longitude,
    altitude = p.altitude ?: altitude,
  )
  updateStreet(updated)
}

fun Street.toView() = StreetView(
  id, name, roadType, routeNumber, town, county, state, zip,
  surface, condition, width, lanes,
  latitude, longitude, altitude, timestamp
)
