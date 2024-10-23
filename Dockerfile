# Build
FROM maven:3.8.5-openjdk-17 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

# Create image
FROM openjdk:17-jdk-slim
WORKDIR /app
COPY --from=build /app/target/StreetScout-1.0-SNAPSHOT.jar /app/streetscout.jar

EXPOSE 8080

# Run the application when the container starts
ENTRYPOINT ["java", "-jar", "/app/streetscout.jar"]
