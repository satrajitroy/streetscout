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

fun Street.toView(): StreetView =
  StreetView(
    id = id,
    name = name,
    zip = zip,
    roadType = roadType,
    routeNumber = routeNumber,
    town = town,
    county = county,
    state = state,
    surface = surface,
    condition = condition,
    width = width,
    lanes = lanes,
    latitude = latitude,
    longitude = longitude,
    altitude = altitude,
    timestamp = timestamp,
    segments = segments.toSegmentView()
  )