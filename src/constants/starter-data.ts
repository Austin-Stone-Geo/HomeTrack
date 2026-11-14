/**
 * The spaces and lists every new household starts with. The database creates
 * the real rows (see `setup_new_household` in the migration); this copy is
 * used to show a preview before Supabase is connected.
 */
export const StarterSpaces = [
  { name: 'Pantry', blurb: 'Food and staples' },
  { name: 'Fridge and Freezer', blurb: 'Perishables with expiry dates' },
  { name: 'Garage', blurb: 'Supplies and storage' },
  { name: 'Houseplants', blurb: 'Plants and their care' },
  { name: 'Gear', blurb: 'Bikes, skis and camping kit' },
  { name: 'Tools', blurb: 'Hand and power tools' },
  { name: 'Bills', blurb: 'Amounts and due days' },
] as const;

export const StarterLists = [
  { name: 'Groceries', blurb: 'Fills itself when pantry items run out' },
  { name: 'To-do', blurb: 'Anything the household needs to get done' },
] as const;
