package com.sstore.product.service;

import com.sstore.product.domain.Product;
import com.sstore.product.repository.ProductRepository;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

class ProductReservationServiceTest {

    @Test
    void reserveRejectsInsufficientStock() {
        ProductRepository repo = Mockito.mock(ProductRepository.class);
        Product product = new Product();
        product.setId(UUID.randomUUID());
        product.setSku("SKU-1");
        product.setStock(2);
        product.setCreatedAt(Instant.now());
        product.setUpdatedAt(Instant.now());

        when(repo.findBySkuForUpdate("SKU-1")).thenReturn(Optional.of(product));

        ProductReservationService service = new ProductReservationService(repo);

        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> service.reserve(List.of(new ProductReservationService.Line("SKU-1", product.getId(), 3)))
        );

        assertTrue(ex.getMessage().contains("Insufficient stock"));
        assertEquals(2, product.getStock());
    }

    @Test
    void reserveDecrementsStockWhenEnoughExists() {
        ProductRepository repo = Mockito.mock(ProductRepository.class);
        Product product = new Product();
        product.setId(UUID.randomUUID());
        product.setSku("SKU-1");
        product.setStock(5);
        product.setCreatedAt(Instant.now());
        product.setUpdatedAt(Instant.now());

        when(repo.findBySkuForUpdate("SKU-1")).thenReturn(Optional.of(product));

        ProductReservationService service = new ProductReservationService(repo);
        service.reserve(List.of(new ProductReservationService.Line("SKU-1", product.getId(), 2)));

        assertEquals(3, product.getStock());
    }

    @Test
    void reserveRejectsProductIdThatDoesNotMatchSku() {
        ProductRepository repo = Mockito.mock(ProductRepository.class);
        Product product = new Product();
        product.setId(UUID.randomUUID());
        product.setSku("SKU-1");
        product.setStock(5);
        when(repo.findBySkuForUpdate("SKU-1")).thenReturn(Optional.of(product));

        ProductReservationService service = new ProductReservationService(repo);

        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> service.reserve(List.of(new ProductReservationService.Line("SKU-1", UUID.randomUUID(), 1)))
        );

        assertTrue(ex.getMessage().contains("does not match SKU"));
        assertEquals(5, product.getStock());
    }

    @Test
    void reserveRejectsUnavailableProduct() {
        ProductRepository repo = Mockito.mock(ProductRepository.class);
        Product product = new Product();
        product.setId(UUID.randomUUID());
        product.setSku("SKU-1");
        product.setStock(5);
        product.setActive(false);
        when(repo.findBySkuForUpdate("SKU-1")).thenReturn(Optional.of(product));

        ProductReservationService service = new ProductReservationService(repo);

        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> service.reserve(List.of(new ProductReservationService.Line("SKU-1", product.getId(), 1)))
        );

        assertTrue(ex.getMessage().contains("unavailable"));
        assertEquals(5, product.getStock());
    }
}
