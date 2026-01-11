
# Grand Stage - Responsive Design Guidelines

## 1. Breakpoints & Grid
We utilize Tailwind's default breakpoint system with a mobile-first approach.

- **Mobile (Default):** < 640px. 1 column layouts, 100% width inputs.
- **Tablet (`sm`, `md`):** 640px - 1023px. 2 column grids, relaxed padding.
- **Desktop (`lg`, `xl`):** ≥ 1024px. Sidebar layouts, complex tables, 3+ column grids.

**Global Padding Rule:**
- Mobile: `px-4 py-4`
- Tablet: `px-6 py-6`
- Desktop: `px-8 py-8` (or `max-w-7xl` centered)

## 2. Navigation Patterns
- **Customer Wizard:** 
  - **Top:** Minimal stepper (scrollable horizontally).
  - **Bottom:** Sticky "Action Bar" containing Primary CTA and Collapsible Summary toggle.
- **Admin Dashboard:**
  - **Mobile/Tablet:** Hamburger menu (Top-Left) triggers a slide-out drawer (Left). Top bar contains search/actions.
  - **Desktop:** Fixed Left Sidebar.
- **Host View:**
  - **Mobile:** Single column list view. Header controls stack vertically.

## 3. Component Adaptations

### Tables (ResponsiveTable Pattern)
- **Desktop:** Standard `<table>` with headers and rows.
- **Mobile:** Stacked `<Card>` view. Each row becomes a card. Headers become labels within the card key-value pairs.

### Modals & Drawers
- **Desktop:** Slide-over from Right (`h-full w-[600px]`).
- **Mobile:** Bottom Sheet (`fixed bottom-0 w-full max-h-[90%] rounded-t-2xl`). Includes a "drag handle" visual indicator.

### Forms & Inputs
- **Touch Targets:** All interactive elements (buttons, inputs, toggles) must have `min-h-[44px]` (44px height).
- **Mobile:** Inputs are `w-full`. Labels appear above inputs.
- **Desktop:** Inputs use `grid` layouts (e.g., `grid-cols-2`).

## 4. Typography & Visibility
- **Font Sizes:** Base text `text-sm` (14px) is standard. Mobile headings scale down (e.g., `text-3xl` -> `text-2xl`).
- **Hiding Elements:** Use `hidden md:block` for secondary information (e.g., request IDs, secondary timestamps) to reduce visual noise on small screens.
