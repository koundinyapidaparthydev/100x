# Generated AI artifacts (drafts, patches, attachments metadata payloads).
resource "google_storage_bucket" "artifacts" {
  name                        = local.artifacts_bucket_name
  project                     = var.project_id
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = false
  public_access_prevention    = "enforced"

  versioning {
    enabled = true
  }

  soft_delete_policy {
    retention_duration_seconds = var.artifact_retention_days * 24 * 60 * 60
  }

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type = "SetStorageClass"
      # Nearline is enough for staging retention after 90 days.
      storage_class = "NEARLINE"
    }
  }

  labels = local.default_labels

  depends_on = [google_project_service.required]
}

# Static assets for web/mobile builds. The bucket remains private unless the
# optional HTTPS/CDN delivery path is explicitly enabled.
resource "google_storage_bucket" "static" {
  name                        = local.static_bucket_name
  project                     = var.project_id
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = false
  public_access_prevention    = local.static_delivery_enabled ? "inherited" : "enforced"

  versioning {
    enabled = true
  }

  website {
    main_page_suffix = "index.html"
    not_found_page   = "index.html"
  }

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD", "OPTIONS"]
    response_header = ["Content-Type", "Cache-Control"]
    max_age_seconds = 3600
  }

  lifecycle {
    precondition {
      condition     = !var.enable_static_cdn || length(var.static_domains) > 0
      error_message = "enable_static_cdn requires at least one static_domains entry."
    }
  }

  labels = local.default_labels

  depends_on = [google_project_service.required]
}
