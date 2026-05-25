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
- Belong to multiple messes at the same time (exempt from the one-mess-per-user rule)

## 2. Tenant Level

Each mess or hostel is a tenant.

Inside each mess, users can manage:

- Members (add, update, remove, leave, transfer ownership)
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
GET /api/v1/messes/members
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
7. A normal user can belong to only one mess at a time (see Membership Business Rules).
8. Roles and permissions are tenant-aware.
9. Manager of Mess A is not automatically Manager of Mess B.
10. Super Admin can bypass tenant restrictions only in system-level routes.
11. Super Admin is exempt from the one-mess-per-user rule and may access multiple messes.
12. No query should return tenant data without filtering by messId.
13. Use Decimal for money, not Float.
14. Use Date fields for mealDate, bazaarDate, paymentDate, and expenseDate.
15. Monthly reports must be generated per messId.
16. Prefer repository/service functions that automatically receive messId.
17. Cross-tenant data leakage must be impossible.

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

For **normal users**, membership is limited to **one mess at a time**. A user cannot be OWNER, MANAGER, or MEMBER in two messes simultaneously.

Example (normal user):

```
Sakib
 └── Mess A: Manager   ← only one current mess membership allowed
```

If Sakib wants to join Mess B or create a new mess, he must **leave Mess A first**.

**Super Admin** is exempt from this rule and may access multiple messes for support or system administration.

This means:

```
Manager of Mess A ≠ Manager of Mess B
```

That rule still applies across separate messes over time — but a normal user cannot hold both roles at the same time.

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

A normal user can have **at most one current mess membership** through `MessUser` (status `ACTIVE` or `INVITED`).

Historical memberships (`REMOVED`, `INACTIVE`) are kept for audit/history and do not block joining another mess later.

Super Admin users are exempt from the one-mess rule.

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
- Whether the membership is active, invited, or historical

### Membership Status

```
ACTIVE    → current membership; user can access the mess
INVITED   → pending membership; counts as a current membership
INACTIVE  → historical; ignored for one-mess rule
REMOVED   → historical; ignored for one-mess rule (used when user leaves or is removed)
```

### One Mess Per User Rule

A normal user may have **only one** `MessUser` row with status `ACTIVE` or `INVITED` at any time, across the entire platform.

Enforced at:

1. **Database level** — partial unique index on `userId` where status is `ACTIVE` or `INVITED`
2. **Application level** — validation before create mess, invite user, auto-link member by phone, or reactivate membership

Blocked actions return `409 Conflict` with a clear message:

```
You are already a member of another mess. Leave your current mess before joining or creating a new one.
```

When an admin adds or invites a user who is already in another mess, the API blocks with an admin-facing message instead of allowing an override.

Super Admin users bypass the one-mess rule.

### Leave Mess

A user can leave their current mess via:

```
POST /api/v1/messes/leave
X-MessID: <mess-id>
```

Behavior:

- Sets `MessUser.status` to `REMOVED`
- Sets linked `Member.status` to `LEFT` with `leavingDate`
- After leaving, the user may create or join another mess

Restrictions:

- **Owner cannot leave** until ownership is transferred
- Owner must use transfer ownership first, then leave if needed

### Transfer Ownership

```
PATCH /api/v1/messes/transfer-ownership
X-MessID: <mess-id>

{
  "newOwnerMemberId": "<member-id>"
}
```

Rules:

- Only the current mess owner can transfer ownership
- Target must be an **active member** in the same mess
- Target must have a **linked app account** (`MessUser` with `ACTIVE` status)
- Previous owner is demoted to `MANAGER`
- New owner receives the `OWNER` role
- `OWNER` cannot be assigned during member create or invite — only through transfer ownership

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

### Member Status

```
ACTIVE
INACTIVE
LEFT
```

### Member Management Rules

- **Add member** — Owner or Manager only
- **Update member** — Owner or Manager only
- **Remove member** — Owner or Manager only; sets member to `LEFT` and revokes app access
- **Assign role on create** — only `MANAGER` or `MEMBER`; `OWNER` is not allowed on create
- **Assign OWNER** — only via transfer ownership
- **Remove owner** — not allowed; transfer ownership first
- **Auto-link by phone** — when creating a member with a phone that matches an active platform user, the system links `MessUser` automatically (blocked if that user already belongs to another mess)

### Member Module APIs

All routes require `Authorization` and `X-MessID`.

**Member profiles**

```
POST   /api/v1/messes/members              Add member
GET    /api/v1/messes/members              List members
GET    /api/v1/messes/members/:memberId    Get member
PATCH  /api/v1/messes/members/:memberId    Update member
DELETE /api/v1/messes/members/:memberId    Remove member
```

**Membership actions**

```
POST   /api/v1/messes/leave                Leave current mess (self-service)
PATCH  /api/v1/messes/transfer-ownership   Transfer ownership (owner only)
```

**App access (MessUser)**

```
GET    /api/v1/messes/users                List mess users
POST   /api/v1/messes/users/invite         Invite platform user by phone
PATCH  /api/v1/messes/users/:messUserId    Update user access / role / status
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

