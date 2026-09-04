package com.sstore.order.web;

import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.jpa.JpaSystemException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Centralised error responses for order-service.
 *
 * <p>Order-service orchestrates multiple downstream services (inventory,
 * payment). When one of them rejects our request we want the original
 * domain message to reach the user, not a generic 500. The convention used
 * by {@link com.sstore.order.client.InventoryServiceClient} and
 * {@link com.sstore.order.client.PaymentServiceClient} is to rethrow
 * non-2xx responses as {@link IllegalStateException} for 409/400 (with
 * the original message appended) or {@link RuntimeException} for 5xx
 * ("... service unavailable"). We translate those into clean HTTP
 * responses here.</p>
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    /** Inventory / payment said "domain rule violated" → 409, surface the message. */
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalState(IllegalStateException e) {
        log.warn("Domain conflict: {}", e.getMessage());
        return body(HttpStatus.CONFLICT, "DOMAIN_CONFLICT", e.getMessage());
    }

    /** Downstream service is unreachable or returned 5xx → 503. */
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, Object>> handleRuntime(RuntimeException e) {
        // Reserve the specific IllegalStateException mapping above; this is
        // the catch-all for everything else RuntimeException.
        if (e instanceof IllegalStateException) {
            return handleIllegalState((IllegalStateException) e);
        }
        log.error("Unhandled runtime exception in order-service", e);
        return body(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR",
                e.getClass().getSimpleName() + ": " + e.getMessage());
    }

    @ExceptionHandler(HttpServerErrorException.class)
    public ResponseEntity<Map<String, Object>> handleDownstream5xx(HttpServerErrorException e) {
        log.error("Downstream service returned 5xx: {}", e.getStatusCode());
        return body(HttpStatus.SERVICE_UNAVAILABLE, "DOWNSTREAM_ERROR",
                "A downstream service is temporarily unavailable. Please retry.");
    }

    @ExceptionHandler(ResourceAccessException.class)
    public ResponseEntity<Map<String, Object>> handleDownstreamTimeout(ResourceAccessException e) {
        log.error("Downstream service unreachable: {}", e.getMessage());
        return body(HttpStatus.SERVICE_UNAVAILABLE, "DOWNSTREAM_UNREACHABLE",
                "A downstream service is unreachable. Please retry.");
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleForbidden(AccessDeniedException e) {
        return body(HttpStatus.FORBIDDEN, "FORBIDDEN", "You don't have permission to perform this action.");
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .collect(Collectors.joining("; "));
        return body(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", message);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> handleUnreadable(HttpMessageNotReadableException e) {
        return body(HttpStatus.BAD_REQUEST, "MALFORMED_REQUEST", e.getMostSpecificCause().getMessage());
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> handleIntegrity(DataIntegrityViolationException e) {
        return body(HttpStatus.CONFLICT, "DATA_INTEGRITY", e.getMostSpecificCause().getMessage());
    }

    @ExceptionHandler(JpaSystemException.class)
    public ResponseEntity<Map<String, Object>> handleJpaSystem(JpaSystemException e) {
        return body(HttpStatus.NOT_FOUND, "NOT_FOUND", e.getMessage());
    }

    /** Last-resort safety net. */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleUnexpected(Exception e) {
        log.error("Unhandled exception in order-service", e);
        return body(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR",
                e.getClass().getSimpleName() + ": " + e.getMessage());
    }

    private static ResponseEntity<Map<String, Object>> body(HttpStatus status, String code, String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", Instant.now().toString());
        body.put("status", status.value());
        body.put("error", code);
        body.put("message", message);
        return ResponseEntity.status(status).body(body);
    }
}
