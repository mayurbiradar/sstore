import axios from 'axios';
import { API_BASE_URL } from '../constants';

const REVIEW_API = axios.create({
  baseURL: `${API_BASE_URL}/api/reviews`,
  headers: { 'Content-Type': 'application/json' },
});

export interface Review {
  id: string;
  productId: string;
  userId: string;
  orderId?: string | null;
  rating: number;
  title: string;
  body: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  verifiedPurchase: boolean;
  helpfulCount: number;
  unhelpfulCount: number;
  /** Reviewer's first name (Keycloak given_name) — null on pre-V2 reviews. */
  reviewerFirstName?: string | null;
  /** Reviewer's last name (Keycloak family_name) — null on pre-V2 reviews. */
  reviewerLastName?: string | null;
  rejectionReason?: string | null;
  moderatedBy?: string | null;
  moderatedAt?: string | null;
  editCount: number;
  lastEditedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ReviewPage {
  content: Review[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface SubmitReviewPayload {
  productId: string;
  orderId?: string;
  rating: number;
  title: string;
  body: string;
}

const bearer = (token?: string) =>
  token ? { headers: { Authorization: `Bearer ${token}` } } : {};

export const listReviewsForProduct = (productId: string, page = 0, size = 10) =>
  REVIEW_API.get<ReviewPage>('', {
    params: { productId, page, size },
  });

export const getMyReviews = (token: string, page = 0, size = 10) =>
  REVIEW_API.get<ReviewPage>('/me', { ...bearer(token), params: { page, size } });

export const getReview = (id: string) => REVIEW_API.get<Review>(`/${id}`);

export const submitReview = (payload: SubmitReviewPayload, token: string) =>
  REVIEW_API.post<Review>('', payload, bearer(token));

export const editReview = (
  id: string,
  payload: SubmitReviewPayload,
  token: string,
) => REVIEW_API.patch<Review>(`/${id}`, payload, bearer(token));

export const deleteReview = (id: string, token: string) =>
  REVIEW_API.delete<void>(`/${id}`, bearer(token));

export const voteHelpful = (id: string, helpful: boolean, token: string) =>
  REVIEW_API.post<Review>(`/${id}/helpful`, null, {
    ...bearer(token),
    params: { helpful },
  });

// ---- admin moderation --------------------------------------------------
export const moderationQueue = (token: string, page = 0, size = 20) =>
  REVIEW_API.get<ReviewPage>('/admin/queue', {
    ...bearer(token),
    params: { page, size },
  });

export const approveReview = (id: string, token: string) =>
  REVIEW_API.post<Review>(`/admin/${id}/approve`, null, bearer(token));

export const rejectReview = (id: string, reason: string, token: string) =>
  REVIEW_API.post<Review>(`/admin/${id}/reject`, null, {
    ...bearer(token),
    params: { reason },
  });