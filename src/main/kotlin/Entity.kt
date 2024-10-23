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
enum class Condition { Poor, Potholes, Bumpy, Icy, Smooth, NewlyPaved, Unknown}
enum class Width { Narrow, Regular, Wide, Unknown }
enum class SignType { Exit, SpeedLimit, Stop, Signal, MilePost, Railroad,  Pedestrian, Bicycle, Animal, Direction, Unknown }
enum class IntersectionType { FreewayExit, HighwayExit, SurfaceStreet, Unknown }

@Serializable
@SerialName("Street")
data class Street(
    // Unique street ID
    // Assumption: The client app can correctly fill in the essential properties such as
    // zip, latittude, longitude and altitude without any user input
    //
    // Assumption: Each zip and name and road type combination would be unique
    // Issues / Edge cases: There still can be issues identifying a street given wrong input,
    // which might need other kinds of heuristics based on geolocation and zip codes that
    // can be implelemnted in locateStreet()
    var name: String? = "",
    var roadType: RoadType? = RoadType.Street,
    var routeNumber: String? = "",
    var town: String? = "",
    var county: String? = "",
    var state: String? = "",
    var zip: String? = "",
    var surface: Surface? = Surface.Unknown,
    var condition: Condition? = Condition.Unknown,
    var width: Width? = Width.Unknown,
    var lanes: Int? = 2,
    var latitude: Double? = 0.0,
    var longitude: Double? = 0.0,
    var altitude: Double? = 0.0,
    val segments: MutableMap<Double, StreetAttributes> = mutableMapOf(),
    val signs: MutableSet<String> = mutableSetOf(),
    val intersections: MutableSet<String> = mutableSetOf(),
) : Entity() {
    override var id: String
    override var timestamp: Long = Instant.now().toEpochMilli()

    @Transient
    val streetMutex = Mutex()
    @Transient
    val signMutex = Mutex()
    @Transient
    val xsectMutex = Mutex()

    init {
        id = generateId()
        setLocationFromZip()
        roadType = getTypeFromName(name!!)

        val attr = StreetAttributes(surface!!, condition!!, width!!, lanes!!)
        val location = latitude!! * latitude!! + longitude!! * longitude!! + altitude!! *altitude!!
        segments[location] = attr

        println("Attributes: ${attr.surface} ${attr.condition} ${attr.width} ${attr.lanes}")
    }

    private suspend fun addsegment(location: Double, attr: StreetAttributes) {
        streetMutex.withLock {  // Thread safe
            segments[location] = attr
        }
    }

    private fun setLocationFromZip() {
        val loc = getLocationFromZip(zip!!)
        state = loc.first
        county = loc.second
        town = loc.third
    }

    private fun generateId(): String {
        return generateId(zip!!, roadType!!, name!!)
    }

    fun locateStreet(street: Street): String? {
        // Heuristics for reconciling confusing street properties
        // Possibly lookup GIS data with close matches for
        // latitude, longitude and altitude
        TODO("Not yet implemented")
    }

    suspend fun updateStreet(updatedStreet: Street) {
        val newStreet = copy(
            surface = updatedStreet.surface ?: surface,
            condition = updatedStreet.condition ?: condition,
            width = updatedStreet.width ?: width,
            lanes = updatedStreet.lanes ?: lanes,
            latitude = updatedStreet.latitude ?: latitude,
            longitude = updatedStreet.longitude ?: longitude,
            altitude = updatedStreet.altitude ?: altitude,
        )

        val attr = StreetAttributes(newStreet.surface!!, newStreet.condition!!, newStreet.width!!, newStreet.lanes!!)
        val location = latitude!! * latitude!! + longitude!! * longitude!! + altitude!! *altitude!!
        addsegment(location, attr)
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

    companion object {
        fun generateId(zip:String, roadType: RoadType, name: String): String {
            return MessageDigest.getInstance("SHA-256")
                .digest("$zip-$roadType-$name".toByteArray())
                .joinToString("") { "%02x".format(it) }
        }

        fun getTypeFromName(name: String) : RoadType {
            val parts = name.lowercase().split(" ")
            val part = parts.last().replace(".", "")
            return  when (part) {
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

        private fun getLocationFromZip(zip: String) : Triple<String, String, String> {
            // Obviously not the right thing to dp;
            // Requires some kind of lookup in USPS databases or something
            return Triple("MA", "Middlesex", "Chelmsford")
        }
    }
}

@Serializable
@SerialName("Intersection")
data class Intersection(
    var streetId: String? = "",
    var intersectionType: IntersectionType? = IntersectionType.Unknown,
    var latitude: Double? = 0.0,
    var longitude: Double? = 0.0,
    var altitude: Double? = 0.0,
    val crossStreet: String? = ""
) : Entity() {
    override var id: String
    override var timestamp: Long = Instant.now().toEpochMilli()

    init {
        id = generateId()
    }

    suspend fun updateIntersection(intersection: Intersection, street: Street) {
        val newXsect = copy(
            intersectionType = intersection.intersectionType ?: intersectionType,
            crossStreet = intersection.crossStreet ?: crossStreet,
            latitude = intersection.latitude ?: latitude,
            longitude = intersection.longitude ?: longitude,
            altitude = intersection.altitude ?: altitude,
        )

        street.addIntersection(newXsect.id)
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
    var streetId: String? = "",
    val signType: SignType? = SignType.Unknown,
    var text: String? = "",
    var speedLimit: Int? = 0,
    val milePost: Double? = 0.0,
    var latitude: Double? = 0.0,
    var longitude: Double? = 0.0,
    var altitude: Double? = 0.0,
) : Entity() {
    override var id: String
    override var timestamp: Long = Instant.now().toEpochMilli()

    init {
        id = generateId()
    }

    suspend fun updateSign(updatedSign: StreetSign, street: Street) {
        val newSign = copy(
            signType = updatedSign.signType ?: signType,
            text = updatedSign.text ?: text,
            speedLimit = updatedSign.speedLimit ?: speedLimit,
            milePost = updatedSign.milePost ?: milePost,
            latitude = updatedSign.latitude ?: latitude,
            longitude = updatedSign.longitude ?: longitude,
            altitude = updatedSign.altitude ?: altitude,
        )

        street.addSign(newSign.id)
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
    var surface: Surface = Surface.Unknown,
    var condition: Condition = Condition.Unknown,
    var width: Width = Width.Unknown,
    var lanes: Int = 2,
)
