--
-- PostgreSQL database dump
--

\restrict WXPvozH7r8S3ahNn4oUYS6evoV9iK3BLgBIb2Md2Iy9gIx83tfioJhfxe9VedlR

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA storage;


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select current_setting('request.jwt.claim.email', true);
$$;


--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select coalesce(current_setting('request.jwt.claim.role', true), 'authenticated');
$$;


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;


--
-- Name: convert_accepted_quotation_to_contract(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.convert_accepted_quotation_to_contract(p_quotation_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  source_quotation public.quotations%rowtype;
  new_contract_id uuid;
  contract_number text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into source_quotation from public.quotations where id = p_quotation_id for update;
  if not found then raise exception 'Quotation not found'; end if;
  if source_quotation.status <> 'accepted' then raise exception 'Only accepted quotations can create contracts'; end if;
  if source_quotation.generated_contract_id is not null then return source_quotation.generated_contract_id; end if;

  contract_number := public.next_document_number('contract');
  insert into public.contracts (
    contract_number, client_id, project_id, quotation_id, contract_type, title,
    status, contract_value, content, terms_and_conditions, created_by
  ) values (
    contract_number, source_quotation.client_id, source_quotation.project_id,
    source_quotation.id, 'sow', source_quotation.title, 'draft',
    source_quotation.total_amount, source_quotation.scope_of_work,
    source_quotation.terms_and_conditions, auth.uid()
  ) returning id into new_contract_id;

  update public.quotations set generated_contract_id = new_contract_id,
    updated_by = auth.uid(), updated_at = now() where id = source_quotation.id;
  insert into public.entity_history(entity_type, entity_id, event_type, description, actor_id, metadata)
  values ('quotation', source_quotation.id, 'converted_to_contract',
    'Accepted quotation converted to contract', auth.uid(), jsonb_build_object('contract_id', new_contract_id));
  return new_contract_id;
end;
$$;


--
-- Name: convert_lead(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.convert_lead(p_lead_id uuid, p_create_project boolean DEFAULT true) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  source_lead public.leads%rowtype;
  new_client_id uuid;
  new_contact_id uuid;
  new_project_id uuid;
  project_number text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into source_lead from public.leads where id = p_lead_id for update;
  if not found then raise exception 'Lead not found'; end if;
  if source_lead.converted_client_id is not null or source_lead.status = 'converted' then
    raise exception 'Lead has already been converted';
  end if;

  insert into public.clients (
    company_name, contact_person, email, phone, address, lead_source, status, notes, created_by
  ) values (
    source_lead.company_name, source_lead.contact_person, source_lead.email,
    source_lead.phone, source_lead.location, source_lead.lead_source,
    'active', source_lead.notes, auth.uid()
  ) returning id into new_client_id;

  if coalesce(source_lead.contact_person, '') <> '' then
    insert into public.contacts (
      client_id, full_name, email, phone, is_primary, is_billing_contact,
      is_project_contact, created_by
    ) values (
      new_client_id, source_lead.contact_person, source_lead.email, source_lead.phone,
      true, true, true, auth.uid()
    ) returning id into new_contact_id;
  end if;

  if p_create_project then
    project_number := public.next_document_number('project');
    insert into public.projects (
      client_id, project_code, project_name, project_type, description, status,
      project_value, assigned_manager, created_by
    ) values (
      new_client_id, project_number,
      source_lead.company_name || ' - ' || coalesce(source_lead.service_interested, 'Opportunity'),
      source_lead.service_interested, source_lead.notes, 'opportunity',
      source_lead.estimated_value, source_lead.assigned_to, auth.uid()
    ) returning id into new_project_id;
  end if;

  update public.leads set
    status = 'converted', converted_client_id = new_client_id,
    converted_contact_id = new_contact_id, converted_project_id = new_project_id,
    converted_at = now(), updated_by = auth.uid(), updated_at = now()
  where id = p_lead_id;

  insert into public.entity_history (
    entity_type, entity_id, event_type, description, actor_id, metadata
  ) values (
    'lead', p_lead_id, 'lead_converted', 'Lead converted to connected business records',
    auth.uid(), jsonb_build_object('client_id', new_client_id, 'contact_id', new_contact_id, 'project_id', new_project_id)
  );

  return jsonb_build_object(
    'lead_id', p_lead_id, 'client_id', new_client_id,
    'contact_id', new_contact_id, 'project_id', new_project_id
  );
end;
$$;


--
-- Name: copilot_security_ready(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.copilot_security_ready() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1 from public.application_security_migrations
    where migration_id = '202611020022_harden_profile_roles'
  );
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    'staff'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;


--
-- Name: is_admin_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin_user() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;


--
-- Name: next_document_number(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.next_document_number(p_document_type text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  format_record public.numbering_formats%rowtype;
  allocated_number integer;
  year_part text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into format_record
  from public.numbering_formats
  where document_type = p_document_type and is_active = true
  for update;

  if not found then
    raise exception 'No active numbering format for %', p_document_type;
  end if;

  allocated_number := format_record.next_number;
  update public.numbering_formats
  set next_number = next_number + 1, updated_at = now()
  where id = format_record.id;

  year_part := case when format_record.include_year then
    format_record.separator || extract(year from current_date)::integer::text
  else '' end;

  return format_record.prefix || year_part || format_record.separator ||
    lpad(allocated_number::text, format_record.padding, '0');
end;
$$;


--
-- Name: prevent_self_role_changes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_self_role_changes() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if (select auth.uid()) = old.id and new.role is distinct from old.role then
    raise exception 'Users cannot change their own role.';
  end if;

  return new;
end;
$$;


--
-- Name: recalculate_invoice_payment_totals(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recalculate_invoice_payment_totals() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  target_invoice uuid;
  allocated numeric;
  withheld numeric;
begin
  target_invoice := coalesce(new.invoice_id, old.invoice_id);
  select coalesce(sum(amount + adjustment_amount), 0), coalesce(sum(withholding_amount), 0)
    into allocated, withheld
  from public.payments
  where invoice_id = target_invoice and reversed_at is null;

  update public.invoices
  set amount_paid = allocated,
      tds_amount = withheld,
      balance_due = greatest(total_amount - allocated - withheld - credit_applied, 0),
      status = case
        when status in ('cancelled', 'written_off', 'draft') then status
        when total_amount - allocated - withheld - credit_applied <= 0 then 'paid'
        when allocated + withheld + credit_applied > 0 then 'partially_paid'
        when due_date < current_date then 'overdue'
        else status
      end,
      paid_at = case when total_amount - allocated - withheld - credit_applied <= 0 then now() else null end,
      updated_at = now()
  where id = target_invoice;
  return coalesce(new, old);
end;
$$;


--
-- Name: record_copilot_ai_usage(uuid, uuid, uuid, text, text, integer, integer, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_copilot_ai_usage(p_user_id uuid, p_request_id uuid, p_conversation_id uuid, p_operation text, p_model text, p_input_tokens integer, p_output_tokens integer, p_estimated_cost_usd numeric) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  reservation public.ai_usage_reservations%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required';
  end if;

  select * into reservation from public.ai_usage_reservations
  where request_id = p_request_id and user_id = p_user_id and released_at is null
  for update;
  if not found then
    raise exception 'Copilot request reservation not found';
  end if;
  if p_input_tokens < 0 or p_output_tokens < 0 or p_estimated_cost_usd < 0
    or p_estimated_cost_usd > reservation.reserved_cost_usd
    or char_length(p_operation) > 80 or char_length(p_model) > 200 then
    raise exception 'Invalid Copilot usage record';
  end if;
  if not exists (
    select 1 from public.copilot_conversations
    where id = p_conversation_id and user_id = p_user_id
  ) then
    raise exception 'Copilot conversation is not owned by this user';
  end if;

  insert into public.ai_usage_events(
    user_id, conversation_id, operation, model, input_tokens, output_tokens, estimated_cost_usd
  ) values (
    p_user_id, p_conversation_id, p_operation, p_model, p_input_tokens, p_output_tokens, p_estimated_cost_usd
  );
  delete from public.ai_usage_reservations where request_id = p_request_id;
end;
$$;


--
-- Name: release_copilot_ai_request(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.release_copilot_ai_request(p_user_id uuid, p_request_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  update public.ai_usage_reservations
  set reserved_cost_usd = 0, released_at = now()
  where request_id = p_request_id and user_id = p_user_id and released_at is null;
end;
$$;


--
-- Name: reserve_copilot_ai_request(uuid, uuid, integer, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reserve_copilot_ai_request(p_user_id uuid, p_request_id uuid, p_hourly_limit integer, p_daily_budget_usd numeric, p_reserved_cost_usd numeric) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  hour_requests integer;
  daily_cost numeric;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  if p_user_id is null or p_request_id is null
    or p_hourly_limit < 1 or p_hourly_limit > 20
    or p_daily_budget_usd <= 0 or p_daily_budget_usd > 10
    or p_reserved_cost_usd <= 0 or p_reserved_cost_usd > 0.5 then
    raise exception 'Invalid Copilot budget reservation';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('business-copilot-ai-budget', 0)
  );

  delete from public.ai_usage_reservations
  where released_at is not null and created_at < now() - interval '1 day';
  update public.ai_usage_reservations
  set reserved_cost_usd = 0, released_at = now()
  where released_at is null and created_at < now() - interval '15 minutes';

  select
    (select count(*) from public.ai_usage_events
     where user_id = p_user_id and created_at >= now() - interval '1 hour')
    +
    (select count(*) from public.ai_usage_reservations
     where user_id = p_user_id and created_at >= now() - interval '1 hour')
  into hour_requests;

  if hour_requests >= p_hourly_limit then
    return false;
  end if;

  select
    coalesce((select sum(estimated_cost_usd) from public.ai_usage_events
      where created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'), 0)
    +
    coalesce((select sum(reserved_cost_usd) from public.ai_usage_reservations
      where released_at is null
        and created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
        and created_at >= now() - interval '15 minutes'), 0)
  into daily_cost;

  if daily_cost + p_reserved_cost_usd > p_daily_budget_usd then
    return false;
  end if;

  insert into public.ai_usage_reservations(request_id, user_id, reserved_cost_usd)
  values (p_request_id, p_user_id, p_reserved_cost_usd);
  return true;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_number text NOT NULL,
    client_id uuid,
    quotation_id uuid,
    contract_id uuid,
    invoice_date date DEFAULT CURRENT_DATE,
    due_date date,
    status text DEFAULT 'draft'::text,
    subtotal numeric DEFAULT 0,
    discount_amount numeric DEFAULT 0,
    tax_percentage numeric DEFAULT 18,
    tax_amount numeric DEFAULT 0,
    total_amount numeric DEFAULT 0,
    amount_paid numeric DEFAULT 0,
    balance_due numeric DEFAULT 0,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    project_id uuid,
    invoice_type text DEFAULT 'standard'::text,
    payment_terms text,
    sent_at timestamp with time zone,
    paid_at timestamp with time zone,
    overdue_days integer DEFAULT 0,
    milestone_id uuid,
    document_type text DEFAULT 'tax_invoice'::text NOT NULL,
    issue_date timestamp with time zone,
    place_of_supply text,
    tax_type text,
    tds_amount numeric(14,2) DEFAULT 0 NOT NULL,
    credit_applied numeric(14,2) DEFAULT 0 NOT NULL,
    rounding_amount numeric(12,2) DEFAULT 0 NOT NULL,
    cancellation_reason text,
    write_off_reason text,
    archived_at timestamp with time zone,
    updated_by uuid,
    reverse_charge boolean DEFAULT false NOT NULL,
    amount_in_words text,
    debit_applied numeric(14,2) DEFAULT 0 NOT NULL,
    CONSTRAINT invoices_debit_applied_check CHECK ((debit_applied >= (0)::numeric)),
    CONSTRAINT invoices_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'issued'::text, 'partially_paid'::text, 'paid'::text, 'overdue'::text, 'cancelled'::text, 'written_off'::text]))),
    CONSTRAINT invoices_tax_type_check CHECK (((tax_type IS NULL) OR (tax_type = ANY (ARRAY['cgst_sgst'::text, 'igst'::text, 'none'::text]))))
);


--
-- Name: save_draft_invoice_lines(uuid, jsonb, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_draft_invoice_lines(p_invoice_id uuid, p_lines jsonb, p_document_discount numeric DEFAULT 0, p_rounding numeric DEFAULT 0) RETURNS public.invoices
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare inv public.invoices%rowtype; line jsonb; gross numeric; line_discount numeric; taxable numeric; line_tax numeric; subtotal_sum numeric:=0; tax_sum numeric:=0; total_sum numeric; idx integer:=0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into inv from public.invoices where id=p_invoice_id for update;
  if not found then raise exception 'Invoice not found'; end if;
  if inv.status<>'draft' then raise exception 'Only draft invoices may be edited'; end if;
  if jsonb_array_length(p_lines)=0 then raise exception 'At least one invoice line is required'; end if;
  delete from public.invoice_items where invoice_id=p_invoice_id;
  for line in select * from jsonb_array_elements(p_lines) loop
    if coalesce(line->>'description','')='' or (line->>'quantity')::numeric<=0 or (line->>'unit_price')::numeric<0 then raise exception 'Invalid invoice line'; end if;
    gross:=round((line->>'quantity')::numeric*(line->>'unit_price')::numeric,2);line_discount:=round(gross*coalesce((line->>'discount_rate')::numeric,0)/100,2);taxable:=greatest(gross-line_discount,0);line_tax:=round(taxable*coalesce((line->>'tax_rate')::numeric,0)/100,2);
    insert into public.invoice_items(invoice_id,description,hsn_sac,unit,quantity,unit_price,discount_rate,discount_amount,taxable_amount,tax_rate,tax_amount,line_total,sort_order)
    values(p_invoice_id,line->>'description',nullif(line->>'hsn_sac',''),nullif(line->>'unit',''),(line->>'quantity')::numeric,(line->>'unit_price')::numeric,coalesce((line->>'discount_rate')::numeric,0),line_discount,taxable,coalesce((line->>'tax_rate')::numeric,0),line_tax,taxable+line_tax,idx);
    subtotal_sum:=subtotal_sum+taxable;tax_sum:=tax_sum+line_tax;idx:=idx+1;
  end loop;
  total_sum:=greatest(subtotal_sum-greatest(p_document_discount,0),0)+tax_sum+p_rounding;
  if total_sum<0 then raise exception 'Invoice total cannot be negative'; end if;
  update public.invoices set subtotal=round(subtotal_sum,2),discount_amount=round(greatest(p_document_discount,0),2),tax_amount=round(tax_sum,2),rounding_amount=round(p_rounding,2),total_amount=round(total_sum,2),balance_due=greatest(round(total_sum,2)-amount_paid-tds_amount-credit_applied,0),updated_by=auth.uid(),updated_at=now() where id=p_invoice_id returning * into inv;
  return inv;
end;$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: financial_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    note_number text NOT NULL,
    note_type text NOT NULL,
    invoice_id uuid NOT NULL,
    note_date date DEFAULT CURRENT_DATE NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    base_amount numeric(14,2) NOT NULL,
    tax_rate numeric(7,4) DEFAULT 0 NOT NULL,
    tax_amount numeric(14,2) DEFAULT 0 NOT NULL,
    total_amount numeric(14,2) NOT NULL,
    override_reason text,
    approved_at timestamp with time zone,
    issued_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    cancellation_reason text,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT financial_notes_base_amount_check CHECK ((base_amount > (0)::numeric)),
    CONSTRAINT financial_notes_note_type_check CHECK ((note_type = ANY (ARRAY['credit_note'::text, 'debit_note'::text]))),
    CONSTRAINT financial_notes_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'issued'::text, 'cancelled'::text]))),
    CONSTRAINT financial_notes_total_amount_check CHECK ((total_amount > (0)::numeric))
);


--
-- Name: transition_financial_note(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.transition_financial_note(p_note_id uuid, p_status text, p_reason text DEFAULT ''::text) RETURNS public.financial_notes
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $_$
declare
  _filename text;
begin
  _filename := storage.filename(name);
  return substring(_filename from '\.([^\.]+)$');
end
$_$;


--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[array_length(_parts, 1)];
end
$$;


--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1:array_length(_parts, 1) - 1];
end
$$;


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    instance_id uuid,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb DEFAULT '{}'::jsonb,
    raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    phone text,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::text,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    contact_id uuid,
    project_id uuid,
    activity_type text DEFAULT 'follow_up'::text NOT NULL,
    subject text NOT NULL,
    description text,
    activity_date timestamp with time zone DEFAULT now() NOT NULL,
    due_date timestamp with time zone,
    status text DEFAULT 'pending'::text NOT NULL,
    priority text DEFAULT 'medium'::text NOT NULL,
    assigned_to uuid,
    completed_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT activities_activity_type_check CHECK ((activity_type = ANY (ARRAY['call'::text, 'email'::text, 'meeting'::text, 'follow_up'::text, 'demo'::text, 'proposal_discussion'::text, 'payment_follow_up'::text, 'support_discussion'::text, 'general_note'::text]))),
    CONSTRAINT activities_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text]))),
    CONSTRAINT activities_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: ai_usage_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_usage_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    conversation_id uuid,
    operation text NOT NULL,
    model text NOT NULL,
    input_tokens integer NOT NULL,
    output_tokens integer NOT NULL,
    estimated_cost_usd numeric(12,8) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_usage_events_estimated_cost_usd_check CHECK ((estimated_cost_usd >= (0)::numeric)),
    CONSTRAINT ai_usage_events_input_tokens_check CHECK ((input_tokens >= 0)),
    CONSTRAINT ai_usage_events_output_tokens_check CHECK ((output_tokens >= 0))
);


