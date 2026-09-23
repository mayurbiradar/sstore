package com.sstore.product.service;

import com.sstore.product.domain.Product;
import com.sstore.product.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ProductReservationService {

    private final ProductRepository productRepository;

    @Transactional
    public void reserve(List<Line> lines) {
        for (Line line : lines) {
            if (line.quantity() == null || line.quantity() <= 0) {
                throw new IllegalStateException("Quantity must be greater than zero for " + line.sku());
            }
            Product product = productRepository.findBySkuForUpdate(line.sku())
                    .orElseThrow(() -> new IllegalStateException("Unknown SKU " + line.sku()));

            if (line.productId() != null && !line.productId().equals(product.getId())) {
                throw new IllegalStateException("Product does not match SKU " + line.sku());
            }
            if (!product.isActive()) {
                throw new IllegalStateException("Product is unavailable " + line.sku());
            }
            if (product.getStock() < line.quantity()) {
                throw new IllegalStateException("Insufficient stock for " + line.sku());
            }

            product.setStock(product.getStock() - line.quantity());
            product.setUpdatedAt(Instant.now());
            productRepository.save(product);
            log.info("Reserved stock for sku={} qty={} remaining={}", line.sku(), line.quantity(), product.getStock());
        }
    }

    @Transactional
    public void release(List<Line> lines) {
        for (Line line : lines) {
            if (line.quantity() == null || line.quantity() <= 0) {
                throw new IllegalStateException("Quantity must be greater than zero for " + line.sku());
            }
            Product product = productRepository.findBySkuForUpdate(line.sku())
                    .orElseThrow(() -> new IllegalStateException("Unknown SKU " + line.sku()));
            if (line.productId() != null && !line.productId().equals(product.getId())) {
                throw new IllegalStateException("Product does not match SKU " + line.sku());
            }
            product.setStock(product.getStock() + line.quantity());
            product.setUpdatedAt(Instant.now());
            productRepository.save(product);
            log.info("Released stock for sku={} qty={} available={}", line.sku(), line.quantity(), product.getStock());
        }
    }

    public record Line(String sku, UUID productId, Integer quantity) {}
}
