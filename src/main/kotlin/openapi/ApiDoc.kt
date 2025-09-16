@file:OptIn(kotlinx.serialization.ExperimentalSerializationApi::class)

package openapi

import kotlinx.serialization.descriptors.*
import kotlinx.serialization.json.*
import kotlinx.serialization.serializer

// ---------- Model ----------

data class Resource(
  val path: String,                 // e.g. "/streetscout/street" (no /api here)
  val idName: String = "id",
  val descriptor: SerialDescriptor,
  val requiredCreate: List<String> = emptyList(), // non-empty helps UI render Create card
  val pageDefault: Int = 1,
  val sizeDefault: Int = 8,
  val addFilters: Boolean = true
)

inline fun <reified T : Any> resource(
  path: String,
  idName: String = "id",
  requiredCreate: List<String> = emptyList(),
  pageDefault: Int = 1,
  sizeDefault: Int = 8,
  addFilters: Boolean = true
): Resource = Resource(
  path = path,
  idName = idName,
  descriptor = serializer<T>().descriptor,
  requiredCreate = requiredCreate,
  pageDefault = pageDefault,
  sizeDefault = sizeDefault,
  addFilters = addFilters
)

// Single Json instance to avoid “redundant creation” warnings.
private val JSON_PRETTY = Json { prettyPrint = true }

// ---------- Public entry point ----------

fun openApiForMany(
  resources: List<Resource>,
  title: String = "API",
  version: String = "latest",
  basePrefix: String = "/api"
): String {
  val paths = buildJsonObject {
    resources.forEach { r ->
      val pr = perResourcePaths(r, basePrefix)
      for ((k, v) in pr) put(k, v)
    }
  }
  val schemas = buildJsonObject {
    resources.forEach { r ->
      val sc = perResourceSchemas(r.descriptor, r.idName, r.requiredCreate) // <-- fixed call
      for ((k, v) in sc) put(k, v)
    }
  }

  val root = buildJsonObject {
    put("openapi", JsonPrimitive("3.1.0"))
    put("info", buildJsonObject {
      put("title", JsonPrimitive(title))
      put("version", JsonPrimitive(version))
    })
    put("externalDocs", buildJsonObject { put("url", JsonPrimitive("/")) })
    put("servers", JsonArray(emptyList()))
    put("tags", JsonArray(emptyList()))
    put("paths", paths)
    put("components", buildJsonObject {
      put("schemas", schemas)
      put("examples", buildJsonObject {})
    })
    put("webhooks", buildJsonObject {})
  }
  return JSON_PRETTY.encodeToString(JsonObject.serializer(), root)
}

// ---------- Helpers ----------
private fun normBase(base: String) = "/" + base.trim('/')
private fun joinPath(base: String, tail: String): String =
  (normBase(base).trimEnd('/') + "/" + tail.trimStart('/')).replace(Regex("/{2,}"), "/")

private fun schemaNameFor(d: SerialDescriptor): String =
  d.serialName.substringAfterLast('.').substringAfterLast('$')

private fun jsonSchemaForScalar(d: SerialDescriptor): JsonObject = buildJsonObject {
  when (d.kind) {
    PrimitiveKind.STRING -> put("type", JsonPrimitive("string"))
    PrimitiveKind.BOOLEAN -> put("type", JsonPrimitive("boolean"))
    PrimitiveKind.INT, PrimitiveKind.LONG -> put("type", JsonPrimitive("integer"))
    PrimitiveKind.FLOAT, PrimitiveKind.DOUBLE -> put("type", JsonPrimitive("number"))
    SerialKind.ENUM -> {
      put("type", JsonPrimitive("string"))
      val enums = (0 until d.elementsCount).map { d.getElementName(it) }
      put("enum", JsonArray(enums.map(::JsonPrimitive)))
    }
    else -> put("type", JsonPrimitive("string"))
  }
}

private fun asNullable(base: JsonObject): JsonObject = buildJsonObject {
  for ((k, v) in base) put(k, v)
  put("nullable", JsonPrimitive(true)) // 3.0-style, widely supported by UIs even under 3.1
}

private class SchemaBag {
  val components = mutableMapOf<String, JsonObject>()
  fun add(name: String, schema: JsonObject) { components[name] = schema }
}

