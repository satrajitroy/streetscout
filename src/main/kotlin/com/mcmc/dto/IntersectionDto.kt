package com.mcmc.dto

import com.mcmc.IntersectionType
import kotlinx.serialization.Serializable

@Serializable
data class IntersectionCreate(
  val streetId: String,
  val intersectionType: IntersectionType? = null,
  val crossStreet: String? = null,
  val latitude: Double? = null,
  val longitude: Double? = null,
  val altitude: Double? = null,
)

@Serializable
data class IntersectionPatch(
  val intersectionType: IntersectionType? = null,
  val crossStreet: String? = null,
  val latitude: Double? = null,
  val longitude: Double? = null,
  val altitude: Double? = null,
)

@Serializable
data class IntersectionView(
  val id: String,
  val streetId: String,
  val intersectionType: IntersectionType,
  val crossStreet: String? = null,
  val latitude: Double,
  val longitude: Double,
  val altitude: Double,
  val timestamp: Long
)
