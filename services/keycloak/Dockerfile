FROM quay.io/keycloak/keycloak:25.0

ENV KC_HEALTH_ENABLED=true
ENV KC_HTTP_ENABLED=true

# Memory tuning for Render free tier (512MB).
# Quarkus + JVM is heavy by default; these flags cut memory ~50%.
ENV JAVA_OPTS="-Xms128m -Xmx384m -XX:MetaspaceSize=64M -XX:MaxMetaspaceSize=192m -XX:+UseG1GC -XX:MaxRAMPercentage=70.0"

# bootstrap.sh is only used by the separate "sstore-keycloak-bootstrap" job,
# not by this Keycloak container itself, so we don't need to COPY it here.

EXPOSE 10000

# Render injects a $PORT env var (defaults to 10000). Keycloak must listen on
# exactly that port so Render can detect and forward traffic to it.
ENTRYPOINT ["/bin/sh", "-c"]
CMD ["PORT=${PORT:-10000}; echo \"Starting Keycloak on port $PORT (java opts: $JAVA_OPTS)\"; export JAVA_OPTS_KC_HEAP=\"$JAVA_OPTS\"; if [ \"$KC_DB\" = \"postgres\" ]; then /opt/keycloak/bin/kc.sh start --http-port=$PORT --hostname-strict=false --import-realm; else /opt/keycloak/bin/kc.sh start-dev --http-port=$PORT --hostname-strict=false; fi"]