// Build a shallow object schema from a descriptor (scalars/enums only)
private fun objectSchemaFromDescriptor(d: SerialDescriptor, required: Set<String> = emptySet()): JsonObject {
  val props = buildJsonObject {
    for (i in 0 until d.elementsCount) {
      val name = d.getElementName(i)
      val ed = d.getElementDescriptor(i)
      when (ed.kind) {
        PrimitiveKind.STRING, PrimitiveKind.BOOLEAN,
        PrimitiveKind.INT, PrimitiveKind.LONG,
        PrimitiveKind.FLOAT, PrimitiveKind.DOUBLE,
        SerialKind.ENUM -> put(name, jsonSchemaForScalar(ed))
        else -> {} // skip nested objects/collections for item types
      }
    }
  }
  return buildJsonObject {
    put("type", JsonPrimitive("object"))
    put("properties", props)
    if (required.isNotEmpty())
      put("required", JsonArray(required.map(::JsonPrimitive)))
    put("title", JsonPrimitive(schemaNameFor(d)))
  }
}

// ---------- Schemas (per resource) ----------

private fun perResourceSchemas(
  root: SerialDescriptor,
  idName: String,
  requiredCreate: List<String>
): Map<String, JsonObject> {
  val bag = SchemaBag()
  val baseName = schemaNameFor(root).removeSuffix("View")
  val viewName = "${baseName}View"
  val createName = "${baseName}Create"
  val patchName = "${baseName}Patch"
  val pageName = "com.mcmc.Page_${viewName}"

  // View: include scalars/enums AND arrays of object types
  val viewProps = buildJsonObject {
    for (i in 0 until root.elementsCount) {
      val fname = root.getElementName(i)
      val fd = root.getElementDescriptor(i)
      when {
        fd.kind in setOf(
          PrimitiveKind.STRING, PrimitiveKind.BOOLEAN,
          PrimitiveKind.INT, PrimitiveKind.LONG,
          PrimitiveKind.FLOAT, PrimitiveKind.DOUBLE,
          SerialKind.ENUM
        ) -> put(fname, jsonSchemaForScalar(fd))

        fd.kind is StructureKind.LIST && fd.getElementDescriptor(0).kind is StructureKind.CLASS -> {
          val itemDesc = fd.getElementDescriptor(0)
          val itemName = schemaNameFor(itemDesc)
          if (!bag.components.containsKey(itemName)) {
            bag.add(itemName, objectSchemaFromDescriptor(itemDesc))
          }
          put(fname, buildJsonObject {
            put("type", JsonPrimitive("array"))
            put("items", buildJsonObject { put("\$ref", JsonPrimitive("#/components/schemas/$itemName")) })
          })
        }

        else -> { /* skip maps/nested objects */ }
      }
    }
  }

  val viewSchema = buildJsonObject {
    put("type", JsonPrimitive("object"))
    put("properties", viewProps)
    put("required", JsonArray(listOf(JsonPrimitive(idName))))
    put("title", JsonPrimitive(viewName))
  }

  // Create: scalars/enums only (no arrays)
  val createProps = buildJsonObject {
    for (i in 0 until root.elementsCount) {
      val fname = root.getElementName(i)
      if (fname == idName) continue
      val fd = root.getElementDescriptor(i)
      if (fd.kind in setOf(
          PrimitiveKind.STRING, PrimitiveKind.BOOLEAN,
          PrimitiveKind.INT, PrimitiveKind.LONG,
          PrimitiveKind.FLOAT, PrimitiveKind.DOUBLE,
          SerialKind.ENUM
        )
      ) put(fname, jsonSchemaForScalar(fd))
    }
  }
  val createSchema = buildJsonObject {
    put("type", JsonPrimitive("object"))
    put("properties", createProps)
    put("required", JsonArray(requiredCreate.map(::JsonPrimitive)))
    put("title", JsonPrimitive(createName))
  }

  // Patch: scalars/enums only (nullable)
  val patchProps = buildJsonObject {
    for (i in 0 until root.elementsCount) {
      val fname = root.getElementName(i)
      if (fname == idName) continue
      val fd = root.getElementDescriptor(i)
      if (fd.kind in setOf(
          PrimitiveKind.STRING, PrimitiveKind.BOOLEAN,
          PrimitiveKind.INT, PrimitiveKind.LONG,
          PrimitiveKind.FLOAT, PrimitiveKind.DOUBLE,
          SerialKind.ENUM
        )
      ) {
        put(fname, asNullable(jsonSchemaForScalar(fd)))
      }
    }
  }
  val patchSchema = buildJsonObject {
    put("type", JsonPrimitive("object"))
    put("properties", patchProps)
    put("title", JsonPrimitive(patchName))
  }

  // Page wrapper
  val pageSchema = buildJsonObject {
    put("type", JsonPrimitive("object"))
    put("properties", buildJsonObject {
      put("items", buildJsonObject {
        put("type", JsonPrimitive("array"))
        put("items", buildJsonObject { put("\$ref", JsonPrimitive("#/components/schemas/$viewName")) })
        put("title", JsonPrimitive("ArrayList<$viewName>"))
      })
      put("page", buildJsonObject { put("type", JsonPrimitive("integer")); put("format", JsonPrimitive("int32")); put("title", JsonPrimitive("Int")) })
      put("size", buildJsonObject { put("type", JsonPrimitive("integer")); put("format", JsonPrimitive("int32")); put("title", JsonPrimitive("Int")) })
      put("total", buildJsonObject { put("type", JsonPrimitive("integer")); put("format", JsonPrimitive("int32")); put("title", JsonPrimitive("Int")) })
    })
    put("required", JsonArray(listOf("items","page","size","total").map(::JsonPrimitive)))
    put("title", JsonPrimitive("Page<$viewName>"))
  }

  return buildMap {
    put(viewName, viewSchema)
    put(createName, createSchema)
    put(patchName, patchSchema)
    put(pageName, pageSchema)
    putAll(bag.components) // e.g., StreetSegmentView component
  }
}

