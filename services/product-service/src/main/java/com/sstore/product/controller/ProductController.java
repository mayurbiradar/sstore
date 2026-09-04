   
package com.sstore.product.controller;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.sstore.product.client.InventoryServiceClient;
import com.sstore.product.domain.Product;
import com.sstore.product.repository.ProductRepository;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final ProductRepository repo;
    private final InventoryServiceClient inventoryClient;

    public ProductController(ProductRepository repo, InventoryServiceClient inventoryClient) {
        this.repo = repo;
        this.inventoryClient = inventoryClient;
    }

    @GetMapping
    public List<Product> list() { return repo.findAll(); }

    @GetMapping("/{id}")
    public ResponseEntity<Product> get(@PathVariable("id") UUID id) {
        Optional<Product> p = repo.findById(id);
        return p.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }
    
    @PostMapping("/create-with-image")
    public ResponseEntity<Product> createWithImage(
        @RequestParam("name") String name,
        @RequestParam("description") String description,
        @RequestParam("price") Long price,
        @RequestParam(value = "stock", required = false) Integer stock,
        @RequestParam(value = "categoryId", required = false) UUID categoryId,
        @RequestParam("file") MultipartFile file
    ) throws IOException {
        String filename = UUID.randomUUID() + "-" + file.getOriginalFilename();
        Path imagePath = Paths.get("src/main/resources/static/images", filename);
        Files.createDirectories(imagePath.getParent());
        Files.write(imagePath, file.getBytes());
        String imageUrl = "/images/" + filename;

        Product p = new Product();
        String sku = "SKU-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        p.setSku(sku);
        p.setSlug(slugify(name) + "-" + sku.toLowerCase());
        p.setName(name);
        p.setDescription(description);
        p.setPrice(price);
        p.setImage(imageUrl);
        p.setAvgRating(java.math.BigDecimal.ZERO);
        p.setReviewCount(0);
        if (stock != null) p.setStock(stock);
        p.setActive(true);
        p.setFeatured(false);
        Product saved = repo.save(p);

        // Auto-register the new SKU with inventory-service so the very
        // first checkout attempt can reserve stock. Inventory's upsert
        // is idempotent (only tops up onHand), so a retry won't reset
        // existing stock. If inventory-service is unreachable the
        // client logs and returns null — the product is still created
        // and an admin can register inventory later.
        inventoryClient.registerProduct(saved.getId(), saved.getSku(), saved.getName(),
                stock != null ? stock : 0);

        return ResponseEntity.status(org.springframework.http.HttpStatus.CREATED).body(saved);
    }

    /** URL-safe slug derived from a product name. */
    private static String slugify(String input) {
        String base = input == null ? "" : input.toLowerCase().trim();
        String normalized = java.text.Normalizer.normalize(base, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
        return normalized.replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
    }

    @GetMapping("/count")
    public ResponseEntity<Long> getProductCount() {
        return ResponseEntity.ok(repo.count());
    }
    
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteProduct(@PathVariable("id") UUID id) {
        repo.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
