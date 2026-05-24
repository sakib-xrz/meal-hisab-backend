# Meal Hisab Project Requirement

# Core Concept

This application has two main levels:

## 1. System Level

Used by the platform owner or Super Admin.

The Super Admin can:

- Create messes/hostels
- Manage all messes
- Activate or deactivate messes
- View system users
- Manage subscriptions or plans in the future
- Access tenant data when needed

## 2. Tenant Level

Each mess or hostel is a tenant.

Inside each mess, users can manage:

- Members
- Meals
- Bazaar costs
- Deposits
- Expenses
- Meal rate
- Monthly reports
- Member-wise due/advance balance
- Tenant roles and permissions

---

# Multi-Tenant Architecture

The project uses:

```
Shared Database
Shared Schema
Tenant Isolation by messId

```

This means all messes use the same PostgreSQL database and same Prisma schema, but every tenant-specific table must contain:

```
messId String

```

Every tenant-specific query must be filtered by `messId`.

Example:

```
awaitprisma.member.findMany({
  where: {
    messId:req.messId,
  },
});

```

Never write tenant-related queries without `messId`.

---

# Tenant Identification

The tenant is identified from request headers:

```
X-MessID: <mess-id>

```

Every tenant-level API request must include this header.

Example:

```
GET /api/v1/members
Authorization: Bearer <access_token>
X-MessID: cmess123

```

Backend middleware must:

1. Read `X-MessID`
2. Validate that the mess exists
3. Check if the mess is active
4. Attach tenant context to the request
5. Verify that the logged-in user has access to that mess
6. Prevent cross-tenant data leakage

---

# Very Important Project Rules

Cursor and developers must follow these rules strictly:

```
1. User table is only for authentication and login.
2. User table must not contain mess-specific business data.
3. Mess is the tenant.
4. Every tenant-level table must include messId.
5. Every tenant-level API must require X-MessID.
6. Normal users can only access messes where they have active membership.
7. Roles and permissions are tenant-aware.
8. Manager of Mess A is not automatically Manager of Mess B.
9. Super Admin can bypass tenant restrictions only in system-level routes.
10. No query should return tenant data without filtering by messId.
11. Use Decimal for money, not Float.
12. Use Date fields for mealDate, bazaarDate, paymentDate, and expenseDate.
13. Monthly reports must be generated per messId.
14. Prefer repository/service functions that automatically receive messId.
15. Cross-tenant data leakage must be impossible.

```

---

# Authentication System

Authentication is phone and password based.

The `User` model is used only for login/authentication.

```
model User {
  id                String   @id @default(cuid())
  name              String
  phone             String   @unique
  passwordHash      String
  avatarUrl         String?

  isPhoneVerified   Boolean  @default(false)
  isActive          Boolean  @default(true)
  isSuperAdmin      Boolean  @default(false)

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  memberships       MessUser[]
}

```

## User Table Responsibility

The `User` table should only store:

- Name
- Phone
- Password hash
- Avatar URL
- Phone verification status
- Active/inactive status
- Super Admin status

The `User` table must not directly store:

- Meals
- Bazaar records
- Payments
- Expenses
- Mess role
- Mess member data
- Monthly bill data

---

# Phone Number Format

The system should support Bangladeshi phone numbers.

Accepted input formats:

```
017XXXXXXXX
88017XXXXXXXX
+88017XXXXXXXX

```

Recommended stored format:

```
+88017XXXXXXXX

```

Phone numbers should be normalized before saving or login.

Example utility:

```
exportconstnormalizeBDPhone= (phone:string) => {
constcleaned=phone.replace(/\\s+/g,"");

if (cleaned.startsWith("+880")) {
returncleaned;
  }

if (cleaned.startsWith("880")) {
return`+${cleaned}`;
  }

if (cleaned.startsWith("01")) {
return`+88${cleaned}`;
  }

thrownewError("Invalid Bangladeshi phone number");
};

```

---

# Role and Permission System

Roles are tenant-specific.

A user can have different roles in different messes.

Example:

```
Sakib
 ├── Mess A: Manager
 └── Mess B: Member

```

This means:

```
Manager of Mess A ≠ Manager of Mess B

```

Roles should be stored in a tenant-aware role table.

Recommended role examples:

```
OWNER
MANAGER
MEMBER

```

Permissions can be stored as JSON.

Example:

```
{
  "members": ["create","read","update","delete"],
  "meals": ["create","read","update"],
  "bazaars": ["create","read","update"],
  "payments": ["create","read"],
  "expenses": ["create","read"],
  "reports": ["read"],
  "settings": []
}

```

---

# Main Database Models

## System-Level Models

```
User
Mess
MessUser
MessRole
AuditLog

```

## Tenant-Level Models

```
Member
MealEntry
BazaarEntry
BazaarItem
Expense
ExpenseSplit
Payment
MonthlyClosing
MemberMonthlyBill

```

---

# Model Responsibilities

## User

Used only for authentication.

One user can belong to one or many messes through `MessUser`.

---

## Mess

Represents a tenant.

Each mess has its own:

- Members
- Meals
- Bazaar entries
- Payments
- Expenses
- Reports
- Roles
- Users

---

## MessUser

Connects a `User` with a `Mess`.

This table defines:

- Which user belongs to which mess
- What role the user has inside that mess
- Whether the user is linked with a mess member profile
- Whether the membership is active

---

## MessRole

Stores tenant-specific roles and permissions.

Each mess can have its own role setup.

---

## Member

Represents a mess member profile.

Important: `Member` is not the same as `User`.

A mess admin can add a member before that person creates a login account.

Example:

```
User = Login account
Member = Business profile inside a mess
MessUser = Connects User with Mess and optional Member

```

---

## MealEntry

Stores daily meal count for each member.

Meal count can support half meals, so use Decimal instead of Integer.

Example:

```
Breakfast: 0
Lunch: 1
Dinner: 1
Total: 2

```

---

## BazaarEntry

Stores bazaar or market cost.

Example:

```
Date: 2026-05-24
Buyer: Sakib
Amount: 1200 BDT
Note: Rice, fish, vegetables

```

This cost is used for meal rate calculation.

---

## BazaarItem

Optional item-level breakdown for a bazaar entry.

Example:

```
Rice - 5kg - 350 BDT
Fish - 2kg - 900 BDT

```

For MVP, `BazaarEntry.totalAmount` is enough. `BazaarItem` is useful for detailed tracking.

---

## Expense

Stores non-bazaar expenses.

Example:

```
House rent
Gas
Electricity
Wi-Fi
Water
Cleaner
Maintenance
Other

```

Recommended accounting rule:

```
Meal rate = Bazaar cost / Total meals
Extra expenses = separate shared cost

```

---

## Payment

Stores member deposits, refunds, and adjustments.

Example:

```
Sakib paid 5000 BDT by bKash on 2026-05-01

```

---

## MonthlyClosing

Stores finalized monthly summary for a mess.

Once a month is closed, the report should be saved so future changes do not accidentally affect the old report.

---

## MemberMonthlyBill

Stores finalized member-wise monthly bill.

It includes:

- Total meals
- Meal cost
- Extra expense share
- Paid amount
- Bazaar credit
- Previous balance
- Final balance

## Tech Stack

### Backend

- Node.js
- Express.js
- TypeScript
- Prisma ORM
- PostgreSQL
- JWT Authentication
- bcrypt password hashing