--
-- Name: ai_usage_reservations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_usage_reservations (
    request_id uuid NOT NULL,
    user_id uuid NOT NULL,
    reserved_cost_usd numeric(12,8) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    released_at timestamp with time zone,
    CONSTRAINT ai_usage_reservations_reserved_cost_usd_check CHECK ((reserved_cost_usd >= (0)::numeric))
);


--
-- Name: application_security_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.application_security_migrations (
    migration_id text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_name text NOT NULL,
    client_short_name text,
    contact_person text,
    email text,
    phone text,
    gst_number text,
    pan_number text,
    address text,
    city text,
    state text,
    country text DEFAULT 'India'::text,
    industry text,
    lead_source text,
    status text DEFAULT 'lead'::text NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    account_owner uuid,
    payment_terms text,
    archived_at timestamp with time zone,
    archived_by uuid,
    updated_by uuid,
    CONSTRAINT clients_status_check CHECK ((status = ANY (ARRAY['lead'::text, 'proposal_sent'::text, 'active'::text, 'inactive'::text, 'closed'::text, 'archived'::text])))
);


--
-- Name: company_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_name text,
    legal_name text,
    email text,
    phone text,
    website text,
    address text,
    gst_number text,
    pan_number text,
    logo_url text,
    primary_color text DEFAULT '#f4b000'::text,
    secondary_color text DEFAULT '#111111'::text,
    currency text DEFAULT 'INR'::text,
    default_tax_percentage numeric DEFAULT 18,
    bank_details text,
    authorized_signatory_name text,
    default_footer_text text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: configurable_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.configurable_options (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    option_group text NOT NULL,
    option_key text NOT NULL,
    label text NOT NULL,
    color text,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    full_name text NOT NULL,
    designation text,
    email text,
    phone text,
    whatsapp text,
    department text,
    is_primary boolean DEFAULT false,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_billing_contact boolean DEFAULT false NOT NULL,
    is_project_contact boolean DEFAULT false NOT NULL,
    archived_at timestamp with time zone,
    updated_by uuid
);


