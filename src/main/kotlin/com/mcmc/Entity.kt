package com.mcmc

import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.Transient
import java.security.MessageDigest
import java.time.Instant
import java.util.*

@Serializable
sealed class Entity {
  abstract var id: String
  abstract val timestamp: Long
}

enum class RoadType { Boulevard, Avenue, Road, Street, Lane, Way, Drive, Circle, Highway, Freeway, Interstate, Unknown }
enum class Surface { Dirt, Gravel, Asphalt, Concrete, Unknown }
enum class Condition { Poor, Potholes, Bumpy, Icy, Smooth, NewlyPaved, Unknown }
enum class Width { Narrow, Regular, Wide, Unknown }
enum class SignType { Exit, SpeedLimit, Stop, Signal, MilePost, Railroad, Pedestrian, Bicycle, Animal, Direction, Unknown }
enum class IntersectionType { FreewayExit, HighwayExit, SurfaceStreet, Unknown }

@Serializable
@SerialName("Street")
data class Street(
  override var id: String = "",
  // Unique street ID
  // Assumption: The client app can correctly fill in the essential properties such as
  // zip, latittude, longitude and altitude without any user input
  //
  // Assumption: Each zip and name and road type combination would be unique
  // Issues / Edge cases: There still can be issues identifying a street given wrong input,
  // which might need other kinds of heuristics based on geolocation and zip codes that
  // can be implelemnted in locateStreet()
  var name: String = "",
  var roadType: RoadType = RoadType.Street,
  var routeNumber: String? = "",
  var town: String? = "",
  var county: String? = "",
  var state: String? = "",
  var zip: String = "",
  var surface: Surface = Surface.Asphalt,
  var condition: Condition = Condition.Smooth,
  var width: Width = Width.Regular,
  var lanes: Int = 2,
  var latitude: Double = 0.0,
  var longitude: Double = 0.0,
  var altitude: Double = 0.0,
  val segments: MutableMap<Double, StreetAttributes> = mutableMapOf(),
  val signs: MutableSet<String> = mutableSetOf(),
  val intersections: MutableSet<String> = mutableSetOf(),
) : Entity() {
  override var timestamp: Long = Instant.now().toEpochMilli()

  @Transient
  val streetMutex = Mutex()

  @Transient
  val signMutex = Mutex()

  @Transient
  val xsectMutex = Mutex()

  init {
    // generate ONLY if id missing AND inputs present
    if (id.isBlank() && name.isNotBlank() && zip.isNotBlank()) {
      id = generateId(zip, roadType, name)
    }

    // derive-from-zip only when zip provided
    if (zip.isNotBlank()) setLocationFromZip()

    val lat = latitude ?: 0.0
    val lon = longitude ?: 0.0
    val alt = altitude ?: 0.0
    val location = lat * lat + lon * lon + alt * alt
    segments[location] = StreetAttributes(surface, condition, width, lanes)
  }

  private suspend fun addSegment(location: Double, attr: StreetAttributes) {
    streetMutex.withLock {  // Thread safe
      segments[location] = attr
    }
  }

  private fun setLocationFromZip() {
    val loc = getLocationFromZip(zip)
    state = loc.first
    county = loc.second
    town = loc.third
  }

  fun locateStreet(street: Street): String? {
    // Heuristics for reconciling confusing street properties
    // Possibly lookup GIS data with close matches for
    // latitude, longitude and altitude
    TODO("Not yet implemented")
  }

  suspend fun updateStreet(updated: Street) {
    surface = updated.surface
    condition = updated.condition
    width = updated.width
    lanes = updated.lanes
    latitude = updated.latitude
    longitude = updated.longitude
    altitude = updated.altitude

    addSegment(latitude * latitude + longitude * longitude + altitude * altitude,
      StreetAttributes(surface, condition, width, lanes)
    )
  }

  suspend fun addSign(id: String) {
    signMutex.withLock {  // Thread safe
      signs.add(id)
    }
  }

  suspend fun addIntersection(id: String) {
    xsectMutex.withLock {  // Thread safe
      intersections.add(id)
    }
  }

  fun updateStreet(updatedStreet: Map<String, List<String>>) {
    TODO("Not yet implemented")
  }

  companion object {
    fun generateId(zip: String, roadType: RoadType, name: String): String {
      return MessageDigest.getInstance("SHA-256")
        .digest("$zip-$roadType-$name".toByteArray())
        .joinToString("") { "%02x".format(it) }
    }

    fun getTypeFromName(name: String): RoadType {
      val parts = name.lowercase().split(" ")
      val part = parts.last().replace(".", "")
      return when (part) {
        "av" -> RoadType.Avenue
        "ave" -> RoadType.Avenue
        "blvd" -> RoadType.Boulevard
        "rd" -> RoadType.Road
        "st" -> RoadType.Street
        "dr" -> RoadType.Drive
        // Not exhaustive
        else -> RoadType.Road
      }
    }

    private fun getLocationFromZip(zip: String): Triple<String, String, String> {
      // Obviously not the right thing to dp;
      // Requires some kind of lookup in USPS databases or something
      return Triple("MA", "Middlesex", "Chelmsford")
    }
  }
}

