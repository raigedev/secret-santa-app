revoke execute on function public.list_my_assignment_gift_prep(uuid[]) from authenticated;
revoke execute on function public.list_my_assignment_gift_prep(uuid[]) from anon;
grant execute on function public.list_my_assignment_gift_prep(uuid[]) to service_role;
