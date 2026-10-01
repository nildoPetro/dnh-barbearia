-- DNH BARBEARIA - proteção de conflitos de agendamento e escala semanal
-- Execute este arquivo no SQL Editor do Supabase.

-- 1) Permite salvar horários diferentes por dia da semana.
alter table public.settings
add column if not exists weekly_schedule jsonb;

-- 2) Impede dois agendamentos ativos exatamente no mesmo horário/profissional/data.
create unique index if not exists bookings_unique_active_slot
on public.bookings (professional_id, booking_date, booking_time)
where status <> 'cancelled';

-- 3) Impede sobreposição de duração (ex.: serviço de 60 min às 10:00
--    não poderá coexistir com outro às 10:30 para o mesmo profissional).
create or replace function public.prevent_booking_overlap()
returns trigger
language plpgsql
as $$
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
           and new.booking_time::time < (b.booking_time::time + make_interval(mins => coalesce(bs.duration, 30)))
           and b.booking_time::time < (new.booking_time::time + make_interval(mins => new_duration))
    ) then
        raise exception 'HORARIO_CONFLITANTE: o profissional já possui um agendamento nesse intervalo.';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_prevent_booking_overlap on public.bookings;

create trigger trg_prevent_booking_overlap
before insert or update of professional_id, booking_date, booking_time, service_id, status
on public.bookings
for each row
execute function public.prevent_booking_overlap();


-- =========================================================
-- V15 - CONCLUSÃO DE ATENDIMENTO -> FINANCEIRO
-- =========================================================
-- O campo booking_id é interno e não altera os campos que o admin
-- utiliza manualmente no menu Financeiro.
alter table public.cash_entries
add column if not exists booking_id uuid references public.bookings(id) on delete set null;

-- Um agendamento só pode gerar um lançamento automático.
create unique index if not exists cash_entries_unique_booking
on public.cash_entries (booking_id)
where booking_id is not null;

-- Conclui o atendimento e cria a entrada financeira em uma única transação.
-- O admin continua podendo inserir lançamentos manuais normalmente.
create or replace function public.complete_booking_and_register_finance(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_booking public.bookings%rowtype;
    v_service_name text;
    v_service_price numeric;
    v_existing_id uuid;
begin
    -- Somente administrador pode concluir atendimento e gerar faturamento.
    if not exists (
        select 1
          from public.profiles p
         where p.id = auth.uid()
           and p.role = 'admin'
    ) then
        raise exception 'ACESSO_NEGADO: somente administrador pode concluir atendimento.';
    end if;

    select b.*, s.name, coalesce(s.price, 0)
      into v_booking, v_service_name, v_service_price
      from public.bookings b
      left join public.services s on s.id = b.service_id
     where b.id = p_booking_id
     for update;

    if not found then
        raise exception 'AGENDAMENTO_NAO_ENCONTRADO: agendamento não encontrado.';
    end if;

    -- Idempotência: se já existe lançamento para este booking, não cria outro.
    select ce.id
      into v_existing_id
      from public.cash_entries ce
     where ce.booking_id = p_booking_id
     limit 1;

    if v_existing_id is not null then
        if v_booking.status <> 'completed' then
            update public.bookings
               set status = 'completed'
             where id = p_booking_id;
        end if;

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
       set status = 'completed',
           updated_at = now()
     where id = p_booking_id;

    insert into public.cash_entries (
        type,
        description,
        amount,
        entry_date,
        booking_id
    ) values (
        'income',
        coalesce(v_service_name, 'Serviço'),
        v_service_price,
        v_booking.booking_date,
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
$$;

grant execute on function public.complete_booking_and_register_finance(uuid) to authenticated;
