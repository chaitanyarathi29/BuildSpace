-- CreateEnum
CREATE TYPE "DeployementStatus" AS ENUM ('NOT_STARTED', 'QUEUED', 'IN_PROGRESS', 'READY', 'FAIL');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "git_url" TEXT NOT NULL,
    "custom_domain" TEXT,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deployement" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "status" "DeployementStatus" NOT NULL DEFAULT 'NOT_STARTED',

    CONSTRAINT "Deployement_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Deployement" ADD CONSTRAINT "Deployement_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
