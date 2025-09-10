package com.mcmc.dto

import com.mcmc.SignType
import kotlinx.serialization.Serializable

@Serializable
data class StreetSignCreate(
  val streetId: String,
  val signType: SignType? = null,
  val text: String? = null,
  val speedLimit: Int? = null,
  val milePost: Double? = null,
  val latitude: Double? = null,
  val longitude: Double? = null,
  val altitude: Double? = null,
)

@Serializable
data class StreetSignPatch(
  val signType: SignType? = null,
  val text: String? = null,
  val speedLimit: Int? = null,
  val milePost: Double? = null,
  val latitude: Double? = null,
  val longitude: Double? = null,
  val altitude: Double? = null,
)

@Serializable
data class StreetSignView(
  val id: String,
  val streetId: String,
  val signType: SignType,
  val text: String? = null,
  val speedLimit: Int? = null,
  val milePost: Double? = null,
  val latitude: Double,
  val longitude: Double,
  val altitude: Double,
  val timestamp: Long
)
