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
COPY --from=builder /app/target/*.jar gateway.jar
EXPOSE 9090
ENTRYPOINT ["java", "-jar", "gateway.jar"]
