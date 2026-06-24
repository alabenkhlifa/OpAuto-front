-- Add durable maintenance-job lines, approvals, and timeline events
ALTER TABLE "maintenance_jobs" ADD COLUMN "appointmentId" TEXT;

CREATE TABLE "maintenance_job_line_items" (
    "id" TEXT NOT NULL,
    "maintenanceJobId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "partId" TEXT,
    "serviceCode" TEXT,
    "mechanicId" TEXT,
    "laborHours" DOUBLE PRECISION,
    "tvaRate" DOUBLE PRECISION NOT NULL DEFAULT 19,
    "discountPct" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_job_line_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "maintenance_job_line_items_maintenanceJob_fkey" FOREIGN KEY ("maintenanceJobId") REFERENCES "maintenance_jobs"("id") ON DELETE CASCADE,
    CONSTRAINT "maintenance_job_line_items_part_fkey" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE SET NULL,
    CONSTRAINT "maintenance_job_line_items_mechanic_fkey" FOREIGN KEY ("mechanicId") REFERENCES "employees"("id") ON DELETE SET NULL
);

CREATE INDEX "maintenance_job_line_items_maintenanceJobId_idx" ON "maintenance_job_line_items" ("maintenanceJobId");

CREATE TABLE "maintenance_job_timeline_events" (
    "id" TEXT NOT NULL,
    "maintenanceJobId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorUserId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_job_timeline_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "maintenance_job_timeline_events_maintenanceJob_fkey" FOREIGN KEY ("maintenanceJobId") REFERENCES "maintenance_jobs"("id") ON DELETE CASCADE
);

CREATE INDEX "maintenance_job_timeline_events_maintenanceJobId_createdAt_idx" ON "maintenance_job_timeline_events" ("maintenanceJobId", "createdAt");

CREATE TABLE "maintenance_job_approval_requests" (
    "id" TEXT NOT NULL,
    "maintenanceJobId" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAmount" DOUBLE PRECISION,
    "summary" TEXT,
    "customerName" TEXT,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "requestedBy" TEXT,
    "respondedBy" TEXT,
    "respondedAt" TIMESTAMP(3),
    "responseNote" TEXT,
    "responseChannel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_job_approval_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "maintenance_job_approval_requests_maintenanceJob_fkey" FOREIGN KEY ("maintenanceJobId") REFERENCES "maintenance_jobs"("id") ON DELETE CASCADE
);

CREATE INDEX "maintenance_job_approval_requests_maintenanceJobId_status_idx" ON "maintenance_job_approval_requests" ("maintenanceJobId", "status");

ALTER TABLE "maintenance_jobs" ADD CONSTRAINT "maintenance_jobs_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL;
