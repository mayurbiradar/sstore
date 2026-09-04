package com.sstore.inventory.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class ReservationExpirySweeper {

    private final InventoryService inventoryService;

    /** Run every minute — release reservations that passed their TTL. */
    @Scheduled(cron = "${reservation.sweep-cron:0 */1 * * * *}")
    public void sweep() {
        int n = inventoryService.sweepExpired();
        if (n > 0) log.info("Released {} expired reservations", n);
    }
}
