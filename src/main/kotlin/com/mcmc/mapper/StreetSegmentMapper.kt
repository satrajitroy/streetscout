// src/main/kotlin/com/mcmc/mappers/StreetSegmentMappers.kt
package com.mcmc.mappers

import com.mcmc.StreetAttributes
import com.mcmc.dto.StreetSegmentView

/** Map<Double, StreetAttributes> → List<StreetSegmentView> (sorted by location) */
fun Map<Double, StreetAttributes>.toSegmentView(): List<StreetSegmentView> =
  this.entries
    .asSequence()
    .filter { it.key.isFinite() }
    .sortedBy { it.key }
    .map { (loc, attr) ->
      StreetSegmentView(
        location  = loc,
        surface   = attr.surface,
        condition = attr.condition,
        width     = attr.width,
        lanes     = attr.lanes
      )
    }
    .toList()

/** Inverse: List<StreetSegmentView> → MutableMap<Double, StreetAttributes> */
fun List<StreetSegmentView>.toSegmentMap(): MutableMap<Double, StreetAttributes> =
  this.associate { seg ->
    seg.location to StreetAttributes(
      surface   = seg.surface,
      condition = seg.condition,
      width     = seg.width,
      lanes     = seg.lanes
    )
  }.toMutableMap()