--
-- Name: contract_relationships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_relationships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_contract_id uuid NOT NULL,
    related_contract_id uuid NOT NULL,
    relationship_type text NOT NULL,
    reason text NOT NULL,
    effective_date date,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT contract_relationships_relationship_type_check CHECK ((relationship_type = ANY (ARRAY['renewal'::text, 'amendment'::text])))
);


--
-- Name: contract_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contract_id uuid NOT NULL,
    version_number integer NOT NULL,
    content text,
    terms_and_conditions text,
    file_path text,
    file_name text,
    file_size bigint,
    mime_type text,
    signed_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT contract_versions_version_number_check CHECK ((version_number > 0))
);


--
-- Name: contracts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contracts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contract_number text NOT NULL,
    client_id uuid,
    quotation_id uuid,
    contract_type text NOT NULL,
    title text NOT NULL,
    start_date date,
    end_date date,
    status text DEFAULT 'draft'::text,
    contract_value numeric DEFAULT 0,
    renewal_required boolean DEFAULT false,
    renewal_date date,
    content text,
    terms_and_conditions text,
    signed_file_url text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    project_id uuid,
    version_number integer DEFAULT 1,
    signed_at timestamp with time zone,
    expiry_alert_days integer DEFAULT 30,
    document_status text DEFAULT 'draft'::text,
    approved_at timestamp with time zone,
    sent_for_signature_at timestamp with time zone,
    termination_reason text,
    notice_period_days integer,
    renewal_period_months integer,
    archived_at timestamp with time zone,
    updated_by uuid,
    billing_schedule text,
    scope text,
    deliverables text,
    CONSTRAINT contracts_contract_type_check CHECK ((contract_type = ANY (ARRAY['onboarding'::text, 'maintenance'::text, 'sow'::text, 'nda'::text, 'change_request'::text, 'project_closure'::text]))),
    CONSTRAINT contracts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'internal_review'::text, 'approved'::text, 'sent_for_signature'::text, 'active'::text, 'expired'::text, 'terminated'::text, 'renewed'::text, 'archived'::text])))
);


--
-- Name: copilot_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.copilot_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT copilot_conversations_title_check CHECK (((char_length(title) >= 1) AND (char_length(title) <= 200)))
);


--
-- Name: copilot_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.copilot_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    records jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT copilot_messages_content_check CHECK (((char_length(content) >= 1) AND (char_length(content) <= 12000))),
    CONSTRAINT copilot_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text])))
);


--
-- Name: document_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_name text NOT NULL,
    template_type text NOT NULL,
    version integer DEFAULT 1,
    content_json jsonb DEFAULT '{}'::jsonb,
    terms_json jsonb DEFAULT '{}'::jsonb,
    is_default boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT document_templates_template_type_check CHECK ((template_type = ANY (ARRAY['quotation'::text, 'onboarding_contract'::text, 'maintenance_contract'::text, 'sow'::text, 'nda'::text, 'change_request'::text, 'invoice'::text, 'project_closure'::text])))
);


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid,
    project_id uuid,
    entity_type text,
    entity_id uuid,
    category text NOT NULL,
    title text NOT NULL,
    description text,
    version_number integer DEFAULT 1 NOT NULL,
    parent_document_id uuid,
    storage_bucket text NOT NULL,
    storage_path text NOT NULL,
    file_name text NOT NULL,
    mime_type text NOT NULL,
    file_size bigint NOT NULL,
    document_date date,
    expiry_date date,
    archived_at timestamp with time zone,
    archived_by uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT documents_category_check CHECK ((category = ANY (ARRAY['requirement'::text, 'proposal'::text, 'quotation'::text, 'contract'::text, 'purchase_order'::text, 'delivery_document'::text, 'acceptance_document'::text, 'invoice'::text, 'receipt'::text, 'payment_evidence'::text, 'technical_document'::text, 'general_attachment'::text]))),
    CONSTRAINT documents_file_size_check CHECK (((file_size > 0) AND (file_size <= 20971520))),
    CONSTRAINT documents_version_number_check CHECK ((version_number > 0))
);


--
-- Name: entity_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entity_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    event_type text NOT NULL,
    previous_value jsonb,
    new_value jsonb,
    description text NOT NULL,
    actor_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: expense_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expense_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    is_billable_default boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    expense_number text NOT NULL,
    expense_date date DEFAULT CURRENT_DATE,
    category text NOT NULL,
    vendor_name text,
    client_id uuid,
    project_or_reference text,
    amount numeric NOT NULL,
    tax_amount numeric DEFAULT 0,
    total_amount numeric NOT NULL,
    payment_mode text,
    receipt_file_url text,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    project_id uuid,
    billable_to_client boolean DEFAULT false,
    reimbursable boolean DEFAULT false,
    approval_status text DEFAULT 'pending'::text,
    approved_by uuid,
    approved_at timestamp with time zone,
    description text,
    status text DEFAULT 'draft'::text NOT NULL,
    gst_number text,
    approval_comments text,
    rejected_at timestamp with time zone,
    paid_at timestamp with time zone,
    archived_at timestamp with time zone,
    updated_by uuid,
    CONSTRAINT expenses_category_check CHECK ((category = ANY (ARRAY['cloud'::text, 'hosting'::text, 'domain'::text, 'software_subscription'::text, 'freelancer'::text, 'salary'::text, 'marketing'::text, 'travel'::text, 'hardware'::text, 'office'::text, 'miscellaneous'::text]))),
    CONSTRAINT expenses_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'approved'::text, 'rejected'::text, 'paid'::text, 'cancelled'::text])))
);


--
-- Name: invoice_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    description text NOT NULL,
    hsn_sac text,
    unit text,
    quantity numeric(12,4) DEFAULT 1 NOT NULL,
    unit_price numeric(14,2) DEFAULT 0 NOT NULL,
    discount_rate numeric(7,4) DEFAULT 0 NOT NULL,
    discount_amount numeric(14,2) DEFAULT 0 NOT NULL,
    taxable_amount numeric(14,2) DEFAULT 0 NOT NULL,
    tax_rate numeric(7,4) DEFAULT 0 NOT NULL,
    tax_amount numeric(14,2) DEFAULT 0 NOT NULL,
    line_total numeric(14,2) DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT invoice_items_discount_amount_check CHECK ((discount_amount >= (0)::numeric)),
    CONSTRAINT invoice_items_discount_rate_check CHECK (((discount_rate >= (0)::numeric) AND (discount_rate <= (100)::numeric))),
    CONSTRAINT invoice_items_line_total_check CHECK ((line_total >= (0)::numeric)),
    CONSTRAINT invoice_items_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT invoice_items_tax_amount_check CHECK ((tax_amount >= (0)::numeric)),
    CONSTRAINT invoice_items_tax_rate_check CHECK ((tax_rate >= (0)::numeric)),
    CONSTRAINT invoice_items_taxable_amount_check CHECK ((taxable_amount >= (0)::numeric)),
    CONSTRAINT invoice_items_unit_price_check CHECK ((unit_price >= (0)::numeric))
);


--
-- Name: leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_number text NOT NULL,
    company_name text NOT NULL,
    contact_person text,
    email text,
    phone text,
    website text,
    location text,
    lead_source text,
    service_interested text,
    status text DEFAULT 'new'::text NOT NULL,
    priority text DEFAULT 'medium'::text NOT NULL,
    assigned_to uuid,
    estimated_value numeric DEFAULT 0,
    expected_close_date date,
    notes text,
    lost_reason text,
    converted_client_id uuid,
    converted_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    campaign text,
    follow_up_date timestamp with time zone,
    converted_contact_id uuid,
    converted_project_id uuid,
    archived_at timestamp with time zone,
    archived_by uuid,
    updated_by uuid,
    CONSTRAINT leads_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text]))),
    CONSTRAINT leads_status_check CHECK ((status = ANY (ARRAY['new'::text, 'contacted'::text, 'qualified'::text, 'proposal_planned'::text, 'converted'::text, 'lost'::text])))
);


--
-- Name: maintenance_contracts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maintenance_contracts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid,
    contract_id uuid,
    plan_name text NOT NULL,
    start_date date,
    end_date date,
    monthly_fee numeric DEFAULT 0,
    yearly_fee numeric DEFAULT 0,
    included_hours numeric DEFAULT 0,
    status text DEFAULT 'active'::text,
    renewal_date date,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    project_id uuid,
    response_sla_hours numeric(8,2),
    resolution_sla_hours numeric(8,2),
    billing_schedule text,
    renewed_from_id uuid,
    archived_at timestamp with time zone,
    updated_by uuid,
    CONSTRAINT maintenance_contracts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'expiring'::text, 'renewed'::text, 'expired'::text, 'cancelled'::text])))
);


--
-- Name: maintenance_renewals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maintenance_renewals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_maintenance_id uuid NOT NULL,
    renewed_maintenance_id uuid NOT NULL,
    reason text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recipient_id uuid,
    notification_type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    entity_type text,
    entity_id uuid,
    due_at timestamp with time zone,
    read_at timestamp with time zone,
    dismissed_at timestamp with time zone,
    deduplication_key text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    priority text DEFAULT 'normal'::text NOT NULL,
    category text,
    archived_at timestamp with time zone,
    CONSTRAINT notifications_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text])))
);


