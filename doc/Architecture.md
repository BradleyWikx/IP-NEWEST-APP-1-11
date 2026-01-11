
# Grand Stage Dinner Theater - Information Architecture

## 1. Customer Booking Wizard (Step-by-Step)

| Step | Title | Fields | Validation Rules |
| :--- | :--- | :--- | :--- |
| 1 | **Date & Show** | `date` (Calendar), `showId` | Must select a date and an available show. |
| 2 | **Party Size** | `totalGuests` | Min 1, Max 230 (warn if > 230). |
| 3 | **Package** | `packageType` (Standard/Premium) | Single selection per booking. |
| 4 | **Addons** | `preDrinks`, `afterDrinks` | Drinks only visible/selectable if `totalGuests >= 25`. |
| 5 | **Details** | `firstName`, `lastName`, `email`, `phone` | All required. Email must be valid. |
| 6 | **Notes** | `dietaryRequirements`, `celebrationNotes` | Optional. |
| 7 | **Payment/Voucher** | `promoCode`, `voucherNumber` | Voucher must be used in full. |
| 8 | **Review** | Summary of all above | Must check "Terms & Conditions" box. |

## 2. Admin Pages & Actions

- **Overview Dashboard**: Stats on occupancy, revenue targets, pending requests, and today's status.
- **Calendar Manager**: 
    - *Actions*: Create shows, Bulk close dates, Adjust capacity (230 default).
    - *Color Coding*: Blue (Standard), Gold (Premium), Red (Closed), Yellow (Waitlist Only).
- **Reservation Manager**: 
    - *Filters*: Date range, Status, Show Type, Search by Name/ID.
    - *Transitions*: `REQUEST` -> `OPTION` (holding) -> `CONFIRMED` (paid).
- **Voucher Manager**: Create, list, and track usage of prepay vouchers.
- **Merchandise & Inventory**: Manage products customers can add post-booking.
- **Customer Database**: Global list of customers with historical bookings.
- **Audit Log**: Record of all status changes and manual edits.

## 3. Host Page (Door Staff)

- **Arrival List**: Alphabetical view of today's confirmed/invited guests.
- **Dynamic Table Assignment**: Interface to assign/change table numbers in real-time.
- **Check-in Toggle**: Mark "Arrived" to track real-time attendance.
- **Dietary Alerts**: High-visibility icons for guests with specific requirements.

## 4. Status Model & Lifecycle

- **REQUEST**: New customer submission. Triggers "Request Received" email.
- **OPTION**: Admin hold (e.g., for large groups). Triggers "Option Expiring" reminder.
- **CONFIRMED**: Marked as paid or verified. Triggers "Booking Confirmed" email.
- **CANCELLED**: Manual or automated (non-payment).
- **WAITLIST**: Automated status when booking on a closed date.
- **INVITED**: Bypasses payment requirements.
- **ARCHIVED**: Automated move 48h after show date.

## 5. Email & Notification Events

- **On Request**: Confirmation of receipt.
- **On Status Change**: Confirm/Option/Cancel notifications.
- **On Payment**: Receipt + "See you soon" details.
- **Reminder (Option Expiry)**: 48h before an OPTION expires.
- **Reminder (Payment Due)**: 7 days before show date if status is not CONFIRMED/INVITED.

## 6. Reports & Printing

- **Daily Overview**: Total guests, show type, revenue summary.
- **Kitchen Report**: Detailed breakdown of dietary requirements + guest counts.
- **Host Sheet**: Printable alphabetical check-in list with table numbers.
- **Weekly Revenue**: Financial summary for management.

## 7. Firestore Collections Structure

- `shows`: `{ date, showType, baseCapacity, currentOccupancy, isClosed }`
- `reservations`: `{ id, lastName, status, partySize, packageId, addons[], totalAmount, amountPaid, ... }`
- `vouchers`: `{ code, balance, isActive }`
- `merchandise`: `{ id, name, price }`
- `auditLogs`: `{ timestamp, adminId, action, reservationId, oldData, newData }`
- `settings`: `{ globalCapacity, pricingRules, emailTemplates }`
