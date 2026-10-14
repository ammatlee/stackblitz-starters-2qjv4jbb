import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ehvbyhzlgdupafuzbgnd.supabase.co';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_LpcYyg69736jVtB9gVexNA__cox8R5t';

export const isConfigured = Boolean(url && key && !url.startsWith('ISI_'));

export const supabase: SupabaseClient | null = isConfigured ? createClient(url, key) : null;