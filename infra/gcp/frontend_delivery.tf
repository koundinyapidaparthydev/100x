# Optional public frontend delivery. With defaults, this file creates no
# resources and the static bucket continues to enforce public-access prevention.

resource "google_storage_bucket_iam_member" "static_public_viewer" {
  count = local.static_delivery_enabled ? 1 : 0

  bucket = google_storage_bucket.static.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

resource "google_compute_global_address" "static" {
  count = local.static_delivery_enabled ? 1 : 0

  project = var.project_id
  name    = "${local.name}-static-ip"

  depends_on = [google_project_service.required]
}

resource "google_compute_backend_bucket" "static" {
  count = local.static_delivery_enabled ? 1 : 0

  project     = var.project_id
  name        = "${local.name}-static-backend"
  bucket_name = google_storage_bucket.static.name
  enable_cdn  = true

  cdn_policy {
    cache_mode        = "CACHE_ALL_STATIC"
    default_ttl       = 3600
    client_ttl        = 3600
    max_ttl           = 86400
    negative_caching  = true
    serve_while_stale = 86400
  }

  depends_on = [google_storage_bucket_iam_member.static_public_viewer]
}

resource "google_compute_region_network_endpoint_group" "api" {
  count = local.static_delivery_enabled && var.cloud_run_image != "" ? 1 : 0

  project               = var.project_id
  name                  = "${local.name}-api-neg"
  region                = var.region
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = google_cloud_run_v2_service.api[0].name
  }
}

resource "google_compute_backend_service" "api" {
  count = local.static_delivery_enabled && var.cloud_run_image != "" ? 1 : 0

  project               = var.project_id
  name                  = "${local.name}-api-backend"
  protocol              = "HTTP"
  load_balancing_scheme = "EXTERNAL_MANAGED"

  backend {
    group = google_compute_region_network_endpoint_group.api[0].id
  }
}

resource "google_compute_url_map" "static" {
  count = local.static_delivery_enabled ? 1 : 0

  project         = var.project_id
  name            = "${local.name}-static"
  default_service = google_compute_backend_bucket.static[0].id

  dynamic "host_rule" {
    for_each = var.cloud_run_image == "" ? [] : [1]
    content {
      hosts        = ["*"]
      path_matcher = "static-and-api"
    }
  }

  dynamic "path_matcher" {
    for_each = var.cloud_run_image == "" ? [] : [1]
    content {
      name            = "static-and-api"
      default_service = google_compute_backend_bucket.static[0].id

      path_rule {
        paths   = ["/api", "/api/*"]
        service = google_compute_backend_service.api[0].id
      }
    }
  }
}

resource "random_id" "static_certificate" {
  count = local.static_delivery_enabled ? 1 : 0

  byte_length = 4
  keepers = {
    domains = join(",", local.static_domains)
  }
}

resource "google_compute_managed_ssl_certificate" "static" {
  count = local.static_delivery_enabled ? 1 : 0

  project = var.project_id
  name    = "${local.name}-static-cert-${random_id.static_certificate[0].hex}"

  managed {
    domains = local.static_domains
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "google_compute_target_https_proxy" "static" {
  count = local.static_delivery_enabled ? 1 : 0

  project          = var.project_id
  name             = "${local.name}-static-https"
  url_map          = google_compute_url_map.static[0].id
  ssl_certificates = [google_compute_managed_ssl_certificate.static[0].id]
}

resource "google_compute_global_forwarding_rule" "static_https" {
  count = local.static_delivery_enabled ? 1 : 0

  project               = var.project_id
  name                  = "${local.name}-static-https"
  ip_address            = google_compute_global_address.static[0].id
  ip_protocol           = "TCP"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  port_range            = "443"
  target                = google_compute_target_https_proxy.static[0].id
}

data "google_dns_managed_zone" "static" {
  count = local.static_delivery_enabled && var.static_dns_managed_zone != "" ? 1 : 0

  project = var.project_id
  name    = var.static_dns_managed_zone

  depends_on = [google_project_service.required]
}

resource "google_dns_record_set" "static" {
  for_each = local.static_delivery_enabled && var.static_dns_managed_zone != "" ? toset(local.static_domains) : toset([])

  project      = var.project_id
  managed_zone = data.google_dns_managed_zone.static[0].name
  name         = "${each.value}."
  type         = "A"
  ttl          = var.static_dns_ttl
  rrdatas      = [google_compute_global_address.static[0].address]
}
