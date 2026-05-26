## **Project progress** 

**Rough completion: ~45–50%** — platform foundation, tenant membership, and **Meals are in place**. The core accounting loop (bazaar → meal rate → expenses → payments → monthly closing) is still ahead.

---

### **What is complete**


| **Area**              | **Status** | **Notes**                                                                                 |
| --------------------- | ---------- | ----------------------------------------------------------------------------------------- |
| **Stack & infra**     | Done       | Express, TS, Prisma, PostgreSQL, JWT, validation, errors, pagination, rate limiting       |
| **Multi-tenant core** | Done       | `X-MessID` middleware, `messId` scoping, tenant context on `req.tenant`                   |
| **Auth**              | Done       | Register, login, logout, `/me`, profile, avatar (R2), change password, BD phone normalize |
| **Database schema**   | Done       | All 15 models + enums, one-mess-per-user partial unique index                             |
| **Mess (tenant)**     | Done       | Create, get/update/delete current, transfer ownership, leave, stats                       |
| **Meals**             | Done       | Full workflow-oriented API — not just CRUD                                                |


**Meals module** (wired at `/api/v1/messes/meals`, builds cleanly):


| **Endpoint**                     | **Purpose**                                                         |
| -------------------------------- | ------------------------------------------------------------------- |
| `GET /meals/daily?date=`         | Daily sheet — all ACTIVE members, left-join entries, summary totals |
| `PUT /meals/daily`               | Bulk upsert in one transaction; zero rows delete existing           |
| `GET /meals/summary?from=&to=`   | Period totals + `byMember[]` + `byDate[]`                           |
| `GET /meals?from=&to=&memberId=` | Range history with role-based scoping                               |
| `PATCH /meals/:mealEntryId`      | Single correction                                                   |
| `DELETE /meals/:mealEntryId`     | Remove one entry                                                    |


Role behavior matches the plan: **Owner/Manager** read all + write; **Member** reads only their linked profile.

---

### **What is not started**


| **Area**                                | **Status**                                |
| --------------------------------------- | ----------------------------------------- |
| **Bazaar**                              | Schema only                               |
| **Expenses + ExpenseSplit**             | Schema only                               |
| **Payments**                            | Schema only                               |
| **Monthly closing + MemberMonthlyBill** | Schema only                               |
| **System admin**                        | `isSuperAdmin` flag only; no admin routes |
| **Audit log**                           | Model only                                |
| **Automated tests**                     | None                                      |


---

## **Recommended next module: Bazaar**

Meals is the **denominator** for meal rate. Bazaar is the **numerator**:

mealRate = totalBazaarCost / totalMeals

Your stats endpoint and future monthly closing both depend on bazaar data. Expenses and payments assume members and meals already exist — which they now do at the API layer.

**Small prep worth doing in parallel (not blockers):**

1. `GET /messes/members/:memberId` — detail view before linking bazaar to a buyer

---

## **Bazaar module — requirement analysis**

### **Business purpose**

Record **market/shopping costs** that feed into meal rate and (later) **bazaar credit** on member bills. A bazaar entry answers: *who bought, when, how much, for what*.

From your schema:

- `BazaarEntry`: date, buyer member, total amount, note, optional receipt
- `BazaarItem`: Remove the bazar item table no need to this table handle everything form the BazaarEntry table.

### **Actors & permissions**


| **Action**                     | **Owner** | **Manager** | **Member** |
| ------------------------------ | --------- | ----------- | ---------- |
| View bazaar list / summary     | Yes       | Yes         | Yes (read) |
| Create / edit / delete entries | Yes       | Yes         | No         |
| Upload receipt                 | Yes       | Yes         | No         |


Use the same `assertMessManagerOrAbove` pattern as Meals.

### **Core workflows (what drives API design)**

**1. Log a bazaar trip (primary write)**  
Manager records: date, buyer (who went to market), total amount, optional note. This is the main daily/weekly input after meals.

**2. Period cost review**  
Before month-end: “How much did we spend on bazaar this month?” Feeds dashboard stats and meal rate.

**3. Buyer-wise credit preview**  
Members who buy groceries get **bazaar credit** against their bill (`MemberMonthlyBill.bazaarCredit`). You need buyer-wise totals before closing — not just a flat sum.

