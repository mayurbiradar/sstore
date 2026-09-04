package com.sstore.order.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.sstore.order.domain.Address;

public interface AddressRepository extends JpaRepository<Address, UUID> {

    /** Addresses the user has saved (every row is "active"; there is no soft delete). */
    List<Address> findByUserId(String userId);

    /** The user's default shipping/billing address, if any. */
    Optional<Address> findByUserIdAndIsDefaultTrue(String userId);
}
