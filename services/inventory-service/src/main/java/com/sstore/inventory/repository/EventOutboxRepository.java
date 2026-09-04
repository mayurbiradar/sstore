package com.sstore.inventory.repository;

import com.sstore.inventory.domain.EventOutbox;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface EventOutboxRepository extends JpaRepository<EventOutbox, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT e FROM EventOutbox e WHERE e.publishedAt IS NULL ORDER BY e.createdAt ASC")
    List<EventOutbox> findUnpublishedForUpdate();
}
