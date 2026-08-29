# Basic logging and monitoring for every environment.

resource "google_logging_project_bucket_config" "app" {
  project        = var.project_id
  location       = "global"
  retention_days = 30
  bucket_id      = "${local.name}-logs"

  depends_on = [google_project_service.required]
}

resource "google_logging_project_sink" "app" {
  name        = "${local.name}-app-logs"
  project     = var.project_id
  destination = "logging.googleapis.com/projects/${var.project_id}/locations/global/buckets/${google_logging_project_bucket_config.app.bucket_id}"

  filter = <<-EOT
    resource.type="cloud_run_revision"
    resource.labels.service_name="${local.cloud_run_service_name}"
  EOT

  unique_writer_identity = true
}

resource "google_monitoring_notification_channel" "email" {
  count = var.alert_email == "" ? 0 : 1

  project      = var.project_id
  display_name = "100x ${var.environment} email"
  type         = "email"

  labels = {
    email_address = var.alert_email
  }
}

resource "google_monitoring_alert_policy" "cloud_run_5xx" {
  count = var.cloud_run_image == "" ? 0 : 1

  project      = var.project_id
  display_name = "${local.name} Cloud Run 5xx rate"
  combiner     = "OR"
  enabled      = true

  conditions {
    display_name = "Cloud Run 5xx ratio"

    condition_threshold {
      filter = <<-EOT
        resource.type = "cloud_run_revision"
        resource.labels.service_name = "${local.cloud_run_service_name}"
        metric.type = "run.googleapis.com/request_count"
        metric.labels.response_code_class = "5xx"
      EOT

      comparison      = "COMPARISON_GT"
      threshold_value = 5
      duration        = "300s"

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }

  notification_channels = var.alert_email == "" ? [] : [google_monitoring_notification_channel.email[0].id]

  documentation {
    content   = "The ${var.environment} API is returning elevated 5xx responses. Check Cloud Run revisions and recent deploys. See docs/deployment/ROLLBACK.md."
    mime_type = "text/markdown"
  }

  depends_on = [google_project_service.required]
}

resource "google_monitoring_uptime_check_config" "api_health" {
  count = var.cloud_run_image == "" || !var.cloud_run_allow_unauthenticated ? 0 : 1

  project      = var.project_id
  display_name = "${local.name} API health"
  timeout      = "10s"
  period       = "60s"

  http_check {
    path         = "/api/v1/health"
    port         = 443
    use_ssl      = true
    validate_ssl = true
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = trimprefix(trimsuffix(google_cloud_run_v2_service.api[0].uri, "/"), "https://")
    }
  }

  depends_on = [google_cloud_run_v2_service.api]
}
