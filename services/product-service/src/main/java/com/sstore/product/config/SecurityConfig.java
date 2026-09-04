package com.sstore.product.config;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;

@EnableWebSecurity
@EnableMethodSecurity
@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {

        http
            .csrf(AbstractHttpConfigurer::disable)

            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt
                    .jwtAuthenticationConverter(jwtAuthenticationConverter()))
            )

            .authorizeHttpRequests(auth -> auth

                // Kubernetes / Spring Boot Actuator
                .requestMatchers("/actuator/**")
                .permitAll()

                // Public images
                .requestMatchers("/images/**")
                .permitAll()

                // Admin-only endpoints
                .requestMatchers(
                    "/api/products/create-with-image",
                    "/api/products/count"
                )
                .hasRole("ADMIN")

                // Public product APIs
                .requestMatchers("/api/products/**")
                .permitAll()

                // Everything else requires authentication
                .anyRequest()
                .authenticated()
            );

        return http.build();
    }

    @Bean
    public JwtAuthenticationConverter jwtAuthenticationConverter() {

        JwtAuthenticationConverter converter =
                new JwtAuthenticationConverter();

        converter.setJwtGrantedAuthoritiesConverter((Jwt jwt) -> {

            Object access = jwt.getClaims().get("realm_access");

            if (!(access instanceof Map<?, ?> claims)
                    || !(claims.get("roles") instanceof List<?> roles)) {

                return List.of();
            }

            return roles.stream()
                .map(Object::toString)
                .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
                .collect(Collectors.toList());
        });

        return converter;
    }
}
