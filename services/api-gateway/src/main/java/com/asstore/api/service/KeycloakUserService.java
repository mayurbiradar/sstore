package com.asstore.api.service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

@Service
public class KeycloakUserService {
    private final RestClient client;
    private final String keycloakUrl;
    private final String realm;
    private final String adminUsername;
    private final String adminPassword;

    public KeycloakUserService(
        RestClient.Builder builder,
        @Value("${keycloak.url}") String keycloakUrl,
        @Value("${keycloak.realm}") String realm,
        @Value("${keycloak.admin-username}") String adminUsername,
        @Value("${keycloak.admin-password}") String adminPassword) {
        this.client = builder.build();
        this.keycloakUrl = keycloakUrl;
        this.realm = realm;
        this.adminUsername = adminUsername;
        this.adminPassword = adminPassword;
    }

    public List<Map<String, Object>> findAll() {
        String token = adminToken();
        List<Map<String, Object>> users = client.get()
            .uri(adminPath("/users?max=1000"))
            .headers(headers -> headers.setBearerAuth(token))
            .retrieve()
            .body(new ParameterizedTypeReference<>() {});
        if (users == null) return List.of();

        users.forEach(user -> {
            List<Map<String, Object>> roles = client.get()
                .uri(adminPath("/users/" + user.get("id") + "/role-mappings/realm"))
                .headers(headers -> headers.setBearerAuth(token))
                .retrieve()
                .body(new ParameterizedTypeReference<>() {});
            String role = roles != null && roles.stream().anyMatch(item -> "ADMIN".equals(item.get("name"))) ? "ADMIN" : "USER";
            user.put("role", role);
            Map<String, Object> attributes = attributes(user);
            Object phone = attributes.get("phone");
            user.put("phone", phone instanceof List<?> values && !values.isEmpty() ? values.get(0) : phone == null ? "" : phone);
        });
        return users;
    }

    public Map<String, Object> update(String id, Map<String, Object> changes) {
        String token = adminToken();
        String userPath = adminPath("/users/" + id);
        Map<String, Object> user = client.get()
            .uri(userPath)
            .headers(headers -> headers.setBearerAuth(token))
            .retrieve()
            .body(new ParameterizedTypeReference<>() {});
        if (user == null) throw new IllegalStateException("User not found");

        copyIfPresent(changes, user, "firstName");
        copyIfPresent(changes, user, "lastName");
        copyIfPresent(changes, user, "email");
        Map<String, Object> attributes = attributes(user);
        if (changes.containsKey("phone")) attributes.put("phone", List.of(String.valueOf(changes.get("phone"))));
        user.put("attributes", attributes);
        client.put()
            .uri(userPath)
            .headers(headers -> headers.setBearerAuth(token))
            .contentType(MediaType.APPLICATION_JSON)
            .body(user)
            .retrieve()
            .toBodilessEntity();

        if (changes.get("role") != null) updateRole(id, changes.get("role").toString(), token);
        if (changes.containsKey("phone")) user.put("phone", changes.get("phone"));
        return user;
    }

    public Map<String, Object> findById(String id) {
        String token = adminToken();
        Map<String, Object> user = client.get()
            .uri(adminPath("/users/" + id))
            .headers(headers -> headers.setBearerAuth(token))
            .retrieve()
            .body(new ParameterizedTypeReference<>() {});
        if (user == null) throw new IllegalStateException("User not found");
        Map<String, Object> attributes = attributes(user);
        Object phone = attributes.get("phone");
        user.put("phone", phone instanceof List<?> values && !values.isEmpty() ? values.get(0) : phone == null ? "" : phone);
        return user;
    }

    public void delete(String id) {
        String token = adminToken();
        client.delete()
            .uri(adminPath("/users/" + id))
            .headers(headers -> headers.setBearerAuth(token))
            .retrieve()
            .toBodilessEntity();
    }

    public long count() {
        return findAll().size();
    }

    private void updateRole(String id, String role, String token) {
        if (!List.of("ADMIN", "USER").contains(role)) throw new IllegalArgumentException("Unsupported role");
        String mappingsPath = adminPath("/users/" + id + "/role-mappings/realm");
        List<Map<String, Object>> current = client.get()
            .uri(mappingsPath)
            .headers(headers -> headers.setBearerAuth(token))
            .retrieve()
            .body(new ParameterizedTypeReference<>() {});
        List<Map<String, Object>> removable = current == null ? List.of() : current.stream()
            .filter(item -> List.of("ADMIN", "USER").contains(item.get("name")))
            .toList();
        if (!removable.isEmpty()) {
            client.method(org.springframework.http.HttpMethod.DELETE)
                .uri(mappingsPath)
                .headers(headers -> headers.setBearerAuth(token))
                .contentType(MediaType.APPLICATION_JSON)
                .body(removable)
                .retrieve()
                .toBodilessEntity();
        }
        Map<String, Object> roleRepresentation = client.get()
            .uri(adminPath("/roles/" + role))
            .headers(headers -> headers.setBearerAuth(token))
            .retrieve()
            .body(new ParameterizedTypeReference<>() {});
        client.post()
            .uri(mappingsPath)
            .headers(headers -> headers.setBearerAuth(token))
            .contentType(MediaType.APPLICATION_JSON)
            .body(List.of(roleRepresentation))
            .retrieve()
            .toBodilessEntity();
    }

    private String adminToken() {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("client_id", "admin-cli");
        form.add("grant_type", "password");
        form.add("username", adminUsername);
        form.add("password", adminPassword);
        Map<String, Object> response = client.post()
            .uri(keycloakUrl + "/realms/master/protocol/openid-connect/token")
            .contentType(MediaType.APPLICATION_FORM_URLENCODED)
            .body(form)
            .retrieve()
            .body(new ParameterizedTypeReference<>() {});
        if (response == null || response.get("access_token") == null) throw new IllegalStateException("Could not authenticate with Keycloak");
        return response.get("access_token").toString();
    }

    private String adminPath(String path) {
        return keycloakUrl + "/admin/realms/" + realm + path;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> attributes(Map<String, Object> user) {
        Object value = user.get("attributes");
        if (value instanceof Map<?, ?> existing) return (Map<String, Object>) existing;
        Map<String, Object> attributes = new HashMap<>();
        user.put("attributes", attributes);
        return attributes;
    }

    private void copyIfPresent(Map<String, Object> source, Map<String, Object> target, String key) {
        if (source.containsKey(key)) target.put(key, source.get(key));
    }
}
