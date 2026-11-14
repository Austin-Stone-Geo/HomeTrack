import { supabase } from '@/lib/supabase';
import type { Item, List, ListEntry, ListType, Member, Space } from '@/lib/types';
import { unwrap } from '@/lib/use-live-query';

/** All database calls the app makes, in one place. */

function db() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

// ---- Spaces ---------------------------------------------------------------

export async function fetchSpaces(householdId: string) {
  return unwrap(
    await db().from('spaces').select('*').eq('household_id', householdId).order('sort_order').order('name')
  ) as Space[];
}

export async function fetchSpace(id: string) {
  return unwrap(await db().from('spaces').select('*').eq('id', id).maybeSingle()) as Space | null;
}

export async function createSpace(householdId: string, name: string, sortOrder: number) {
  return unwrap(
    await db().from('spaces').insert({ household_id: householdId, name, sort_order: sortOrder }).select().single()
  ) as Space;
}

export async function renameSpace(id: string, name: string) {
  unwrap(await db().from('spaces').update({ name }).eq('id', id));
}

export async function deleteSpace(id: string) {
  unwrap(await db().from('spaces').delete().eq('id', id));
}

// ---- Items ----------------------------------------------------------------

export async function fetchItems(householdId: string, spaceId?: string) {
  let query = db().from('items').select('*').eq('household_id', householdId);
  if (spaceId) query = query.eq('space_id', spaceId);
  return unwrap(await query.order('name')) as Item[];
}

export async function fetchItem(id: string) {
  return unwrap(await db().from('items').select('*').eq('id', id).maybeSingle()) as Item | null;
}

export async function findItemByBarcode(householdId: string, barcode: string) {
  return unwrap(
    await db().from('items').select('*').eq('household_id', householdId).eq('barcode', barcode).limit(1).maybeSingle()
  ) as Item | null;
}

export type ItemInput = Pick<
  Item,
  'space_id' | 'name' | 'category' | 'quantity' | 'unit' | 'min_quantity' | 'expires_on' | 'barcode' | 'notes'
>;

export async function createItem(input: ItemInput) {
  // household_id is filled in by the database from the space.
  return unwrap(await db().from('items').insert(input).select().single()) as Item;
}

export async function updateItem(id: string, input: Partial<ItemInput>) {
  unwrap(await db().from('items').update(input).eq('id', id));
}

export async function setQuantity(id: string, quantity: number) {
  unwrap(await db().from('items').update({ quantity: Math.max(0, quantity) }).eq('id', id));
}

export async function deleteItem(id: string) {
  unwrap(await db().from('items').delete().eq('id', id));
}

export function isLow(item: Pick<Item, 'quantity' | 'min_quantity'>) {
  return item.quantity <= 0 || (item.min_quantity != null && item.quantity <= item.min_quantity);
}

// ---- Lists ----------------------------------------------------------------

export type ListWithCount = List & { open: number };

export async function fetchLists(householdId: string) {
  const lists = unwrap(
    await db().from('lists').select('*').eq('household_id', householdId).order('sort_order').order('name')
  ) as List[];
  const open = unwrap(
    await db().from('list_entries').select('list_id').eq('household_id', householdId).eq('done', false)
  ) as { list_id: string }[];
  return lists.map((list) => ({ ...list, open: open.filter((e) => e.list_id === list.id).length }));
}

export async function fetchList(id: string) {
  return unwrap(await db().from('lists').select('*').eq('id', id).maybeSingle()) as List | null;
}

export async function createList(householdId: string, name: string, type: ListType, sortOrder: number) {
  return unwrap(
    await db().from('lists').insert({ household_id: householdId, name, type, sort_order: sortOrder }).select().single()
  ) as List;
}

export async function deleteList(id: string) {
  unwrap(await db().from('lists').delete().eq('id', id));
}

export async function fetchEntries(listId: string) {
  return unwrap(
    await db().from('list_entries').select('*').eq('list_id', listId).order('done').order('created_at')
  ) as ListEntry[];
}

export async function addEntry(listId: string, text: string, assignedTo?: string | null) {
  // household_id is filled in by the database from the list.
  unwrap(await db().from('list_entries').insert({ list_id: listId, text, assigned_to: assignedTo ?? null }));
}

/** Ticks an entry off. On a grocery list, this also restocks the linked item. */
export async function completeEntry(id: string) {
  unwrap(await db().rpc('complete_list_entry', { entry_id: id }));
}

export async function reopenEntry(id: string) {
  unwrap(await db().from('list_entries').update({ done: false, done_at: null }).eq('id', id));
}

export async function clearDoneEntries(listId: string) {
  unwrap(await db().from('list_entries').delete().eq('list_id', listId).eq('done', true));
}

export async function deleteEntry(id: string) {
  unwrap(await db().from('list_entries').delete().eq('id', id));
}

// ---- Household ------------------------------------------------------------

export async function fetchMembers(householdId: string) {
  return unwrap(
    await db().from('members').select('*').eq('household_id', householdId).order('created_at')
  ) as Member[];
}

export async function createHousehold(name: string, userId: string, displayName: string) {
  const household = unwrap(
    await db().from('households').insert({ name, created_by: userId }).select().single()
  ) as { id: string };
  if (displayName) {
    unwrap(
      await db()
        .from('members')
        .update({ display_name: displayName })
        .eq('household_id', household.id)
        .eq('user_id', userId)
    );
  }
  return household;
}

export async function joinHousehold(code: string, displayName: string) {
  return unwrap(await db().rpc('join_household', { code, name: displayName || null })) as string;
}

export async function updateDisplayName(memberId: string, displayName: string) {
  unwrap(await db().from('members').update({ display_name: displayName }).eq('id', memberId));
}

// ---- Barcode lookup -------------------------------------------------------

export type ProductInfo = { name: string; category: string | null; unit: string | null };

/**
 * Looks a barcode up in Open Food Facts, a free, open database of food
 * products. Returns null when the product isn't found or the lookup fails.
 */
export async function lookupBarcode(barcode: string): Promise<ProductInfo | null> {
  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,brands,categories,quantity`
    );
    if (!response.ok) return null;
    const json = await response.json();
    const product = json?.product;
    if (json?.status !== 1 || !product?.product_name) return null;
    const brand = typeof product.brands === 'string' ? product.brands.split(',')[0].trim() : '';
    const name = brand && !product.product_name.includes(brand) ? `${brand} ${product.product_name}` : product.product_name;
    const category =
      typeof product.categories === 'string' ? product.categories.split(',').at(-1)?.trim() || null : null;
    return { name, category, unit: product.quantity || null };
  } catch {
    return null;
  }
}
