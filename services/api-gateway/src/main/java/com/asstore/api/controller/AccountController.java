package com.asstore.api.controller;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.asstore.api.service.KeycloakUserService;

@RestController
@RequestMapping("/api/account")
public class AccountController {
    private final KeycloakUserService userService;

    public AccountController(KeycloakUserService userService) {
        this.userService = userService;
    }

    @PutMapping("/profile")
    public ResponseEntity<Map<String, Object>> updateProfile(Authentication authentication, @RequestBody Map<String, Object> changes) {
        changes.remove("role");
        return ResponseEntity.ok(userService.update(authentication.getName(), changes));
    }

    @GetMapping("/profile")
    public ResponseEntity<Map<String, Object>> getProfile(Authentication authentication) {
        return ResponseEntity.ok(userService.findById(authentication.getName()));
    }
}