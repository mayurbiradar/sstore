package com.sstore.product.controller;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.sstore.product.domain.Product;
import com.sstore.product.repository.ProductRepository;

/**
 * Admin analytics — KPI tiles for the dashboard. Read-only.
 *
 * Note: revenue/AOV can't be computed from product_db alone because order
 * data lives in order_db. The saga service (sprint 2) will compute those
 * across DBs. For now this endpoint returns catalog-side analytics only.
 */
@RestController
@RequestMapping("/api/analytics")
@PreAuthorize("hasRole('ADMIN')")
public class AnalyticsController {

    private final ProductRepository productRepo;

    public AnalyticsController(ProductRepository productRepo) { this.productRepo = productRepo; }

    @GetMapping("/catalog")
    public Map<String, Object> catalogOverview() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("generatedAt", Instant.now().toString());

        // Active / inactive counts (the only catalog visibility flag we keep).
        Map<String, Long> byActive = productRepo.countByActive().stream()
                .collect(Collectors.toMap(
                        row -> ((Boolean) row[0]) ? "active" : "inactive",
                        row -> (Long) row[1],
                        (a, b) -> a,
                        LinkedHashMap::new));
        out.put("byActive", byActive);

        // Inventory health. Use findAllNotDeleted() so soft-deleted rows are
        // excluded from the tile counts — they are gone from the catalog.
        List<Product> live = productRepo.findAllNotDeleted();
        long total = live.size();
        long active = live.stream()
                .filter(Product::isActive)
                .count();
        long lowStock = productRepo.findLowStock().size();
        long outOfStock = live.stream()
                .filter(p -> p.isActive() && p.getStock() == 0)
                .count();
        out.put("total", total);
        out.put("active", active);
        out.put("lowStock", lowStock);
        out.put("outOfStock", outOfStock);

        // Catalog value (sum of price * stock for active products).
        BigDecimal catalogValue = live.stream()
                .filter(Product::isActive)
                .map(p -> BigDecimal.valueOf(p.getPrice()).multiply(BigDecimal.valueOf(p.getStock())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        out.put("catalogValuePaise", catalogValue);
        out.put("catalogValueInr", catalogValue.divide(BigDecimal.valueOf(100)));

        return out;
    }

    @GetMapping("/top-selling")
    public List<Product> topSelling(@org.springframework.web.bind.annotation.RequestParam(value = "limit", defaultValue = "10") int limit) {
        return productRepo.findTopSelling(PageRequest.of(0, Math.min(Math.max(limit, 1), 50)));
    }

    @GetMapping("/low-stock")
    public List<Product> lowStock() { return productRepo.findLowStock(); }

    @GetMapping("/recently-updated")
    public List<Product> recentlyUpdated(@org.springframework.web.bind.annotation.RequestParam(value = "hours", defaultValue = "24") int hours,
                                         @org.springframework.web.bind.annotation.RequestParam(value = "limit", defaultValue = "10") int limit) {
        Instant since = Instant.now().minus(Math.max(hours, 1), ChronoUnit.HOURS);
        return productRepo.findRecentlyUpdated(since, PageRequest.of(0, Math.min(Math.max(limit, 1), 50)));
    }
}