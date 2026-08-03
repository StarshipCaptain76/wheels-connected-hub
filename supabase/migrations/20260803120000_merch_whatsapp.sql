-- Optional WhatsApp number per shop item.
-- When set, the public Enquire button opens WhatsApp instead of the email form.
ALTER TABLE public.merch_items
  ADD COLUMN IF NOT EXISTS whatsapp_number text;

COMMENT ON COLUMN public.merch_items.whatsapp_number IS
  'WhatsApp number for enquiries (digits / +27…). When set, public shop Enquire opens WhatsApp.';
