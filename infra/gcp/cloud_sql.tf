# Private networking for Cloud SQL (no public IP). Cloud Run connects via
# the built-in Cloud SQL integration + Auth Proxy.
resource "google_compute_network" "staging" {
  name                    = "${local.name}-vpc"
  project                 = var.project_id
  auto_create_subnetworks = false

  lifecycle {
    precondition {
      condition = (
        contains(["dev", "stage"], var.environment)
        ? var.project_id == "jobseek-459701"
        : var.project_id != "jobseek-459701"
      )
      error_message = "dev and stage must use Project A (jobseek-459701); production must use separate Project B."
    }

    precondition {
      condition     = var.environment == "dev" || !var.auth_allow_demo_login
      error_message = "auth_allow_demo_login may be true only in dev."
    }
  }

  depends_on = [google_project_service.required]
}

resource "google_compute_subnetwork" "staging" {
  name          = "${local.name}-subnet"
  project       = var.project_id
  region        = var.region
  network       = google_compute_network.staging.id
  ip_cidr_range = var.vpc_subnet_cidr

  private_ip_google_access = true
}

resource "google_compute_global_address" "private_services" {
  name          = "${local.name}-psa"
  project       = var.project_id
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.staging.id
}

resource "google_service_networking_connection" "private_vpc" {
  network                 = google_compute_network.staging.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_services.name]

  depends_on = [google_project_service.required]
}

resource "random_password" "db" {
  length           = 32
  special          = true
  override_special = "-_~"
}

resource "google_sql_database_instance" "main" {
  name             = local.sql_instance_name
  project          = var.project_id
  region           = var.region
  database_version = "POSTGRES_16"

  deletion_protection = var.sql_deletion_protection

  settings {
    edition           = "ENTERPRISE"
    tier              = var.sql_tier
    availability_type = var.sql_availability_type
    disk_size         = var.sql_disk_size_gb
    disk_type         = "PD_SSD"
    disk_autoresize   = true

    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = google_compute_network.staging.id
      enable_private_path_for_google_cloud_services = true
    }

    backup_configuration {
      enabled                        = var.sql_backup_enabled
      start_time                     = "06:00"
      point_in_time_recovery_enabled = var.sql_backup_enabled
      backup_retention_settings {
        retained_backups = 7
        retention_unit   = "COUNT"
      }
    }

    insights_config {
      query_insights_enabled  = true
      query_plans_per_minute  = 5
      query_string_length     = 1024
      record_application_tags = true
      record_client_address   = false
    }

    maintenance_window {
      day          = 7
      hour         = 7
      update_track = "stable"
    }

    user_labels = local.default_labels
  }

  depends_on = [
    google_service_networking_connection.private_vpc,
    google_project_service.required,
  ]
}

resource "google_sql_database" "app" {
  name     = var.db_name
  project  = var.project_id
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "app" {
  name     = var.db_user
  project  = var.project_id
  instance = google_sql_database_instance.main.name
  password = random_password.db.result
}
