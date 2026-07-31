-- Members directory: opt-in visibility (default true) + member browse policies

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS directory_visible boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS profiles_directory_visible_idx
  ON public.profiles (directory_visible)
  WHERE directory_visible = true;

-- Signed-in members can read profiles that opted into the directory (except suspended)
DROP POLICY IF EXISTS profiles_members_directory_read ON public.profiles;
CREATE POLICY profiles_members_directory_read
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    directory_visible = true
    AND membership_status IS DISTINCT FROM 'suspended'
  );

-- Garage vehicles: members can view vehicles of directory-visible members
DROP POLICY IF EXISTS gv_members_directory_read ON public.garage_vehicles;
CREATE POLICY gv_members_directory_read
  ON public.garage_vehicles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = garage_vehicles.user_id
        AND p.directory_visible = true
        AND p.membership_status IS DISTINCT FROM 'suspended'
    )
  );

-- Garage photos: same rule via parent vehicle
DROP POLICY IF EXISTS gvp_members_directory_read ON public.garage_vehicle_photos;
CREATE POLICY gvp_members_directory_read
  ON public.garage_vehicle_photos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.garage_vehicles v
      JOIN public.profiles p ON p.id = v.user_id
      WHERE v.id = garage_vehicle_photos.vehicle_id
        AND p.directory_visible = true
        AND p.membership_status IS DISTINCT FROM 'suspended'
    )
  );
