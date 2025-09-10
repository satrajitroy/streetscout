package com.mcmc.dto

import com.mcmc.Condition
import com.mcmc.RoadType
import com.mcmc.Surface
import com.mcmc.Width
import kotlinx.serialization.Serializable

@Serializable
data class StreetCreate(
  val zip: String,
  val name: String,
  val roadType: RoadType? = null,
  val routeNumber: String? = null,
  val town: String? = null,
  val county: String? = null,
  val state: String? = null,
  val surface: Surface? = null,
  val condition: Condition? = null,
  val width: Width? = null,
  val lanes: Int? = null,
  val latitude: Double? = null,
  val longitude: Double? = null,
  val altitude: Double? = null,
)

@Serializable
data class StreetPatch(
  val routeNumber: String? = null,
  val town: String? = null,
  val county: String? = null,
  val state: String? = null,
  val surface: Surface? = null,
  val condition: Condition? = null,
  val width: Width? = null,
  val lanes: Int? = null,
  val latitude: Double? = null,
  val longitude: Double? = null,
  val altitude: Double? = null,
)

@Serializable
data class StreetSegmentView(
  val key: Double,
  val surface: Surface,
  val condition: Condition,
  val width: Width,
  val lanes: Int
)

@Serializable
data class StreetView(
  val id: String,
  val name: String,
  val roadType: RoadType,
  val routeNumber: String? = null,
  val town: String? = null,
  val county: String? = null,
  val state: String? = null,
  val zip: String,
  val surface: Surface,
  val condition: Condition,
  val width: Width,
  val lanes: Int,
  val latitude: Double,
  val longitude: Double,
  val altitude: Double,
  val timestamp: Long,
  val segments: List<StreetSegmentView> = emptyList()
)
