# SStore Helm chart

Install the complete SStore stack into a namespace:

```bash
helm upgrade --install sstore ./helm/sstore --namespace dev --create-namespace
```

For non-local deployments, override `hosts`, image names, and `ingress.tlsSecretName`. Monitoring is enabled by default and exposes Prometheus and Grafana through `hosts.prometheus` and `hosts.grafana`. For production credentials, Grafana credentials, and Stripe keys, enable Sealed Secrets with encrypted values or use an external secret manager. Do not commit plaintext credentials.

Validate rendering:

```bash
helm lint ./helm/sstore
helm template sstore ./helm/sstore --namespace dev
```
