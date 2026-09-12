-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "industry" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isPublicEntity" BOOLEAN NOT NULL DEFAULT false,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "pendingTwoFactorSecret" TEXT,
    "pendingChallengeJti" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "address" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "parentWarehouseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_locations" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "zone" TEXT,
    "rack" TEXT,
    "level" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storage_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sku" TEXT,
    "barcode" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'UNIDAD',
    "salePrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "avgCost" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "standardCost" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "valuationMethod" TEXT NOT NULL DEFAULT 'AVG',
    "minStock" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "maxStock" DECIMAL(12,4),
    "reorderPoint" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "type" TEXT NOT NULL DEFAULT 'PRODUCT',
    "imageUrl" TEXT,
    "images" JSONB,
    "lastMovementAt" TIMESTAMP(3),
    "defaultLocationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_stock" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "reserved" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unitCost" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "avgCostAfter" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "stockAfter" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "reference" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fromWarehouseId" TEXT,
    "toWarehouseId" TEXT,
    "batchId" TEXT,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_adjustments" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "adjNumber" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unitCost" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "movementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_batches" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT,
    "lotNumber" TEXT,
    "expiryDate" TIMESTAMP(3),
    "daysLife" INTEGER,
    "supplierBatch" TEXT,
    "initialQty" DECIMAL(12,4) NOT NULL,
    "remainingQty" DECIMAL(12,4) NOT NULL,
    "unitCost" DECIMAL(12,4) NOT NULL,
    "isExhausted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "managerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ruc" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "paymentTerms" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "personType" TEXT,
    "documentType" TEXT,
    "razonSocial" TEXT,
    "nombreComercial" TEXT,
    "ciiuCode" TEXT,
    "ciiuDescription" TEXT,
    "birthDate" TIMESTAMP(3),
    "nationality" TEXT,
    "maritalStatus" TEXT,
    "spouseName" TEXT,
    "spouseDocument" TEXT,
    "occupation" TEXT,
    "employerName" TEXT,
    "workplace" TEXT,
    "legalRepName" TEXT,
    "legalRepDocument" TEXT,
    "beneficialOwners" JSONB,
    "annualIncome" DECIMAL(14,2),
    "estimatedPatrimony" DECIMAL(14,2),
    "isPEP" BOOLEAN NOT NULL DEFAULT false,
    "pepPosition" TEXT,
    "pepRelationship" TEXT,
    "contribuyenteEspecial" BOOLEAN NOT NULL DEFAULT false,
    "obligadoContabilidad" BOOLEAN NOT NULL DEFAULT false,
    "taxRegime" TEXT,
    "defaultIvaCode" TEXT,
    "defaultRetentionCodeRenta" TEXT,
    "defaultRetentionCodeIva" TEXT,
    "kycCompletedAt" TIMESTAMP(3),
    "kycCompletedBy" TEXT,
    "kycLastReviewedAt" TIMESTAMP(3),
    "rupNumber" TEXT,
    "rupStatus" TEXT,
    "uafeCertExpiry" TIMESTAMP(3),
    "portalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "portalPassword" TEXT,
    "portalToken" TEXT,
    "lastPortalLogin" TIMESTAMP(3),

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "deliveryDate" TIMESTAMP(3),
    "notes" TEXT,
    "requisitionId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "currentLevel" INTEGER NOT NULL DEFAULT 0,
    "requiredLevels" INTEGER NOT NULL DEFAULT 1,
    "l1ApproverId" TEXT,
    "l1ApprovedAt" TIMESTAMP(3),
    "l1Notes" TEXT,
    "l2ApproverId" TEXT,
    "l2ApprovedAt" TIMESTAMP(3),
    "l2Notes" TEXT,
    "l3ApproverId" TEXT,
    "l3ApprovedAt" TIMESTAMP(3),
    "l3Notes" TEXT,
    "l4ApproverId" TEXT,
    "l4ApprovedAt" TIMESTAMP(3),
    "l4Notes" TEXT,
    "l5ApproverId" TEXT,
    "l5ApprovedAt" TIMESTAMP(3),
    "l5Notes" TEXT,
    "rejectedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "advancePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "advanceAmount" DECIMAL(12,2),
    "advanceStatus" TEXT NOT NULL DEFAULT 'NONE',
    "advancePaidAt" TIMESTAMP(3),
    "balanceStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "balancePaidAt" TIMESTAMP(3),
    "deliveryLocationId" TEXT,
    "receivedOnTime" BOOLEAN,
    "qualityConformity" BOOLEAN,
    "conformityBy" TEXT,
    "conformityAt" TIMESTAMP(3),
    "conformityNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requisitions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "reqNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "departmentId" TEXT,
    "totalEstimated" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "budgetExceeded" BOOLEAN NOT NULL DEFAULT false,
    "scoringCriteria" JSONB,
    "requestedBy" TEXT NOT NULL,
    "l1ApproverId" TEXT,
    "l1ApprovedAt" TIMESTAMP(3),
    "l1Notes" TEXT,
    "l2ApproverId" TEXT,
    "l2ApprovedAt" TIMESTAMP(3),
    "l2Notes" TEXT,
    "l3ApproverId" TEXT,
    "l3ApprovedAt" TIMESTAMP(3),
    "l3Notes" TEXT,
    "rejectedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requisition_items" (
    "id" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'UNIDAD',
    "estimatedCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "requisition_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_quotations" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "quoteNumber" TEXT,
    "validUntil" TIMESTAMP(3),
    "deliveryDays" INTEGER,
    "paymentTerms" TEXT,
    "notes" TEXT,
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isWinner" BOOLEAN NOT NULL DEFAULT false,
    "manualScores" JSONB,
    "advanceRequiredPct" DOUBLE PRECISION,
    "weightedScore" DOUBLE PRECISION,
    "scoreBreakdown" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_items" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "requisitionItemId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unitPrice" DECIMAL(12,4) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "brand" TEXT,
    "notes" TEXT,

    CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_controls" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "departmentId" TEXT,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "budgetAmount" DECIMAL(12,2) NOT NULL,
    "consumed" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_controls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_matrix" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "minAmount" DOUBLE PRECISION NOT NULL,
    "maxAmount" DOUBLE PRECISION,
    "approverRole" TEXT NOT NULL DEFAULT 'APPROVER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_matrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "physical_counts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "countDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "notes" TEXT,
    "countedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "physical_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "physical_count_items" (
    "id" TEXT NOT NULL,
    "countId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "systemQty" DECIMAL(12,4) NOT NULL,
    "physicalQty" DECIMAL(12,4) NOT NULL,
    "variance" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "varianceValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "physical_count_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "po_items" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "productId" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "receivedQuantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "po_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceMonthly" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "features" TEXT NOT NULL,
    "maxUsers" INTEGER,
    "maxProducts" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'TRIAL',
    "billingEmail" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "renewalDate" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_history" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL,
    "paymentProvider" TEXT,
    "transactionId" TEXT,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "paidDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "salesOrderId" TEXT,
    "shipmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sri_documents" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "tipoDocumento" TEXT NOT NULL DEFAULT 'FACTURA',
    "claveAcceso" TEXT NOT NULL,
    "numeroAutorizacion" TEXT,
    "rucEmisor" TEXT NOT NULL,
    "razonSocialEmisor" TEXT NOT NULL,
    "nombreComercial" TEXT,
    "dirEmisor" TEXT,
    "contribuyenteEspecial" TEXT,
    "obligadoContabilidad" BOOLEAN NOT NULL DEFAULT false,
    "tipoIdComprador" TEXT,
    "idComprador" TEXT,
    "razonSocialComprador" TEXT,
    "dirComprador" TEXT,
    "estab" TEXT,
    "ptoEmi" TEXT,
    "secuencial" TEXT,
    "numeroDoc" TEXT,
    "fechaEmision" TIMESTAMP(3) NOT NULL,
    "fechaAutorizacion" TIMESTAMP(3),
    "ambiente" TEXT DEFAULT 'PRODUCCION',
    "subtotal0" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotal8" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotal12" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotal15" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotalNoObj" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotalExento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalDescuento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "iva" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "irbpnr" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "propina" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "formaPago" TEXT,
    "valorFormaPago" DECIMAL(12,2),
    "retencionRenta" DECIMAL(12,2),
    "retencionIva" DECIMAL(12,2),
    "parseConfidence" INTEGER,
    "parseWarnings" TEXT,
    "fileType" TEXT,
    "rawJson" JSONB,
    "observaciones" TEXT,
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "supplierId" TEXT,
    "purchaseOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sri_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sri_document_items" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "linea" INTEGER NOT NULL,
    "codPrincipal" TEXT NOT NULL,
    "codAuxiliar" TEXT,
    "descripcion" TEXT NOT NULL,
    "detAdicional" TEXT,
    "cantidad" DECIMAL(12,4) NOT NULL,
    "precioUnitario" DECIMAL(12,4) NOT NULL,
    "descuento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "precioTotal" DECIMAL(12,2) NOT NULL,
    "codigoTarifa" TEXT NOT NULL,
    "tarifaIva" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "valorIva" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tipoItem" TEXT NOT NULL DEFAULT 'PRODUCTO',
    "productId" TEXT,

    CONSTRAINT "sri_document_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sri_retentions" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "baseImponible" DECIMAL(12,2) NOT NULL,
    "porcentaje" DECIMAL(5,2) NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "sri_retentions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iva_tariffs" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "porcentaje" DECIMAL(5,2) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "vigenciaDesde" TIMESTAMP(3) NOT NULL,
    "vigenciaHasta" TIMESTAMP(3),

    CONSTRAINT "iva_tariffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retention_catalog" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "porcentaje" DECIMAL(5,2) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "aplicaA" TEXT NOT NULL,

    CONSTRAINT "retention_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_withholdings" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "baseImponible" DECIMAL(12,2) NOT NULL,
    "porcentaje" DECIMAL(5,2) NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_withholdings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_lists" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_list_items" (
    "id" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "minQuantity" DECIMAL(12,4) NOT NULL DEFAULT 1,

    CONSTRAINT "price_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ruc" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "creditLimit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "personType" TEXT,
    "documentType" TEXT,
    "razonSocial" TEXT,
    "nombreComercial" TEXT,
    "ciiuCode" TEXT,
    "ciiuDescription" TEXT,
    "birthDate" TIMESTAMP(3),
    "nationality" TEXT,
    "maritalStatus" TEXT,
    "spouseName" TEXT,
    "spouseDocument" TEXT,
    "occupation" TEXT,
    "employerName" TEXT,
    "workplace" TEXT,
    "legalRepName" TEXT,
    "legalRepDocument" TEXT,
    "beneficialOwners" JSONB,
    "annualIncome" DECIMAL(14,2),
    "estimatedPatrimony" DECIMAL(14,2),
    "paymentTerms" TEXT,
    "isPEP" BOOLEAN NOT NULL DEFAULT false,
    "pepPosition" TEXT,
    "pepRelationship" TEXT,
    "contribuyenteEspecial" BOOLEAN NOT NULL DEFAULT false,
    "obligadoContabilidad" BOOLEAN NOT NULL DEFAULT false,
    "taxRegime" TEXT,
    "defaultIvaCode" TEXT,
    "defaultRetentionCodeRenta" TEXT,
    "defaultRetentionCodeIva" TEXT,
    "kycCompletedAt" TIMESTAMP(3),
    "kycCompletedBy" TEXT,
    "kycLastReviewedAt" TIMESTAMP(3),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_quotations" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "quoteNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "validUntil" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_quotation_items" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unitPrice" DECIMAL(12,4) NOT NULL,
    "discount" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "sales_quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_orders" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "quotationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deliveryDate" TIMESTAMP(3),
    "deliveryAddress" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT,
    "description" TEXT,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unitPrice" DECIMAL(12,4) NOT NULL,
    "discount" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "reservedQty" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "shippedQty" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "invoicedQty" DECIMAL(12,4) NOT NULL DEFAULT 0,

    CONSTRAINT "sales_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "changes" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_performance_records" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "deliveredDate" TIMESTAMP(3),
    "promisedDate" TIMESTAMP(3),
    "onTimeDays" INTEGER,
    "isOnTime" BOOLEAN NOT NULL DEFAULT true,
    "invoiceTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "poTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "priceVariancePct" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "defectQty" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "totalQty" DECIMAL(12,4) NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_performance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_scores" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "priceScore" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "deliveryScore" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "qualityScore" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "complianceScore" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "totalScore" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "recordsCount" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "uploadedBy" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entryNumber" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "totalDebit" DECIMAL(12,2) NOT NULL,
    "totalCredit" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entry_lines" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "debit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "description" TEXT,

    CONSTRAINT "journal_entry_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_quotation_responses" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "validUntil" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portal_quotation_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_quotation_items" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unitPrice" DECIMAL(12,4) NOT NULL,
    "deliveryDays" INTEGER,
    "notes" TEXT,

    CONSTRAINT "portal_quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bills_of_materials" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bills_of_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom_items" (
    "id" TEXT NOT NULL,
    "bomId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unit" TEXT,
    "wastePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "bom_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_orders" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "bomId" TEXT,
    "quantity" DECIMAL(12,4) NOT NULL,
    "quantityDone" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "plannedStart" TIMESTAMP(3),
    "plannedEnd" TIMESTAMP(3),
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "requiredQty" DECIMAL(12,4) NOT NULL,
    "consumedQty" DECIMAL(12,4) NOT NULL DEFAULT 0,

    CONSTRAINT "production_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_chart_of_accounts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "parentId" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "isMovement" BOOLEAN NOT NULL DEFAULT true,
    "niifRef" TEXT,
    "sriRef" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_chart_of_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_dcf_models" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assumptions" JSONB NOT NULL,
    "results" JSONB NOT NULL,
    "yearlyProjections" JSONB NOT NULL,
    "sensitivity" JSONB,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "finance_dcf_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_scenarios" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'custom',
    "parameters" JSONB NOT NULL,
    "results" JSONB NOT NULL,
    "baselineId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "finance_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_savings_log" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "savingType" TEXT NOT NULL,
    "amountUsd" DECIMAL(15,2) NOT NULL,
    "sourceModule" TEXT NOT NULL,
    "sourceId" TEXT,
    "description" TEXT,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "evidenceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "finance_savings_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_ai_insights" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "insights" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "tokensUsed" INTEGER,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_ai_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_statements" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "data" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "financial_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_mappings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_contacts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "crmCompanyId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "title" TEXT,
    "email" TEXT,
    "phoneE164" TEXT,
    "whatsappId" TEXT,
    "telegramId" TEXT,
    "linkedinUrl" TEXT,
    "preferredChannel" TEXT DEFAULT 'whatsapp',
    "language" TEXT NOT NULL DEFAULT 'es-EC',
    "timezone" TEXT NOT NULL DEFAULT 'America/Guayaquil',
    "leadScore" INTEGER NOT NULL DEFAULT 0,
    "leadTemperature" TEXT DEFAULT 'cold',
    "ownerUserId" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "customFields" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_companies" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ruc" TEXT,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT,
    "industry" TEXT,
    "ciiu" TEXT,
    "size" TEXT,
    "employeesEst" INTEGER,
    "revenueEstUsd" DECIMAL(14,2),
    "country" TEXT NOT NULL DEFAULT 'EC',
    "city" TEXT,
    "address" TEXT,
    "website" TEXT,
    "linkedinUrl" TEXT,
    "lifecycleStage" TEXT NOT NULL DEFAULT 'lead',
    "ownerUserId" TEXT,
    "enrichedAt" TIMESTAMP(3),
    "enrichedData" JSONB,
    "buyingSignals" JSONB DEFAULT '[]',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_deals" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contactId" TEXT,
    "crmCompanyId" TEXT,
    "name" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'lead',
    "amountUsd" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "probability" INTEGER NOT NULL DEFAULT 10,
    "expectedCloseDate" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedReason" TEXT,
    "ownerUserId" TEXT,
    "autonomyMode" TEXT NOT NULL DEFAULT 'setter_closer',
    "modulesInterest" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tierInterest" TEXT,
    "notes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_deal_stage_history" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "fromStage" TEXT,
    "toStage" TEXT NOT NULL,
    "changedBy" TEXT,
    "notes" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_deal_stage_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_conversations" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contactId" TEXT,
    "channel" TEXT NOT NULL,
    "externalChatId" TEXT,
    "unipileAccountId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "aiHandling" BOOLEAN NOT NULL DEFAULT true,
    "ownerUserId" TEXT,
    "subject" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "lastMessageBody" TEXT,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "externalId" TEXT,
    "direction" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachments" JSONB DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'sent',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "senderType" TEXT NOT NULL DEFAULT 'human',
    "agentCode" TEXT,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "crm_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_agents" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "maxTokens" INTEGER NOT NULL DEFAULT 1500,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "tools" JSONB NOT NULL DEFAULT '[]',
    "autonomyDefault" TEXT NOT NULL DEFAULT 'setter_closer',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metrics" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_agent_runs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "agentCode" TEXT NOT NULL,
    "conversationId" TEXT,
    "dealId" TEXT,
    "inputContext" JSONB NOT NULL,
    "output" JSONB,
    "toolsCalled" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tokensInput" INTEGER NOT NULL DEFAULT 0,
    "tokensOutput" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'success',
    "errorMessage" TEXT,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_workflows" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "actions" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "crm_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_lead_scores" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "budgetScore" INTEGER NOT NULL DEFAULT 0,
    "authorityScore" INTEGER NOT NULL DEFAULT 0,
    "needScore" INTEGER NOT NULL DEFAULT 0,
    "timelineScore" INTEGER NOT NULL DEFAULT 0,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "evidence" TEXT,
    "scoredBy" TEXT NOT NULL DEFAULT 'system',
    "scoredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_lead_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_forecasts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "totalPipelineUsd" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "weightedFcstUsd" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "wonUsd" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "byStage" JSONB NOT NULL DEFAULT '{}',
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_forecasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_templates" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'utility',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "crm_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "orderType" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "trackingNumber" TEXT NOT NULL,
    "carrier" TEXT,
    "carrierGuide" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "originAddress" TEXT,
    "destAddress" TEXT,
    "recipientName" TEXT,
    "recipientPhone" TEXT,
    "estimatedDelivery" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_items" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "salesOrderItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "shipment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_events" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "eventTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "location" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_sequences" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "padding" INTEGER NOT NULL DEFAULT 4,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "reference" TEXT,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "appliedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'UNAPPLIED',
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_applications" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amountApplied" DECIMAL(12,2) NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "payment_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_companyId_idx" ON "users"("companyId");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "user_sessions_userId_idx" ON "user_sessions"("userId");

-- CreateIndex
CREATE INDEX "user_sessions_expiresAt_idx" ON "user_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "categories_companyId_idx" ON "categories"("companyId");

-- CreateIndex
CREATE INDEX "warehouses_companyId_idx" ON "warehouses"("companyId");

-- CreateIndex
CREATE INDEX "storage_locations_companyId_idx" ON "storage_locations"("companyId");

-- CreateIndex
CREATE INDEX "storage_locations_warehouseId_idx" ON "storage_locations"("warehouseId");

-- CreateIndex
CREATE INDEX "products_companyId_idx" ON "products"("companyId");

-- CreateIndex
CREATE INDEX "products_sku_idx" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_barcode_idx" ON "products"("barcode");

-- CreateIndex
CREATE INDEX "product_stock_productId_idx" ON "product_stock"("productId");

-- CreateIndex
CREATE INDEX "product_stock_warehouseId_idx" ON "product_stock"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "product_stock_productId_warehouseId_key" ON "product_stock"("productId", "warehouseId");

-- CreateIndex
CREATE INDEX "inventory_movements_companyId_idx" ON "inventory_movements"("companyId");

-- CreateIndex
CREATE INDEX "inventory_movements_productId_idx" ON "inventory_movements"("productId");

-- CreateIndex
CREATE INDEX "inventory_movements_warehouseId_idx" ON "inventory_movements"("warehouseId");

-- CreateIndex
CREATE INDEX "inventory_movements_createdAt_idx" ON "inventory_movements"("createdAt");

-- CreateIndex
CREATE INDEX "inventory_movements_batchId_idx" ON "inventory_movements"("batchId");

-- CreateIndex
CREATE INDEX "inventory_adjustments_companyId_idx" ON "inventory_adjustments"("companyId");

-- CreateIndex
CREATE INDEX "inventory_adjustments_status_idx" ON "inventory_adjustments"("status");

-- CreateIndex
CREATE INDEX "inventory_adjustments_productId_idx" ON "inventory_adjustments"("productId");

-- CreateIndex
CREATE INDEX "inventory_batches_companyId_idx" ON "inventory_batches"("companyId");

-- CreateIndex
CREATE INDEX "inventory_batches_productId_warehouseId_isExhausted_idx" ON "inventory_batches"("productId", "warehouseId", "isExhausted");

-- CreateIndex
CREATE INDEX "inventory_batches_receivedAt_idx" ON "inventory_batches"("receivedAt");

-- CreateIndex
CREATE INDEX "departments_companyId_idx" ON "departments"("companyId");

-- CreateIndex
CREATE INDEX "suppliers_companyId_idx" ON "suppliers"("companyId");

-- CreateIndex
CREATE INDEX "suppliers_ruc_idx" ON "suppliers"("ruc");

-- CreateIndex
CREATE INDEX "suppliers_portalToken_idx" ON "suppliers"("portalToken");

-- CreateIndex
CREATE INDEX "suppliers_isPEP_idx" ON "suppliers"("isPEP");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_poNumber_key" ON "purchase_orders"("poNumber");

-- CreateIndex
CREATE INDEX "purchase_orders_companyId_idx" ON "purchase_orders"("companyId");

-- CreateIndex
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");

-- CreateIndex
CREATE UNIQUE INDEX "requisitions_reqNumber_key" ON "requisitions"("reqNumber");

-- CreateIndex
CREATE INDEX "requisitions_companyId_idx" ON "requisitions"("companyId");

-- CreateIndex
CREATE INDEX "requisitions_status_idx" ON "requisitions"("status");

-- CreateIndex
CREATE INDEX "requisition_items_requisitionId_idx" ON "requisition_items"("requisitionId");

-- CreateIndex
CREATE INDEX "supplier_quotations_requisitionId_idx" ON "supplier_quotations"("requisitionId");

-- CreateIndex
CREATE INDEX "supplier_quotations_companyId_idx" ON "supplier_quotations"("companyId");

-- CreateIndex
CREATE INDEX "quotation_items_quotationId_idx" ON "quotation_items"("quotationId");

-- CreateIndex
CREATE INDEX "budget_controls_companyId_idx" ON "budget_controls"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "budget_controls_companyId_departmentId_year_month_key" ON "budget_controls"("companyId", "departmentId", "year", "month");

-- CreateIndex
CREATE INDEX "approval_matrix_companyId_idx" ON "approval_matrix"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "approval_matrix_companyId_level_key" ON "approval_matrix"("companyId", "level");

-- CreateIndex
CREATE INDEX "physical_counts_companyId_idx" ON "physical_counts"("companyId");

-- CreateIndex
CREATE INDEX "physical_counts_warehouseId_idx" ON "physical_counts"("warehouseId");

-- CreateIndex
CREATE INDEX "physical_count_items_countId_idx" ON "physical_count_items"("countId");

-- CreateIndex
CREATE INDEX "physical_count_items_productId_idx" ON "physical_count_items"("productId");

-- CreateIndex
CREATE INDEX "po_items_poId_idx" ON "po_items"("poId");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_name_key" ON "subscription_plans"("name");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_companyId_key" ON "subscriptions"("companyId");

-- CreateIndex
CREATE INDEX "subscriptions_companyId_idx" ON "subscriptions"("companyId");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "billing_history_companyId_idx" ON "billing_history"("companyId");

-- CreateIndex
CREATE INDEX "billing_history_status_idx" ON "billing_history"("status");

-- CreateIndex
CREATE INDEX "invoices_companyId_idx" ON "invoices"("companyId");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_salesOrderId_idx" ON "invoices"("salesOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_companyId_number_key" ON "invoices"("companyId", "number");

-- CreateIndex
CREATE INDEX "invoice_items_invoiceId_idx" ON "invoice_items"("invoiceId");

-- CreateIndex
CREATE INDEX "sri_documents_companyId_idx" ON "sri_documents"("companyId");

-- CreateIndex
CREATE INDEX "sri_documents_rucEmisor_idx" ON "sri_documents"("rucEmisor");

-- CreateIndex
CREATE INDEX "sri_documents_status_idx" ON "sri_documents"("status");

-- CreateIndex
CREATE INDEX "sri_documents_fechaEmision_idx" ON "sri_documents"("fechaEmision");

-- CreateIndex
CREATE UNIQUE INDEX "sri_documents_companyId_claveAcceso_key" ON "sri_documents"("companyId", "claveAcceso");

-- CreateIndex
CREATE INDEX "sri_document_items_documentId_idx" ON "sri_document_items"("documentId");

-- CreateIndex
CREATE INDEX "sri_retentions_documentId_idx" ON "sri_retentions"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "iva_tariffs_codigo_key" ON "iva_tariffs"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "retention_catalog_codigo_key" ON "retention_catalog"("codigo");

-- CreateIndex
CREATE INDEX "invoice_withholdings_invoiceId_idx" ON "invoice_withholdings"("invoiceId");

-- CreateIndex
CREATE INDEX "invoice_withholdings_invoiceId_tipo_idx" ON "invoice_withholdings"("invoiceId", "tipo");

-- CreateIndex
CREATE INDEX "invoice_withholdings_tipo_codigo_idx" ON "invoice_withholdings"("tipo", "codigo");

-- CreateIndex
CREATE INDEX "price_lists_companyId_idx" ON "price_lists"("companyId");

-- CreateIndex
CREATE INDEX "price_lists_companyId_isActive_idx" ON "price_lists"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "price_list_items_priceListId_idx" ON "price_list_items"("priceListId");

-- CreateIndex
CREATE UNIQUE INDEX "price_list_items_priceListId_productId_minQuantity_key" ON "price_list_items"("priceListId", "productId", "minQuantity");

-- CreateIndex
CREATE INDEX "customers_companyId_idx" ON "customers"("companyId");

-- CreateIndex
CREATE INDEX "customers_ruc_idx" ON "customers"("ruc");

-- CreateIndex
CREATE INDEX "customers_isPEP_idx" ON "customers"("isPEP");

-- CreateIndex
CREATE UNIQUE INDEX "sales_quotations_quoteNumber_key" ON "sales_quotations"("quoteNumber");

-- CreateIndex
CREATE INDEX "sales_quotations_companyId_idx" ON "sales_quotations"("companyId");

-- CreateIndex
CREATE INDEX "sales_quotations_customerId_idx" ON "sales_quotations"("customerId");

-- CreateIndex
CREATE INDEX "sales_quotations_status_idx" ON "sales_quotations"("status");

-- CreateIndex
CREATE INDEX "sales_quotation_items_quotationId_idx" ON "sales_quotation_items"("quotationId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_quotationId_key" ON "sales_orders"("quotationId");

-- CreateIndex
CREATE INDEX "sales_orders_companyId_idx" ON "sales_orders"("companyId");

-- CreateIndex
CREATE INDEX "sales_orders_customerId_idx" ON "sales_orders"("customerId");

-- CreateIndex
CREATE INDEX "sales_orders_status_idx" ON "sales_orders"("status");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_companyId_orderNumber_key" ON "sales_orders"("companyId", "orderNumber");

-- CreateIndex
CREATE INDEX "sales_order_items_orderId_idx" ON "sales_order_items"("orderId");

-- CreateIndex
CREATE INDEX "sales_order_items_productId_idx" ON "sales_order_items"("productId");

-- CreateIndex
CREATE INDEX "sales_order_items_orderId_shippedQty_idx" ON "sales_order_items"("orderId", "shippedQty");

-- CreateIndex
CREATE INDEX "sales_order_items_orderId_invoicedQty_idx" ON "sales_order_items"("orderId", "invoicedQty");

-- CreateIndex
CREATE INDEX "audit_logs_companyId_idx" ON "audit_logs"("companyId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "supplier_performance_records_companyId_idx" ON "supplier_performance_records"("companyId");

-- CreateIndex
CREATE INDEX "supplier_performance_records_supplierId_idx" ON "supplier_performance_records"("supplierId");

-- CreateIndex
CREATE INDEX "supplier_performance_records_poId_idx" ON "supplier_performance_records"("poId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_scores_supplierId_key" ON "supplier_scores"("supplierId");

-- CreateIndex
CREATE INDEX "supplier_scores_companyId_idx" ON "supplier_scores"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_scores_companyId_supplierId_key" ON "supplier_scores"("companyId", "supplierId");

-- CreateIndex
CREATE INDEX "attachments_companyId_idx" ON "attachments"("companyId");

-- CreateIndex
CREATE INDEX "attachments_entityType_entityId_idx" ON "attachments"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "journal_entries_companyId_idx" ON "journal_entries"("companyId");

-- CreateIndex
CREATE INDEX "journal_entries_entityType_entityId_idx" ON "journal_entries"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "journal_entries_entryDate_idx" ON "journal_entries"("entryDate");

-- CreateIndex
CREATE INDEX "journal_entry_lines_entryId_idx" ON "journal_entry_lines"("entryId");

-- CreateIndex
CREATE INDEX "portal_quotation_responses_supplierId_idx" ON "portal_quotation_responses"("supplierId");

-- CreateIndex
CREATE INDEX "portal_quotation_responses_requisitionId_idx" ON "portal_quotation_responses"("requisitionId");

-- CreateIndex
CREATE INDEX "portal_quotation_items_responseId_idx" ON "portal_quotation_items"("responseId");

-- CreateIndex
CREATE INDEX "bills_of_materials_companyId_idx" ON "bills_of_materials"("companyId");

-- CreateIndex
CREATE INDEX "bills_of_materials_productId_idx" ON "bills_of_materials"("productId");

-- CreateIndex
CREATE INDEX "bom_items_bomId_idx" ON "bom_items"("bomId");

-- CreateIndex
CREATE INDEX "production_orders_companyId_idx" ON "production_orders"("companyId");

-- CreateIndex
CREATE INDEX "production_orders_productId_idx" ON "production_orders"("productId");

-- CreateIndex
CREATE INDEX "production_orders_status_idx" ON "production_orders"("status");

-- CreateIndex
CREATE INDEX "production_order_items_orderId_idx" ON "production_order_items"("orderId");

-- CreateIndex
CREATE INDEX "finance_chart_of_accounts_companyId_idx" ON "finance_chart_of_accounts"("companyId");

-- CreateIndex
CREATE INDEX "finance_chart_of_accounts_accountType_idx" ON "finance_chart_of_accounts"("accountType");

-- CreateIndex
CREATE INDEX "finance_chart_of_accounts_parentId_idx" ON "finance_chart_of_accounts"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "finance_chart_of_accounts_companyId_code_key" ON "finance_chart_of_accounts"("companyId", "code");

-- CreateIndex
CREATE INDEX "finance_dcf_models_companyId_idx" ON "finance_dcf_models"("companyId");

-- CreateIndex
CREATE INDEX "finance_scenarios_companyId_idx" ON "finance_scenarios"("companyId");

-- CreateIndex
CREATE INDEX "finance_scenarios_type_idx" ON "finance_scenarios"("type");

-- CreateIndex
CREATE INDEX "finance_savings_log_companyId_idx" ON "finance_savings_log"("companyId");

-- CreateIndex
CREATE INDEX "finance_savings_log_savingType_idx" ON "finance_savings_log"("savingType");

-- CreateIndex
CREATE INDEX "finance_savings_log_periodYear_periodMonth_idx" ON "finance_savings_log"("periodYear", "periodMonth");

-- CreateIndex
CREATE INDEX "finance_ai_insights_companyId_period_idx" ON "finance_ai_insights"("companyId", "period");

-- CreateIndex
CREATE INDEX "financial_statements_companyId_idx" ON "financial_statements"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "financial_statements_companyId_type_period_key" ON "financial_statements"("companyId", "type", "period");

-- CreateIndex
CREATE INDEX "account_mappings_companyId_idx" ON "account_mappings"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "account_mappings_companyId_key_key" ON "account_mappings"("companyId", "key");

-- CreateIndex
CREATE INDEX "crm_contacts_companyId_idx" ON "crm_contacts"("companyId");

-- CreateIndex
CREATE INDEX "crm_contacts_email_idx" ON "crm_contacts"("email");

-- CreateIndex
CREATE INDEX "crm_contacts_leadScore_idx" ON "crm_contacts"("leadScore");

-- CreateIndex
CREATE INDEX "crm_contacts_ownerUserId_idx" ON "crm_contacts"("ownerUserId");

-- CreateIndex
CREATE INDEX "crm_companies_companyId_idx" ON "crm_companies"("companyId");

-- CreateIndex
CREATE INDEX "crm_companies_ruc_idx" ON "crm_companies"("ruc");

-- CreateIndex
CREATE INDEX "crm_companies_lifecycleStage_idx" ON "crm_companies"("lifecycleStage");

-- CreateIndex
CREATE INDEX "crm_companies_industry_idx" ON "crm_companies"("industry");

-- CreateIndex
CREATE INDEX "crm_deals_companyId_idx" ON "crm_deals"("companyId");

-- CreateIndex
CREATE INDEX "crm_deals_stage_idx" ON "crm_deals"("stage");

-- CreateIndex
CREATE INDEX "crm_deals_ownerUserId_idx" ON "crm_deals"("ownerUserId");

-- CreateIndex
CREATE INDEX "crm_deals_expectedCloseDate_idx" ON "crm_deals"("expectedCloseDate");

-- CreateIndex
CREATE INDEX "crm_deal_stage_history_dealId_idx" ON "crm_deal_stage_history"("dealId");

-- CreateIndex
CREATE INDEX "crm_conversations_companyId_idx" ON "crm_conversations"("companyId");

-- CreateIndex
CREATE INDEX "crm_conversations_contactId_idx" ON "crm_conversations"("contactId");

-- CreateIndex
CREATE INDEX "crm_conversations_channel_idx" ON "crm_conversations"("channel");

-- CreateIndex
CREATE INDEX "crm_conversations_status_idx" ON "crm_conversations"("status");

-- CreateIndex
CREATE INDEX "crm_conversations_lastMessageAt_idx" ON "crm_conversations"("lastMessageAt");

-- CreateIndex
CREATE INDEX "crm_messages_conversationId_idx" ON "crm_messages"("conversationId");

-- CreateIndex
CREATE INDEX "crm_messages_direction_idx" ON "crm_messages"("direction");

-- CreateIndex
CREATE INDEX "crm_messages_sentAt_idx" ON "crm_messages"("sentAt");

-- CreateIndex
CREATE INDEX "crm_agents_companyId_idx" ON "crm_agents"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "crm_agents_companyId_code_key" ON "crm_agents"("companyId", "code");

-- CreateIndex
CREATE INDEX "crm_agent_runs_companyId_idx" ON "crm_agent_runs"("companyId");

-- CreateIndex
CREATE INDEX "crm_agent_runs_agentCode_idx" ON "crm_agent_runs"("agentCode");

-- CreateIndex
CREATE INDEX "crm_agent_runs_conversationId_idx" ON "crm_agent_runs"("conversationId");

-- CreateIndex
CREATE INDEX "crm_agent_runs_createdAt_idx" ON "crm_agent_runs"("createdAt");

-- CreateIndex
CREATE INDEX "crm_workflows_companyId_idx" ON "crm_workflows"("companyId");

-- CreateIndex
CREATE INDEX "crm_workflows_trigger_idx" ON "crm_workflows"("trigger");

-- CreateIndex
CREATE INDEX "crm_lead_scores_contactId_idx" ON "crm_lead_scores"("contactId");

-- CreateIndex
CREATE INDEX "crm_lead_scores_scoredAt_idx" ON "crm_lead_scores"("scoredAt");

-- CreateIndex
CREATE INDEX "crm_forecasts_companyId_idx" ON "crm_forecasts"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "crm_forecasts_companyId_period_key" ON "crm_forecasts"("companyId", "period");

-- CreateIndex
CREATE INDEX "crm_templates_companyId_idx" ON "crm_templates"("companyId");

-- CreateIndex
CREATE INDEX "crm_templates_channel_idx" ON "crm_templates"("channel");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_trackingNumber_key" ON "shipments"("trackingNumber");

-- CreateIndex
CREATE INDEX "shipments_companyId_idx" ON "shipments"("companyId");

-- CreateIndex
CREATE INDEX "shipments_orderType_orderId_idx" ON "shipments"("orderType", "orderId");

-- CreateIndex
CREATE INDEX "shipments_status_idx" ON "shipments"("status");

-- CreateIndex
CREATE INDEX "shipment_items_shipmentId_idx" ON "shipment_items"("shipmentId");

-- CreateIndex
CREATE INDEX "shipment_items_salesOrderItemId_idx" ON "shipment_items"("salesOrderItemId");

-- CreateIndex
CREATE INDEX "shipment_events_shipmentId_idx" ON "shipment_events"("shipmentId");

-- CreateIndex
CREATE INDEX "shipment_events_eventTime_idx" ON "shipment_events"("eventTime");

-- CreateIndex
CREATE INDEX "document_sequences_companyId_idx" ON "document_sequences"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "document_sequences_companyId_docType_key" ON "document_sequences"("companyId", "docType");

-- CreateIndex
CREATE UNIQUE INDEX "payments_paymentNumber_key" ON "payments"("paymentNumber");

-- CreateIndex
CREATE INDEX "payments_companyId_idx" ON "payments"("companyId");

-- CreateIndex
CREATE INDEX "payments_entityType_entityId_idx" ON "payments"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "payment_applications_paymentId_idx" ON "payment_applications"("paymentId");

-- CreateIndex
CREATE INDEX "payment_applications_invoiceId_idx" ON "payment_applications"("invoiceId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_parentWarehouseId_fkey" FOREIGN KEY ("parentWarehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_locations" ADD CONSTRAINT "storage_locations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_locations" ADD CONSTRAINT "storage_locations_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_defaultLocationId_fkey" FOREIGN KEY ("defaultLocationId") REFERENCES "storage_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_stock" ADD CONSTRAINT "product_stock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_stock" ADD CONSTRAINT "product_stock_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "requisitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_deliveryLocationId_fkey" FOREIGN KEY ("deliveryLocationId") REFERENCES "storage_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisitions" ADD CONSTRAINT "requisitions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisitions" ADD CONSTRAINT "requisitions_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisition_items" ADD CONSTRAINT "requisition_items_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisition_items" ADD CONSTRAINT "requisition_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_quotations" ADD CONSTRAINT "supplier_quotations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_quotations" ADD CONSTRAINT "supplier_quotations_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_quotations" ADD CONSTRAINT "supplier_quotations_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "supplier_quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_requisitionItemId_fkey" FOREIGN KEY ("requisitionItemId") REFERENCES "requisition_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_controls" ADD CONSTRAINT "budget_controls_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_controls" ADD CONSTRAINT "budget_controls_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_matrix" ADD CONSTRAINT "approval_matrix_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physical_counts" ADD CONSTRAINT "physical_counts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physical_counts" ADD CONSTRAINT "physical_counts_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physical_count_items" ADD CONSTRAINT "physical_count_items_countId_fkey" FOREIGN KEY ("countId") REFERENCES "physical_counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physical_count_items" ADD CONSTRAINT "physical_count_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_items" ADD CONSTRAINT "po_items_poId_fkey" FOREIGN KEY ("poId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_items" ADD CONSTRAINT "po_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_history" ADD CONSTRAINT "billing_history_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sri_documents" ADD CONSTRAINT "sri_documents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sri_documents" ADD CONSTRAINT "sri_documents_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sri_documents" ADD CONSTRAINT "sri_documents_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sri_document_items" ADD CONSTRAINT "sri_document_items_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "sri_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sri_document_items" ADD CONSTRAINT "sri_document_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sri_retentions" ADD CONSTRAINT "sri_retentions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "sri_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_withholdings" ADD CONSTRAINT "invoice_withholdings_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "price_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quotations" ADD CONSTRAINT "sales_quotations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quotations" ADD CONSTRAINT "sales_quotations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quotation_items" ADD CONSTRAINT "sales_quotation_items_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "sales_quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_quotation_items" ADD CONSTRAINT "sales_quotation_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "sales_quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_performance_records" ADD CONSTRAINT "supplier_performance_records_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_performance_records" ADD CONSTRAINT "supplier_performance_records_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_performance_records" ADD CONSTRAINT "supplier_performance_records_poId_fkey" FOREIGN KEY ("poId") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_scores" ADD CONSTRAINT "supplier_scores_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_scores" ADD CONSTRAINT "supplier_scores_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_quotation_responses" ADD CONSTRAINT "portal_quotation_responses_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_quotation_responses" ADD CONSTRAINT "portal_quotation_responses_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_quotation_items" ADD CONSTRAINT "portal_quotation_items_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "portal_quotation_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_quotation_items" ADD CONSTRAINT "portal_quotation_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills_of_materials" ADD CONSTRAINT "bills_of_materials_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills_of_materials" ADD CONSTRAINT "bills_of_materials_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_items" ADD CONSTRAINT "bom_items_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "bills_of_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_items" ADD CONSTRAINT "bom_items_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "bills_of_materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_items" ADD CONSTRAINT "production_order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_items" ADD CONSTRAINT "production_order_items_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_chart_of_accounts" ADD CONSTRAINT "finance_chart_of_accounts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_chart_of_accounts" ADD CONSTRAINT "finance_chart_of_accounts_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "finance_chart_of_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_dcf_models" ADD CONSTRAINT "finance_dcf_models_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_scenarios" ADD CONSTRAINT "finance_scenarios_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_savings_log" ADD CONSTRAINT "finance_savings_log_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_ai_insights" ADD CONSTRAINT "finance_ai_insights_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_statements" ADD CONSTRAINT "financial_statements_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_mappings" ADD CONSTRAINT "account_mappings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_crmCompanyId_fkey" FOREIGN KEY ("crmCompanyId") REFERENCES "crm_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_companies" ADD CONSTRAINT "crm_companies_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_crmCompanyId_fkey" FOREIGN KEY ("crmCompanyId") REFERENCES "crm_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_deal_stage_history" ADD CONSTRAINT "crm_deal_stage_history_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "crm_deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_conversations" ADD CONSTRAINT "crm_conversations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_conversations" ADD CONSTRAINT "crm_conversations_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_messages" ADD CONSTRAINT "crm_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "crm_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_agents" ADD CONSTRAINT "crm_agents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_agent_runs" ADD CONSTRAINT "crm_agent_runs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_agent_runs" ADD CONSTRAINT "crm_agent_runs_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "crm_agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_workflows" ADD CONSTRAINT "crm_workflows_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_scores" ADD CONSTRAINT "crm_lead_scores_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "crm_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_forecasts" ADD CONSTRAINT "crm_forecasts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_templates" ADD CONSTRAINT "crm_templates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_salesOrderItemId_fkey" FOREIGN KEY ("salesOrderItemId") REFERENCES "sales_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_applications" ADD CONSTRAINT "payment_applications_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_applications" ADD CONSTRAINT "payment_applications_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

