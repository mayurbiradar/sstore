package com.asstore.order.repository;

import com.asstore.order.domain.Address;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface AddressRepository extends JpaRepository<Address, UUID> {
    List<Address> findByUserIdAndIsDeleted(String userId, boolean isDeleted);
}
