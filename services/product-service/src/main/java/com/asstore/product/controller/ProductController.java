   
package com.asstore.product.controller;

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

import com.asstore.product.domain.Product;
import com.asstore.product.repository.ProductRepository;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final ProductRepository repo;

    public ProductController(ProductRepository repo) { this.repo = repo; }

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
        @RequestParam("price") Long price,
        @RequestParam(value = "stock", required = false) Integer stock,
        @RequestParam("file") MultipartFile file
    ) throws IOException {
        String filename = UUID.randomUUID() + "-" + file.getOriginalFilename();
        Path imagePath = Paths.get("src/main/resources/static/images", filename);
        Files.createDirectories(imagePath.getParent());
        Files.write(imagePath, file.getBytes());
        String imageUrl = "/images/" + filename;

        Product p = new Product();
        p.setSku("SKU-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        p.setName(name);
        p.setPrice(price);
        p.setImage(imageUrl);
        double min = 4.5;
        double max = 5.0;
        // Generate a random double in the range [4.5, 5.0)
        double randomValue = min + (Math.random() * (max - min));
        double roundedValue2 = Math.round(randomValue * 10.0) / 10.0;
        p.setRating(roundedValue2);
        if (stock != null) p.setStock(stock);
        p.setActive(false);
        p.setCreatedAt(java.time.Instant.now());
        p.setUpdatedAt(java.time.Instant.now());
        Product saved = repo.save(p);
        return ResponseEntity.ok(saved);
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
