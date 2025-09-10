package com.mcmc.mappers

import com.mcmc.SignType
import com.mcmc.Street
import com.mcmc.StreetSign
import com.mcmc.dto.StreetSignCreate
import com.mcmc.dto.StreetSignPatch
import com.mcmc.dto.StreetSignView

fun StreetSignCreate.toEntity(): StreetSign = StreetSign(
  streetId = streetId,
  signType = signType ?: SignType.Unknown,
  text = text,
  speedLimit = speedLimit ?: 0,
  milePost = milePost ?: 0.0,
  latitude = latitude ?: 0.0,
  longitude = longitude ?: 0.0,
  altitude = altitude ?: 0.0,
)

fun StreetSignPatch.toEntity(): StreetSign = StreetSign(
  signType = signType ?: SignType.Unknown,
  text = text,
  speedLimit = speedLimit ?: 0,
  milePost = milePost ?: 0.0,
  latitude = latitude ?: 0.0,
  longitude = longitude ?: 0.0,
  altitude = altitude ?: 0.0,
)

suspend fun StreetSign.apply(p: StreetSignPatch, street: Street) {
  val updated = copy(
    signType = p.signType ?: signType,
    text = p.text ?: text,
    speedLimit = p.speedLimit ?: speedLimit,
    milePost = p.milePost ?: milePost,
    latitude = p.latitude ?: latitude,
    longitude = p.longitude ?: longitude,
    altitude = p.altitude ?: altitude,
  )
  updateSign(updated, street)
}

fun StreetSign.toView() = StreetSignView(
  id, streetId!!, signType!!, text, speedLimit, milePost,
  latitude!!, longitude!!, altitude!!, timestamp
)
