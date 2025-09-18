// Supabase Configuration
// Your actual Supabase project URLs
window.SUPABASE_URL = 'https://lfwsooldipswbvbpnoxo.supabase.co';
window.SUPABASE_FUNCTION_URL = 'https://lfwsooldipswbvbpnoxo.functions.supabase.co';

// For local development, uncomment the lines below:
// window.SUPABASE_URL = 'http://localhost:54321';
// window.SUPABASE_FUNCTION_URL = 'http://localhost:54321/functions/v1';

console.log('Supabase configured:', {
  url: window.SUPABASE_URL,
  functions: window.SUPABASE_FUNCTION_URL
});