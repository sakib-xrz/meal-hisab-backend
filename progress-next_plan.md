## **Project progress vs plan**

You are past **platform foundation** and into **tenant setup**, but **no operational accounting module** (meals, bazaar, expenses, payments, billing) is implemented yet. The database is ahead of the API layer.

### **Progress overview**


| **Area**                    | **Plan requirement**                              | **Status**  | **Notes**                                                         |
| --------------------------- | ------------------------------------------------- | ----------- | ----------------------------------------------------------------- |
| **Stack & infra**           | Express, TS, Prisma, PostgreSQL, JWT              | Done        | Solid setup: validation, errors, pagination, rate limiting        |
| **Multi-tenant core**       | `X-MessID`, `messId` filtering, tenant middleware | Done        | `resolveTenant` + role context on `req.tenant`                    |
| **Auth**                    | Phone/password, BD phone normalize, JWT           | Done        | Register, login, profile, avatar (R2), change password            |
| **User model**              | Auth-only, no mess business data                  | Done        | Matches plan                                                      |
| **Database schema**         | All 15 models + enums                             | Done        | Migrations applied, including one-mess-per-user index             |
| **Mess (tenant)**           | Create, manage, transfer, leave                   | Mostly done | Missing system-level list/activate/deactivate                     |
| **Member profiles**         | Add, list, update, remove                         | Partial     | Missing GET by ID; create requires existing `User`                |
| **MessUser / app access**   | Invite, list users, update role/status            | Partial     | Logic exists inside member create, but no dedicated `/users` APIs |
| **Roles & permissions**     | Tenant-aware JSON permissions                     | Partial     | Seeded on mess create; **not enforced** in middleware             |
| **Meals**                   | Daily meal counts per member                      | Not started | Schema only                                                       |
| **Bazaar**                  | Market cost tracking                              | Not started | Schema only                                                       |
| **Expenses**                | Shared non-bazaar costs                           | Not started | Schema only                                                       |
| **Payments**                | Deposits, refunds, adjustments                    | Not started | Schema only                                                       |
| **Monthly closing & bills** | Finalized reports                                 | Not started | Schema only                                                       |
| **System admin**            | Manage all messes, users, subscriptions           | Not started | `isSuperAdmin` exists, no admin routes                            |
| **Audit log**               | Action tracking                                   | Not started | Model only                                                        |
| **Tests**                   | —                                                 | Not started | No automated tests                                                |


**Rough completion: ~35%** — foundation and tenant membership are in place; the core “meal hisab” workflow is not.

---

## **What is already built (in detail)**

### **1. Authentication (**`/api/v1/auth`**)**

- Register, login, logout, `GET /me`, profile update, avatar upload/delete, change password
- Bangladeshi phone normalization
- JWT + optional cookie

### **2. Mess tenant (**`/api/v1/messes`**)**

- `POST /` — create mess (seeds OWNER/MANAGER/MEMBER roles)
- With `X-MessID`: get/update/delete current mess, transfer ownership, leave, stats
- One-mess-per-user rule enforced (DB index + app validation)
- Owner cannot leave until ownership transfer

### **3. Members (**`/api/v1/messes/members`**)**

- Create, list (filter/search/paginate), update, remove
- Auto-links `MessUser` when phone matches an existing platform user
- Role assignment on create: MANAGER or MEMBER only

### **4. Stats endpoint (read-only preview)**

`GET /messes/stats` already computes meal rate from DB aggregates — but **there is no API to write meals, bazaar, expenses, or payments**, so stats will stay empty until those modules exist.

---

## **Gaps in current modules (before moving on)**

These are plan requirements that are **not** done yet:


| **Gap**                  | **Plan says**                               | **Current code**                                       |
| ------------------------ | ------------------------------------------- | ------------------------------------------------------ |
| Add member without login | Admin can add profile before user registers | Create **requires** an existing active `User`          |
| Get single member        | `GET /members/:memberId`                    | Missing                                                |
| Mess user management     | `/messes/users`, invite, update access      | Not implemented                                        |
| Permission enforcement   | Role JSON drives access                     | Hardcoded owner/manager checks only                    |
| System admin APIs        | List/manage all messes                      | `listMessesQuerySchema` exists, no route               |
| Member create fields     | `fullName`, `roomNo`, etc. on profile       | Name copied from `User`; profile fields only on update |


You can start Meals without fixing all of these, but **“add member without app account”** matters for real mess ops — many members are tracked before they register.

---

## **Recommended next module: Meals**

### **Why Meals (not Bazaar/Payments/Reports yet)**

Dependency chain from your plan:

MembersMealsBazaarMealRateReportsExpensesPaymentsMonthlyClosing

- **Meals** are the primary daily input and the denominator for meal rate (`bazaar cost / total meals`).
- Bazaar, expenses, and payments all assume **members exist** (you have that, partially).
- Monthly closing and member bills depend on meal totals.
- Your stats endpoint already expects `MealEntry` data.

**Optional short prep (1–2 days):** extend member create to allow profile-only members (no `User` required). That unblocks meal tracking for everyone in the mess, not only registered users.

---

## **Meals module — requirement analysis (not basic CRUD)**

### **Business purpose**

Record **how many meals each member took on each date**, split by breakfast / lunch / dinner, supporting **half meals** (`Decimal`, e.g. `0.5`, `1`, `1.5`).

### **Actors & permissions (from your role matrix)**


