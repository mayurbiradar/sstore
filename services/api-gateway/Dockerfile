FROM eclipse-temurin:21-jdk AS builder
WORKDIR /app

COPY .mvn/ .mvn
COPY pom.xml .
COPY mvnw .
RUN ./mvnw -B dependency:go-offline

COPY src ./src
RUN ./mvnw -B package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
ADD https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/download/v2.19.0/opentelemetry-javaagent.jar /opt/opentelemetry-javaagent.jar
COPY --from=builder /app/target/*.jar gateway.jar
EXPOSE 9090
ENTRYPOINT ["java", "-javaagent:/opt/opentelemetry-javaagent.jar", "-jar", "gateway.jar"]
