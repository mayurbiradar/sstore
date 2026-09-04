# Service contracts

JSON-Schema definitions for the events flowing on Kafka topics. Treat these as the API between services — a change here must be coordinated with every consumer.

| Topic | Publisher | Consumers | Schema |
| --- | --- | --- | --- |
| `orders` | order-service | inventory-service (OrderCreated / OrderCancelled), payment-service (OrderCreated, for amount sanity checks) | [orders.json](events/orders.json) |
| `payments` | payment-service | order-service (status), inventory-service (commit/release reservations) | [payments.json](events/payments.json) |

Conventions:
- Kafka message **key** = aggregate id (orderId / paymentId). Guarantees ordering per-aggregate.
- Schema uses `eventType` as a discriminator; consumers must ignore unknown values for forward compatibility.
- `occurredAt` / `createdAt` are ISO-8601 in UTC.
- All money fields are integers in the smallest currency unit (paise for INR, cents for USD).
