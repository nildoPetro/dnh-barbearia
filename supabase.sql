-- ============================================================
-- DNH BARBEARIA - SQL V17
-- Correções: estoque, status da equipe e permissões administrativas
-- ============================================================

-- 1) Horários semanais
alter table public.settings
add column if not exists weekly_schedule jsonb;

-- 2) Impede dois agendamentos ativos no mesmo horário/profissional
create unique index if not exists bookings_unique_active_slot
on public.bookings (professional_id, booking_date, booking_time)
where status <> 'cancelled';

-- 3) Impede sobreposição conforme duração do serviço
create or replace function public.prevent_booking_overlap()
returns trigger
language plpgsql
as $function$
declare
    new_duration integer;
begin
    if new.status = 'cancelled' then
        return new;
    end if;

    select coalesce(s.duration, 30)
      into new_duration
      from public.services s
     where s.id = new.service_id;

    new_duration := coalesce(new_duration, 30);

    if exists (
        select 1
          from public.bookings b
          left join public.services bs on bs.id = b.service_id
         where b.id <> new.id
           and b.professional_id = new.professional_id
           and b.booking_date = new.booking_date
           and b.status <> 'cancelled'
           and new.booking_time::time < (
                b.booking_time::time + make_interval(mins => coalesce(bs.duration, 30))
           )
           and b.booking_time::time < (
                new.booking_time::time + make_interval(mins => new_duration)
           )
    ) then
        raise exception 'HORARIO_CONFLITANTE: o profissional já possui um agendamento nesse intervalo.';
    end if;

    return new;
end;
$function$;

drop trigger if exists trg_prevent_booking_overlap on public.bookings;

create trigger trg_prevent_booking_overlap
before insert or update of professional_id, booking_date, booking_time, service_id, status
on public.bookings
for each row
execute function public.prevent_booking_overlap();

-- 4) Campo de vínculo do financeiro com agendamento
alter table public.cash_entries
add column if not exists booking_id uuid
references public.bookings(id)
on delete set null;

create unique index if not exists cash_entries_unique_booking
on public.cash_entries (booking_id)
where booking_id is not null;

-- 5) Concluir atendimento -> financeiro
create or replace function public.complete_booking_and_register_finance(
    p_booking_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to public, pg_temp
as $function$
declare
    v_service_name text;
    v_service_price numeric;
    v_booking_date date;
    v_existing_id uuid;
begin
    if not exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'admin'
    ) then
        raise exception 'ACESSO_NEGADO: somente administrador pode concluir atendimento.';
    end if;

    select
        b.booking_date,
        s.name,
        coalesce(s.price, 0)
    into
        v_booking_date,
        v_service_name,
        v_service_price
    from public.bookings b
    left join public.services s on s.id = b.service_id
    where b.id = p_booking_id;

    if not found then
        raise exception 'AGENDAMENTO_NAO_ENCONTRADO: agendamento não encontrado.';
    end if;

    select id into v_existing_id
    from public.cash_entries
    where booking_id = p_booking_id
    limit 1;

    if v_existing_id is not null then
        update public.bookings
        set status = 'completed', updated_at = now()
        where id = p_booking_id;

        return jsonb_build_object(
            'success', true,
            'already_completed', true,
            'booking_id', p_booking_id,
            'cash_entry_id', v_existing_id,
            'description', coalesce(v_service_name, 'Serviço'),
            'amount', v_service_price
        );
    end if;

    update public.bookings
    set status = 'completed', updated_at = now()
    where id = p_booking_id;

    insert into public.cash_entries (
        type, description, amount, entry_date, booking_id
    ) values (
        'income',
        coalesce(v_service_name, 'Serviço'),
        v_service_price,
        v_booking_date,
        p_booking_id
    )
    returning id into v_existing_id;

    return jsonb_build_object(
        'success', true,
        'already_completed', false,
        'booking_id', p_booking_id,
        'cash_entry_id', v_existing_id,
        'description', coalesce(v_service_name, 'Serviço'),
        'amount', v_service_price
    );
end;
$function$;