| **Action**                     | **Owner** | **Manager** | **Member** |
| ------------------------------ | --------- | ----------- | ---------- |
| View daily sheet (all members) | Yes       | Yes         | Yes (read) |
| View own history               | Yes       | Yes         | Yes        |
| Enter/edit/delete meals        | Yes       | Yes         | No         |


Use your existing `assertMessManagerOrAbove` pattern; later wire to JSON permissions.

### **Core workflows**

**1. Daily meal sheet (primary UX)**  
Manager opens today’s sheet: all **ACTIVE** members, each row showing breakfast/lunch/dinner (default 0). One save updates the whole day.

**2. Correction**  
Fix a single member’s count for a past date.

**3. History / audit**  
View meals for a date range — per member or whole mess — for disputes and month-end review.

**4. Aggregation**  
Totals by day, member, and period feed stats and (later) monthly closing.

### **Data rules (from schema + plan)**

- Scope: always `messId` from `X-MessID`
- Uniqueness: one row per `(messId, memberId, mealDate)`
- Only **ACTIVE** members on default daily sheet; LEFT/INACTIVE excluded unless querying history
- `mealDate` is a **date** (no time component)
- Counts: `Decimal(5,2)`, typically `0`, `0.5`, `1`, `1.5`, `2` per slot
- **Future rule (when monthly closing exists):** block edits for dates in a closed month

### **APIs to build**

#### **1. Daily meal sheet**

GET /api/v1/messes/meals/daily?date=2026-05-26

**Purpose:** One call for the “today’s meals” screen.

**Response shape:**

- `date`
- `members[]`: `{ memberId, fullName, roomNo?, mealEntryId?, breakfast, lunch, dinner, total }`
- `summary`: `{ totalBreakfast, totalLunch, totalDinner, totalMeals }`

**Logic:**

- Load all ACTIVE members for `messId`
- Left-join `MealEntry` for that `mealDate`
- Missing entry → counts default to `0` (no DB row until saved)

---

#### **2. Bulk upsert (most important write API)**

PUT /api/v1/messes/meals/daily

Body: {

  "date": "2026-05-26",

  "entries": [

    { "memberId": "...", "breakfast": 1, "lunch": 1, "dinner": 0.5, "note": null }

  ]

}

**Purpose:** Save the full day in one transaction.

**Rules:**

- Manager/owner only
- Every `memberId` must belong to `messId` and be ACTIVE
- Upsert by `(messId, memberId, mealDate)`
- If all three counts are `0` and no note: either skip create or delete existing row (pick one and document)
- Validate decimals (non-negative, reasonable max e.g. ≤ 3 per slot)
- Reject if month is closed (once closing module exists)

---

#### **3. Range list (reports prep)**

GET /api/v1/messes/meals?from=2026-05-01&to=2026-05-31&memberId=<optional>

**Purpose:** History, member detail, export.

**Query params:** `from`, `to`, optional `memberId`, pagination if unfiltered range is large.

**Response:** entries with member summary + per-row total (`breakfast + lunch + dinner`).

---

#### **4. Period summary**

GET /api/v1/messes/meals/summary?from=2026-05-01&to=2026-05-31

**Purpose:** Dashboard and meal-rate input without pulling every row.

**Returns:**

- `totalMeals`, `totalBreakfast`, `totalLunch`, `totalDinner`
- `byMember[]`: `{ memberId, fullName, totalMeals }`
- `byDate[]`: `{ date, totalMeals }` (optional, for charts)

This aligns with `GET /messes/stats` and future monthly closing.

---

#### **5. Single entry update**

PATCH /api/v1/messes/meals/:mealEntryId

Body: { "breakfast"?, "lunch"?, "dinner"?, "note"? }

**Purpose:** Quick fix without resubmitting the full sheet.

**Rules:** Entry must belong to `messId`; manager/owner only.

---

#### **6. Delete entry**

DELETE /api/v1/messes/meals/:mealEntryId

**Purpose:** Remove a mistaken day for one member.

---

#### **7. Member meal history (convenience)**

GET /api/v1/messes/members/:memberId/meals?from=&to=

**Purpose:** Member profile / “my meals” without client-side filtering.

Same data as range list with fixed `memberId`; member role can read **own** linked profile only.

---

### **What you should not build yet in Meals**

- Meal “approval” workflows
- Automatic meal rate calculation inside Meals (belongs in reports/closing)
- Copy previous day (nice later, not MVP)

---

## **Module order after Meals**


| **Order**    | **Module**                    | **Why**                                           |
| ------------ | ----------------------------- | ------------------------------------------------- |
| **1 (now)**  | **Meals**                     | Core daily input; meal rate denominator           |
| **2**        | **Bazaar**                    | Meal rate numerator; links to `buyerMemberId`     |
| **3**        | **Expenses**                  | Extra shared costs + split logic (`ExpenseSplit`) |
| **4**        | **Payments**                  | Deposits/refunds; member balance                  |
| **5**        | **Reports + monthly closing** | Snapshot bills; lock closed months                |
| **Parallel** | **MessUser APIs**             | Invite/manage app access separately from profiles |
| **Later**    | **System admin**              | Cross-tenant mess management                      |


---

## **Suggested immediate backlog**

**Before or alongside Meals (small):**

1. `GET /messes/members/:memberId`
2. Member create without requiring `User` (optional phone → auto-link when user registers later)
3. `GET/POST/PATCH /messes/users` for invite and access management

**Meals module (main):**

1. `GET /meals/daily`
2. `PUT /meals/daily` (bulk upsert)
3. `GET /meals/summary`
4. `GET /meals` (range)
5. `PATCH/DELETE /meals/:mealEntryId`

