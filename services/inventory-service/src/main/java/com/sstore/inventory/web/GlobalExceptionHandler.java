package com.sstore.inventory.web;

import jakarta.persistence.EntityNotFoundException;
import jakarta.persistence.OptimisticLockException;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.jpa.JpaSystemException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Centralised error responses for inventory-service.
 *
 * <p>Without this, Spring's default error handler returns the
 * {@code {"timestamp":...,"status":500,"error":"Internal Server Error",...}}
 * body — which is opaque to the order-service's
 * {@code InventoryServiceClient}, which then wraps every non-409/400 as
 * "Inventory service unavailable". Surfacing the real cause as a 409/400/422
 * lets the caller (and ultimately the user) see something useful.</p>
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    /** Unknown SKU / insufficient stock / domain invariant violation → 409. */
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalState(IllegalStateException e) {
        log.warn("Domain conflict: {}", e.getMessage());
        return body(HttpStatus.CONFLICT, "DOMAIN_CONFLICT", e.getMessage());
    }

    /** Bean validation on @RequestBody DTOs (e.g. @Min(1) on quantity) → 400. */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .collect(Collectors.joining("; "));
        return body(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", message);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Map<String, Object>> handleConstraint(ConstraintViolationException e) {
        return body(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", e.getMessage());
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> handleUnreadable(HttpMessageNotReadableException e) {
        return body(HttpStatus.BAD_REQUEST, "MALFORMED_REQUEST", e.getMostSpecificCause().getMessage());
    }

    @ExceptionHandler({OptimisticLockingFailureException.class, OptimisticLockException.class})
    public ResponseEntity<Map<String, Object>> handleOptimistic(Exception e) {
        return body(HttpStatus.CONFLICT, "CONCURRENT_MODIFICATION", "Another writer changed this row; retry");
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> handleIntegrity(DataIntegrityViolationException e) {
        return body(HttpStatus.CONFLICT, "DATA_INTEGRITY", e.getMostSpecificCause().getMessage());
    }

    @ExceptionHandler({EntityNotFoundException.class, JpaSystemException.class})
    public ResponseEntity<Map<String, Object>> handleNotFound(Exception e) {
        return body(HttpStatus.NOT_FOUND, "NOT_FOUND", e.getMessage());
    }

    /** Last-resort safety net so we never leak a Spring default 500 body. */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleUnexpected(Exception e) {
        log.error("Unhandled exception in inventory-service", e);
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
