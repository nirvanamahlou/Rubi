ALTER TABLE "master_visa_services"
ADD COLUMN "requiredDocumentNames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "master_visa_services"
ADD CONSTRAINT "master_visa_services_required_documents_count_check"
CHECK (cardinality("requiredDocumentNames") <= 50);
