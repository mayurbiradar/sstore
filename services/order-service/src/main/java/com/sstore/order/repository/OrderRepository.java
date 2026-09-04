package com.sstore.order.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.sstore.order.domain.Order;

public interface OrderRepository extends JpaRepository<Order, UUID> {

	/**
	 * Eagerly fetch the {@code items} collection so callers can serialise the
	 * result without hitting a {@code LazyInitializationException}. The default
	 * {@code findByUserId} returns proxies because {@code Order.items} is a lazy
	 * {@code @OneToMany} and {@code spring.jpa.open-in-view} is disabled.
	 *
	 * <p>Use a {@code List} result (not {@code Set}) to avoid the
	 * "MultipleBagFetchException" if other collections are added later.</p>
	 */
	@Query("SELECT DISTINCT o FROM Order o LEFT JOIN FETCH o.items WHERE o.userId = :userId ORDER BY o.createdAt DESC")
	List<Order> findByUserIdWithItems(@Param("userId") String userId);

	/** Backwards-compatible alias — used by callers that don't need items. */
	default List<Order> findByUserId(String userId) {
		return findByUserIdWithItems(userId);
	}

	/**
	 * Eagerly-loaded single-order lookup. Use this from controllers that
	 * serialise the result (otherwise the {@code items} collection will throw
	 * a {@code LazyInitializationException} on JSON write).
	 */
	@Query("SELECT o FROM Order o LEFT JOIN FETCH o.items WHERE o.id = :id")
	Optional<Order> findByIdWithItems(@Param("id") UUID id);

	@Query("SELECT SUM(o.totalAmount) FROM Order o")
	Double getTotalRevenue();

	/**
	 * Admin listing — eagerly fetch the items collection so the JSON
	 * serialiser doesn't trigger a {@code LazyInitializationException}.
	 * Returns {@code List} (not {@code Set}) to stay compatible with
	 * future {@code JOIN FETCH} additions.
	 */
	@Query("SELECT DISTINCT o FROM Order o LEFT JOIN FETCH o.items ORDER BY o.createdAt DESC")
	List<Order> findAllWithItems();
}
