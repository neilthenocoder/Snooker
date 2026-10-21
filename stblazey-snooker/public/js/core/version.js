// The version of the database this website expects.
// supabase/schema.sql ends by storing the same number in the database (the schema_version() function).
// Whenever the SQL file gains something the website needs, raise BOTH numbers by one — here and at the
// bottom of schema.sql. If the files are then uploaded without the SQL being run, the admin dashboard
// says so in red at the top of every page, instead of things quietly failing.
export const SCHEMA_VERSION = 25;
