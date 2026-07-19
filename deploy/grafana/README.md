# Grafana

`guardtime-fleet-dashboard.json` — import into Grafana (Dashboards → Import
→ Upload JSON), pointed at a Prometheus datasource scraping via
`../prometheus/prometheus.yml`.

**Status: prepared, not deployed.** No live Grafana/Prometheus instance was
available to actually load this into and screenshot. Every metric it
queries is real and covered by tests (see `backend/test/metrics.*.spec.ts`,
`dns-service/test/health-server.test.ts`) — what's unverified is the
dashboard JSON rendering correctly in an actual Grafana instance, since none
was available to check it against.

To stand it up alongside staging:
```
docker run -d -p 9090:9090 -v $(pwd)/../prometheus/prometheus.yml:/etc/prometheus/prometheus.yml prom/prometheus
docker run -d -p 3002:3000 grafana/grafana
# Grafana UI → Connections → Data sources → Prometheus → http://host.docker.internal:9090
# Dashboards → Import → upload guardtime-fleet-dashboard.json
```
