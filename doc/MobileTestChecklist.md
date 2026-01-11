
# Mobile & Tablet Test Checklist

## Customer Wizard
1. [ ] **Step 1 (Calendar):** Verify calendar scales down. Days should be tap targets of min 44px.
2. [ ] **Sticky Footer:** Ensure the "Price / Next" bar is fixed at the bottom on iPhone/Android.
3. [ ] **Summary Sheet:** Tap the "Totaal" price in the footer. Does the summary slide up from the bottom?
4. [ ] **Stepper:** Verify the top progress bar scrolls horizontally without breaking layout.
5. [ ] **Inputs:** Check "Gegevens" step. Are First Name/Last Name inputs full width (stacked) on mobile?
6. [ ] **Keyboard:** Focus on an input. Does the sticky footer stay visible/usable above the keyboard?

## Customer Portal
7. [ ] **Login:** Does the 2-column layout stack to 1-column on mobile?
8. [ ] **Dashboard:** Are the "Hero" card and "Action" buttons stacked vertically?
9. [ ] **Change Wizard:** Open the "Wijziging" modal. Does it cover the screen properly on mobile?

## Admin Dashboard (Layout)
10. [ ] **Hamburger:** Is the hamburger menu visible on top-left for mobile/tablet?
11. [ ] **Sidebar:** Tap hamburger. Does sidebar slide in from left with a backdrop?
12. [ ] **Navigation:** Tap a link in sidebar. Does it navigate? (Note: Sidebar might need auto-close logic in future refinement).

## Admin Reservation Manager
13. [ ] **Card View:** Load `/admin/reservations` on mobile. Do you see Cards instead of a Table?
14. [ ] **Drawer:** Tap a reservation card. Does the detail view slide up from the bottom (Sheet) instead of Right?
15. [ ] **Actions:** Inside the detail sheet, are the Action Buttons (Confirm/Cancel/Pay) easily tappable?
16. [ ] **Filters:** Tap "Filters". Do the date/select inputs stack properly?

## Host View
17. [ ] **List View:** Verify the guest list is legible on a tablet held in portrait mode.
18. [ ] **Check-in:** Tap the check-in button. Is the hit area large enough?

## General
19. [ ] **Landscape Mode:** Rotate phone to landscape. Does the layout break or adapt (e.g., show sidebar or keep hamburger)?
20. [ ] **Scroll:** Ensure no horizontal scrollbar exists on the `<body>` (overflow issue check).
