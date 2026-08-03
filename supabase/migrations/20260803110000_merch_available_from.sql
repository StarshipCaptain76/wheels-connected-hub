-- Where the item can be bought / collected (e.g. club meetings, a local shop).
ALTER TABLE public.merch_items
  ADD COLUMN IF NOT EXISTS available_from text;

COMMENT ON COLUMN public.merch_items.available_from IS
  'Place or channel where the item is available to buy/collect (shown on public shop).';
