package com.sstore.order.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.sstore.order.domain.Order;

public interface OrderRepository extends JpaRepository<Order, UUID> {
	List<Order> findByUserId(String userId);

	@Query("SELECT SUM(o.totalAmount) FROM Order o")
	Double getTotalRevenue();
}
