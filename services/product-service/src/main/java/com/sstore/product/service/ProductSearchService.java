package com.sstore.product.service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import com.sstore.product.domain.Product;

/**
 * Builds JPA Specifications for the admin catalog search endpoint.
 *
 * Kept package-private to service so callers can't bypass the controller layer.
 */
@Component
public class ProductSearchService {

    public enum StockFilter { ANY, IN_STOCK, LOW_STOCK, OUT_OF_STOCK }

    /** Compose every clause; nulls/empties short-circuit so the SQL stays lean. */
    public Specification<Product> build(
            String q,
            Boolean active,
            Boolean featured,
            StockFilter stock,
            BigDecimal minPrice,
            BigDecimal maxPrice
    ) {
        List<Specification<Product>> specs = new ArrayList<>();
        // Always exclude soft-deleted rows from the admin view.
        specs.add((root, query, cb) -> cb.isNull(root.get("deletedAt")));

        if (StringUtils.hasText(q)) {
            String like = "%" + q.toLowerCase() + "%";
            specs.add((root, query, cb) -> cb.or(
                    cb.like(cb.lower(root.get("name")), like),
                    cb.like(cb.lower(root.get("sku")), like),
                    cb.like(cb.lower(cb.coalesce(root.get("description"), "")), like)
            ));
        }

        if (active != null) {
            specs.add((root, query, cb) -> cb.equal(root.get("active"), active));
        }
        if (featured != null) {
            specs.add((root, query, cb) -> cb.equal(root.get("featured"), featured));
        }
        if (stock != null) {
            switch (stock) {
                case IN_STOCK ->
                    specs.add((root, query, cb) -> cb.greaterThan(root.get("stock"), 0));
                case OUT_OF_STOCK ->
                    specs.add((root, query, cb) -> cb.equal(root.get("stock"), 0));
                case LOW_STOCK ->
                    // Low-stock = stock <= 5 (no per-product threshold column).
                    specs.add((root, query, cb) -> cb.lessThanOrEqualTo(root.get("stock"), 5));
                case ANY -> { /* no-op */ }
            }
        }
        if (minPrice != null) {
            specs.add((root, query, cb) -> cb.greaterThanOrEqualTo(root.get("price"), minPrice));
        }
        if (maxPrice != null) {
            specs.add((root, query, cb) -> cb.lessThanOrEqualTo(root.get("price"), maxPrice));
        }
        // tags filter removed — products.tags column was dropped.

        Specification<Product> result = null;
        for (Specification<Product> s : specs) {
            result = (result == null) ? s : result.and(s);
        }
        return result;
    }
}