**4. Correction / dispute**  
Fix wrong amount or buyer on a past entry.

### **Data rules**

- Always scoped by `messId` from `X-MessID`
- `buyerMemberId` must be an **ACTIVE** member in the same mess
- `bazaarDate` and amounts: `Date` + `Decimal(12,2)` — no floats
- `totalAmount` must be **> 0** on create
- Future: block edits when the month is **closed** (same pattern as Meals)

---

### **APIs to build (workflow-oriented, not generic CRUD)**

#### **1. Create bazaar entry**

POST /api/v1/messes/bazaars

**Body:**

{

"bazaarDate": "2026-05-24",

"buyerMemberId": "cmember123",

"totalAmount": 1200,

"note": "Rice, fish, vegetables",

"receiptUrl": null

}

**Rules:** Manager/owner only; validate active buyer; positive amount; normalize date.

**Why not generic POST:** Validates the buyer–mess relationship and business fields in one place — this is the main data-entry screen.

---

#### **2. Period list (ledger view)**

GET /api/v1/messes/bazaars?from=2026-05-01&to=2026-05-31&buyerMemberId=

**Response:** entries with buyer `{ memberId, fullName, roomNo? }`, sorted by date desc.

**Access:** All mess members read; optional `buyerMemberId` filter for “what did Sakib buy this month?”

**Why:** Month-end review and dispute resolution — not just “list all rows.”

---

#### **3. Period summary (meal rate + credit prep)**

GET /api/v1/messes/bazaars/summary?from=2026-05-01&to=2026-05-31

**Returns:**

{

"from": "2026-05-01",

"to": "2026-05-31",

"totalAmount": 18500,

"entryCount": 12,

"byBuyer": [

{ "memberId": "...", "fullName": "Sakib", "totalAmount": 7200, "entryCount": 5 }

],

"byDate": [

{ "date": "2026-05-24", "totalAmount": 1200 }

]

}

**Why:** Powers dashboard meal rate (`totalAmount / totalMeals` from Meals summary) and pre-computes **bazaar credit per buyer** for monthly closing. This is the most important read API after create.

---

#### **4. Single entry detail**

GET /api/v1/messes/bazaars/:bazaarEntryId

**Why:** Edit form, receipt view, audit. Include buyer member summary; include `items[]` when you add item breakdown.

---

#### **5. Update entry**

PATCH /api/v1/messes/bazaars/:bazaarEntryId

**Partial update:** `bazaarDate`, `buyerMemberId`, `totalAmount`, `note`, `receiptUrl`.

**Rules:** Tenant scope check; re-validate buyer if changed; reject if month closed (later).

---

#### **6. Delete entry**

DELETE /api/v1/messes/bazaars/:bazaarEntryId

**Why:** Wrong duplicate entry. Hard delete is fine for MVP; audit log can come later.

---

### **What not to build yet in Bazaar**

- Automatic meal rate calculation inside Bazaar (belongs in stats/reports/closing)
- Linking bazaar to specific meal dates
- Approval workflows

---

## **Module order after Bazaar**


| **Order**   | **Module**                    | **Why**                                                             |
| ----------- | ----------------------------- | ------------------------------------------------------------------- |
| **1 (now)** | **Bazaar**                    | Meal rate numerator; buyer credit for bills                         |
| **2**       | **Expenses**                  | Shared costs + `ExpenseSplit` (equal/custom)                        |
| **3**       | **Payments**                  | Deposits, refunds, adjustments → member balance                     |
| **4**       | **Reports + monthly closing** | Snapshot `MonthlyClosing` + `MemberMonthlyBill`; lock closed months |
| **Later**   | System admin + audit log      | Cross-tenant management, action history                             |


---

## **Immediate backlog**

**Bazaar (main):**

1. `POST /bazaars`
2. `GET /bazaars` (range + buyer filter)
3. `GET /bazaars/summary` ← critical for meal rate dashboard
4. `GET /bazaars/:id`
5. `PATCH /bazaars/:id`
6. `DELETE /bazaars/:id`

Once Bazaar summary + Meals summary both exist, `GET /messes/stats` can be upgraded to **current-month scoped** aggregates instead of all-time totals — that would make the dashboard accurate.