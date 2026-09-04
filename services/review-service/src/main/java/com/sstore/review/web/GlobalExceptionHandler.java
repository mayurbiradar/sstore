// filepath: services/review-service/src/main/java/com/sstore/review/web/GlobalExceptionHandler.java
package com.sstore.review.web;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.jpa.JpaSystemException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import lombok.extern.slf4j.Slf4j;

/**
 * Centralised error responses for review-service. Without this advice, any
 * uncaught exception surfaces as a generic 500 with no body — making
 * debugging from the gateway / browser painful. The convention used by the
 * other SStore services (see order-service {@code GlobalExceptionHandler})
 * is: stable error code, short message, full stack in the server log.
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    /** Domain rule violated by the caller (e.g. "user has no delivered order"). */
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalState(IllegalStateException e) {
        log.warn("Domain conflict: {}", e.getMessage());
        return body(HttpStatus.CONFLICT, "DOMAIN_CONFLICT", e.getMessage());
    }

    /** Bean-validation failure on a request body. */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .reduce((a, b) -> a + "; " + b)
                .orElse("validation failed");
        return body(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", message);
    }

    /** Malformed JSON / wrong types in the request body. */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> handleUnreadable(HttpMessageNotReadableException e) {
        return body(HttpStatus.BAD_REQUEST, "MALFORMED_REQUEST",
                e.getMostSpecificCause().getMessage());
    }

    /** Caller is authenticated but lacks the required role / ownership. */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleForbidden(AccessDeniedException e) {
        return body(HttpStatus.FORBIDDEN, "FORBIDDEN", "You don't have permission to perform this action.");
    }

    /** DB-level uniqueness or referential integrity failure. */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> handleIntegrity(DataIntegrityViolationException e) {
        return body(HttpStatus.CONFLICT, "DATA_INTEGRITY", e.getMostSpecificCause().getMessage());
    }

    @ExceptionHandler(JpaSystemException.class)
    public ResponseEntity<Map<String, Object>> handleJpaSystem(JpaSystemException e) {
        return body(HttpStatus.NOT_FOUND, "NOT_FOUND", e.getMessage());
    }

    /** Last-resort safety net. Logs the full stack so STS shows the cause. */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleUnexpected(Exception e) {
        log.error("Unhandled exception in review-service", e);
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