--
-- Name: numbering_formats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.numbering_formats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_type text NOT NULL,
    prefix text NOT NULL,
    include_year boolean DEFAULT true,
    separator text DEFAULT '-'::text,
    padding integer DEFAULT 4,
    next_number integer DEFAULT 1,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: payment_milestone_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_milestone_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_name text NOT NULL,
    milestone_name text NOT NULL,
    percentage numeric DEFAULT 0,
    description text,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid,
    payment_date date DEFAULT CURRENT_DATE,
    amount numeric NOT NULL,
    payment_mode text,
    transaction_reference text,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    bank_reference text,
    withholding_amount numeric(14,2) DEFAULT 0 NOT NULL,
    adjustment_amount numeric(14,2) DEFAULT 0 NOT NULL,
    evidence_path text,
    reversed_at timestamp with time zone,
    reversal_reason text,
    reversed_by uuid
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text,
    email text,
    role text DEFAULT 'staff'::text NOT NULL,
    company_name text DEFAULT 'Business Operations'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'staff'::text])))
);


--
-- Name: project_milestones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_milestones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    deliverable text,
    owner_id uuid,
    status text DEFAULT 'planned'::text NOT NULL,
    planned_date date,
    actual_completion_date date,
    billing_percentage numeric(7,4),
    billing_amount numeric(14,2),
    acceptance_required boolean DEFAULT true NOT NULL,
    completion_evidence text,
    internal_notes text,
    client_accepted_at timestamp with time zone,
    invoice_id uuid,
    override_reason text,
    created_by uuid,
    updated_by uuid,
    archived_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT project_milestones_billing_amount_check CHECK ((billing_amount >= (0)::numeric)),
    CONSTRAINT project_milestones_billing_percentage_check CHECK (((billing_percentage >= (0)::numeric) AND (billing_percentage <= (100)::numeric))),
    CONSTRAINT project_milestones_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'in_progress'::text, 'ready_for_review'::text, 'accepted'::text, 'invoiced'::text, 'cancelled'::text])))
);


--
-- Name: project_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    default_template_id uuid,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    project_code text NOT NULL,
    project_name text NOT NULL,
    project_type text,
    description text,
    status text DEFAULT 'lead'::text,
    start_date date,
    target_end_date date,
    actual_end_date date,
    project_value numeric DEFAULT 0,
    assigned_manager uuid,
    priority text DEFAULT 'medium'::text,
    tags text[],
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    objectives text,
    scope text,
    assumptions text,
    dependencies text,
    exclusions text,
    budget numeric(14,2) DEFAULT 0 NOT NULL,
    closure_notes text,
    client_accepted_at timestamp with time zone,
    closed_at timestamp with time zone,
    closure_override_reason text,
    archived_at timestamp with time zone,
    archived_by uuid,
    updated_by uuid,
    closed_by uuid,
    reopened_at timestamp with time zone,
    reopened_by uuid,
    reopen_reason text,
    final_invoice_waived boolean DEFAULT false NOT NULL,
    deliverables_accepted boolean DEFAULT false NOT NULL,
    reimbursable_expenses_processed boolean DEFAULT false NOT NULL,
    required_documents_attached boolean DEFAULT false NOT NULL,
    CONSTRAINT projects_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text]))),
    CONSTRAINT projects_status_check CHECK ((status = ANY (ARRAY['opportunity'::text, 'planned'::text, 'active'::text, 'on_hold'::text, 'completed'::text, 'closed'::text, 'cancelled'::text, 'archived'::text])))
);


--
-- Name: quotation_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quotation_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quotation_id uuid NOT NULL,
    description text NOT NULL,
    quantity numeric(10,2) DEFAULT 1 NOT NULL,
    unit_price numeric(12,2) DEFAULT 0 NOT NULL,
    line_total numeric(12,2) DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    unit text,
    hsn_sac text,
    discount_rate numeric(7,4) DEFAULT 0 NOT NULL,
    discount_amount numeric(14,2) DEFAULT 0 NOT NULL,
    taxable_amount numeric(14,2) DEFAULT 0 NOT NULL
);


--
-- Name: quotations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quotations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quotation_number text NOT NULL,
    client_id uuid NOT NULL,
    title text NOT NULL,
    quotation_date date DEFAULT CURRENT_DATE NOT NULL,
    valid_until date,
    status text DEFAULT 'draft'::text NOT NULL,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    discount_rate numeric(5,2) DEFAULT 0 NOT NULL,
    discount_amount numeric(12,2) DEFAULT 0 NOT NULL,
    tax_rate numeric(5,2) DEFAULT 18 NOT NULL,
    tax_amount numeric(12,2) DEFAULT 0 NOT NULL,
    total_amount numeric(12,2) DEFAULT 0 NOT NULL,
    payment_terms text,
    notes text,
    terms_and_conditions text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    project_overview text,
    scope_of_work text,
    tech_stack text,
    project_timeline text,
    support_and_maintenance text,
    project_id uuid,
    version_number integer DEFAULT 1,
    parent_quotation_id uuid,
    approved_at timestamp with time zone,
    sent_at timestamp with time zone,
    rejected_reason text,
    revision_number integer DEFAULT 1 NOT NULL,
    reviewed_at timestamp with time zone,
    accepted_at timestamp with time zone,
    superseded_at timestamp with time zone,
    place_of_supply text,
    tax_type text,
    rounding_amount numeric(12,2) DEFAULT 0 NOT NULL,
    archived_at timestamp with time zone,
    updated_by uuid,
    return_to_draft_reason text,
    generated_contract_id uuid,
    generated_project_id uuid,
    CONSTRAINT quotations_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'under_review'::text, 'approved'::text, 'sent'::text, 'accepted'::text, 'rejected'::text, 'expired'::text, 'superseded'::text]))),
    CONSTRAINT quotations_tax_type_check CHECK (((tax_type IS NULL) OR (tax_type = ANY (ARRAY['cgst_sgst'::text, 'igst'::text, 'none'::text]))))
);


--
-- Name: service_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_name text NOT NULL,
    service_category text,
    description text,
    default_unit text,
    default_rate numeric DEFAULT 0,
    default_duration_days integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: standard_terms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.standard_terms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    term_type text NOT NULL,
    title text NOT NULL,
    content text,
    is_default boolean DEFAULT false,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: support_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_number text NOT NULL,
    client_id uuid,
    maintenance_contract_id uuid,
    title text NOT NULL,
    description text,
    priority text DEFAULT 'medium'::text,
    status text DEFAULT 'open'::text,
    assigned_to uuid,
    resolution_notes text,
    opened_at timestamp with time zone DEFAULT now(),
    closed_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    project_id uuid,
    due_date date,
    sla_hours numeric DEFAULT 0,
    time_spent_hours numeric DEFAULT 0,
    client_visible boolean DEFAULT false,
    severity text,
    response_deadline timestamp with time zone,
    resolution_deadline timestamp with time zone,
    first_responded_at timestamp with time zone,
    resolved_at timestamp with time zone,
    reopening_reason text,
    internal_notes text,
    client_visible_notes text,
    archived_at timestamp with time zone,
    updated_by uuid,
    CONSTRAINT support_tickets_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text]))),
    CONSTRAINT support_tickets_status_check CHECK ((status = ANY (ARRAY['new'::text, 'assigned'::text, 'in_progress'::text, 'waiting_for_client'::text, 'resolved'::text, 'closed'::text, 'reopened'::text, 'cancelled'::text])))
);


--
-- Name: ticket_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    comment text NOT NULL,
    client_visible boolean DEFAULT false NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ticket_time_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_time_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    user_id uuid,
    entry_date date DEFAULT CURRENT_DATE NOT NULL,
    hours numeric(8,2) NOT NULL,
    notes text,
    eligible_for_maintenance boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ticket_time_entries_hours_check CHECK ((hours > (0)::numeric))
);


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[]
);


--
-- Name: objects; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED
);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: activities activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_pkey PRIMARY KEY (id);


--
-- Name: ai_usage_events ai_usage_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_events
    ADD CONSTRAINT ai_usage_events_pkey PRIMARY KEY (id);


--
-- Name: ai_usage_reservations ai_usage_reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_reservations
    ADD CONSTRAINT ai_usage_reservations_pkey PRIMARY KEY (request_id);


