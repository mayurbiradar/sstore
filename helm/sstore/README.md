# SStore Helm chart

Install the complete SStore stack into a namespace:

```bash
helm upgrade --install sstore ./helm/sstore --namespace dev --create-namespace
```

For non-local deployments, override `hosts`, image names, credentials, and `ingress.tlsSecretName`. Keep credentials and Stripe keys in a private values file or an external secret manager.

Validate rendering:

```bash
helm lint ./helm/sstore
helm template sstore ./helm/sstore --namespace dev
```
