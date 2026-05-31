-- Migration 0044a: Add 'owner' to user_role enum (must commit before policies use it).

alter type public.user_role add value if not exists 'owner';
