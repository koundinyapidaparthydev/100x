# Cloud Run API service. Created only when cloud_run_image is set so `terraform
# apply` can provision data/IAM/registry before the first image push.
resource "google_cloud_run_v2_service" "api" {
  count = var.cloud_run_image == "" ? 0 : 1

  name     = local.cloud_run_service_name
  project  = var.project_id
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  labels = local.default_labels

  template {
    service_account = google_service_account.api.email

    scaling {
      min_instance_count = var.cloud_run_min_instances
      max_instance_count = var.cloud_run_max_instances
    }

    timeout = "300s"

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [google_sql_database_instance.main.connection_name]
      }
    }

    containers {
      image = var.cloud_run_image

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = var.cloud_run_cpu
          memory = var.cloud_run_memory
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "PORT"
        value = "8080"
      }

      env {
        name  = "ARTIFACTS_BUCKET"
        value = google_storage_bucket.artifacts.name
      }

      env {
        name  = "STATIC_ASSETS_BUCKET"
        value = google_storage_bucket.static.name
      }

      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.app["database-url"].secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "AUTH_SESSION_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.app["session-secret"].secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "AUTH_ALLOW_DEMO_LOGIN"
        value = tostring(var.auth_allow_demo_login)
      }

      env {
        name  = "JIRA_BASE_URL"
        value = var.jira_base_url
      }

      env {
        name  = "JIRA_EMAIL"
        value = var.jira_email
      }

      env {
        name = "OPENAI_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.app["openai-api-key"].secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "JIRA_API_TOKEN"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.app["jira-api-token"].secret_id
            version = "latest"
          }
        }
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }

      startup_probe {
        http_get {
          path = "/api/v1/health"
          port = 8080
        }
        initial_delay_seconds = 5
        timeout_seconds       = 3
        period_seconds        = 10
        failure_threshold     = 6
      }

      liveness_probe {
        http_get {
          path = "/api/v1/health"
          port = 8080
        }
        timeout_seconds   = 3
        period_seconds    = 30
        failure_threshold = 3
      }
    }

    # Cloud SQL is reached via the mounted Unix socket (/cloudsql/...), not
    # Direct VPC egress. Add vpc_access later if the API needs private VPC peers.
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    google_project_service.required,
    google_secret_manager_secret_version.database_url,
    google_secret_manager_secret_version.placeholders,
    google_secret_manager_secret_iam_member.api_secret_accessor,
  ]

  lifecycle {
    ignore_changes = [
      # Allow gcloud / CI to roll images without Terraform thrash.
      client,
      client_version,
      template[0].containers[0].image,
    ]
  }
}

resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  count = var.cloud_run_image != "" && var.cloud_run_allow_unauthenticated ? 1 : 0

  project  = var.project_id
  location = google_cloud_run_v2_service.api[0].location
  name     = google_cloud_run_v2_service.api[0].name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