grant execute on function public.complete_booking_and_register_finance(uuid) to authenticated;

-- 6) ESTOQUE - cria a tabela caso ainda não exista
create table if not exists public.inventory (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    quantity numeric not null default 0,
    min_quantity numeric not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists inventory_name_idx
on public.inventory (name);

-- RLS do estoque
alter table public.inventory enable row level security;

drop policy if exists inventory_admin_select on public.inventory;
drop policy if exists inventory_admin_insert on public.inventory;
drop policy if exists inventory_admin_update on public.inventory;
drop policy if exists inventory_admin_delete on public.inventory;

create policy inventory_admin_select
on public.inventory for select to authenticated
using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
));

create policy inventory_admin_insert
on public.inventory for insert to authenticated
with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
));

create policy inventory_admin_update
on public.inventory for update to authenticated
using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
))
with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
));

create policy inventory_admin_delete
on public.inventory for delete to authenticated
using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
));

-- 7) Status independente para a equipe.
-- Não altera o campo active existente.
alter table public.professionals
add column if not exists work_status text not null default 'active';

update public.professionals
set work_status = case
    when active = true then 'active'
    else 'inactive'
end
where work_status is null or work_status = '';

-- 8) Permissões administrativas para edição/exclusão do financeiro.
-- Os nomes das policies são próprios deste script e podem ser executados novamente.
alter table public.cash_entries enable row level security;

drop policy if exists cash_entries_admin_select on public.cash_entries;
drop policy if exists cash_entries_admin_insert on public.cash_entries;
drop policy if exists cash_entries_admin_update on public.cash_entries;
drop policy if exists cash_entries_admin_delete on public.cash_entries;

create policy cash_entries_admin_select
on public.cash_entries for select to authenticated
using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
));

create policy cash_entries_admin_insert
on public.cash_entries for insert to authenticated
with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
));

create policy cash_entries_admin_update
on public.cash_entries for update to authenticated
using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
))
with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
));

create policy cash_entries_admin_delete
on public.cash_entries for delete to authenticated
using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
));

-- ============================================================
-- FIM V17
-- ============================================================

-- ============================================================
-- V18 - ESTOQUE COM ENTRADAS/SAÍDAS + EXCLUSÃO DE CLIENTE
-- ============================================================

-- Movimentações do estoque
create table if not exists public.inventory_movements (
    id uuid primary key default gen_random_uuid(),
    inventory_id uuid not null references public.inventory(id) on delete cascade,
    type text not null check (type in ('in','out')),
    quantity numeric not null check (quantity > 0),
    created_at timestamptz not null default now()
);

create index if not exists inventory_movements_inventory_idx
on public.inventory_movements (inventory_id, created_at desc);

alter table public.inventory_movements enable row level security;

drop policy if exists inventory_movements_admin_select on public.inventory_movements;
drop policy if exists inventory_movements_admin_insert on public.inventory_movements;
drop policy if exists inventory_movements_admin_delete on public.inventory_movements;

create policy inventory_movements_admin_select
on public.inventory_movements for select to authenticated
using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
));

create policy inventory_movements_admin_insert
on public.inventory_movements for insert to authenticated
with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
));

create policy inventory_movements_admin_delete
on public.inventory_movements for delete to authenticated
using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
));

-- Políticas administrativas para exclusão de clientes e seus agendamentos.
alter table public.bookings enable row level security;

drop policy if exists bookings_admin_delete on public.bookings;
create policy bookings_admin_delete
on public.bookings for delete to authenticated
using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
));

create or replace function public.dnh_is_admin()
returns boolean
language sql
security definer
set search_path to public, pg_temp
as $function$
    select exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'admin'
    );
$function$;

grant execute on function public.dnh_is_admin() to authenticated;

alter table public.profiles enable row level security;

drop policy if exists profiles_admin_delete_clients on public.profiles;
create policy profiles_admin_delete_clients
on public.profiles for delete to authenticated
using (role = 'client' and public.dnh_is_admin());

-- ============================================================
-- FIM V18
-- ============================================================