--
-- Name: application_security_migrations application_security_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_security_migrations
    ADD CONSTRAINT application_security_migrations_pkey PRIMARY KEY (migration_id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: company_settings company_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_settings
    ADD CONSTRAINT company_settings_pkey PRIMARY KEY (id);


--
-- Name: configurable_options configurable_options_option_group_option_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.configurable_options
    ADD CONSTRAINT configurable_options_option_group_option_key_key UNIQUE (option_group, option_key);


--
-- Name: configurable_options configurable_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.configurable_options
    ADD CONSTRAINT configurable_options_pkey PRIMARY KEY (id);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: contract_relationships contract_relationships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_relationships
    ADD CONSTRAINT contract_relationships_pkey PRIMARY KEY (id);


--
-- Name: contract_relationships contract_relationships_source_contract_id_related_contract__key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_relationships
    ADD CONSTRAINT contract_relationships_source_contract_id_related_contract__key UNIQUE (source_contract_id, related_contract_id);


--
-- Name: contract_versions contract_versions_contract_id_version_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_versions
    ADD CONSTRAINT contract_versions_contract_id_version_number_key UNIQUE (contract_id, version_number);


--
-- Name: contract_versions contract_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_versions
    ADD CONSTRAINT contract_versions_pkey PRIMARY KEY (id);


--
-- Name: contracts contracts_contract_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_contract_number_key UNIQUE (contract_number);


--
-- Name: contracts contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_pkey PRIMARY KEY (id);


--
-- Name: copilot_conversations copilot_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copilot_conversations
    ADD CONSTRAINT copilot_conversations_pkey PRIMARY KEY (id);


--
-- Name: copilot_messages copilot_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copilot_messages
    ADD CONSTRAINT copilot_messages_pkey PRIMARY KEY (id);


--
-- Name: document_templates document_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_templates
    ADD CONSTRAINT document_templates_pkey PRIMARY KEY (id);


--
-- Name: documents documents_parent_document_id_version_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_parent_document_id_version_number_key UNIQUE (parent_document_id, version_number);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: documents documents_storage_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_storage_path_key UNIQUE (storage_path);


--
-- Name: entity_history entity_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_history
    ADD CONSTRAINT entity_history_pkey PRIMARY KEY (id);


--
-- Name: expense_categories expense_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_categories
    ADD CONSTRAINT expense_categories_name_key UNIQUE (name);


--
-- Name: expense_categories expense_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_categories
    ADD CONSTRAINT expense_categories_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_expense_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_expense_number_key UNIQUE (expense_number);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: financial_notes financial_notes_note_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_notes
    ADD CONSTRAINT financial_notes_note_number_key UNIQUE (note_number);


--
-- Name: financial_notes financial_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_notes
    ADD CONSTRAINT financial_notes_pkey PRIMARY KEY (id);


--
-- Name: invoice_items invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_invoice_number_key UNIQUE (invoice_number);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: leads leads_lead_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_lead_number_key UNIQUE (lead_number);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: maintenance_contracts maintenance_contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_contracts
    ADD CONSTRAINT maintenance_contracts_pkey PRIMARY KEY (id);


--
-- Name: maintenance_renewals maintenance_renewals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_renewals
    ADD CONSTRAINT maintenance_renewals_pkey PRIMARY KEY (id);


--
-- Name: maintenance_renewals maintenance_renewals_renewed_maintenance_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_renewals
    ADD CONSTRAINT maintenance_renewals_renewed_maintenance_id_key UNIQUE (renewed_maintenance_id);


--
-- Name: maintenance_renewals maintenance_renewals_source_maintenance_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_renewals
    ADD CONSTRAINT maintenance_renewals_source_maintenance_id_key UNIQUE (source_maintenance_id);


--
-- Name: notifications notifications_deduplication_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_deduplication_key_key UNIQUE (deduplication_key);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: numbering_formats numbering_formats_document_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.numbering_formats
    ADD CONSTRAINT numbering_formats_document_type_key UNIQUE (document_type);


--
-- Name: numbering_formats numbering_formats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.numbering_formats
    ADD CONSTRAINT numbering_formats_pkey PRIMARY KEY (id);


--
-- Name: payment_milestone_templates payment_milestone_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_milestone_templates
    ADD CONSTRAINT payment_milestone_templates_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: project_milestones project_milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_milestones
    ADD CONSTRAINT project_milestones_pkey PRIMARY KEY (id);


--
-- Name: project_types project_types_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_types
    ADD CONSTRAINT project_types_name_key UNIQUE (name);


--
-- Name: project_types project_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_types
    ADD CONSTRAINT project_types_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: projects projects_project_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_project_code_key UNIQUE (project_code);


--
-- Name: quotation_items quotation_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotation_items
    ADD CONSTRAINT quotation_items_pkey PRIMARY KEY (id);


--
-- Name: quotations quotations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_pkey PRIMARY KEY (id);


--
-- Name: quotations quotations_quotation_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_quotation_number_key UNIQUE (quotation_number);


--
-- Name: service_catalog service_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_catalog
    ADD CONSTRAINT service_catalog_pkey PRIMARY KEY (id);


--
-- Name: standard_terms standard_terms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standard_terms
    ADD CONSTRAINT standard_terms_pkey PRIMARY KEY (id);


--
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);


--
-- Name: support_tickets support_tickets_ticket_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_ticket_number_key UNIQUE (ticket_number);


--
-- Name: ticket_comments ticket_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_comments
    ADD CONSTRAINT ticket_comments_pkey PRIMARY KEY (id);


--
-- Name: ticket_time_entries ticket_time_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_time_entries
    ADD CONSTRAINT ticket_time_entries_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: idx_activities_activity_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_activity_date ON public.activities USING btree (activity_date);


--
-- Name: idx_activities_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_client_id ON public.activities USING btree (client_id);


--
-- Name: idx_activities_contact_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_contact_id ON public.activities USING btree (contact_id);


--
-- Name: idx_activities_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_due_date ON public.activities USING btree (due_date);


--
-- Name: idx_activities_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_project_id ON public.activities USING btree (project_id);


--
-- Name: idx_activities_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_status ON public.activities USING btree (status);


--
-- Name: idx_ai_usage_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_usage_user_created ON public.ai_usage_events USING btree (user_id, created_at DESC);


--
-- Name: idx_configurable_options_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_configurable_options_active ON public.configurable_options USING btree (is_active);


--
-- Name: idx_configurable_options_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_configurable_options_group ON public.configurable_options USING btree (option_group);


--
-- Name: idx_contacts_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_client_id ON public.contacts USING btree (client_id);


--
-- Name: idx_contacts_full_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_full_name ON public.contacts USING btree (full_name);


--
-- Name: idx_contacts_one_primary_per_client; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_contacts_one_primary_per_client ON public.contacts USING btree (client_id) WHERE (is_primary = true);


--
-- Name: idx_contract_relationship_one_renewal; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_contract_relationship_one_renewal ON public.contract_relationships USING btree (source_contract_id) WHERE (relationship_type = 'renewal'::text);


--
-- Name: idx_contracts_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contracts_client_id ON public.contracts USING btree (client_id);


--
-- Name: idx_contracts_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contracts_created_at ON public.contracts USING btree (created_at);


--
-- Name: idx_contracts_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contracts_number ON public.contracts USING btree (contract_number);


--
-- Name: idx_contracts_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contracts_project_id ON public.contracts USING btree (project_id);


--
-- Name: idx_contracts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contracts_status ON public.contracts USING btree (status);


--
-- Name: idx_copilot_conversations_user_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_copilot_conversations_user_updated ON public.copilot_conversations USING btree (user_id, updated_at DESC);


--
-- Name: idx_copilot_messages_conversation_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_copilot_messages_conversation_created ON public.copilot_messages USING btree (conversation_id, created_at);


--
-- Name: idx_documents_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_entity ON public.documents USING btree (entity_type, entity_id, created_at DESC);


--
-- Name: idx_documents_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_project ON public.documents USING btree (project_id, category, created_at DESC);


--
-- Name: idx_entity_history_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_history_entity ON public.entity_history USING btree (entity_type, entity_id, created_at DESC);


--
-- Name: idx_expenses_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_client_id ON public.expenses USING btree (client_id);


--
-- Name: idx_expenses_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_created_at ON public.expenses USING btree (created_at);


--
-- Name: idx_expenses_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_project_id ON public.expenses USING btree (project_id);


--
-- Name: idx_financial_notes_invoice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financial_notes_invoice ON public.financial_notes USING btree (invoice_id, status);


--
-- Name: idx_invoice_items_invoice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoice_items_invoice ON public.invoice_items USING btree (invoice_id, sort_order);


--
-- Name: idx_invoices_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_client_id ON public.invoices USING btree (client_id);


--
-- Name: idx_invoices_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_created_at ON public.invoices USING btree (created_at);


--
-- Name: idx_invoices_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_number ON public.invoices USING btree (invoice_number);


--
-- Name: idx_invoices_one_per_milestone; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_invoices_one_per_milestone ON public.invoices USING btree (milestone_id) WHERE ((milestone_id IS NOT NULL) AND (status <> 'cancelled'::text));


--
-- Name: idx_invoices_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_project_id ON public.invoices USING btree (project_id);


--
-- Name: idx_invoices_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_status ON public.invoices USING btree (status);


--
-- Name: idx_leads_assigned_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_assigned_to ON public.leads USING btree (assigned_to);


--
-- Name: idx_leads_converted_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_converted_client_id ON public.leads USING btree (converted_client_id);


--
-- Name: idx_leads_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_created_at ON public.leads USING btree (created_at);


--
-- Name: idx_leads_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_created_by ON public.leads USING btree (created_by);


--
-- Name: idx_leads_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_number ON public.leads USING btree (lead_number);


--
-- Name: idx_leads_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_priority ON public.leads USING btree (priority);


--
-- Name: idx_leads_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_status ON public.leads USING btree (status);


--
-- Name: idx_maintenance_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_maintenance_project_id ON public.maintenance_contracts USING btree (project_id);


--
-- Name: idx_notifications_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_due ON public.notifications USING btree (due_at) WHERE ((read_at IS NULL) AND (dismissed_at IS NULL));


--
-- Name: idx_notifications_recipient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_recipient ON public.notifications USING btree (recipient_id, read_at, due_at);


--
-- Name: idx_project_milestones_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_milestones_project ON public.project_milestones USING btree (project_id, status);


--
-- Name: idx_projects_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_client_id ON public.projects USING btree (client_id);


--
-- Name: idx_projects_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_created_at ON public.projects USING btree (created_at);


--
-- Name: idx_projects_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_status ON public.projects USING btree (status);


--
-- Name: idx_quotations_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotations_client_id ON public.quotations USING btree (client_id);


--
-- Name: idx_quotations_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotations_created_at ON public.quotations USING btree (created_at);


--
-- Name: idx_quotations_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotations_number ON public.quotations USING btree (quotation_number);


--
-- Name: idx_quotations_one_contract; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_quotations_one_contract ON public.quotations USING btree (generated_contract_id) WHERE (generated_contract_id IS NOT NULL);


--
-- Name: idx_quotations_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotations_project_id ON public.quotations USING btree (project_id);


--
-- Name: idx_quotations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotations_status ON public.quotations USING btree (status);


--
-- Name: idx_support_tickets_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_project_id ON public.support_tickets USING btree (project_id);


--
-- Name: idx_support_tickets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_status ON public.support_tickets USING btree (status);


