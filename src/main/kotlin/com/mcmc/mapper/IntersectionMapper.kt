package com.mcmc.mappers

import com.mcmc.Intersection
import com.mcmc.IntersectionType
import com.mcmc.Street
import com.mcmc.dto.IntersectionCreate
import com.mcmc.dto.IntersectionPatch
import com.mcmc.dto.IntersectionView


fun IntersectionCreate.toEntity(): Intersection = Intersection(
  streetId = streetId,
  intersectionType = intersectionType ?: IntersectionType.Unknown,
  crossStreet = crossStreet,
  latitude = latitude ?: 0.0,
  longitude = longitude ?: 0.0,
  altitude = altitude ?: 0.0,
)

fun IntersectionPatch.toEntity(): Intersection = Intersection(
  intersectionType = intersectionType ?: IntersectionType.Unknown,
  crossStreet = crossStreet,
  latitude = latitude ?: 0.0,
  longitude = longitude ?: 0.0,
  altitude = altitude ?: 0.0,
)

suspend fun Intersection.apply(p: IntersectionPatch, street: Street) {
  val updated = copy(
    intersectionType = p.intersectionType ?: intersectionType,
    crossStreet = p.crossStreet ?: crossStreet,
    latitude = p.latitude ?: latitude,
    longitude = p.longitude ?: longitude,
    altitude = p.altitude ?: altitude,
  )
  updateIntersection(updated, street)
}

fun Intersection.toView() = IntersectionView(
  id, streetId!!, intersectionType!!, crossStreet,
  latitude!!, longitude!!, altitude!!, timestamp
)
