/* =====================================================================
   CONNECTION SETTINGS
   Leave both values empty to run in offline mode (sample questions,
   scores saved on each device only).
   Fill them in to use Brigit's Supabase: approved questions, email
   sign-in and one shared league table for everyone.
   The "anon" key is designed to be public — the database's access
   rules (supabase/schema.sql) decide what it can do.
   ===================================================================== */
window.QUIZ_CONFIG = {
  supabaseUrl: "https://sxxfuxwgxeitvkbtywhp.supabase.co",
  supabaseAnonKey: "sb_publishable_2cHhIpWBoWqdavlzF9SukA_G_HG03GE",   // publishable key: safe in a browser
  emailDomain: "brigit.co.za",
  // Admins who may sign in with a non-Brigit address. They must also be listed
  // in the quiz_approvers table, or the database will not let them in.
  adminEmails: ["sysproai@elveygroup.com"],
  // Guests: non-Brigit people who may play (not review). They must also be listed
  // in the quiz_guests table (supabase/guests.sql).
  guestEmails: ["carlos@elveygroup.com", "natasha@elveygroup.com"]
};
