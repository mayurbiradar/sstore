package com.sstore.product.controller;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.sstore.product.client.InventoryServiceClient;
import com.sstore.product.domain.Product;
import com.sstore.product.repository.ProductRepository;
import com.sstore.product.service.ProductSearchService;
import com.sstore.product.service.ProductSearchService.StockFilter;
import com.sstore.product.service.SlugGenerator;
import com.sstore.product.web.NotFoundException;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final ProductRepository productRepo;
    private final InventoryServiceClient inventoryClient;
    private final ProductSearchService searchService;

    public ProductController(ProductRepository productRepo,
                             InventoryServiceClient inventoryClient,
                             ProductSearchService searchService) {
        this.productRepo = productRepo;
        this.inventoryClient = inventoryClient;
        this.searchService = searchService;
    }

    // -------------------------------------------------------------------------
    // Public catalog
    // -------------------------------------------------------------------------

    @GetMapping
    public Page<Product> search(
            @RequestParam(value = "q", required = false) String q,
            @RequestParam(value = "active", required = false) Boolean active,
            @RequestParam(value = "featured", required = false) Boolean featured,
            @RequestParam(value = "stock", required = false) StockFilter stock,
            @RequestParam(value = "minPrice", required = false) BigDecimal minPrice,
            @RequestParam(value = "maxPrice", required = false) BigDecimal maxPrice,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size,
            @RequestParam(value = "sort", defaultValue = "updatedAt,desc") String sort
    ) {
        Sort sortSpec = parseSort(sort);
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100), sortSpec);
        // Non-admin callers only see visible products. Admins keep full search flexibility
        // (they can pass `active=false` to find inactive rows, etc.).
        boolean forceActive = active == null && !callerIsAdmin();
        var spec = searchService.build(q, forceActive ? true : active, featured, stock, minPrice, maxPrice);
        return productRepo.findAll(spec, pageable);
    }

    /**
     * Storefront-facing flat list. Always filters to visible rows
     * ({@code active = true AND deletedAt IS NULL}) — regardless of caller
     * role. The Home page, Collection page, and any other public catalog
     * surface should call {@code /visible} so an admin browsing the
     * storefront still doesn't see inactive/draft rows.
     *
     * Pass {@code ?featured=true} to restrict to featured products (used by
     * the Home page "Trending now" tile).
     */
    @GetMapping("/visible")
    public List<Product> listVisible(
            @RequestParam(value = "featured", required = false) Boolean featured) {
        if (Boolean.TRUE.equals(featured)) {
            return productRepo.findAllVisibleFeatured();
        }
        return productRepo.findAllVisible();
    }

    /**
     * Admin-only flat list: every non-deleted row, including inactive drafts.
     * Soft-deleted rows are excluded — admin shouldn't see them in the catalog
     * listing. Use a soft-deleted-aware query (e.g. via search) if you need to
     * surface them for recovery.
     */
    @GetMapping("/all")
    @PreAuthorize("hasRole('ADMIN')")
    public List<Product> listAll() {
        return productRepo.findAllNotDeleted();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Product> get(@PathVariable("id") UUID id) {
        return productRepo.findById(id)
                .filter(p -> callerIsAdmin() || (p.isActive() && p.getDeletedAt() == null))
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/count")
    public ResponseEntity<Long> getProductCount() {
        // Admin-only via SecurityConfig. Report the same set the admin
        // sees in the Products tab — non-deleted rows (inactive drafts
        // included, soft-deleted excluded).
        return ResponseEntity.ok((long) productRepo.findAllNotDeleted().size());
    }

    /**
     * True if the current request has an authenticated principal whose
     * authorities include ROLE_ADMIN. Anonymous requests always return false.
     * Public catalog endpoints consult this to decide whether to hide inactive
     * rows; admin endpoints bypass the filter entirely.
     */
    private static boolean callerIsAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return false;
        for (GrantedAuthority ga : auth.getAuthorities()) {
            if ("ROLE_ADMIN".equals(ga.getAuthority())) return true;
        }
        return false;
    }

    // -------------------------------------------------------------------------
    // Admin mutations
    // -------------------------------------------------------------------------

    /**
     * Minimal "add product" flow: name + 1+ images → inactive product
     * (stock=0, price=0, active=false). Admin fills in description / price /
     * stock / etc. on the edit page and flips {@code active} to true.
     *
     * Accepts either a single {@code file} part or multiple {@code files}.
     * The first image becomes the primary (stored in {@code products.image}).
     * Subsequent images are also written to disk under {@code /images/...} so
     * the admin edit page can later pick a new primary from them.
     */
    @PostMapping(value = "/create-with-image", consumes = {"multipart/form-data"})
    public ResponseEntity<Product> createWithImage(
            @RequestParam("name") String name,
            @RequestPart(value = "file", required = false) MultipartFile file,
            @RequestPart(value = "files", required = false) List<MultipartFile> files
    ) throws IOException {
        if ((name == null || name.isBlank())) {
            throw new IllegalArgumentException("name is required");
        }
        // Coalesce the two part names so the frontend can pick either.
        List<MultipartFile> allFiles = new ArrayList<>();
        if (file != null && !file.isEmpty()) allFiles.add(file);
        if (files != null) {
            for (MultipartFile f : files) {
                if (f != null && !f.isEmpty()) allFiles.add(f);
            }
        }
        if (allFiles.isEmpty()) {
            throw new IllegalArgumentException("At least one image file is required");
        }

        // Write every image to disk. The first one is the primary.
        String primaryUrl = null;
        for (MultipartFile f : allFiles) {
            String filename = UUID.randomUUID() + "-" + sanitizeFilename(f.getOriginalFilename());
            Path imagePath = Paths.get("src/main/resources/static/images", filename);
            Files.createDirectories(imagePath.getParent());
            Files.write(imagePath, f.getBytes());
            String url = "/images/" + filename;
            if (primaryUrl == null) primaryUrl = url;
        }

        Product p = new Product();
        p.setSku(generateSku());
        p.setSlug(SlugGenerator.uniqueSlug(name));
        p.setName(name);
        // Everything else starts blank; the admin edit page is where the
        // admin sets description, price, stock, active, etc.
        p.setDescription("");
        p.setPrice(0L);
        p.setImage(primaryUrl);
        // New rows are inactive until the admin fills in price + stock and
        // flips `active` to true on the edit page.
        p.setActive(false);
        p.setStock(0);

        Product saved = productRepo.save(p);

        // Auto-register the new SKU with inventory-service so checkout can
        // attach stock once the admin sets it. Inventory's upsert is
        // idempotent (only tops up onHand), so retries won't reset stock.
        inventoryClient.registerProduct(saved.getId(), saved.getSku(), saved.getName(), 0);

        return ResponseEntity.status(org.springframework.http.HttpStatus.CREATED).body(saved);
    }

    /** JSON-only update endpoint (no image). All optional — partial update. */
    @PutMapping("/{id}")
    public ResponseEntity<Product> update(@PathVariable("id") UUID id, @RequestBody Product patch) {
        Product p = productRepo.findById(id).orElseThrow(() -> new NotFoundException("Product " + id));

        if (patch.getName() != null) { p.setName(patch.getName()); p.setSlug(SlugGenerator.uniqueSlug(patch.getName())); }
        if (patch.getDescription() != null) p.setDescription(patch.getDescription());
        if (patch.getPrice() != null) p.setPrice(patch.getPrice());
        if (patch.getCurrency() != null) p.setCurrency(patch.getCurrency());
        boolean stockChanged = patch.getStock() != null && !patch.getStock().equals(p.getStock());
        if (patch.getStock() != null) p.setStock(patch.getStock());
        p.setActive(patch.isActive());
        p.setFeatured(patch.isFeatured());

        Product saved = productRepo.save(p);

        // Mirror the new value to inventory-service so checkout can fulfil.
        // registerProduct tops up; we want a set, so use the dedicated
        // setOnHand endpoint when stock actually changed.
        if (stockChanged) {
            inventoryClient.setOnHand(saved.getId(), saved.getStock());
        }

        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable("id") UUID id) {
        // Soft delete: keep the row so order history / FKs stay intact.
        Product p = productRepo.findById(id).orElseThrow(() -> new NotFoundException("Product " + id));
        p.setDeletedAt(Instant.now());
        p.setActive(false);
        productRepo.save(p);
        return ResponseEntity.noContent().build();
    }

    // -------------------------------------------------------------------------
    // Bulk admin operations
    // -------------------------------------------------------------------------

    /** Bulk stock adjustment: increment a list of products by the given delta. */
    @PostMapping("/bulk-stock-adjust")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> bulkStockAdjust(@RequestBody List<BulkStockAdjust> items) {
        Instant now = Instant.now();
        int touched = 0;
        for (BulkStockAdjust item : items) {
            if (item == null || item.id() == null) continue;
            if (item.delta() != null) {
                touched += productRepo.adjustStock(item.id(), item.delta(), now);
            } else if (item.setTo() != null) {
                touched += productRepo.setStock(item.id(), item.setTo(), now);
            }
        }
        return ResponseEntity.ok(Map.of("updated", touched, "requested", items.size()));
    }

    public record BulkStockAdjust(UUID id, Integer delta, Integer setTo) {}

    // -------------------------------------------------------------------------
    // helpers
    // -------------------------------------------------------------------------

    private static String generateSku() {
        return "SKU-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    private static String sanitizeFilename(String name) {
        if (name == null) return "upload.bin";
        return name.replaceAll("[^A-Za-z0-9._-]", "_");
    }

    private static Sort parseSort(String spec) {
        if (spec == null || spec.isBlank()) return Sort.by(Sort.Direction.DESC, "updatedAt");
        String[] parts = spec.split(",");
        String field = parts[0].trim();
        Sort.Direction dir = (parts.length > 1 && "asc".equalsIgnoreCase(parts[1].trim()))
                ? Sort.Direction.ASC : Sort.Direction.DESC;
        // Whitelist sortable fields to avoid arbitrary JPQL injection via sort param.
        return switch (field) {
            case "name", "price", "stock", "avgRating", "reviewCount", "soldCount",
                 "createdAt", "updatedAt", "status" -> Sort.by(dir, field);
            default -> Sort.by(Sort.Direction.DESC, "updatedAt");
        };
    }
}