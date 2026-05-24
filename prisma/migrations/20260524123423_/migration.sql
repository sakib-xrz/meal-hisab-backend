-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'LEFT');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'INVITED', 'REMOVED');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('HOUSE_RENT', 'GAS', 'ELECTRICITY', 'WIFI', 'WATER', 'CLEANER', 'MAINTENANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseSplitType" AS ENUM ('EQUAL_BY_ACTIVE_MEMBER', 'CUSTOM', 'NONE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BKASH', 'NAGAD', 'BANK', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('DEPOSIT', 'REFUND', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('AVATAR', 'RECEIPT', 'DOCUMENT', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "isPhoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "avatarAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "originalName" TEXT,
    "type" "AssetType" NOT NULL DEFAULT 'OTHER',
    "ownerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mess" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessRole" (
    "id" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "permissions" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessUser" (
    "id" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "memberId" TEXT,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "roomNo" TEXT,
    "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "joiningDate" DATE NOT NULL,
    "leavingDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealEntry" (
    "id" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "mealDate" DATE NOT NULL,
    "breakfast" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "lunch" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "dinner" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BazaarEntry" (
    "id" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "buyerMemberId" TEXT NOT NULL,
    "bazaarDate" DATE NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "receiptUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BazaarEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BazaarItem" (
    "id" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "bazaarEntryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL(10,2),
    "unit" TEXT,
    "unitPrice" DECIMAL(12,2),
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BazaarItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "expenseDate" DATE NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "splitType" "ExpenseSplitType" NOT NULL DEFAULT 'EQUAL_BY_ACTIVE_MEMBER',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseSplit" (
    "id" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseSplit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "paymentDate" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "type" "PaymentType" NOT NULL DEFAULT 'DEPOSIT',
    "referenceNo" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyClosing" (
    "id" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "totalMeals" DECIMAL(12,2) NOT NULL,
    "totalBazaarCost" DECIMAL(12,2) NOT NULL,
    "mealRate" DECIMAL(12,4) NOT NULL,
    "totalExtraExpense" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyClosing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberMonthlyBill" (
    "id" TEXT NOT NULL,
    "messId" TEXT NOT NULL,
    "closingId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "totalMeals" DECIMAL(12,2) NOT NULL,
    "mealCost" DECIMAL(12,2) NOT NULL,
    "extraExpenseShare" DECIMAL(12,2) NOT NULL,
    "paidAmount" DECIMAL(12,2) NOT NULL,
    "bazaarCredit" DECIMAL(12,2) NOT NULL,
    "previousBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "finalBalance" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberMonthlyBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "messId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_avatarAssetId_key" ON "User"("avatarAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_key_key" ON "Asset"("key");

-- CreateIndex
CREATE INDEX "Asset_ownerUserId_idx" ON "Asset"("ownerUserId");

-- CreateIndex
CREATE INDEX "Asset_type_idx" ON "Asset"("type");

-- CreateIndex
CREATE INDEX "MessRole_messId_idx" ON "MessRole"("messId");

-- CreateIndex
CREATE UNIQUE INDEX "MessRole_messId_key_key" ON "MessRole"("messId", "key");

-- CreateIndex
CREATE INDEX "MessUser_messId_idx" ON "MessUser"("messId");

-- CreateIndex
CREATE INDEX "MessUser_userId_idx" ON "MessUser"("userId");

-- CreateIndex
CREATE INDEX "MessUser_roleId_idx" ON "MessUser"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "MessUser_messId_userId_key" ON "MessUser"("messId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "MessUser_messId_memberId_key" ON "MessUser"("messId", "memberId");

-- CreateIndex
CREATE INDEX "Member_messId_idx" ON "Member"("messId");

-- CreateIndex
CREATE UNIQUE INDEX "Member_messId_phone_key" ON "Member"("messId", "phone");

-- CreateIndex
CREATE INDEX "MealEntry_messId_mealDate_idx" ON "MealEntry"("messId", "mealDate");

-- CreateIndex
CREATE INDEX "MealEntry_messId_memberId_idx" ON "MealEntry"("messId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "MealEntry_messId_memberId_mealDate_key" ON "MealEntry"("messId", "memberId", "mealDate");

-- CreateIndex
CREATE INDEX "BazaarEntry_messId_bazaarDate_idx" ON "BazaarEntry"("messId", "bazaarDate");

-- CreateIndex
CREATE INDEX "BazaarEntry_messId_buyerMemberId_idx" ON "BazaarEntry"("messId", "buyerMemberId");

-- CreateIndex
CREATE INDEX "BazaarItem_messId_idx" ON "BazaarItem"("messId");

-- CreateIndex
CREATE INDEX "BazaarItem_bazaarEntryId_idx" ON "BazaarItem"("bazaarEntryId");

-- CreateIndex
CREATE INDEX "Expense_messId_expenseDate_idx" ON "Expense"("messId", "expenseDate");

-- CreateIndex
CREATE INDEX "Expense_messId_category_idx" ON "Expense"("messId", "category");

-- CreateIndex
CREATE INDEX "ExpenseSplit_messId_idx" ON "ExpenseSplit"("messId");

-- CreateIndex
CREATE INDEX "ExpenseSplit_memberId_idx" ON "ExpenseSplit"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseSplit_messId_expenseId_memberId_key" ON "ExpenseSplit"("messId", "expenseId", "memberId");

-- CreateIndex
CREATE INDEX "Payment_messId_paymentDate_idx" ON "Payment"("messId", "paymentDate");

-- CreateIndex
CREATE INDEX "Payment_messId_memberId_idx" ON "Payment"("messId", "memberId");

-- CreateIndex
CREATE INDEX "MonthlyClosing_messId_fromDate_toDate_idx" ON "MonthlyClosing"("messId", "fromDate", "toDate");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyClosing_messId_year_month_key" ON "MonthlyClosing"("messId", "year", "month");

-- CreateIndex
CREATE INDEX "MemberMonthlyBill_messId_idx" ON "MemberMonthlyBill"("messId");

-- CreateIndex
CREATE INDEX "MemberMonthlyBill_memberId_idx" ON "MemberMonthlyBill"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberMonthlyBill_messId_closingId_memberId_key" ON "MemberMonthlyBill"("messId", "closingId", "memberId");

-- CreateIndex
CREATE INDEX "AuditLog_messId_idx" ON "AuditLog"("messId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_avatarAssetId_fkey" FOREIGN KEY ("avatarAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessRole" ADD CONSTRAINT "MessRole_messId_fkey" FOREIGN KEY ("messId") REFERENCES "Mess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessUser" ADD CONSTRAINT "MessUser_messId_fkey" FOREIGN KEY ("messId") REFERENCES "Mess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessUser" ADD CONSTRAINT "MessUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessUser" ADD CONSTRAINT "MessUser_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "MessRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessUser" ADD CONSTRAINT "MessUser_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_messId_fkey" FOREIGN KEY ("messId") REFERENCES "Mess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealEntry" ADD CONSTRAINT "MealEntry_messId_fkey" FOREIGN KEY ("messId") REFERENCES "Mess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealEntry" ADD CONSTRAINT "MealEntry_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BazaarEntry" ADD CONSTRAINT "BazaarEntry_messId_fkey" FOREIGN KEY ("messId") REFERENCES "Mess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BazaarEntry" ADD CONSTRAINT "BazaarEntry_buyerMemberId_fkey" FOREIGN KEY ("buyerMemberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BazaarItem" ADD CONSTRAINT "BazaarItem_messId_fkey" FOREIGN KEY ("messId") REFERENCES "Mess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BazaarItem" ADD CONSTRAINT "BazaarItem_bazaarEntryId_fkey" FOREIGN KEY ("bazaarEntryId") REFERENCES "BazaarEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_messId_fkey" FOREIGN KEY ("messId") REFERENCES "Mess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseSplit" ADD CONSTRAINT "ExpenseSplit_messId_fkey" FOREIGN KEY ("messId") REFERENCES "Mess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseSplit" ADD CONSTRAINT "ExpenseSplit_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseSplit" ADD CONSTRAINT "ExpenseSplit_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_messId_fkey" FOREIGN KEY ("messId") REFERENCES "Mess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyClosing" ADD CONSTRAINT "MonthlyClosing_messId_fkey" FOREIGN KEY ("messId") REFERENCES "Mess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberMonthlyBill" ADD CONSTRAINT "MemberMonthlyBill_messId_fkey" FOREIGN KEY ("messId") REFERENCES "Mess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberMonthlyBill" ADD CONSTRAINT "MemberMonthlyBill_closingId_fkey" FOREIGN KEY ("closingId") REFERENCES "MonthlyClosing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberMonthlyBill" ADD CONSTRAINT "MemberMonthlyBill_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_messId_fkey" FOREIGN KEY ("messId") REFERENCES "Mess"("id") ON DELETE SET NULL ON UPDATE CASCADE;