--
-- Name: idx_ticket_comments_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_comments_ticket ON public.ticket_comments USING btree (ticket_id, created_at);


--
-- Name: idx_ticket_time_entries_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_time_entries_ticket ON public.ticket_time_entries USING btree (ticket_id);


--
-- Name: users on_auth_user_created; Type: TRIGGER; Schema: auth; Owner: -
--

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


--
-- Name: profiles prevent_self_role_changes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER prevent_self_role_changes BEFORE UPDATE OF role ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_changes();


--
-- Name: payments recalculate_invoice_after_payment; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER recalculate_invoice_after_payment AFTER INSERT OR DELETE OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.recalculate_invoice_payment_totals();


--
-- Name: activities set_activities_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_activities_updated_at BEFORE UPDATE ON public.activities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: clients set_clients_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: company_settings set_company_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_company_settings_updated_at BEFORE UPDATE ON public.company_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: configurable_options set_configurable_options_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_configurable_options_updated_at BEFORE UPDATE ON public.configurable_options FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: contacts set_contacts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: contracts set_contracts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_contracts_updated_at BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: document_templates set_document_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_document_templates_updated_at BEFORE UPDATE ON public.document_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: expense_categories set_expense_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_expense_categories_updated_at BEFORE UPDATE ON public.expense_categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: expenses set_expenses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: financial_notes set_financial_notes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_financial_notes_updated_at BEFORE UPDATE ON public.financial_notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: invoice_items set_invoice_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_invoice_items_updated_at BEFORE UPDATE ON public.invoice_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: invoices set_invoices_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: leads set_leads_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: maintenance_contracts set_maintenance_contracts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_maintenance_contracts_updated_at BEFORE UPDATE ON public.maintenance_contracts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: numbering_formats set_numbering_formats_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_numbering_formats_updated_at BEFORE UPDATE ON public.numbering_formats FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: payment_milestone_templates set_payment_milestone_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_payment_milestone_templates_updated_at BEFORE UPDATE ON public.payment_milestone_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: profiles set_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: project_milestones set_project_milestones_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_project_milestones_updated_at BEFORE UPDATE ON public.project_milestones FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: project_types set_project_types_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_project_types_updated_at BEFORE UPDATE ON public.project_types FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: projects set_projects_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: quotation_items set_quotation_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_quotation_items_updated_at BEFORE UPDATE ON public.quotation_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: quotations set_quotations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_quotations_updated_at BEFORE UPDATE ON public.quotations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: service_catalog set_service_catalog_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_service_catalog_updated_at BEFORE UPDATE ON public.service_catalog FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: standard_terms set_standard_terms_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_standard_terms_updated_at BEFORE UPDATE ON public.standard_terms FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: support_tickets set_support_tickets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_support_tickets_updated_at BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: activities activities_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id);


--
-- Name: activities activities_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: activities activities_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: activities activities_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: activities activities_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: ai_usage_events ai_usage_events_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_events
    ADD CONSTRAINT ai_usage_events_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.copilot_conversations(id) ON DELETE SET NULL;


--
-- Name: ai_usage_events ai_usage_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_events
    ADD CONSTRAINT ai_usage_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ai_usage_reservations ai_usage_reservations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_reservations
    ADD CONSTRAINT ai_usage_reservations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: clients clients_account_owner_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_account_owner_fkey FOREIGN KEY (account_owner) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: clients clients_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: clients clients_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: clients clients_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: contacts contacts_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: contacts contacts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: contacts contacts_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: contract_relationships contract_relationships_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_relationships
    ADD CONSTRAINT contract_relationships_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: contract_relationships contract_relationships_related_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_relationships
    ADD CONSTRAINT contract_relationships_related_contract_id_fkey FOREIGN KEY (related_contract_id) REFERENCES public.contracts(id) ON DELETE RESTRICT;


--
-- Name: contract_relationships contract_relationships_source_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_relationships
    ADD CONSTRAINT contract_relationships_source_contract_id_fkey FOREIGN KEY (source_contract_id) REFERENCES public.contracts(id) ON DELETE RESTRICT;


--
-- Name: contract_versions contract_versions_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_versions
    ADD CONSTRAINT contract_versions_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE RESTRICT;


--
-- Name: contract_versions contract_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_versions
    ADD CONSTRAINT contract_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: contracts contracts_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: contracts contracts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: contracts contracts_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: contracts contracts_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id);


--
-- Name: contracts contracts_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: copilot_conversations copilot_conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copilot_conversations
    ADD CONSTRAINT copilot_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: copilot_messages copilot_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copilot_messages
    ADD CONSTRAINT copilot_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.copilot_conversations(id) ON DELETE CASCADE;


--
-- Name: copilot_messages copilot_messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copilot_messages
    ADD CONSTRAINT copilot_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: documents documents_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: documents documents_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;


--
-- Name: documents documents_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: documents documents_parent_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_parent_document_id_fkey FOREIGN KEY (parent_document_id) REFERENCES public.documents(id) ON DELETE RESTRICT;


--
-- Name: documents documents_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE RESTRICT;


--
-- Name: entity_history entity_history_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_history
    ADD CONSTRAINT entity_history_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: expenses expenses_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.profiles(id);


--
-- Name: expenses expenses_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: expenses expenses_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: expenses expenses_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: expenses expenses_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: financial_notes financial_notes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_notes
    ADD CONSTRAINT financial_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: financial_notes financial_notes_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_notes
    ADD CONSTRAINT financial_notes_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE RESTRICT;


--
-- Name: financial_notes financial_notes_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_notes
    ADD CONSTRAINT financial_notes_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: invoice_items invoice_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE RESTRICT;


--
-- Name: invoices invoices_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: invoices invoices_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id);


--
-- Name: invoices invoices_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: invoices invoices_milestone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_milestone_id_fkey FOREIGN KEY (milestone_id) REFERENCES public.project_milestones(id) ON DELETE SET NULL;


--
-- Name: invoices invoices_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: invoices invoices_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id);


--
-- Name: invoices invoices_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: leads leads_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: leads leads_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id);


--
-- Name: leads leads_converted_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_converted_client_id_fkey FOREIGN KEY (converted_client_id) REFERENCES public.clients(id);