private fun buildListParams(rootDesc: SerialDescriptor, r: Resource): JsonArray =
  buildJsonArray {
    // page
    add(buildJsonObject {
      put("name", JsonPrimitive("page"))
      put("in", JsonPrimitive("query"))
      put("required", JsonPrimitive(false))
      put("deprecated", JsonPrimitive(false))
      put("explode", JsonPrimitive(false))
      put("schema", buildJsonObject {
        put("type", JsonPrimitive("integer"))
        put("format", JsonPrimitive("int32"))
        put("title", JsonPrimitive("Int"))
      })
      put("example", JsonPrimitive(r.pageDefault))
    })
    // size
    add(buildJsonObject {
      put("name", JsonPrimitive("size"))
      put("in", JsonPrimitive("query"))
      put("required", JsonPrimitive(false))
      put("deprecated", JsonPrimitive(false))
      put("explode", JsonPrimitive(false))
      put("schema", buildJsonObject {
        put("type", JsonPrimitive("integer"))
        put("format", JsonPrimitive("int32"))
        put("title", JsonPrimitive("Int"))
      })
      put("example", JsonPrimitive(r.sizeDefault))
    })

    if (r.addFilters) {
      // Add scalar/enum filters for each property except the id
      for (i in 0 until rootDesc.elementsCount) {
        val fname = rootDesc.getElementName(i)
        if (fname == r.idName) continue
        val fd = rootDesc.getElementDescriptor(i)

        val isScalarOrEnum = when (fd.kind) {
          PrimitiveKind.STRING, PrimitiveKind.BOOLEAN,
          PrimitiveKind.INT, PrimitiveKind.LONG,
          PrimitiveKind.FLOAT, PrimitiveKind.DOUBLE,
          SerialKind.ENUM -> true
          else -> false
        }
        if (!isScalarOrEnum) continue

        add(buildJsonObject {
          put("name", JsonPrimitive(fname))
          put("in", JsonPrimitive("query"))
          put("required", JsonPrimitive(false))
          put("deprecated", JsonPrimitive(false))
          put("explode", JsonPrimitive(false))
          // Reuse the same scalar schema builder so enums stay visible to the UI
          put("schema", jsonSchemaForScalar(fd))
          // Optional: a short description helps some UIs
          // put("description", JsonPrimitive("Filter by $fname (equals)"))
        })
      }
    }
  }

