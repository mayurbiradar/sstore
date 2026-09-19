package com.sstore.order.repository;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.sstore.order.domain.OrderStatusHistory;

public interface OrderStatusHistoryRepository extends JpaRepository<OrderStatusHistory, UUID> {
}
