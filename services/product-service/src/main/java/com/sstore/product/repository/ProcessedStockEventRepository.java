package com.sstore.product.repository;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.sstore.product.domain.ProcessedStockEvent;

public interface ProcessedStockEventRepository
        extends JpaRepository<ProcessedStockEvent, UUID> {
}