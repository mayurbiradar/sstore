package com.sstore.review.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.sstore.review.domain.PurchaseProof;

public interface PurchaseProofRepository extends JpaRepository<PurchaseProof, UUID> {

    boolean existsByUserIdAndProductId(String userId, UUID productId);

    List<PurchaseProof> findByUserIdAndProductId(String userId, UUID productId);
}
