package com.sstore.review.controller;

import java.net.URI;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.sstore.review.config.ReviewProperties;
import com.sstore.review.domain.Review;
import com.sstore.review.service.ReviewService;
import com.sstore.review.service.ReviewService.SubmitCommand;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/reviews")
@RequiredArgsConstructor
public class ReviewController {

    private final ReviewService reviewService;
    private final ReviewProperties props;

    // ---- queries -----------------------------------------------------------

    @GetMapping
    public Page<Review> listByProduct(
            @RequestParam("productId") UUID productId,
            Pageable pageable
    ) {
        return reviewService.listForProduct(productId, pageable);
    }

    @GetMapping("/me")
    public Page<Review> listMine(Authentication auth, Pageable pageable) {
        return reviewService.listForUser(auth.getName(), pageable);
    }

    @GetMapping("/{id}")
    public Review get(@PathVariable UUID id) {
        return reviewService.get(id);
    }

    // ---- mutations ---------------------------------------------------------

    @PostMapping
    public ResponseEntity<Review> submit(@Valid @RequestBody SubmitRequest body, Authentication auth) {
        SubmitCommand cmd = new SubmitCommand(
            body.productId(), auth.getName(), body.orderId(),
            body.rating(), body.title(), body.body()
        );
        Review saved = reviewService.submit(cmd);
        return ResponseEntity.created(URI.create("/api/reviews/" + saved.getId())).body(saved);
    }

    @PatchMapping("/{id}")
    public Review edit(@PathVariable UUID id, @Valid @RequestBody SubmitRequest body, Authentication auth) {
        SubmitCommand cmd = new SubmitCommand(
            body.productId(), auth.getName(), body.orderId(),
            body.rating(), body.title(), body.body()
        );
        return reviewService.edit(id, auth.getName(), cmd);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id, Authentication auth) {
        reviewService.delete(id, auth.getName());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/helpful")
    public Review vote(@PathVariable UUID id,
                       @RequestParam("helpful") boolean helpful,
                       Authentication auth) {
        // If require-login is false, anonymous votes are stored under "_anon"
        String user = props.helpfulVote().requireLogin() ? auth.getName() : "_anon";
        return reviewService.vote(id, user, helpful);
    }

    // ---- admin moderation queue -------------------------------------------

    @GetMapping("/admin/queue")
    public Page<Review> queue(Pageable pageable) {
        return reviewService.moderationQueue(pageable);
    }

    @PostMapping("/admin/{id}/approve")
    public Review approve(@PathVariable UUID id, Authentication auth) {
        return reviewService.approve(id, auth.getName());
    }

    @PostMapping("/admin/{id}/reject")
    public Review reject(@PathVariable UUID id,
                         @RequestParam("reason") String reason,
                         Authentication auth) {
        return reviewService.reject(id, auth.getName(), reason);
    }

    // ---- DTO ---------------------------------------------------------------

    public record SubmitRequest(
        @NotNull UUID productId,
        UUID orderId,
        @NotNull @Min(1) @Max(5) Integer rating,
        @NotBlank @Size(min = 3, max = 120) String title,
        @NotBlank @Size(min = 10, max = 4000) String body
    ) {}
}
