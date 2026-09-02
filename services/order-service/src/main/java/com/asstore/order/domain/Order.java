package com.asstore.order.domain;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonManagedReference;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "orders")
@Getter
@Setter
public class Order {
	@Id
	@GeneratedValue
	private UUID id;

	@Column(nullable = false)
	private String userId;

	@ManyToOne
	@JoinColumn(name = "address_id", nullable = false)
	private Address address;

	@Column(nullable = false)
	private String status = "PLACED"; // PLACED, CONFIRMED, SHIPPED, DELIVERED, CANCELLED

	@Column(nullable = false)
	private Long totalAmount = 0L; // in paise/cents

	private String currency = "INR";

	private Instant createdAt = Instant.now();

	private Instant updatedAt = Instant.now();

	@OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
	@JsonManagedReference
	private Set<OrderItem> items = new HashSet<>();
}