// ---------- Paths (per resource) ----------
private fun perResourcePaths(r: Resource, basePrefix: String): Map<String, JsonElement> {
  val rootDesc = r.descriptor
  val cap = r.path.substringAfterLast('/').replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
  val basePath = joinPath(basePrefix, r.path)

  // NEW: names derived from descriptor (must match perResourceSchemas)
  val baseName = schemaNameFor(rootDesc).removeSuffix("View")
  val viewName = "${baseName}View"                   // e.g. StreetSignView
  val createName = "${baseName}Create"              // e.g. StreetSignCreate
  val patchName = "${baseName}Patch"                // e.g. StreetSignPatch
  val pageName = "com.mcmc.Page_${viewName}"        // e.g. com.mcmc.Page_StreetSignView

  val paths = mutableMapOf<String, JsonElement>()

  // GET list
  paths[basePath] = buildJsonObject {
    put("get", buildJsonObject {
      put("tags", JsonArray(emptyList()))
      put("summary", JsonPrimitive("List ${cap}s (paged)"))
      put("parameters", buildListParams(rootDesc, r))        // your existing builder
      put("responses", buildJsonObject {
        put("200", buildJsonObject {
          put("headers", buildJsonObject {})
          put("content", buildJsonObject {
            put("application/json", buildJsonObject {
              put("schema", buildJsonObject {
                put("\$ref", JsonPrimitive("#/components/schemas/$pageName"))
              })
            })
          })
        })
      })
      put("deprecated", JsonPrimitive(false))
    })
  }

  // GET by id
  paths[joinPath(basePath, "{id}")] = buildJsonObject {
    put("get", buildJsonObject {
      put("tags", JsonArray(emptyList()))
      put("summary", JsonPrimitive("Get $cap by id"))
      put("parameters", JsonArray(emptyList()))
      put("responses", buildJsonObject {
        put("200", buildJsonObject {
          put("headers", buildJsonObject {})
          put("content", buildJsonObject {
            put("application/json", buildJsonObject {
              put("schema", buildJsonObject { put("\$ref", JsonPrimitive("#/components/schemas/$viewName")) })
            })
          })
        })
        put("404", buildJsonObject { put("headers", buildJsonObject {}) })
      })
      put("deprecated", JsonPrimitive(false))
    })
  }

  // POST submit
  paths[joinPath(basePath, "submit")] = buildJsonObject {
    put("post", buildJsonObject {
      put("tags", JsonArray(emptyList()))
      put("summary", JsonPrimitive("Create/Upsert $cap"))
      put("parameters", JsonArray(emptyList()))
      put("requestBody", buildJsonObject {
        put("content", buildJsonObject {
          put("application/json", buildJsonObject {
            put("schema", buildJsonObject { put("\$ref", JsonPrimitive("#/components/schemas/$createName")) })
          })
        })
        put("required", JsonPrimitive(false))
      })
      put("responses", buildJsonObject {
        put("200", buildJsonObject {
          put("headers", buildJsonObject {})
          put("content", buildJsonObject {
            put("application/json", buildJsonObject {
              put("schema", buildJsonObject { put("type", JsonPrimitive("string")); put("title", JsonPrimitive("String")) })
            })
          })
        })
      })
      put("deprecated", JsonPrimitive(false))
    })
  }

  // PUT edit/{id}
  paths[joinPath(basePath, "edit/{id}")] = buildJsonObject {
    put("put", buildJsonObject {
      put("tags", JsonArray(emptyList()))
      put("summary", JsonPrimitive("Update $cap"))
      put("parameters", JsonArray(emptyList()))
      put("requestBody", buildJsonObject {
        put("content", buildJsonObject {
          put("application/json", buildJsonObject {
            put("schema", buildJsonObject { put("\$ref", JsonPrimitive("#/components/schemas/$patchName")) })
          })
        })
        put("required", JsonPrimitive(false))
      })
      put("responses", buildJsonObject {
        put("200", buildJsonObject {
          put("headers", buildJsonObject {})
          put("content", buildJsonObject {
            put("application/json", buildJsonObject {
              put("schema", buildJsonObject { put("type", JsonPrimitive("string")); put("title", JsonPrimitive("String")) })
            })
          })
        })
      })
      put("deprecated", JsonPrimitive(false))
    })
  }

  // DELETE delete/{id} (no schema refs here)
  paths[joinPath(basePath, "delete/{id}")] = buildJsonObject {
    put("delete", buildJsonObject {
      put("tags", JsonArray(emptyList()))
      put("summary", JsonPrimitive("Delete $cap"))
      put("parameters", JsonArray(emptyList()))
      put("responses", buildJsonObject {
        put("200", buildJsonObject {
          put("headers", buildJsonObject {})
          put("content", buildJsonObject {
            put("application/json", buildJsonObject {
              put("schema", buildJsonObject { put("type", JsonPrimitive("string")); put("title", JsonPrimitive("String")) })
            })
          })
        })
      })
      put("deprecated", JsonPrimitive(false))
    })
  }

  return paths
}