--
-- Name: leads leads_converted_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_converted_contact_id_fkey FOREIGN KEY (converted_contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: leads leads_converted_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_converted_project_id_fkey FOREIGN KEY (converted_project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: leads leads_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: leads leads_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: maintenance_contracts maintenance_contracts_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_contracts
    ADD CONSTRAINT maintenance_contracts_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: maintenance_contracts maintenance_contracts_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_contracts
    ADD CONSTRAINT maintenance_contracts_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id);


--
-- Name: maintenance_contracts maintenance_contracts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_contracts
    ADD CONSTRAINT maintenance_contracts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: maintenance_contracts maintenance_contracts_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_contracts
    ADD CONSTRAINT maintenance_contracts_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: maintenance_contracts maintenance_contracts_renewed_from_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_contracts
    ADD CONSTRAINT maintenance_contracts_renewed_from_id_fkey FOREIGN KEY (renewed_from_id) REFERENCES public.maintenance_contracts(id) ON DELETE SET NULL;


--
-- Name: maintenance_contracts maintenance_contracts_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_contracts
    ADD CONSTRAINT maintenance_contracts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: maintenance_renewals maintenance_renewals_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_renewals
    ADD CONSTRAINT maintenance_renewals_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: maintenance_renewals maintenance_renewals_renewed_maintenance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_renewals
    ADD CONSTRAINT maintenance_renewals_renewed_maintenance_id_fkey FOREIGN KEY (renewed_maintenance_id) REFERENCES public.maintenance_contracts(id) ON DELETE RESTRICT;


--
-- Name: maintenance_renewals maintenance_renewals_source_maintenance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_renewals
    ADD CONSTRAINT maintenance_renewals_source_maintenance_id_fkey FOREIGN KEY (source_maintenance_id) REFERENCES public.maintenance_contracts(id) ON DELETE RESTRICT;


--
-- Name: notifications notifications_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: payments payments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: payments payments_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: payments payments_reversed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_reversed_by_fkey FOREIGN KEY (reversed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: project_milestones project_milestones_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_milestones
    ADD CONSTRAINT project_milestones_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: project_milestones project_milestones_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_milestones
    ADD CONSTRAINT project_milestones_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;


--
-- Name: project_milestones project_milestones_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_milestones
    ADD CONSTRAINT project_milestones_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: project_milestones project_milestones_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_milestones
    ADD CONSTRAINT project_milestones_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE RESTRICT;


--
-- Name: project_milestones project_milestones_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_milestones
    ADD CONSTRAINT project_milestones_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: project_types project_types_default_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_types
    ADD CONSTRAINT project_types_default_template_id_fkey FOREIGN KEY (default_template_id) REFERENCES public.document_templates(id);


--
-- Name: projects projects_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: projects projects_assigned_manager_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_assigned_manager_fkey FOREIGN KEY (assigned_manager) REFERENCES public.profiles(id);


--
-- Name: projects projects_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;


--
-- Name: projects projects_closed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: projects projects_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: projects projects_reopened_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_reopened_by_fkey FOREIGN KEY (reopened_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: projects projects_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: quotation_items quotation_items_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotation_items
    ADD CONSTRAINT quotation_items_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON DELETE CASCADE;


--
-- Name: quotations quotations_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;


--
-- Name: quotations quotations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: quotations quotations_generated_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_generated_contract_id_fkey FOREIGN KEY (generated_contract_id) REFERENCES public.contracts(id) ON DELETE SET NULL;


--
-- Name: quotations quotations_generated_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_generated_project_id_fkey FOREIGN KEY (generated_project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: quotations quotations_parent_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_parent_quotation_id_fkey FOREIGN KEY (parent_quotation_id) REFERENCES public.quotations(id);


--
-- Name: quotations quotations_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: quotations quotations_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: support_tickets support_tickets_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id);


--
-- Name: support_tickets support_tickets_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: support_tickets support_tickets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: support_tickets support_tickets_maintenance_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_maintenance_contract_id_fkey FOREIGN KEY (maintenance_contract_id) REFERENCES public.maintenance_contracts(id);


--
-- Name: support_tickets support_tickets_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: support_tickets support_tickets_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: ticket_comments ticket_comments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_comments
    ADD CONSTRAINT ticket_comments_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: ticket_comments ticket_comments_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_comments
    ADD CONSTRAINT ticket_comments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE RESTRICT;


--
-- Name: ticket_time_entries ticket_time_entries_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_time_entries
    ADD CONSTRAINT ticket_time_entries_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: ticket_time_entries ticket_time_entries_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_time_entries
    ADD CONSTRAINT ticket_time_entries_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE RESTRICT;


--
-- Name: ticket_time_entries ticket_time_entries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_time_entries
    ADD CONSTRAINT ticket_time_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: buckets buckets_owner_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_owner_fkey FOREIGN KEY (owner) REFERENCES auth.users(id);


--
-- Name: objects objects_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: objects objects_owner_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_owner_fkey FOREIGN KEY (owner) REFERENCES auth.users(id);


--
-- Name: activities Admins can delete activities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete activities" ON public.activities FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: clients Admins can delete clients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete clients" ON public.clients FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: company_settings Admins can delete company_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete company_settings" ON public.company_settings FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: configurable_options Admins can delete configurable options; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete configurable options" ON public.configurable_options FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: contacts Admins can delete contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete contacts" ON public.contacts FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: contracts Admins can delete contracts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete contracts" ON public.contracts FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: document_templates Admins can delete document_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete document_templates" ON public.document_templates FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: expense_categories Admins can delete expense_categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete expense_categories" ON public.expense_categories FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: expenses Admins can delete expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete expenses" ON public.expenses FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: invoices Admins can delete invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete invoices" ON public.invoices FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: leads Admins can delete leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete leads" ON public.leads FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: maintenance_contracts Admins can delete maintenance contracts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete maintenance contracts" ON public.maintenance_contracts FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: numbering_formats Admins can delete numbering formats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete numbering formats" ON public.numbering_formats FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: payment_milestone_templates Admins can delete payment_milestone_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete payment_milestone_templates" ON public.payment_milestone_templates FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: payments Admins can delete payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete payments" ON public.payments FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: project_types Admins can delete project_types; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete project_types" ON public.project_types FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: projects Admins can delete projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete projects" ON public.projects FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: quotations Admins can delete quotations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete quotations" ON public.quotations FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: service_catalog Admins can delete service_catalog; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete service_catalog" ON public.service_catalog FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: standard_terms Admins can delete standard_terms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete standard_terms" ON public.standard_terms FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: support_tickets Admins can delete support tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete support tickets" ON public.support_tickets FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: profiles Admins can read profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_admin_user());


--
-- Name: profiles Admins can update profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());


--
-- Name: quotation_items Authenticated users can delete quotation items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete quotation items" ON public.quotation_items FOR DELETE TO authenticated USING (true);


--
-- Name: activities Authenticated users can insert activities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert activities" ON public.activities FOR INSERT TO authenticated WITH CHECK ((auth.uid() = created_by));


--
-- Name: clients Authenticated users can insert clients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK ((auth.uid() = created_by));


--
-- Name: company_settings Authenticated users can insert company_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert company_settings" ON public.company_settings FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: configurable_options Authenticated users can insert configurable options; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert configurable options" ON public.configurable_options FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: contacts Authenticated users can insert contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert contacts" ON public.contacts FOR INSERT TO authenticated WITH CHECK ((auth.uid() = created_by));


--
-- Name: contract_relationships Authenticated users can insert contract relationships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert contract relationships" ON public.contract_relationships FOR INSERT TO authenticated WITH CHECK ((created_by = auth.uid()));


--
-- Name: contract_versions Authenticated users can insert contract versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert contract versions" ON public.contract_versions FOR INSERT TO authenticated WITH CHECK ((created_by = auth.uid()));


--
-- Name: contracts Authenticated users can insert contracts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert contracts" ON public.contracts FOR INSERT TO authenticated WITH CHECK ((auth.uid() = created_by));


--
-- Name: document_templates Authenticated users can insert document_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert document_templates" ON public.document_templates FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: documents Authenticated users can insert documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert documents" ON public.documents FOR INSERT TO authenticated WITH CHECK ((created_by = auth.uid()));


--
-- Name: entity_history Authenticated users can insert entity history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert entity history" ON public.entity_history FOR INSERT TO authenticated WITH CHECK (((actor_id IS NULL) OR (actor_id = auth.uid())));


--
-- Name: expense_categories Authenticated users can insert expense_categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert expense_categories" ON public.expense_categories FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: expenses Authenticated users can insert expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK ((auth.uid() = created_by));


--
-- Name: financial_notes Authenticated users can insert financial notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert financial notes" ON public.financial_notes FOR INSERT TO authenticated WITH CHECK ((created_by = auth.uid()));


--
-- Name: invoice_items Authenticated users can insert invoice items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert invoice items" ON public.invoice_items FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.invoices
  WHERE (invoices.id = invoice_items.invoice_id))));


--
-- Name: invoices Authenticated users can insert invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK ((auth.uid() = created_by));


--
-- Name: leads Authenticated users can insert leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert leads" ON public.leads FOR INSERT TO authenticated WITH CHECK ((auth.uid() = created_by));


--
-- Name: maintenance_contracts Authenticated users can insert maintenance contracts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert maintenance contracts" ON public.maintenance_contracts FOR INSERT TO authenticated WITH CHECK ((auth.uid() = created_by));


--
-- Name: maintenance_renewals Authenticated users can insert maintenance renewals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert maintenance renewals" ON public.maintenance_renewals FOR INSERT TO authenticated WITH CHECK ((created_by = auth.uid()));


--
-- Name: numbering_formats Authenticated users can insert numbering formats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert numbering formats" ON public.numbering_formats FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: payment_milestone_templates Authenticated users can insert payment_milestone_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert payment_milestone_templates" ON public.payment_milestone_templates FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: payments Authenticated users can insert payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert payments" ON public.payments FOR INSERT TO authenticated WITH CHECK ((auth.uid() = created_by));


--
-- Name: project_milestones Authenticated users can insert project milestones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert project milestones" ON public.project_milestones FOR INSERT TO authenticated WITH CHECK ((created_by = auth.uid()));


--
-- Name: project_types Authenticated users can insert project_types; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert project_types" ON public.project_types FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: projects Authenticated users can insert projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert projects" ON public.projects FOR INSERT TO authenticated WITH CHECK ((auth.uid() = created_by));


--
-- Name: quotation_items Authenticated users can insert quotation items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert quotation items" ON public.quotation_items FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.quotations
  WHERE (quotations.id = quotation_items.quotation_id))));


--
-- Name: quotations Authenticated users can insert quotations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert quotations" ON public.quotations FOR INSERT TO authenticated WITH CHECK ((auth.uid() = created_by));


--
-- Name: service_catalog Authenticated users can insert service_catalog; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert service_catalog" ON public.service_catalog FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: standard_terms Authenticated users can insert standard_terms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert standard_terms" ON public.standard_terms FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: support_tickets Authenticated users can insert support tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert support tickets" ON public.support_tickets FOR INSERT TO authenticated WITH CHECK ((auth.uid() = created_by));


--
-- Name: ticket_comments Authenticated users can insert ticket comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert ticket comments" ON public.ticket_comments FOR INSERT TO authenticated WITH CHECK ((created_by = auth.uid()));


--
-- Name: ticket_time_entries Authenticated users can insert ticket time entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert ticket time entries" ON public.ticket_time_entries FOR INSERT TO authenticated WITH CHECK ((created_by = auth.uid()));


--
-- Name: activities Authenticated users can read activities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read activities" ON public.activities FOR SELECT TO authenticated USING (true);


--
-- Name: clients Authenticated users can read clients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read clients" ON public.clients FOR SELECT TO authenticated USING (true);


--
-- Name: company_settings Authenticated users can read company_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read company_settings" ON public.company_settings FOR SELECT TO authenticated USING (true);


--
-- Name: configurable_options Authenticated users can read configurable options; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read configurable options" ON public.configurable_options FOR SELECT TO authenticated USING (true);


--
-- Name: contacts Authenticated users can read contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read contacts" ON public.contacts FOR SELECT TO authenticated USING (true);


--
-- Name: contract_relationships Authenticated users can read contract relationships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read contract relationships" ON public.contract_relationships FOR SELECT TO authenticated USING (true);


--
-- Name: contract_versions Authenticated users can read contract versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read contract versions" ON public.contract_versions FOR SELECT TO authenticated USING (true);


--
-- Name: contracts Authenticated users can read contracts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read contracts" ON public.contracts FOR SELECT TO authenticated USING (true);


--
-- Name: document_templates Authenticated users can read document_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read document_templates" ON public.document_templates FOR SELECT TO authenticated USING (true);


--
-- Name: documents Authenticated users can read documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read documents" ON public.documents FOR SELECT TO authenticated USING (true);


--
-- Name: entity_history Authenticated users can read entity history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read entity history" ON public.entity_history FOR SELECT TO authenticated USING (true);


--
-- Name: expense_categories Authenticated users can read expense_categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read expense_categories" ON public.expense_categories FOR SELECT TO authenticated USING (true);