@Serializable
@SerialName("Intersection")
data class Intersection(
  override var id: String = "",

  var streetId: String? = "",
  var intersectionType: IntersectionType? = IntersectionType.SurfaceStreet,
  var latitude: Double = 0.0,
  var longitude: Double = 0.0,
  var altitude: Double = 0.0,
  var crossStreet: String? = ""
) : Entity() {
  override var timestamp: Long = Instant.now().toEpochMilli()

  init {
    id = generateId()
  }

  suspend fun updateIntersection(intersection: Intersection, street: Street) {
    streetId = street.id
    intersectionType = intersection.intersectionType ?: intersectionType
    crossStreet = intersection.crossStreet ?: crossStreet
    latitude = intersection.latitude
    longitude = intersection.longitude
    altitude = intersection.altitude

    street.addIntersection(id)
  }

  fun locateXsect(sign: Intersection): String? {
    // Heuristics for reconciling confusing intersection location and  properties
    // Possibly lookup GIS data with close matches for
    // latitude, longitude and altitude
    // Also could use satellite imaging or something instead or additionally
    // to pinpoint the location relative to the correct position of the sign
    // Possibly help generating IDs more optimally
    TODO("Not yet implemented")
  }

  companion object {
    // The identification of intersection is probably not optimal
    // Cannot really use the latitude, longitude and altitude
    // It is impossible to pinpoint where exactly the location
    // was recorded relative to the correct position of the sign
    fun generateId(): String {
      return UUID.randomUUID().toString()
    }
  }
}

@Serializable
@SerialName("Sign")
data class StreetSign(
  override var id: String = "",

  var streetId: String? = "",
  var signType: SignType = SignType.Stop,
  var text: String? = "Stop",
  var speedLimit: Int = 0,
  var milePost: Double = 0.0,
  var latitude: Double = 0.0,
  var longitude: Double = 0.0,
  var altitude: Double = 0.0,
) : Entity() {
  override var timestamp: Long = Instant.now().toEpochMilli()

  init {
    id = generateId()
  }

  suspend fun updateSign(updatedSign: StreetSign, street: Street) {
    streetId = street.id
    signType = updatedSign.signType ?: signType
    text = updatedSign.text ?: text
    speedLimit = updatedSign.speedLimit
    milePost = updatedSign.milePost
    latitude = updatedSign.latitude
    longitude = updatedSign.longitude
    altitude = updatedSign.altitude

    street.addSign(id)
  }

  fun locateSign(sign: StreetSign): String? {
    // Heuristics for reconciling confusing sign location and  properties
    // Possibly lookup GIS data with close matches for
    // latitude, longitude and altitude
    // Also could use satellite imaging or something instead or additionally
    // Possibly help generating IDs more optimally
    TODO("Not yet implemented")
  }

  companion object {
    // The identification of street sign is probably not optimal
    // Cannot really use the latitude, longitude and altitude
    // It is impossible to pinpoint where exactly the location
    // was recorded relative to the correct position of the sign
    fun generateId(): String {
      return UUID.randomUUID().toString()
    }
  }
}

@Serializable
@SerialName("Segment")
data class StreetAttributes(
  var surface: Surface = Surface.Asphalt,
  var condition: Condition = Condition.Smooth,
  var width: Width = Width.Regular,
  var lanes: Int = 2,
)
