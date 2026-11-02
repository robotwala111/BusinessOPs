alter table public.invoices
  add column if not exists debit_applied numeric(14,2) not null default 0
    check (debit_applied >= 0);

create or replace function public.transition_financial_note(
  p_note_id uuid,
  p_status text,
  p_reason text default ''
) returns public.financial_notes
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.financial_notes%rowtype;
  source_invoice public.invoices%rowtype;
  credit_total numeric(14,2);
  debit_total numeric(14,2);
  next_balance numeric(14,2);
  next_invoice_status text;
  previous_note_status text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_status not in ('approved','issued','cancelled') then raise exception 'Unsupported financial note transition'; end if;
  select * into target from public.financial_notes where id = p_note_id for update;
  if not found then raise exception 'Financial note not found'; end if;
  select * into source_invoice from public.invoices where id = target.invoice_id for update;
  previous_note_status := target.status;
  if target.status = 'cancelled' then raise exception 'Cancelled financial notes are immutable'; end if;
  if p_status = 'approved' and target.status <> 'draft' then raise exception 'Only draft notes may be approved'; end if;
  if p_status = 'issued' and target.status <> 'approved' then raise exception 'Only approved notes may be issued'; end if;
  if p_status = 'issued' and target.note_type = 'credit_note' and target.total_amount > source_invoice.balance_due and coalesce(trim(target.override_reason),'') = '' then
    raise exception 'Credit exceeds eligible invoice balance; an override reason is required';
  end if;
  if p_status = 'cancelled' and coalesce(trim(p_reason),'') = '' then raise exception 'Cancellation reason is required'; end if;

  update public.financial_notes set
    status = p_status,
    approved_at = case when p_status = 'approved' then now() else approved_at end,
    issued_at = case when p_status = 'issued' then now() else issued_at end,
    cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end,
    cancellation_reason = case when p_status = 'cancelled' then trim(p_reason) else cancellation_reason end,
    updated_by = auth.uid(), updated_at = now()
  where id = p_note_id returning * into target;

  select
    coalesce(sum(total_amount) filter (where note_type='credit_note' and status='issued'),0),
    coalesce(sum(total_amount) filter (where note_type='debit_note' and status='issued'),0)
  into credit_total, debit_total
  from public.financial_notes where invoice_id = target.invoice_id;

  next_balance := greatest(source_invoice.total_amount + debit_total - source_invoice.amount_paid - source_invoice.tds_amount - credit_total, 0);
  next_invoice_status := case
    when source_invoice.status in ('draft','cancelled','written_off') then source_invoice.status
    when next_balance = 0 then 'paid'
    when source_invoice.amount_paid + source_invoice.tds_amount + credit_total > 0 then 'partially_paid'
    when source_invoice.due_date is not null and source_invoice.due_date < current_date then 'overdue'
    else 'issued'
  end;
  update public.invoices set credit_applied=credit_total, debit_applied=debit_total,
    balance_due=next_balance, status=next_invoice_status, updated_by=auth.uid(), updated_at=now()
  where id=target.invoice_id;
  insert into public.entity_history(entity_type,entity_id,event_type,previous_value,new_value,description,actor_id,metadata)
  values('invoice',target.invoice_id,'financial_note_status',jsonb_build_object('status',previous_note_status),jsonb_build_object('status',p_status),
    target.note_type||' '||target.note_number||' moved to '||p_status,auth.uid(),jsonb_build_object('note_id',target.id));
  return target;
end;
$$;
revoke all on function public.transition_financial_note(uuid,text,text) from public;
grant execute on function public.transition_financial_note(uuid,text,text) to authenticated;