--
-- Name: expenses Authenticated users can read expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read expenses" ON public.expenses FOR SELECT TO authenticated USING (true);


--
-- Name: financial_notes Authenticated users can read financial notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read financial notes" ON public.financial_notes FOR SELECT TO authenticated USING (true);


--
-- Name: invoice_items Authenticated users can read invoice items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read invoice items" ON public.invoice_items FOR SELECT TO authenticated USING (true);


--
-- Name: invoices Authenticated users can read invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read invoices" ON public.invoices FOR SELECT TO authenticated USING (true);


--
-- Name: leads Authenticated users can read leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read leads" ON public.leads FOR SELECT TO authenticated USING (true);


--
-- Name: maintenance_contracts Authenticated users can read maintenance contracts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read maintenance contracts" ON public.maintenance_contracts FOR SELECT TO authenticated USING (true);


--
-- Name: maintenance_renewals Authenticated users can read maintenance renewals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read maintenance renewals" ON public.maintenance_renewals FOR SELECT TO authenticated USING (true);


--
-- Name: numbering_formats Authenticated users can read numbering formats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read numbering formats" ON public.numbering_formats FOR SELECT TO authenticated USING (true);


--
-- Name: payment_milestone_templates Authenticated users can read payment_milestone_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read payment_milestone_templates" ON public.payment_milestone_templates FOR SELECT TO authenticated USING (true);


--
-- Name: payments Authenticated users can read payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read payments" ON public.payments FOR SELECT TO authenticated USING (true);


--
-- Name: project_milestones Authenticated users can read project milestones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read project milestones" ON public.project_milestones FOR SELECT TO authenticated USING (true);


--
-- Name: project_types Authenticated users can read project_types; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read project_types" ON public.project_types FOR SELECT TO authenticated USING (true);


--
-- Name: projects Authenticated users can read projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read projects" ON public.projects FOR SELECT TO authenticated USING (true);


--
-- Name: quotation_items Authenticated users can read quotation items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read quotation items" ON public.quotation_items FOR SELECT TO authenticated USING (true);


--
-- Name: quotations Authenticated users can read quotations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read quotations" ON public.quotations FOR SELECT TO authenticated USING (true);


--
-- Name: service_catalog Authenticated users can read service_catalog; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read service_catalog" ON public.service_catalog FOR SELECT TO authenticated USING (true);


--
-- Name: standard_terms Authenticated users can read standard_terms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read standard_terms" ON public.standard_terms FOR SELECT TO authenticated USING (true);


--
-- Name: support_tickets Authenticated users can read support tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read support tickets" ON public.support_tickets FOR SELECT TO authenticated USING (true);


--
-- Name: ticket_comments Authenticated users can read ticket comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read ticket comments" ON public.ticket_comments FOR SELECT TO authenticated USING (true);


--
-- Name: ticket_time_entries Authenticated users can read ticket time entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read ticket time entries" ON public.ticket_time_entries FOR SELECT TO authenticated USING (true);


--
-- Name: activities Authenticated users can update activities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update activities" ON public.activities FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: clients Authenticated users can update clients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update clients" ON public.clients FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: company_settings Authenticated users can update company_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update company_settings" ON public.company_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: configurable_options Authenticated users can update configurable options; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update configurable options" ON public.configurable_options FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: contacts Authenticated users can update contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update contacts" ON public.contacts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: contracts Authenticated users can update contracts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update contracts" ON public.contracts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: document_templates Authenticated users can update document_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update document_templates" ON public.document_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: documents Authenticated users can update documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update documents" ON public.documents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: expense_categories Authenticated users can update expense_categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update expense_categories" ON public.expense_categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: expenses Authenticated users can update expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update expenses" ON public.expenses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: financial_notes Authenticated users can update financial notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update financial notes" ON public.financial_notes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: invoice_items Authenticated users can update invoice items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update invoice items" ON public.invoice_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: invoices Authenticated users can update invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update invoices" ON public.invoices FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: leads Authenticated users can update leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update leads" ON public.leads FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: maintenance_contracts Authenticated users can update maintenance contracts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update maintenance contracts" ON public.maintenance_contracts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: numbering_formats Authenticated users can update numbering formats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update numbering formats" ON public.numbering_formats FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: payment_milestone_templates Authenticated users can update payment_milestone_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update payment_milestone_templates" ON public.payment_milestone_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: payments Authenticated users can update payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update payments" ON public.payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: project_milestones Authenticated users can update project milestones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update project milestones" ON public.project_milestones FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: project_types Authenticated users can update project_types; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update project_types" ON public.project_types FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: projects Authenticated users can update projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update projects" ON public.projects FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: quotation_items Authenticated users can update quotation items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update quotation items" ON public.quotation_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: quotations Authenticated users can update quotations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update quotations" ON public.quotations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: service_catalog Authenticated users can update service_catalog; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update service_catalog" ON public.service_catalog FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: standard_terms Authenticated users can update standard_terms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update standard_terms" ON public.standard_terms FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: support_tickets Authenticated users can update support tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update support tickets" ON public.support_tickets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: copilot_conversations Users can create their copilot conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their copilot conversations" ON public.copilot_conversations FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: copilot_messages Users can create their copilot messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their copilot messages" ON public.copilot_messages FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (role = 'user'::text) AND (EXISTS ( SELECT 1
   FROM public.copilot_conversations c
  WHERE ((c.id = copilot_messages.conversation_id) AND (c.user_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (((auth.uid() = id) AND (role = 'staff'::text)));


--
-- Name: profiles Users can read own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING ((auth.uid() = id));


--
-- Name: copilot_conversations Users can read their copilot conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read their copilot conversations" ON public.copilot_conversations FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: copilot_messages Users can read their copilot messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read their copilot messages" ON public.copilot_messages FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.copilot_conversations c
  WHERE ((c.id = copilot_messages.conversation_id) AND (c.user_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: notifications Users can read their notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read their notifications" ON public.notifications FOR SELECT TO authenticated USING (((recipient_id IS NULL) OR (recipient_id = auth.uid())));


--
-- Name: ai_usage_events Users can read their own AI usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read their own AI usage" ON public.ai_usage_events FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: copilot_conversations Users can update their copilot conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their copilot conversations" ON public.copilot_conversations FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: notifications Users can update their notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their notifications" ON public.notifications FOR UPDATE TO authenticated USING (((recipient_id IS NULL) OR (recipient_id = auth.uid()))) WITH CHECK (((recipient_id IS NULL) OR (recipient_id = auth.uid())));


--
-- Name: activities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_usage_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_usage_reservations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_usage_reservations ENABLE ROW LEVEL SECURITY;

--
-- Name: application_security_migrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.application_security_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: clients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

--
-- Name: company_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: configurable_options; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.configurable_options ENABLE ROW LEVEL SECURITY;

--
-- Name: contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: contract_relationships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contract_relationships ENABLE ROW LEVEL SECURITY;

--
-- Name: contract_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contract_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: contracts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

--
-- Name: copilot_conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.copilot_conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: copilot_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.copilot_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: document_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

--
-- Name: entity_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.entity_history ENABLE ROW LEVEL SECURITY;

--
-- Name: expense_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: expenses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

--
-- Name: financial_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.financial_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: invoice_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

--
-- Name: invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: leads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

--
-- Name: maintenance_contracts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.maintenance_contracts ENABLE ROW LEVEL SECURITY;

--
-- Name: maintenance_renewals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.maintenance_renewals ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: numbering_formats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.numbering_formats ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_milestone_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_milestone_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: project_milestones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;

--
-- Name: project_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_types ENABLE ROW LEVEL SECURITY;

--
-- Name: projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

--
-- Name: quotation_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;

--
-- Name: quotations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;

--
-- Name: service_catalog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;

--
-- Name: standard_terms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.standard_terms ENABLE ROW LEVEL SECURITY;

--
-- Name: support_tickets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

--
-- Name: ticket_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: ticket_time_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ticket_time_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: objects Authenticated users can read business documents; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated users can read business documents" ON storage.objects FOR SELECT TO authenticated USING ((bucket_id = 'business-documents'::text));


--
-- Name: objects Authenticated users can read expense receipts; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated users can read expense receipts" ON storage.objects FOR SELECT TO authenticated USING ((bucket_id = 'expense-receipts'::text));


--
-- Name: objects Authenticated users can read payment evidence; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated users can read payment evidence" ON storage.objects FOR SELECT TO authenticated USING ((bucket_id = 'payment-evidence'::text));


--
-- Name: objects Authenticated users can read signed contracts; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated users can read signed contracts" ON storage.objects FOR SELECT TO authenticated USING ((bucket_id = 'signed-contracts'::text));


--
-- Name: objects Authenticated users can upload brand assets; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated users can upload brand assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'brand-assets'::text) AND ((storage.foldername(name))[1] = 'company'::text)));


--
-- Name: objects Authenticated users can upload business documents; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated users can upload business documents" ON storage.objects FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'business-documents'::text));


--
-- Name: objects Authenticated users can upload expense receipts; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated users can upload expense receipts" ON storage.objects FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'expense-receipts'::text));


--
-- Name: objects Authenticated users can upload payment evidence; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated users can upload payment evidence" ON storage.objects FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'payment-evidence'::text));


--
-- Name: objects Authenticated users can upload signed contracts; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Authenticated users can upload signed contracts" ON storage.objects FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'signed-contracts'::text));


--
-- Name: objects Public can read brand assets; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Public can read brand assets" ON storage.objects FOR SELECT USING ((bucket_id = 'brand-assets'::text));


--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict WXPvozH7r8S3ahNn4oUYS6evoV9iK3BLgBIb2Md2Iy9gIx83tfioJhfxe9VedlR

