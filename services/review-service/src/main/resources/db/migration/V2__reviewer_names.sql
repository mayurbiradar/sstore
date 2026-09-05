-- ============================================================================
-- Reviewer display name captured at submission time.
--
-- Captured server-side from the JWT (Keycloak given_name / family_name
-- claims) so we never trust the client. Nullable to preserve existing
-- reviews; old rows display as "Customer · <userId prefix>" until the
-- user posts a new review, after which their name will appear.
-- ============================================================================
ALTER TABLE reviews
    ADD COLUMN reviewer_first_name text,
    ADD COLUMN reviewer_last_name  text;