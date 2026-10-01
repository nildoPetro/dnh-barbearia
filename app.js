/* =========================================================
   DNH BARBEARIA
   APP.JS COMPLETO
   CONTROLE DE ACESSO ADMIN / CLIENTE
   ========================================================= */

const cfg = window.DNH_CONFIG || {};

const sb = window.supabase.createClient(
    cfg.supabaseUrl,
    cfg.supabaseAnonKey
);

let profile = null;

let settings = {
    name: 'DNH BARBEARIA',
    whatsapp: '',
    start_time: '08:00',
    end_time: '18:00',
    slot_interval: 30,
    logo_url: 'dnh-logo.png'
};

let services = [];
let professionals = [];

const $ = selector => document.querySelector(selector);

const $$ = selector => [...document.querySelectorAll(selector)];

const today = () => {
    const d = new Date();

    return new Date(
        d.getTime() - d.getTimezoneOffset() * 60000
    )
        .toISOString()
        .slice(0, 10);
};

const money = value =>
    Number(value || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });

const digits = value =>
    (value || '').replace(/\D/g, '');


/* =========================================================
   CONTROLE DE ACESSO
   ========================================================= */

const ADMIN_PAGES = [
    'dashboard',
    'agenda',
    'services',
    'clients',
    'stock',
    'finance',
    'team',
    'settings'
];

const CLIENT_PAGES = [
    'agenda',
    'consultar'
];


function isAdmin() {
    return profile?.role === 'admin';
}


function isClient() {
    return profile?.role === 'client';
}


function canAccessPage(page) {

    if (!profile) {
        return false;
    }

    if (isAdmin()) {
        return ADMIN_PAGES.includes(page);
    }

    return CLIENT_PAGES.includes(page);
}


/* =========================================================
   UTILITÁRIOS
   ========================================================= */

function toast(message) {

    if (!message) return;

    let el = $('#toast');

    if (!el) {

        el = document.createElement('div');

        el.id = 'toast';

        el.className = 'toast';

        document.body.appendChild(el);
    }

    el.textContent = message;

    el.classList.add('show');

    clearTimeout(window.__toastTimer);

    window.__toastTimer = setTimeout(() => {

        el.classList.remove('show');

    }, 3000);
}


function configured() {

    return !!(
        cfg.supabaseUrl &&
        cfg.supabaseAnonKey
    );
}


const WEEK_DAYS = [
    { key: '0', label: 'Domingo' },
    { key: '1', label: 'Segunda-feira' },
    { key: '2', label: 'Terça-feira' },
    { key: '3', label: 'Quarta-feira' },
    { key: '4', label: 'Quinta-feira' },
    { key: '5', label: 'Sexta-feira' },
    { key: '6', label: 'Sábado' }
];

const WEEKLY_STORAGE_KEY = 'dnh_weekly_schedule_v1';

function defaultWeeklySchedule() {
    return WEEK_DAYS.reduce((acc, day) => {
        acc[day.key] = {
            enabled: true,
            start_time: settings.start_time?.slice(0, 5) || '08:00',
            end_time: settings.end_time?.slice(0, 5) || '18:00'
        };
        return acc;
    }, {});
}

function getWeeklySchedule() {
    const fallback = defaultWeeklySchedule();
    let parsed = null;
    try {
        if (settings?.weekly_schedule) {
            parsed = typeof settings.weekly_schedule === 'string'
                ? JSON.parse(settings.weekly_schedule)
                : settings.weekly_schedule;
        }
    } catch (error) {
        console.warn('Não foi possível interpretar a escala semanal salva no banco:', error);
    }
    if (!parsed) {
        try {
            const raw = localStorage.getItem(WEEKLY_STORAGE_KEY);
            parsed = raw ? JSON.parse(raw) : null;
        } catch (error) {
            console.warn('Não foi possível ler a escala semanal:', error);
        }
    }
    if (!parsed || typeof parsed !== 'object') return fallback;
    WEEK_DAYS.forEach(day => {
        if (parsed[day.key]) {
            fallback[day.key] = {
                ...fallback[day.key],
                ...parsed[day.key]
            };
        }
    });
    return fallback;
}

function saveWeeklySchedule(schedule) {
    try {
        localStorage.setItem(WEEKLY_STORAGE_KEY, JSON.stringify(schedule));
    } catch (error) {
        console.warn('Não foi possível salvar a escala semanal localmente:', error);
    }
}

function dateToLocalObject(dateString) {
    const [y, m, d] = String(dateString).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
}

function formatLocalDate(date) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
    ].join('-');
}

function getScheduleForDate(dateString) {
    const schedule = getWeeklySchedule();
    const date = dateToLocalObject(dateString);
    const key = String(date.getDay());
    return {
        date: dateString,
        dayKey: key,
        ...(schedule[key] || {
            enabled: true,
            start_time: settings.start_time?.slice(0, 5) || '08:00',
            end_time: settings.end_time?.slice(0, 5) || '18:00'
        })
    };
}

function isWithinWorkingHours(dateString, now = new Date()) {
    const schedule = getScheduleForDate(dateString);
    if (!schedule.enabled) return false;
    const start = timeToMinutes(schedule.start_time);
    const end = timeToMinutes(schedule.end_time);
    const current = now.getHours() * 60 + now.getMinutes();
    return current >= start && current < end;
}

function nextWorkingDate(fromDateString) {
    const schedule = getWeeklySchedule();
    let date = dateToLocalObject(fromDateString);
    for (let i = 0; i < 8; i++) {
        date.setDate(date.getDate() + (i === 0 ? 1 : 1));
        const key = String(date.getDay());
        if (schedule[key]?.enabled !== false) {
            return formatLocalDate(date);
        }
    }
    return formatLocalDate(dateToLocalObject(fromDateString));
}

function getInitialBookingDate() {
    const currentDate = today();
    const schedule = getScheduleForDate(currentDate);
    if (schedule.enabled !== false && !isWithinWorkingHours(currentDate)) {
        const now = new Date();
        const end = timeToMinutes(schedule.end_time);
        const current = now.getHours() * 60 + now.getMinutes();
        const start = timeToMinutes(schedule.start_time);
        if (current < start) return currentDate;
        if (current >= end) return nextWorkingDate(currentDate);
    }
    if (schedule.enabled !== false) return currentDate;
    return nextWorkingDate(currentDate);
}

function ensureServiceDurationOptions() {
    const select = $('#serviceDuration');
    if (!select) return;
    const existing = new Set([...select.options].map(o => String(o.value)));
    [30, 60, 90, 120].forEach(value => {
        if (!existing.has(String(value))) {
            const option = document.createElement('option');
            option.value = String(value);
            option.textContent = `${value} minutos`;
            select.appendChild(option);
        }
    });
}

function ensureAdminBookingButtons() {
    if (!isAdmin()) return;

    const dashboardPage = $('#page-dashboard');
    if (dashboardPage && !dashboardPage.querySelector('[data-admin-new-booking]')) {
        const header = dashboardPage.querySelector('.page-header');
        if (header) {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;';
            wrap.innerHTML = '<button type="button" class="btn gold" data-admin-new-booking>+ Novo agendamento</button>';
            header.appendChild(wrap);
        }
    }

    $$('[data-page="consultar"]').forEach(el => {
        el.style.display = 'none';
    });
}

function ensureFinanceControls() {
    if (!isAdmin()) return;
    const list = $('#financeList');
    if (!list || $('#financePeriodControls')) return;
    const wrap = document.createElement('div');
    wrap.id = 'financePeriodControls';
    wrap.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 16px;';
    wrap.innerHTML = `
        <label style="display:flex;align-items:center;gap:6px;">
            <strong>Período:</strong>
            <select id="financePeriodFilter">
                <option value="month">Mês</option>
                <option value="week">Semana</option>
                <option value="day">Dia</option>
            </select>
        </label>
        <button type="button" id="financeRefreshFilter">Atualizar</button>
        <button type="button" class="btn gold" id="financeOpenAll">Ver todos os lançamentos</button>
    `;
    list.parentNode.insertBefore(wrap, list);
    $('#financePeriodFilter').onchange = loadFinance;
    $('#financeRefreshFilter').onclick = loadFinance;
    $('#financeOpenAll').onclick = abrirTodosLancamentosFinanceiros;
}

async function abrirTodosLancamentosFinanceiros() {
    if (!isAdmin()) return;

    const { data = [], error } = await sb
        .from('cash_entries')
        .select('*')
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Erro ao carregar todos os lançamentos:', error);
        toast(error.message || 'Não foi possível carregar os lançamentos.');
        return;
    }

    let modal = $('#financeAllModal');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'financeAllModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.68);display:flex;align-items:center;justify-content:center;padding:18px;';

    const rows = Array.isArray(data) ? data : [];
    modal.innerHTML = `
        <div style="width:min(1100px,100%);max-height:92vh;overflow:hidden;background:var(--card,#fff);color:inherit;border-radius:16px;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.35);display:flex;flex-direction:column;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px;">
                <div>
                    <h3 style="margin:0 0 4px;">Todos os lançamentos financeiros</h3>
                    <small class="muted">Registros automáticos e lançamentos inseridos manualmente.</small>
                </div>
                <button type="button" id="closeFinanceAll">✕</button>
            </div>
            <div style="overflow:auto;flex:1;">
                ${rows.length ? `
                <div style="display:grid;gap:8px;">
                    ${rows.map(x => `
                        <div class="list-row" style="gap:12px;align-items:center;">
                            <div style="min-width:0;flex:1;">
                                <b>${escapeHtml(x.description || 'Lançamento')}</b>
                                <small>${x.entry_date ? new Date(x.entry_date + 'T12:00').toLocaleDateString('pt-BR') : '-'} • ${x.type === 'income' ? 'Entrada' : 'Saída'}${x.booking_id ? ' • Atendimento agendado' : ' • Manual'}</small>
                            </div>
                            <strong>${money(x.amount)}</strong>
                            <div style="display:flex;gap:6px;flex-wrap:wrap;">
                                <button type="button" data-finance-edit="${x.id}">Editar</button>
                                <button type="button" class="danger" data-finance-delete="${x.id}">Excluir</button>
                            </div>
                        </div>
                    `).join('')}
                </div>` : '<p class="muted">Nenhum lançamento cadastrado.</p>'}
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    $('#closeFinanceAll')?.addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });

    modal.querySelectorAll('[data-finance-edit]').forEach(btn => {
        btn.addEventListener('click', async () => {
            await editarLancamentoFinanceiro(btn.dataset.financeEdit);
        });
    });

    modal.querySelectorAll('[data-finance-delete]').forEach(btn => {
        btn.addEventListener('click', async () => {
            await excluirLancamentoFinanceiro(btn.dataset.financeDelete);
        });
    });
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function editarLancamentoFinanceiro(id) {
    if (!isAdmin()) return;

    const { data: item, error } = await sb
        .from('cash_entries')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (error || !item) {
        toast(error?.message || 'Lançamento não encontrado.');
        return;
    }

    const modal = document.createElement('div');
    modal.id = 'editFinanceModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,.68);display:flex;align-items:center;justify-content:center;padding:18px;';
    modal.innerHTML = `
        <div style="width:min(500px,100%);background:var(--card,#fff);color:inherit;border-radius:16px;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.35);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
                <h3 style="margin:0;">Editar lançamento</h3>
                <button type="button" id="closeEditFinance">✕</button>
            </div>
            <form id="editFinanceForm">
                <label>Tipo</label>
                <select id="editFinanceType" style="width:100%;box-sizing:border-box;margin:6px 0 14px;">
                    <option value="income" ${item.type === 'income' ? 'selected' : ''}>Entrada</option>
                    <option value="expense" ${item.type === 'expense' ? 'selected' : ''}>Saída</option>
                </select>
                <label>Descrição</label>
                <input id="editFinanceDesc" type="text" value="${escapeHtml(item.description || '')}" required style="width:100%;box-sizing:border-box;margin:6px 0 14px;">
                <label>Valor</label>
                <input id="editFinanceAmount" type="number" min="0" step="0.01" value="${Number(item.amount || 0).toFixed(2)}" required style="width:100%;box-sizing:border-box;margin:6px 0 14px;">
                <label>Data</label>
                <input id="editFinanceDate" type="date" value="${item.entry_date || today()}" required style="width:100%;box-sizing:border-box;margin:6px 0 20px;">
                <div style="display:flex;justify-content:flex-end;gap:8px;">
                    <button type="button" id="cancelEditFinance">Cancelar</button>
                    <button type="submit" class="btn gold">Salvar alterações</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    $('#closeEditFinance')?.addEventListener('click', close);
    $('#cancelEditFinance')?.addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });

    $('#editFinanceForm')?.addEventListener('submit', async e => {
        e.preventDefault();
        const type = $('#editFinanceType').value;
        const description = $('#editFinanceDesc').value.trim();
        const amount = Number($('#editFinanceAmount').value);
        const entry_date = $('#editFinanceDate').value;
        if (!['income', 'expense'].includes(type) || !description || !Number.isFinite(amount) || amount < 0 || !entry_date) {
            toast('Informe tipo, descrição, valor e data válidos.');
            return;
        }
        const { error: saveError } = await sb
            .from('cash_entries')
            .update({ type, description, amount, entry_date })
            .eq('id', id);
        if (saveError) {
            toast(saveError.message || 'Não foi possível editar o lançamento.');
            return;
        }
        close();
        toast('Lançamento atualizado.');
        await loadFinance();
        await abrirTodosLancamentosFinanceiros();
    });
}

async function excluirLancamentoFinanceiro(id) {
    if (!isAdmin()) return;

    const { data: item, error: findError } = await sb
        .from('cash_entries')
        .select('id, description, booking_id')
        .eq('id', id)
        .maybeSingle();
    if (findError || !item) {
        toast(findError?.message || 'Lançamento não encontrado.');
        return;
    }

    const confirmText = item.booking_id
        ? 'Este lançamento foi gerado por um atendimento agendado. Excluir o lançamento financeiro não exclui o agendamento. Deseja continuar?'
        : 'Excluir este lançamento financeiro?';
    if (!confirm(confirmText)) return;

    const { error } = await sb.from('cash_entries').delete().eq('id', id);
    if (error) {
        toast(error.message || 'Não foi possível excluir o lançamento.');
        return;
    }

    toast('Lançamento excluído.');
    await loadFinance();
    await abrirTodosLancamentosFinanceiros();
}

function ensureFinanceChart() {
    if (!$('#financeChart')) {
        const list = $('#financeList');
        if (!list) return;
        const chart = document.createElement('div');
        chart.id = 'financeChart';
        chart.style.cssText = 'margin:18px 0;padding:16px;border:1px solid rgba(128,128,128,.25);border-radius:14px;';
        list.parentNode.insertBefore(chart, list);
    }
}



if (!document.getElementById('dnh-v14-styles')) {
    const style = document.createElement('style');
    style.id = 'dnh-v14-styles';
    style.textContent = `
        .time-option.selected { background:#22c55e !important; color:#fff !important; border-color:#22c55e !important; transform:scale(1.02); }
        .time-option:hover { transform:translateY(-1px); }
        #financeChart { overflow-x:auto; }
    `;
    document.head.appendChild(style);
}

/* =========================================================
   APLICAR PERMISSÕES NA INTERFACE
   ========================================================= */

function aplicarPermissoesUI() {

    const admin = isAdmin();

    $$('.admin-only').forEach(el => {
        el.style.display = admin ? '' : 'none';
    });

    ADMIN_PAGES.forEach(page => {
        const pageElement = $('#page-' + page);
        if (!pageElement) return;
        if (!admin) pageElement.classList.remove('active');
    });

    $$('[data-page]').forEach(button => {
        const page = button.dataset.page;
        if (ADMIN_PAGES.includes(page)) {
            button.style.display = admin ? '' : 'none';
        }
        if (admin && page === 'consultar') {
            button.style.display = 'none';
        }
    });

    if (admin) {
        $('#page-consultar')?.classList.remove('active');
    }

    ensureServiceDurationOptions();
    ensureAdminBookingButtons();
}


/* =========================================================
   AUTENTICAÇÃO / PERFIL
   ========================================================= */

async function user() {

    const {
        data: {
            user: authUser
        }
    } = await sb.auth.getUser();

    if (!authUser) {

        profile = null;

        return null;
    }


    const {
        data,
        error
    } = await sb
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();


    if (error) {

        console.error(
            'Erro ao carregar perfil:',
            error
        );

        profile = null;

        return null;
    }


    profile = data;


    console.log(
        'PERFIL LOGADO:',
        profile
    );

    console.log(
        'ROLE:',
        profile?.role
    );


    return profile;
}


/* =========================================================
   NAVEGAÇÃO
   ========================================================= */

function go(page) {

    /* -------------------------
       VERIFICAR LOGIN
       ------------------------- */

    if (!profile) {

        console.warn(
            'Tentativa de navegação sem perfil.'
        );

        return;
    }


    /* -------------------------
       VERIFICAR PERMISSÃO
       ------------------------- */

    if (!canAccessPage(page)) {

        toast(
            'Acesso restrito ao administrador.'
        );


        /* Cliente sempre retorna para Agenda */

        if (isClient()) {

            page = 'agenda';

        } else {

            return;
        }
    }


    /* -------------------------
       ESCONDER TODAS AS PÁGINAS
       ------------------------- */

    $$('.page').forEach(p => {

        p.classList.remove('active');

    });


    /* -------------------------
       MOSTRAR PÁGINA
       ------------------------- */

    const target =
        $('#page-' + page);


    if (target) {

        target.classList.add(
            'active'
        );

    } else {

        console.warn(
            'Página não encontrada:',
            page
        );

        return;
    }


    /* -------------------------
       ATUALIZAR MENU
       ------------------------- */

    $$('[data-page]').forEach(btn => {

        btn.classList.toggle(
            'active',
            btn.dataset.page === page &&
            btn.style.display !== 'none'
        );

    });


    /* -------------------------
       CARREGAR CONTEÚDO
       ------------------------- */

    if (page === 'dashboard') {

        if (isAdmin()) {
            dashboard();
        }

    }


    if (page === 'agenda') {

        agenda();

    }


    if (page === 'consultar') {

        consultarAgenda();

    }


    if (page === 'services') {

        if (isAdmin()) {
            loadServices();
        }

    }


    if (page === 'clients') {

        if (isAdmin()) {
            loadClients();
        }

    }


    if (page === 'stock') {

        if (isAdmin()) {
            loadStock();
        }

    }


    if (page === 'finance') {

        if (isAdmin()) {
            loadFinance();
        }

    }


    if (page === 'team') {

        if (isAdmin()) {
            loadTeam();
        }

    }


    if (page === 'settings') {

        if (isAdmin()) {
            loadSettings();
        }

    }
}


/* =========================================================
   CONFIGURAÇÕES
   ========================================================= */

async function loadSettings() {
    const { data, error } = await sb
        .from('settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

    if (error) {
        console.error('Erro ao carregar configurações:', error);
        return;
    }

    if (data) {
        settings = { ...settings, ...data };
    }

    if ($('#setName')) $('#setName').value = settings.name || 'DNH BARBEARIA';
    if ($('#setWhatsapp')) $('#setWhatsapp').value = settings.whatsapp || '';
    if ($('#setStart')) $('#setStart').value = settings.start_time?.slice(0, 5) || '08:00';
    if ($('#setEnd')) $('#setEnd').value = settings.end_time?.slice(0, 5) || '18:00';
    if ($('#setInterval')) $('#setInterval').value = settings.slot_interval || 30;
    if ($('#setLogoUrl')) $('#setLogoUrl').value = settings.logo_url || 'dnh-logo.png';
    if ($('#shareUrl')) $('#shareUrl').textContent = location.href.split('?')[0];
    if ($('#brandName')) $('#brandName').textContent = settings.name || 'DNH BARBEARIA';
    if ($('#brandLogo')) $('#brandLogo').src = settings.logo_url || 'dnh-logo.png';

    renderWeeklyScheduleSettings();
}

function renderWeeklyScheduleSettings() {
    if (!isAdmin() || !$('#saveSettings')) return;
    let box = $('#weeklyScheduleSettings');
    if (!box) {
        box = document.createElement('div');
        box.id = 'weeklyScheduleSettings';
        box.style.cssText = 'margin:18px 0;padding:16px;border:1px solid rgba(128,128,128,.25);border-radius:14px;';
        const save = $('#saveSettings');
        save.parentNode.insertBefore(box, save);
    }
    const schedule = getWeeklySchedule();
    box.innerHTML = `
        <h3 style="margin:0 0 12px;">Horários por dia da semana</h3>
        <p class="muted" style="margin:0 0 14px;">Marque os dias sem expediente e defina horários diferentes para cada dia.</p>
        <div style="display:grid;gap:10px;">
            ${WEEK_DAYS.map(day => {
                const row = schedule[day.key] || {};
                return `
                    <div style="display:grid;grid-template-columns:minmax(140px,1fr) auto minmax(110px,150px) minmax(110px,150px);gap:8px;align-items:center;">
                        <strong>${day.label}</strong>
                        <label style="display:flex;gap:6px;align-items:center;"><input type="checkbox" data-week-enabled="${day.key}" ${row.enabled !== false ? 'checked' : ''}> Expediente</label>
                        <input type="time" data-week-start="${day.key}" value="${row.start_time || settings.start_time?.slice(0,5) || '08:00'}">
                        <input type="time" data-week-end="${day.key}" value="${row.end_time || settings.end_time?.slice(0,5) || '18:00'}">
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function collectWeeklySchedule() {
    const schedule = {};
    WEEK_DAYS.forEach(day => {
        schedule[day.key] = {
            enabled: !!$(`[data-week-enabled="${day.key}"]`)?.checked,
            start_time: $(`[data-week-start="${day.key}"]`)?.value || '08:00',
            end_time: $(`[data-week-end="${day.key}"]`)?.value || '18:00'
        };
    });
    return schedule;
}


/* =========================================================
   SERVIÇOS
   ========================================================= */

async function loadServices() {

    const {
        data = [],
        error
    } = await sb
        .from('services')
        .select('*')
        .order('name');


    if (error) {

        console.error(
            'Erro ao carregar serviços:',
            error
        );


        if ($('#serviceList')) {

            $('#serviceList').innerHTML =
                '<p class="muted">Não foi possível carregar os serviços.</p>';

        }

        return;
    }


    services = data || [];


    /* -------------------------
       LISTA ADMIN
       ------------------------- */

    if ($('#serviceList')) {

        if (!services.length) {

            $('#serviceList').innerHTML =
                '<p class="muted">Nenhum serviço cadastrado.</p>';

        } else {

            $('#serviceList').innerHTML =
                services.map(service => {

                    return `
                        <div class="list-row">

                            <div>

                                <b>
                                    ${service.name}
                                </b>

                                <small>
                                    ${money(service.price)}
                                    •
                                    ${Number(service.duration) || 30} min
                                </small>

                            </div>

                            <div
                                style="
                                    display:flex;
                                    gap:6px;
                                    align-items:center;
                                    flex-wrap:wrap;
                                "
                            >

                                <span
                                    class="${
                                        service.active
                                            ? 'ok'
                                            : 'cancel'
                                    }"
                                >
                                    ${
                                        service.active
                                            ? 'Ativo'
                                            : 'Inativo'
                                    }
                                </span>

                                <button
                                    type="button"
                                    data-service-edit="${service.id}"
                                >
                                    Editar
                                </button>

                                <button
                                    type="button"
                                    data-service-toggle="${service.id}"
                                >
                                    ${
                                        service.active
                                            ? 'Desativar'
                                            : 'Ativar'
                                    }
                                </button>

                                <button
                                    type="button"
                                    class="danger"
                                    data-service-delete="${service.id}"
                                >
                                    Excluir
                                </button>

                            </div>

                        </div>
                    `;

                }).join('');
        }
    }


    /* -------------------------
       SELECT DO CLIENTE
       ------------------------- */

    if ($('#clientService')) {

        const current =
            $('#clientService').value;


        const activeServices =
            services.filter(
                s => s.active !== false
            );


        $('#clientService').innerHTML = `

            <option value="">
                Selecione o serviço
            </option>

            ${activeServices.map(s => `

                <option value="${s.id}">

                    ${s.name}
                    -
                    ${money(s.price)}
                    -
                    ${Number(s.duration) || 30} min

                </option>

            `).join('')}

        `;


        if (
            current &&
            activeServices.some(
                s => s.id === current
            )
        ) {

            $('#clientService').value =
                current;

        }
    }
}


/* =========================================================
   EDITAR SERVIÇO
   ========================================================= */

async function editarServico(serviceId) {

    if (!isAdmin()) {
        toast('Acesso restrito ao administrador.');
        return;
    }

    const service =
        services.find(
            s => s.id === serviceId
        );

    if (!service) {
        toast('Serviço não encontrado.');
        return;
    }

    const oldModal = $('#editServiceModal');

    if (oldModal) {
        oldModal.remove();
    }

    const modal = document.createElement('div');

    modal.id = 'editServiceModal';

    modal.style.cssText = `
        position:fixed;
        inset:0;
        z-index:9999;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:20px;
        background:rgba(0,0,0,.65);
    `;

    modal.innerHTML = `

        <div
            style="
                width:min(100%,460px);
                background:var(--card,#fff);
                color:inherit;
                border-radius:16px;
                padding:22px;
                box-shadow:0 20px 60px rgba(0,0,0,.30);
            "
        >

            <div
                style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    gap:12px;
                    margin-bottom:18px;
                "
            >

                <h3 style="margin:0;">
                    Editar serviço
                </h3>

                <button
                    type="button"
                    id="closeEditService"
                    aria-label="Fechar"
                >
                    ✕
                </button>

            </div>

            <form id="editServiceForm">

                <label style="display:block;margin-bottom:6px;">
                    Nome do serviço
                </label>

                <input
                    type="text"
                    id="editServiceName"
                    value="${String(service.name || '')
                        .replace(/"/g, '&quot;')}"
                    required
                    style="
                        width:100%;
                        box-sizing:border-box;
                        margin-bottom:14px;
                    "
                >

                <label style="display:block;margin-bottom:6px;">
                    Preço (R$)
                </label>

                <input
                    type="text"
                    id="editServicePrice"
                    inputmode="decimal"
                    value="${String(service.price ?? 0)
                        .replace('.', ',')}"
                    required
                    style="
                        width:100%;
                        box-sizing:border-box;
                        margin-bottom:14px;
                    "
                >

                <label style="display:block;margin-bottom:6px;">
                    Tempo / duração (minutos)
                </label>

                <input
                    type="number"
                    id="editServiceDuration"
                    min="1"
                    step="1"
                    value="${Number(service.duration) || 30}"
                    required
                    style="
                        width:100%;
                        box-sizing:border-box;
                        margin-bottom:20px;
                    "
                >

                <div
                    style="
                        display:flex;
                        justify-content:flex-end;
                        gap:8px;
                        flex-wrap:wrap;
                    "
                >

                    <button
                        type="button"
                        id="cancelEditService"
                    >
                        Cancelar
                    </button>

                    <button
                        type="submit"
                    >
                        Salvar alterações
                    </button>

                </div>

            </form>

        </div>

    `;

    document.body.appendChild(modal);

    const closeModal = () => {
        modal.remove();
    };

    $('#closeEditService')?.addEventListener(
        'click',
        closeModal
    );

    $('#cancelEditService')?.addEventListener(
        'click',
        closeModal
    );

    modal.addEventListener(
        'click',
        e => {
            if (e.target === modal) {
                closeModal();
            }
        }
    );

    $('#editServiceForm')?.addEventListener(
        'submit',
        async e => {

            e.preventDefault();

            const name =
                $('#editServiceName')
                    ?.value
                    .trim();

            const priceText =
                $('#editServicePrice')
                    ?.value
                    .trim();

            const durationText =
                $('#editServiceDuration')
                    ?.value
                    .trim();

            const normalizedPrice =
                String(priceText)
                    .replace(/\s/g, '')
                    .trim();

            const cleanPrice =
                normalizedPrice.includes(',')
                    ? normalizedPrice
                        .replace(/\./g, '')
                        .replace(',', '.')
                    : normalizedPrice;

            const price =
                Number(cleanPrice);

            const duration =
                Number(durationText);

            if (
                !name ||
                !Number.isFinite(price) ||
                price < 0 ||
                !Number.isFinite(duration) ||
                duration <= 0
            ) {
                toast(
                    'Informe nome, preço e tempo válidos.'
                );
                return;
            }

            const saveButton =
                $('#editServiceForm button[type="submit"]');

            if (saveButton) {
                saveButton.disabled = true;
                saveButton.textContent = 'Salvando...';
            }

            const {
                error
            } = await sb
                .from('services')
                .update({
                    name,
                    price,
                    duration
                })
                .eq(
                    'id',
                    serviceId
                );

            if (error) {

                console.error(
                    'Erro ao editar serviço:',
                    error
                );

                if (saveButton) {
                    saveButton.disabled = false;
                    saveButton.textContent =
                        'Salvar alterações';
                }

                toast(
                    error.message ||
                    'Não foi possível editar o serviço.'
                );

                return;
            }

            service.name =
                name;

            service.price =
                price;

            service.duration =
                duration;

            closeModal();

            toast(
                'Serviço atualizado com sucesso.'
            );

            await loadServices();

            if (
                $('#clientService')?.value ===
                serviceId
            ) {
                await loadClientTimes();
            }

        }
    );

    $('#editServiceName')?.focus();
}


/* =========================================================
   PROFISSIONAIS
   ========================================================= */

async function loadProfessionals() {

    const {
        data = [],
        error
    } = await sb
        .from('professionals')
        .select('*')
        .eq('active', true)
        .order('name');


    if (error) {

        console.error(
            'Erro ao carregar profissionais:',
            error
        );

        professionals = [];

        return;
    }


    professionals = data || [];


    if ($('#clientProfessional')) {

        const current =
            $('#clientProfessional').value;


        $('#clientProfessional').innerHTML = `

            <option value="">
                Selecione o profissional
            </option>

            ${professionals.map(p => `

                <option value="${p.id}">
                    ${p.name}
                </option>

            `).join('')}

        `;


        if (
            current &&
            professionals.some(
                p => p.id === current
            )
        ) {

            $('#clientProfessional').value =
                current;

        }
    }


    if ($('#agendaProfessional')) {

        const current =
            $('#agendaProfessional').value;


        $('#agendaProfessional').innerHTML = `

            <option value="">
                Todos os profissionais
            </option>

            ${professionals.map(p => `

                <option value="${p.id}">
                    ${p.name}
                </option>

            `).join('')}

        `;


        if (
            current &&
            professionals.some(
                p => p.id === current
            )
        ) {

            $('#agendaProfessional').value =
                current;

        }
    }
}


/* =========================================================
   DASHBOARD
   ========================================================= */

async function dashboard() {

    if (!isAdmin()) {
        return;
    }


    await loadSettings();


    const month =
        today().slice(0, 7);


    const {
        data: bookingsData,
        error: bookingError
    } = await sb
        .from('bookings')
        .select(`
            id,
            booking_time,
            status,
            service_id,
            user_id
        `)
        .eq(
            'booking_date',
            today()
        )
        .order(
            'booking_time'
        );


    if (bookingError) {

        console.error(
            'Erro dashboard bookings:',
            bookingError
        );

    }


    const {
        count: clientCount,
        error: clientError
    } = await sb
        .from('profiles')
        .select('*', {
            count: 'exact',
            head: true
        })
        .eq(
            'role',
            'client'
        );


    if (clientError) {

        console.error(
            'Erro dashboard clientes:',
            clientError
        );

    }


    const {
        data: financeData,
        error: financeError
    } = await sb
        .from('cash_entries')
        .select('*')
        .gte(
            'entry_date',
            month + '-01'
        )
        .lte(
            'entry_date',
            month + '-31'
        );


    if (financeError) {

        console.error(
            'Erro dashboard financeiro:',
            financeError
        );

    }


    const {
        data: clientsData,
        error: birthdayError
    } = await sb
        .from('profiles')
        .select(
            'id,name,birth,phone'
        )
        .eq(
            'role',
            'client'
        );

    if (birthdayError) {
        console.error(
            'Erro ao carregar aniversariantes:',
            birthdayError
        );

        if ($('#birthdayList')) {
            $('#birthdayList').innerHTML =
                '<p class="muted">Não foi possível carregar os aniversariantes.</p>';
        }
    }


    const bookings = Array.isArray(bookingsData) ? bookingsData : [];
    const finance = Array.isArray(financeData) ? financeData : [];
    const clients = Array.isArray(clientsData) ? clientsData : [];

    if ($('#kToday')) {

        $('#kToday').textContent =
            bookings.filter(
                x =>
                    x.status ===
                    'confirmed'
            ).length;

    }


    if ($('#kClients')) {

        $('#kClients').textContent =
            clientCount || 0;

    }


    if ($('#kRevenue')) {

        const revenue =
            finance
                .filter(
                    x =>
                        x.type ===
                        'income'
                )
                .reduce(
                    (total, x) =>
                        total +
                        Number(
                            x.amount || 0
                        ),
                    0
                );


        $('#kRevenue').textContent =
            money(revenue);

    }


    /* ---------------------------------------------------------
       ANIVERSARIANTES DO MÊS
       Normaliza a data para YYYY-MM-DD antes do filtro.
       Isso evita problemas caso o Supabase devolva a data
       como string em outro formato/representação.
       --------------------------------------------------------- */

    const currentMonth =
        today().slice(5, 7);

    const birthdays =
        (Array.isArray(clients) ? clients : [])
            .filter(client => {

                if (!client?.birth) {
                    return false;
                }

                const birth =
                    String(client.birth)
                        .trim()
                        .slice(0, 10);

                return (
                    /^\d{4}-\d{2}-\d{2}$/.test(birth) &&
                    birth.slice(5, 7) === currentMonth
                );
            })
            .sort((a, b) => {

                const dayA = Number(
                    String(a.birth).slice(8, 10)
                );

                const dayB = Number(
                    String(b.birth).slice(8, 10)
                );

                return dayA - dayB;
            });

    console.log(
        'ANIVERSARIANTES DO MÊS:',
        birthdays
    );


    if ($('#kBirthdays')) {

        $('#kBirthdays').textContent =
            birthdays.length;

    }


    if ($('#todayList')) {

        $('#todayList').innerHTML =
            bookings.length

                ? bookings.map(b => `

                    <div class="agenda-row">

                        <div>

                            <b>
                                ${
                                    b.booking_time
                                        ?.slice(0, 5) ||
                                    ''
                                }
                            </b>

                            <small>
                                Agendamento
                            </small>

                        </div>

                        <span
                            class="${
                                b.status ===
                                'cancelled'
                                    ? 'cancel'
                                    : 'ok'
                            }"
                        >
                            ${
                                b.status ===
                                'cancelled'
                                    ? 'Cancelado'
                                    : b.status ===
                                      'completed'
                                        ? 'Concluído'
                                        : 'Confirmado'
                            }
                        </span>

                    </div>

                `).join('')

                : '<p class="muted">Nenhum agendamento hoje.</p>';
    }


    if ($('#birthdayList')) {

        $('#birthdayList').innerHTML =
            birthdays
                .slice(0, 6)
                .map(c => {

                    const birth =
                        String(c.birth)
                            .trim()
                            .slice(0, 10);

                    const day =
                        birth.slice(8, 10);

                    const birthMonth =
                        birth.slice(5, 7);

                    const isToday =
                        birth.slice(5, 10) ===
                        today().slice(5, 10);

                    return `

                    <div class="list-row">

                        <div>

                            <b>
                                🎂
                                ${c.name || 'Cliente'}
                            </b>

                            <small>
                                ${day}/${birthMonth}
                                •
                                ${c.phone || ''}
                            </small>

                        </div>

                        <span>
                            ${isToday ? 'Hoje' : ''}
                        </span>

                    </div>

                `;
                })
                .join('')

            ||
            '<p class="muted">Nenhum aniversariante este mês.</p>';
    }
}


/* =========================================================
   HORÁRIOS
   ========================================================= */

function slots(schedule = null) {
    const activeSchedule = schedule || {
        start_time: settings.start_time,
        end_time: settings.end_time
    };
    const result = [];
    const [hour, minute] = String(activeSchedule.start_time || '08:00').slice(0, 5).split(':').map(Number);
    const [endHour, endMinute] = String(activeSchedule.end_time || '18:00').slice(0, 5).split(':').map(Number);
    let current = hour * 60 + minute;
    const end = endHour * 60 + endMinute;
    const interval = Number(settings.slot_interval) || 30;
    while (current < end) {
        result.push(String(Math.floor(current / 60)).padStart(2, '0') + ':' + String(current % 60).padStart(2, '0'));
        current += interval;
    }
    return result;
}


function timeToMinutes(time) {

    const [
        h,
        m
    ] =
        time
            .split(':')
            .map(Number);


    return h * 60 + m;
}


/* =========================================================
   AGENDA ADMIN
   ========================================================= */

async function agenda() {

    /* =========================================================
       CONTROLE POR PERFIL
       ========================================================= */

    if (!profile) {
        return;
    }

    /* ADMINISTRADOR — CALENDÁRIO / AGENDA */

    if (isAdmin()) {

        await loadSettings();
        await loadProfessionals();

        const page = $('#page-agenda');
        const clientAgenda = $('#clientAgenda');
        const adminAgenda = $('#adminAgenda');

        if (!page || !adminAgenda) {
            return;
        }

        if (clientAgenda) {
            clientAgenda.classList.add('hidden');
        }

        adminAgenda.classList.remove('hidden');


        adminAgenda.innerHTML = `

            <div class="page-header">

                <div>

                    <h1>Agenda</h1>

                    <p class="muted">
                        Todos os agendamentos da barbearia organizados por dia e horário.
                    </p>

                </div>

                <button type="button" class="btn gold" data-admin-new-booking>+ Novo agendamento</button>

            </div>


            <!-- FILTROS -->

            <div
                style="
                    display:grid;
                    grid-template-columns:
                        repeat(
                            auto-fit,
                            minmax(190px, 1fr)
                        );
                    gap:12px;
                    margin:20px 0;
                "
            >

                <div>

                    <label
                        for="adminAgendaDate"
                        style="
                            display:block;
                            margin-bottom:6px;
                            font-weight:600;
                        "
                    >
                        Data
                    </label>

                    <input
                        type="date"
                        id="adminAgendaDate"
                        style="
                            width:100%;
                            box-sizing:border-box;
                        "
                    >

                </div>


                <div>

                    <label
                        for="adminAgendaProfessional"
                        style="
                            display:block;
                            margin-bottom:6px;
                            font-weight:600;
                        "
                    >
                        Profissional
                    </label>

                    <select
                        id="adminAgendaProfessional"
                        style="
                            width:100%;
                            box-sizing:border-box;
                        "
                    >

                        <option value="">
                            Todos os profissionais
                        </option>

                    </select>

                </div>


                <div
                    style="
                        display:flex;
                        align-items:flex-end;
                    "
                >

                    <button
                        type="button"
                        id="adminAgendaClear"
                        style="width:100%;"
                    >
                        Mostrar todos
                    </button>

                </div>

            </div>


            <!-- RESUMO -->

            <div
                id="adminAgendaSummary"
                style="
                    margin:0 0 16px 0;
                "
            ></div>


            <!-- CALENDÁRIO -->

            <div
                id="adminAgendaCalendar"
                style="
                    display:grid;
                    gap:18px;
                "
            >

                <p class="muted">
                    Carregando agenda...
                </p>

            </div>

        `;


        const professionalSelect =
            $('#adminAgendaProfessional');


        if (professionalSelect) {

            professionals.forEach(
                professional => {

                    const option =
                        document.createElement(
                            'option'
                        );

                    option.value =
                        professional.id;

                    option.textContent =
                        professional.name;

                    professionalSelect.appendChild(
                        option
                    );

                }
            );

        }


        const dateInput =
            $('#adminAgendaDate');


        const professionalInput =
            $('#adminAgendaProfessional');


        const clearButton =
            $('#adminAgendaClear');

        if (dateInput) {
            dateInput.value = today();
        }


        /* =====================================================
           CARREGAR CALENDÁRIO
           ===================================================== */

        async function carregarAgendaAdmin() {

            const calendar =
                $('#adminAgendaCalendar');

            const summary =
                $('#adminAgendaSummary');


            if (!calendar) {
                return;
            }


            calendar.innerHTML = `
                <p class="muted">
                    Carregando agenda...
                </p>
            `;


            let query =
                sb
                    .from('bookings')
                    .select(`
                        id,
                        booking_date,
                        booking_time,
                        status,
                        professional_id,
                        service_id,
                        user_id
                    `)
                    .order(
                        'booking_date',
                        {
                            ascending: true
                        }
                    )
                    .order(
                        'booking_time',
                        {
                            ascending: true
                        }
                    );


            const filterDate =
                dateInput?.value || '';


            const filterProfessional =
                professionalInput?.value || '';


            if (filterDate) {

                query =
                    query.eq(
                        'booking_date',
                        filterDate
                    );

            }


            if (filterProfessional) {

                query =
                    query.eq(
                        'professional_id',
                        filterProfessional
                    );

            }


            const {
                data: bookings = [],
                error
            } = await query;


            if (error) {

                console.error(
                    'Erro ao carregar agenda do administrador:',
                    error
                );


                calendar.innerHTML = `

                    <div
                        style="
                            padding:20px;
                            border:1px solid rgba(128,128,128,.25);
                            border-radius:14px;
                        "
                    >

                        <strong>
                            Não foi possível carregar a agenda.
                        </strong>

                        <small
                            class="muted"
                            style="display:block;margin-top:6px;"
                        >
                            ${error.message || ''}
                        </small>

                    </div>

                `;

                if (summary) {
                    summary.textContent = '';
                }

                return;
            }


            if (summary) {

                summary.innerHTML = `

                    <div
                        style="
                            display:flex;
                            gap:8px;
                            flex-wrap:wrap;
                            align-items:center;
                        "
                    >

                        <strong>
                            ${bookings.length}
                            agendamento(s)
                        </strong>

                        <span class="muted">
                            ${
                                filterDate
                                    ? 'na data selecionada'
                                    : 'em todos os períodos'
                            }
                        </span>

                    </div>

                `;

            }


            if (!bookings.length) {

                calendar.innerHTML = `

                    <div
                        style="
                            padding:28px 20px;
                            text-align:center;
                            border:1px dashed rgba(128,128,128,.35);
                            border-radius:14px;
                        "
                    >

                        <strong>
                            Nenhum agendamento encontrado.
                        </strong>

                        <p
                            class="muted"
                            style="margin:8px 0 0;"
                        >
                            Tente outra data ou profissional.
                        </p>

                    </div>

                `;

                return;
            }


            /* =================================================
               BUSCAR DADOS RELACIONADOS
               ================================================= */

            const serviceIds =
                [
                    ...new Set(
                        bookings
                            .map(
                                booking =>
                                    booking.service_id
                            )
                            .filter(Boolean)
                    )
                ];


            const userIds =
                [
                    ...new Set(
                        bookings
                            .map(
                                booking =>
                                    booking.user_id
                            )
                            .filter(Boolean)
                    )
                ];


            const professionalIds =
                [
                    ...new Set(
                        bookings
                            .map(
                                booking =>
                                    booking.professional_id
                            )
                            .filter(Boolean)
                    )
                ];


            let serviceMap =
                new Map();


            let profileMap =
                new Map();


            let professionalMap =
                new Map();


            if (serviceIds.length) {

                const {
                    data: serviceData = []
                } =
                    await sb
                        .from('services')
                        .select(
                            'id,name,duration,price'
                        )
                        .in(
                            'id',
                            serviceIds
                        );


                serviceMap =
                    new Map(
                        serviceData.map(
                            service => [
                                service.id,
                                service
                            ]
                        )
                    );

            }


            if (userIds.length) {

                const {
                    data: profileData = []
                } =
                    await sb
                        .from('profiles')
                        .select(
                            'id,name,phone,email'
                        )
                        .in(
                            'id',
                            userIds
                        );


                profileMap =
                    new Map(
                        profileData.map(
                            profile => [
                                profile.id,
                                profile
                            ]
                        )
                    );

            }


            if (professionalIds.length) {

                const {
                    data: professionalData = []
                } =
                    await sb
                        .from('professionals')
                        .select(
                            'id,name'
                        )
                        .in(
                            'id',
                            professionalIds
                        );


                professionalMap =
                    new Map(
                        professionalData.map(
                            professional => [
                                professional.id,
                                professional
                            ]
                        )
                    );

            }


            /* =================================================
               AGRUPAR POR DATA
               ================================================= */

            const groups =
                new Map();


            bookings.forEach(
                booking => {

                    const date =
                        booking.booking_date ||
                        'sem-data';


                    if (!groups.has(date)) {

                        groups.set(
                            date,
                            []
                        );

                    }


                    groups
                        .get(date)
                        .push(booking);

                }
            );


            /* =================================================
               STATUS
               ================================================= */

            function statusInfo(status) {

                switch (status) {

                    case 'completed':

                        return {
                            text:
                                'Concluído',
                            className:
                                'ok'
                        };


                    case 'cancelled':

                        return {
                            text:
                                'Cancelado',
                            className:
                                'cancel'
                        };


                    case 'in_progress':

                        return {
                            text:
                                'Em atendimento',
                            className:
                                'progress'
                        };


                    default:

                        return {
                            text:
                                'Confirmado',
                            className:
                                'ok'
                        };

                }

            }


            /* =================================================
               DATA
               ================================================= */

            function formatDate(date) {

                if (!date) {
                    return '-';
                }


                const [
                    year,
                    month,
                    day
                ] =
                    date.split('-');


                return (
                    day +
                    '/' +
                    month +
                    '/' +
                    year
                );

            }


            function dayName(date) {

                if (!date) {
                    return '';
                }


                const parts =
                    date
                        .split('-')
                        .map(Number);


                const value =
                    new Date(
                        parts[0],
                        parts[1] - 1,
                        parts[2]
                    );


                return value.toLocaleDateString(
                    'pt-BR',
                    {
                        weekday:
                            'long'
                    }
                );

            }


            /* =================================================
               MONTAR CALENDÁRIO
               ================================================= */

            calendar.innerHTML =
                Array.from(
                    groups.entries()
                )
                .map(
                    ([date, dayBookings]) => {

                        dayBookings.sort(
                            (a, b) =>
                                String(
                                    a.booking_time || ''
                                ).localeCompare(
                                    String(
                                        b.booking_time || ''
                                    )
                                )
                        );


                        const cards =
                            dayBookings
                                .map(
                                    booking => {

                                        const service =
                                            serviceMap.get(
                                                booking.service_id
                                            );


                                        const client =
                                            profileMap.get(
                                                booking.user_id
                                            );


                                        const professional =
                                            professionalMap.get(
                                                booking.professional_id
                                            );


                                        const status =
                                            statusInfo(
                                                booking.status
                                            );


                                        const clientName =
                                            client?.name ||
                                            'Cliente';


                                        const phone =
                                            client?.phone ||
                                            '';


                                        const serviceName =
                                            service?.name ||
                                            'Serviço';


                                        const professionalName =
                                            professional?.name ||
                                            'Não informado';


                                        const duration =
                                            Number(
                                                service?.duration
                                            ) || 30;


                                        const price =
                                            money(
                                                service?.price
                                            );


                                        const time =
                                            booking.booking_time
                                                ?.slice(
                                                    0,
                                                    5
                                                ) ||
                                            '--:--';


                                        const cancelled =
                                            booking.status ===
                                            'cancelled';


                                        return `

                                            <div
                                                style="
                                                    display:grid;
                                                    grid-template-columns:
                                                        82px
                                                        1fr;
                                                    gap:14px;
                                                    padding:14px;
                                                    border-top:1px solid rgba(128,128,128,.18);
                                                "
                                            >

                                                <!-- HORÁRIO -->

                                                <div
                                                    style="
                                                        font-size:18px;
                                                        font-weight:700;
                                                        padding-top:2px;
                                                    "
                                                >
                                                    ${time}

                                                    <small
                                                        class="muted"
                                                        style="
                                                            display:block;
                                                            font-size:11px;
                                                            font-weight:400;
                                                            margin-top:3px;
                                                        "
                                                    >
                                                        ${duration} min
                                                    </small>

                                                </div>


                                                <!-- AGENDAMENTO -->

                                                <div>

                                                    <div
                                                        style="
                                                            display:flex;
                                                            justify-content:space-between;
                                                            align-items:flex-start;
                                                            gap:10px;
                                                            flex-wrap:wrap;
                                                        "
                                                    >

                                                        <div>

                                                            <strong
                                                                style="
                                                                    font-size:16px;
                                                                "
                                                            >
                                                                ${clientName}
                                                            </strong>

                                                            ${
                                                                phone
                                                                    ? `
                                                                        <small
                                                                            class="muted"
                                                                            style="
                                                                                display:block;
                                                                                margin-top:2px;
                                                                            "
                                                                        >
                                                                            📱 ${phone}
                                                                        </small>
                                                                    `
                                                                    : ''
                                                            }

                                                        </div>


                                                        <span
                                                            class="${status.className}"
                                                        >
                                                            ${status.text}
                                                        </span>

                                                    </div>


                                                    <div
                                                        style="
                                                            display:flex;
                                                            gap:14px;
                                                            flex-wrap:wrap;
                                                            margin-top:9px;
                                                        "
                                                    >

                                                        <span>
                                                            ✂️
                                                            ${serviceName}
                                                        </span>

                                                        <span class="muted">
                                                            👤
                                                            ${professionalName}
                                                        </span>

                                                        <span class="muted">
                                                            💰
                                                            ${price}
                                                        </span>

                                                    </div>


                                                    ${
                                                        !cancelled
                                                            ? `

                                                                <div
                                                                    style="
                                                                        display:flex;
                                                                        gap:7px;
                                                                        flex-wrap:wrap;
                                                                        margin-top:11px;
                                                                    "
                                                                >

                                                                    ${
                                                                        booking.status !==
                                                                            'completed'
                                                                            ? `

                                                                                <button
                                                                                    type="button"
                                                                                    data-status-booking="${booking.id}"
                                                                                    data-status="completed"
                                                                                >
                                                                                    Concluir
                                                                                </button>

                                                                            `
                                                                            : ''
                                                                    }


                                                                    <button
                                                                        type="button"
                                                                        class="danger"
                                                                        data-cancel="${booking.id}"
                                                                    >
                                                                        Cancelar
                                                                    </button>


                                                                    ${
                                                                        phone
                                                                            ? `

                                                                                <button
                                                                                    type="button"
                                                                                    data-wa="${digits(phone)}"
                                                                                    data-msg="${encodeURIComponent(
                                                                                        'Olá ' +
                                                                                        clientName +
                                                                                        '! Seu agendamento na DNH Barbearia é dia ' +
                                                                                        formatDate(
                                                                                            booking.booking_date
                                                                                        ) +
                                                                                        ' às ' +
                                                                                        time +
                                                                                        '.'
                                                                                    )}"
                                                                                >
                                                                                    WhatsApp
                                                                                </button>

                                                                            `
                                                                            : ''
                                                                    }

                                                                </div>

                                                            `
                                                            : ''
                                                    }

                                                </div>

                                            </div>

                                        `;

                                    }
                                )
                                .join('');


                        return `

                            <section
                                style="
                                    border:1px solid rgba(128,128,128,.22);
                                    border-radius:14px;
                                    overflow:hidden;
                                "
                            >

                                <!-- CABEÇALHO DO DIA -->

                                <div
                                    style="
                                        display:flex;
                                        justify-content:space-between;
                                        align-items:center;
                                        gap:12px;
                                        flex-wrap:wrap;
                                        padding:14px 16px;
                                        background:rgba(128,128,128,.08);
                                    "
                                >

                                    <div>

                                        <strong
                                            style="
                                                text-transform:capitalize;
                                                font-size:16px;
                                            "
                                        >
                                            ${dayName(date)}
                                        </strong>

                                        <span
                                            class="muted"
                                            style="margin-left:8px;"
                                        >
                                            ${formatDate(date)}
                                        </span>

                                    </div>


                                    <span class="muted">
                                        ${dayBookings.length}
                                        agendamento(s)
                                    </span>

                                </div>


                                <!-- HORÁRIOS -->

                                <div>
                                    ${cards}
                                </div>

                            </section>

                        `;

                    }
                )
                .join('');

        }


        /* =====================================================
           FILTROS
           ===================================================== */

        if (dateInput) {

            dateInput.addEventListener(
                'change',
                carregarAgendaAdmin
            );

        }


        if (professionalInput) {

            professionalInput.addEventListener(
                'change',
                carregarAgendaAdmin
            );

        }


        if (clearButton) {

            clearButton.addEventListener(
                'click',
                async () => {

                    if (dateInput) {
                        dateInput.value = '';
                    }


                    if (professionalInput) {
                        professionalInput.value = '';
                    }


                    await carregarAgendaAdmin();

                }
            );

        }


        await carregarAgendaAdmin();

        return;
    }


    /* =========================================================
       CLIENTE
       ========================================================= */

    const clientAgenda = $('#clientAgenda');
    const adminAgenda = $('#adminAgenda');

    if (clientAgenda) {
        clientAgenda.classList.remove('hidden');
    }

    if (adminAgenda) {
        adminAgenda.classList.add('hidden');
    }

    await loadSettings();
    await loadServices();
    await loadProfessionals();
    initClientBooking();
    await loadClientTimes();

    return;


    /* Código legado de agenda do cliente mantido abaixo para preservar a versão original. */

    await loadSettings();

    await loadProfessionals();


    const date =
        $('#agendaDate')?.value ||
        today();


    if ($('#agendaDate')) {

        $('#agendaDate').value =
            date;

    }


    const professionalId =
        $('#agendaProfessional')?.value ||
        '';


    let query =
        sb
            .from('bookings')
            .select(`
                id,
                booking_time,
                status,
                professional_id,
                service_id,
                user_id
            `)
            .eq(
                'booking_date',
                date
            )
            .order(
                'booking_time'
            );


    if (professionalId) {

        query =
            query.eq(
                'professional_id',
                professionalId
            );

    }


    const {
        data: bookings = [],
        error
    } = await query;


    if (error) {

        console.error(
            'Erro ao carregar agenda:',
            error
        );


        if ($('#agendaGrid')) {

            $('#agendaGrid').innerHTML =
                '<p class="muted">Não foi possível carregar a agenda.</p>';

        }

        return;
    }


    const serviceIds =
        [
            ...new Set(
                bookings
                    .map(
                        b =>
                            b.service_id
                    )
                    .filter(Boolean)
            )
        ];


    let serviceMap =
        new Map();


    if (serviceIds.length) {

        const {
            data: serviceData = []
        } = await sb
            .from('services')
            .select(
                'id,name,duration,price'
            )
            .in(
                'id',
                serviceIds
            );


        serviceMap =
            new Map(
                serviceData.map(
                    s => [
                        s.id,
                        s
                    ]
                )
            );
    }


    const userIds =
        [
            ...new Set(
                bookings
                    .map(
                        b =>
                            b.user_id
                    )
                    .filter(Boolean)
            )
        ];


    let profileMap =
        new Map();


    if (userIds.length) {

        const {
            data: profileData = []
        } = await sb
            .from('profiles')
            .select(
                'id,name,phone'
            )
            .in(
                'id',
                userIds
            );


        profileMap =
            new Map(
                profileData.map(
                    p => [
                        p.id,
                        p
                    ]
                )
            );
    }


    const bookingsByStart =
        new Map();


    bookings.forEach(b => {

        if (!b.booking_time) {
            return;
        }


        const start =
            b.booking_time.slice(
                0,
                5
            );


        bookingsByStart.set(
            start,
            b
        );

    });


    function statusInfo(status) {

        switch (status) {

            case 'in_progress':

                return {
                    text: 'Em atendimento',
                    className: 'progress'
                };


            case 'completed':

                return {
                    text: 'Concluído',
                    className: 'ok'
                };


            case 'cancelled':

                return {
                    text: 'Cancelado',
                    className: 'cancel'
                };


            default:

                return {
                    text: 'Confirmado',
                    className: 'ok'
                };
        }
    }


    const schedule =
        slots();


    if (!$('#agendaGrid')) {
        return;
    }


    $('#agendaGrid').innerHTML =
        schedule.map(time => {

            const booking =
                bookingsByStart.get(
                    time
                );


            if (!booking) {

                const current =
                    timeToMinutes(time);


                const occupying =
                    bookings.find(b => {

                        if (
                            !b.booking_time ||
                            b.status ===
                                'cancelled'
                        ) {

                            return false;
                        }


                        const start =
                            timeToMinutes(
                                b.booking_time
                                    .slice(0, 5)
                            );


                        const service =
                            serviceMap.get(
                                b.service_id
                            );


                        const duration =
                            Number(
                                service?.duration
                            ) || 30;


                        const end =
                            start +
                            duration;


                        return (
                            current >
                                start &&
                            current <
                                end
                        );
                    });


                if (occupying) {

                    const service =
                        serviceMap.get(
                            occupying.service_id
                        );


                    return `

                        <div class="slot-card busy">

                            <div class="time">
                                ${time}
                            </div>

                            <div class="client">

                                <small>
                                    Horário ocupado
                                </small>

                                <b>
                                    ${
                                        service?.name ||
                                        'Serviço'
                                    }
                                </b>

                            </div>

                        </div>

                    `;
                }


                return `

                    <div class="slot-card">

                        <div class="time">
                            ${time}
                        </div>

                        <small class="muted">
                            Livre
                        </small>

                    </div>

                `;
            }


            const service =
                serviceMap.get(
                    booking.service_id
                );


            const client =
                profileMap.get(
                    booking.user_id
                );


            const info =
                statusInfo(
                    booking.status
                );


            const serviceName =
                service?.name ||
                'Serviço';


            const duration =
                Number(
                    service?.duration
                ) || 30;


            const price =
                money(
                    service?.price
                );


            const clientName =
                client?.name ||
                'Cliente';


            const phone =
                client?.phone ||
                '';


            const isCancelled =
                booking.status ===
                'cancelled';


            return `

                <div
                    class="slot-card busy"
                    style="
                        border-left:4px solid currentColor;
                    "
                >

                    <div class="time">

                        ${time}

                        <small>
                            ${duration} min
                        </small>

                    </div>


                    <div class="client">

                        <b>
                            ${clientName}
                        </b>

                        <small>
                            ${serviceName}
                        </small>

                        <small>
                            ${price}
                        </small>

                        ${
                            phone
                                ? `
                                    <small>
                                        📱 ${phone}
                                    </small>
                                `
                                : ''
                        }

                    </div>


                    <div
                        style="
                            margin-top:8px;
                            display:flex;
                            align-items:center;
                            gap:8px;
                            flex-wrap:wrap;
                        "
                    >

                        <span
                            class="${info.className}"
                        >
                            ${info.text}
                        </span>

                    </div>


                    ${
                        !isCancelled
                            ? `

                        <div
                            class="slot-actions"
                            style="
                                display:flex;
                                gap:6px;
                                flex-wrap:wrap;
                                margin-top:10px;
                            "
                        >

                            ${
                                booking.status !==
                                    'in_progress' &&
                                booking.status !==
                                    'completed'
                                    ? `

                                        <button
                                            type="button"
                                            data-status-booking="${booking.id}"
                                            data-status="in_progress"
                                        >
                                            Iniciar
                                        </button>

                                    `
                                    : ''
                            }


                            ${
                                booking.status !==
                                    'completed'
                                    ? `

                                        <button
                                            type="button"
                                            data-status-booking="${booking.id}"
                                            data-status="completed"
                                        >
                                            Concluir
                                        </button>

                                    `
                                    : ''
                            }


                            <button
                                type="button"
                                class="danger"
                                data-cancel="${booking.id}"
                            >
                                Cancelar
                            </button>


                            ${
                                phone
                                    ? `

                                        <button
                                            type="button"
                                            data-wa="${digits(phone)}"
                                            data-msg="${encodeURIComponent(
                                                'Olá ' +
                                                clientName +
                                                '! Seu agendamento na DNH Barbearia é hoje às ' +
                                                time +
                                                '.'
                                            )}"
                                        >
                                            WhatsApp
                                        </button>

                                    `
                                    : ''
                            }

                        </div>

                    `
                            : ''
                    }

                </div>

            `;

        }).join('');
}


/* =========================================================
   CLIENTE - INICIALIZAÇÃO
   ========================================================= */

function initClientBooking() {
    const date = $('#clientDate');
    if (!date) return;
    const initial = getInitialBookingDate();
    date.value = initial;
    date.min = today();
    loadClientTimes();
}


/* =========================================================
   CLIENTE - HORÁRIOS DISPONÍVEIS
   ========================================================= */

async function loadClientTimes() {
    const serviceId = $('#clientService')?.value;
    const professionalId = $('#clientProfessional')?.value;
    const date = $('#clientDate')?.value;
    const grid = $('#clientTimeGrid');
    if (!grid) return;

    if (!serviceId || !professionalId || !date) {
        grid.innerHTML = '<p class="muted">Selecione serviço, profissional e data.</p>';
        $('#bookingSummary')?.classList.add('hidden');
        return;
    }

    const daySchedule = getScheduleForDate(date);
    if (daySchedule.enabled === false) {
        grid.innerHTML = '<p class="muted">Não há expediente neste dia. Escolha outra data.</p>';
        $('#bookingSummary')?.classList.add('hidden');
        return;
    }

    const service = services.find(s => s.id === serviceId);
    if (!service) {
        grid.innerHTML = '<p class="muted">Serviço não encontrado.</p>';
        return;
    }

    const duration = Number(service.duration) || 30;
    const { data: bookings = [], error } = await sb
        .from('bookings')
        .select('id,booking_time,status,service_id')
        .eq('professional_id', professionalId)
        .eq('booking_date', date)
        .neq('status', 'cancelled');

    if (error) {
        console.error('Erro ao carregar horários:', error);
        grid.innerHTML = '<p class="muted">Não foi possível carregar os horários.</p>';
        return;
    }

    const bookingRows = Array.isArray(bookings) ? bookings : [];
    const occupied = bookingRows.map(booking => {
        const start = timeToMinutes(String(booking.booking_time || '').slice(0, 5));
        const bookedService = services.find(s => s.id === booking.service_id);
        const bookedDuration = Number(bookedService?.duration) || 30;
        return { start, end: start + bookedDuration };
    }).filter(x => Number.isFinite(x.start));

    const available = slots(daySchedule).filter(time => {
        const start = timeToMinutes(time);
        const end = start + duration;
        const closing = timeToMinutes(daySchedule.end_time);
        if (end > closing) return false;

        if (date === today()) {
            const now = new Date();
            const current = now.getHours() * 60 + now.getMinutes();
            if (current >= timeToMinutes(daySchedule.end_time) || start <= current) return false;
        }

        return !occupied.some(booked => start < booked.end && end > booked.start);
    });

    if (!available.length) {
        grid.innerHTML = '<p class="muted">Nenhum horário disponível para esta data.</p>';
        $('#bookingSummary')?.classList.add('hidden');
        return;
    }

    grid.innerHTML = available.map(time => `
        <button type="button" class="time-option" data-booking-time="${time}" style="transition:.15s;">${time}</button>
    `).join('');

    const selectedTime = $('#summaryTime')?.textContent?.trim();
    if (selectedTime && available.includes(selectedTime)) {
        const selected = grid.querySelector(`[data-booking-time="${selectedTime}"]`);
        selected?.classList.add('selected');
    }
}


/* =========================================================
   CLIENTE - RESUMO
   ========================================================= */

function atualizarResumoAgendamento(time) {

    const service =
        services.find(
            s =>
                s.id ===
                $('#clientService')?.value
        );


    const professional =
        professionals.find(
            p =>
                p.id ===
                $('#clientProfessional')?.value
        );


    if ($('#summaryService')) {

        $('#summaryService').textContent =
            service?.name ||
            '-';

    }


    if ($('#summaryProfessional')) {

        $('#summaryProfessional').textContent =
            professional?.name ||
            '-';

    }


    if ($('#summaryDate')) {

        const date =
            $('#clientDate')?.value;


        if (date) {

            const [
                year,
                month,
                day
            ] =
                date.split('-');


            $('#summaryDate').textContent =
                `${day}/${month}/${year}`;

        } else {

            $('#summaryDate').textContent =
                '-';

        }
    }


    if ($('#summaryTime')) {

        $('#summaryTime').textContent =
            time ||
            '';

    }


    if ($('#bookingSummary')) {

        if (time) {

            $('#bookingSummary')
                .classList
                .remove('hidden');

        } else {

            $('#bookingSummary')
                .classList
                .add('hidden');

        }
    }
}


/* =========================================================
   CLIENTE - CRIAR AGENDAMENTO
   ========================================================= */

async function createBooking() {
    if (!isClient()) { toast('Somente clientes podem realizar este agendamento.'); return; }

    const serviceId = $('#clientService')?.value;
    const professionalId = $('#clientProfessional')?.value;
    const date = $('#clientDate')?.value;
    const time = $('#summaryTime')?.textContent?.trim();

    if (!serviceId || !professionalId || !date || !time) {
        toast('Selecione serviço, profissional, data e horário.');
        return;
    }

    if (date < today()) {
        toast('Não é permitido agendar em uma data passada.');
        await loadClientTimes();
        return;
    }

    const daySchedule = getScheduleForDate(date);
    if (daySchedule.enabled === false) {
        toast('Não há expediente nesta data.');
        await loadClientTimes();
        return;
    }

    if (date === today()) {
        const current = new Date().getHours() * 60 + new Date().getMinutes();
        if (timeToMinutes(time) <= current) {
            toast('Este horário já passou. Escolha outro.');
            await loadClientTimes();
            return;
        }
    }

    const authResult = await sb.auth.getUser();
    const authUser = authResult?.data?.user;
    if (!authUser) { toast('Faça login para realizar o agendamento.'); return; }

    const service = services.find(s => s.id === serviceId);
    const duration = Number(service?.duration) || 30;
    const requestedStart = timeToMinutes(time);
    const requestedEnd = requestedStart + duration;

    const { data: existingBookings = [], error: checkError } = await sb
        .from('bookings')
        .select('id,booking_time,service_id,status')
        .eq('professional_id', professionalId)
        .eq('booking_date', date)
        .neq('status', 'cancelled');

    if (checkError) {
        console.error('Erro ao verificar horário:', checkError);
        toast('Não foi possível verificar o horário.');
        return;
    }

    const conflict = (Array.isArray(existingBookings) ? existingBookings : []).some(b => {
        const start = timeToMinutes(String(b.booking_time || '').slice(0, 5));
        const bookedService = services.find(s => s.id === b.service_id);
        const bookedDuration = Number(bookedService?.duration) || 30;
        return requestedStart < start + bookedDuration && requestedEnd > start;
    });

    if (conflict) {
        toast('Este horário conflita com outro agendamento. Escolha outro.');
        await loadClientTimes();
        return;
    }

    const { error } = await sb.from('bookings').insert({
        user_id: authUser.id,
        service_id: serviceId,
        professional_id: professionalId,
        booking_date: date,
        booking_time: time + ':00',
        status: 'confirmed',
        notes: null
    });

    if (error) {
        console.error('Erro ao criar agendamento:', error);
        if (error.code === '23505') {
            toast('Este horário acabou de ser reservado por outro cliente. Escolha outro horário.');
            await loadClientTimes();
            return;
        }
        toast(error.message || 'Não foi possível realizar o agendamento.');
        return;
    }

    toast('Agendamento confirmado!');
    $('#bookingSummary')?.classList.add('hidden');
    if ($('#clientService')) $('#clientService').value = '';
    if ($('#clientProfessional')) $('#clientProfessional').value = '';
    if ($('#clientTimeGrid')) $('#clientTimeGrid').innerHTML = '<p class="muted">Selecione serviço, profissional e data.</p>';
    if ($('#summaryTime')) $('#summaryTime').textContent = '';
    await consultarAgenda();
}


/* =========================================================
   CLIENTE - CONSULTAR AGENDAMENTOS
   ========================================================= */

async function consultarAgenda() {

    if (isClient()) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const list =
        $('#clientBookingsList');


    if (!list) {
        return;
    }


    list.innerHTML =
        '<p class="muted">Carregando seus agendamentos...</p>';


    const {
        data: {
            user: authUser
        },
        error: authError
    } =
        await sb.auth.getUser();


    if (
        authError ||
        !authUser
    ) {

        console.error(
            'Erro ao obter usuário:',
            authError
        );


        list.innerHTML =
            '<p class="muted">Faça login para consultar seus agendamentos.</p>';

        return;
    }


    const {
        data: bookings = [],
        error
    } = await sb
        .from('bookings')
        .select(`
            id,
            booking_date,
            booking_time,
            status,
            service_id,
            professional_id,
        `)
        .eq(
            'user_id',
            authUser.id
        )
        .order(
            'booking_date',
            {
                ascending: true
            }
        )
        .order(
            'booking_time',
            {
                ascending: true
            }
        );


    if (error) {

        console.error(
            'Erro ao consultar agendamentos:',
            error
        );


        list.innerHTML = `

            <div class="empty-state">

                <p>
                    Não foi possível carregar seus agendamentos.
                </p>

                <small class="muted">
                    ${error.message || ''}
                </small>

            </div>

        `;

        return;
    }


    if (bookings.length) {
        const nowKey = `${today()} ${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;
        bookings.sort((a, b) => {
            const aKey = `${a.booking_date || ''} ${String(a.booking_time || '').slice(0, 5)}`;
            const bKey = `${b.booking_date || ''} ${String(b.booking_time || '').slice(0, 5)}`;
            const aUpcoming = aKey >= nowKey;
            const bUpcoming = bKey >= nowKey;
            if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
            return aUpcoming ? aKey.localeCompare(bKey) : bKey.localeCompare(aKey);
        });
    }

    if (!bookings.length) {

        list.innerHTML = `

            <div class="empty-state">

                <p>
                    Você ainda não possui agendamentos.
                </p>

            </div>

        `;

        return;
    }


    const serviceIds =
        [
            ...new Set(
                bookings
                    .map(
                        b =>
                            b.service_id
                    )
                    .filter(Boolean)
            )
        ];


    let serviceMap =
        new Map();


    if (serviceIds.length) {

        const {
            data: serviceData = []
        } = await sb
            .from('services')
            .select(
                'id,name,duration,price'
            )
            .in(
                'id',
                serviceIds
            );


        serviceMap =
            new Map(
                serviceData.map(
                    s => [
                        s.id,
                        s
                    ]
                )
            );
    }


    const professionalIds =
        [
            ...new Set(
                bookings
                    .map(
                        b =>
                            b.professional_id
                    )
                    .filter(Boolean)
            )
        ];


    let professionalMap =
        new Map();


    if (professionalIds.length) {

        const {
            data: professionalData = []
        } = await sb
            .from('professionals')
            .select(
                'id,name'
            )
            .in(
                'id',
                professionalIds
            );


        professionalMap =
            new Map(
                professionalData.map(
                    p => [
                        p.id,
                        p
                    ]
                )
            );
    }


    function statusInfo(status) {

        switch (status) {

            case 'confirmed':

                return {
                    text: 'Confirmado',
                    className: 'ok'
                };


            case 'in_progress':

                return {
                    text: 'Em atendimento',
                    className: 'progress'
                };


            case 'completed':

                return {
                    text: 'Concluído',
                    className: 'ok'
                };


            case 'cancelled':

                return {
                    text: 'Cancelado',
                    className: 'cancel'
                };


            default:

                return {
                    text:
                        status ||
                        'Confirmado',
                    className: ''
                };
        }
    }


    function formatDate(date) {

        if (!date) {
            return '';
        }


        const [
            year,
            month,
            day
        ] =
            date.split('-');


        return `${day}/${month}/${year}`;
    }


    list.innerHTML =
        bookings.map(b => {

            const service =
                serviceMap.get(
                    b.service_id
                );


            const professional =
                professionalMap.get(
                    b.professional_id
                );


            const serviceName =
                service?.name ||
                'Serviço';


            const duration =
                Number(
                    service?.duration
                ) || 30;


            const price =
                money(
                    service?.price ||
                    0
                );


            const professionalName =
                professional?.name ||
                'Profissional';


            const time =
                b.booking_time
                    ? b.booking_time.slice(
                        0,
                        5
                    )
                    : '';


            const status =
                statusInfo(
                    b.status
                );


            const cancelButton =
                b.status !==
                    'cancelled' &&
                b.status !==
                    'completed'

                    ? `

                        <button
                            type="button"
                            class="danger"
                            data-client-cancel="${b.id}"
                        >
                            Cancelar agendamento
                        </button>

                    `

                    : '';


            return `

                <div class="booking-card">

                    <div class="booking-main">

                        <div class="booking-date">

                            <strong>
                                ${formatDate(
                                    b.booking_date
                                )}
                            </strong>

                            <span>
                                ${time}
                            </span>

                        </div>


                        <div class="booking-info">

                            <strong>
                                ${serviceName}
                            </strong>

                            <small>
                                Profissional:
                                ${professionalName}
                            </small>

                            <small>
                                Duração:
                                ${duration} min
                            </small>

                            <small>
                                Valor:
                                ${price}
                            </small>

                        </div>

                    </div>


                    <div class="booking-footer">

                        <span
                            class="${status.className}"
                        >
                            ${status.text}
                        </span>

                        ${cancelButton}

                    </div>

                </div>

            `;

        }).join('');

    if (isClient()) {
        requestAnimationFrame(() => {
            list.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }
}


/* =========================================================
   CANCELAR AGENDAMENTO DO CLIENTE
   ========================================================= */

async function cancelarMeuAgendamento(
    bookingId
) {

    if (!isClient()) {

        toast(
            'Acesso não permitido.'
        );

        return;
    }


    const {
        data: {
            user: authUser
        }
    } =
        await sb.auth.getUser();


    if (!authUser) {

        toast(
            'Faça login novamente.'
        );

        return;
    }


    const confirmar =
        confirm(
            'Deseja realmente cancelar este agendamento?'
        );


    if (!confirmar) {
        return;
    }


    const {
        error
    } = await sb
        .from('bookings')
        .update({
            status:
                'cancelled'
        })
        .eq(
            'id',
            bookingId
        )
        .eq(
            'user_id',
            authUser.id
        );


    if (error) {

        console.error(
            'Erro ao cancelar agendamento:',
            error
        );


        toast(
            'Não foi possível cancelar o agendamento.'
        );

        return;
    }


    toast(
        'Agendamento cancelado com sucesso!'
    );


    await consultarAgenda();
}


/* =========================================================
   CLIENTES ADMIN
   ========================================================= */

async function loadClients() {
    if (!isAdmin()) return;
    const { data = [], error } = await sb
        .from('profiles')
        .select('*')
        .eq('role', 'client')
        .order('name');
    if (error) {
        console.error('Erro ao carregar clientes:', error);
        toast('Não foi possível carregar os clientes.');
        return;
    }
    window.allClients = Array.isArray(data) ? data : [];
    renderClients(window.allClients);
}

async function excluirCliente(clientId) {
    if (!isAdmin() || !clientId) return;
    const client = (window.allClients || []).find(c => c.id === clientId);
    const nome = client?.name || client?.email || 'este cliente';
    if (!confirm(`O cliente "${nome}" será excluído do cadastro. Os agendamentos deste cliente também serão removidos. Deseja continuar?`)) return;

    const { error: bookingError } = await sb.from('bookings').delete().eq('user_id', clientId);
    if (bookingError) {
        console.error('Erro ao excluir agendamentos do cliente:', bookingError);
        toast('Não foi possível excluir os agendamentos vinculados ao cliente.');
        return;
    }

    const { error } = await sb.from('profiles').delete().eq('id', clientId).eq('role', 'client');
    if (error) {
        console.error('Erro ao excluir cliente:', error);
        toast(error.message || 'Não foi possível excluir o cliente.');
        return;
    }
    toast('Cliente excluído do cadastro.');
    await loadClients();
}


function renderClients(data) {
    if (!isAdmin() || !$('#clientList')) return;
    const rows = Array.isArray(data) ? data : [];
    $('#clientList').innerHTML = rows.length ? `
        <div style="overflow:auto;">
        <table class="table">
            <thead><tr><th>Nome</th><th>WhatsApp</th><th>Nascimento</th><th>E-mail</th><th>Ações</th></tr></thead>
            <tbody>
                ${rows.map(c => `
                    <tr>
                        <td>${c.name || '-'}</td>
                        <td>${c.phone || '-'}</td>
                        <td>${c.birth ? new Date(c.birth + 'T12:00').toLocaleDateString('pt-BR') : '-'}</td>
                        <td>${c.email || '-'}</td>
                        <td><button type="button" class="danger" data-client-delete="${c.id}">Excluir</button></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        </div>
    ` : '<p class="muted">Nenhum cliente cadastrado.</p>';
}


/* =========================================================
   ESTOQUE
   ========================================================= */

async function loadStock() {
    if (!isAdmin()) return;
    const { data = [], error } = await sb.from('inventory').select('*').order('name');
    if (error) {
        console.error('Erro ao carregar estoque:', error);
        if ($('#stockList')) $('#stockList').innerHTML = `<p class="muted">${error.message || 'Não foi possível carregar o estoque.'}</p>`;
        return;
    }
    const stockData = Array.isArray(data) ? data : [];
    if (!$('#stockList')) return;
    $('#stockList').innerHTML = stockData.length ? stockData.map(x => `
        <div class="list-row">
            <div><b>${x.name || 'Produto'}</b><small>Atual: ${Number(x.quantity) || 0} • mínimo: ${Number(x.min_quantity) || 0}</small></div>
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
                <span class="${Number(x.quantity) <= Number(x.min_quantity) ? 'cancel' : 'ok'}">${Number(x.quantity) <= Number(x.min_quantity) ? 'Baixo' : 'OK'}</span>
                <button type="button" data-stock-adjust="${x.id}" data-stock-delta="1">+1</button>
                <button type="button" data-stock-adjust="${x.id}" data-stock-delta="-1">-1</button>
                <button type="button" data-stock-edit="${x.id}">Editar</button>
                <button type="button" class="danger" data-stock-delete="${x.id}">Excluir</button>
            </div>
        </div>
    `).join('') : '<p class="muted">Nenhum produto.</p>';
}

async function editarEstoque(id) {
    if (!isAdmin()) return;
    const { data: item, error } = await sb.from('inventory').select('*').eq('id', id).maybeSingle();
    if (error || !item) { toast('Produto não encontrado.'); return; }
    const name = prompt('Nome do produto:', item.name || '');
    if (name === null) return;
    const quantityText = prompt('Quantidade atual:', String(item.quantity ?? 0));
    if (quantityText === null) return;
    const minText = prompt('Estoque mínimo:', String(item.min_quantity ?? 0));
    if (minText === null) return;
    const quantity = Number(quantityText);
    const min_quantity = Number(minText);
    if (!name.trim() || !Number.isFinite(quantity) || !Number.isFinite(min_quantity) || quantity < 0 || min_quantity < 0) { toast('Informe valores válidos.'); return; }
    const { error: saveError } = await sb.from('inventory').update({ name: name.trim(), quantity, min_quantity }).eq('id', id);
    if (saveError) { toast(saveError.message || 'Não foi possível editar o produto.'); return; }
    toast('Produto atualizado.');
    await loadStock();
}

async function ajustarEstoque(id, delta) {
    if (!isAdmin()) return;
    const { data: item, error } = await sb.from('inventory').select('quantity').eq('id', id).maybeSingle();
    if (error || !item) { toast('Produto não encontrado.'); return; }
    const quantity = Math.max(0, Number(item.quantity || 0) + Number(delta || 0));
    const { error: saveError } = await sb.from('inventory').update({ quantity }).eq('id', id);
    if (saveError) { toast(saveError.message || 'Não foi possível atualizar o estoque.'); return; }
    await loadStock();
}

async function excluirEstoque(id) {
    if (!isAdmin()) return;
    if (!confirm('Excluir este produto do estoque?')) return;
    const { error } = await sb.from('inventory').delete().eq('id', id);
    if (error) { toast(error.message || 'Não foi possível excluir o produto.'); return; }
    toast('Produto excluído.');
    await loadStock();
}


/* =========================================================
   FINANCEIRO
   ========================================================= */

async function loadFinance() {
    if (!isAdmin()) return;
    ensureFinanceControls();
    ensureFinanceChart();

    const period = $('#financePeriodFilter')?.value || 'month';
    const reference = today();
    let startDate = reference;
    let endDate = reference;

    if (period === 'month') {
        const d = dateToLocalObject(reference);
        startDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
        const last = new Date(d.getFullYear(), d.getMonth()+1, 0);
        endDate = formatLocalDate(last);
    } else if (period === 'week') {
        const d = dateToLocalObject(reference);
        const day = d.getDay();
        d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
        startDate = formatLocalDate(d);
        d.setDate(d.getDate() + 6);
        endDate = formatLocalDate(d);
    }

    const { data = [], error } = await sb.from('cash_entries').select('*').gte('entry_date', startDate).lte('entry_date', endDate).order('entry_date', { ascending: true });
    if (error) {
        console.error('Erro ao carregar financeiro:', error);
        if ($('#financeList')) $('#financeList').innerHTML = `<p class="muted">${error.message || 'Não foi possível carregar o financeiro.'}</p>`;
        return;
    }

    const financeRows = Array.isArray(data) ? data : [];
    const income = financeRows.filter(x => x.type === 'income').reduce((t,x) => t + Number(x.amount || 0), 0);
    const expense = financeRows.filter(x => x.type === 'expense').reduce((t,x) => t + Number(x.amount || 0), 0);
    if ($('#sumIncome')) $('#sumIncome').textContent = money(income);
    if ($('#sumExpense')) $('#sumExpense').textContent = money(expense);
    if ($('#sumBalance')) $('#sumBalance').textContent = money(income - expense);

    if ($('#financeList')) {
        $('#financeList').innerHTML = financeRows.slice().reverse().slice(0, 30).map(x => `
            <div class="list-row"><div><b>${x.description || 'Lançamento'}</b><small>${x.entry_date ? new Date(x.entry_date + 'T12:00').toLocaleDateString('pt-BR') : ''}</small></div><span class="${x.type === 'income' ? 'ok' : 'cancel'}">${x.type === 'income' ? '+' : '-'} ${money(x.amount)}</span></div>
        `).join('') || '<p class="muted">Nenhum lançamento no período.</p>';
    }

    const chart = $('#financeChart');
    if (chart) {
        const groups = new Map();
        financeRows.forEach(x => {
            const key = period === 'day' ? (x.entry_date || reference) : (period === 'week' ? (x.entry_date || '').slice(5) : (x.entry_date || '').slice(8,10));
            if (!key) return;
            if (!groups.has(key)) groups.set(key, { income: 0, expense: 0 });
            groups.get(key)[x.type === 'income' ? 'income' : 'expense'] += Number(x.amount || 0);
        });
        const entries = [...groups.entries()];
        const max = Math.max(1, ...entries.flatMap(([,v]) => [v.income, v.expense]));
        chart.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px;"><strong>Gráfico — ${period === 'day' ? 'dia' : period === 'week' ? 'semana' : 'mês'}</strong><span class="muted">${new Date(startDate + 'T12:00').toLocaleDateString('pt-BR')} a ${new Date(endDate + 'T12:00').toLocaleDateString('pt-BR')}</span></div>
            <div style="display:flex;gap:8px;align-items:flex-end;min-height:180px;overflow:auto;padding:10px 0;">
                ${entries.length ? entries.map(([key,v]) => `
                    <div style="min-width:54px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:160px;gap:4px;">
                        <div title="Entradas ${money(v.income)}" style="width:18px;height:${Math.max(2, v.income/max*130)}px;background:#22c55e;border-radius:4px 4px 0 0;"></div>
                        <div title="Saídas ${money(v.expense)}" style="width:18px;height:${Math.max(2, v.expense/max*130)}px;background:#ef4444;border-radius:4px 4px 0 0;"></div>
                        <small>${key}</small>
                    </div>
                `).join('') : '<p class="muted">Sem dados para o período.</p>'}
            </div>
        `;
    }
}


/* =========================================================
   EQUIPE
   ========================================================= */

async function loadTeam() {
    if (!isAdmin()) return;
    const { data = [], error } = await sb.from('professionals').select('*').order('name');
    if (error) {
        console.error('Erro ao carregar equipe:', error);
        toast('Não foi possível carregar a equipe.');
        return;
    }
    const teamData = Array.isArray(data) ? data : [];
    if (!$('#teamList')) return;
    const localStatus = (() => { try { return JSON.parse(localStorage.getItem('dnh_professional_status_v1') || '{}'); } catch { return {}; } })();
    $('#teamList').innerHTML = teamData.length ? teamData.map(x => {
        const status = x.status || localStatus[x.id] || (x.active ? 'active' : 'inactive');
        const label = status === 'vacation' ? 'Férias' : status === 'active' ? 'Ativo' : 'Inativo';
        return `
            <div class="list-row">
                <div><b>${x.name || 'Profissional'}</b><small>${x.phone || ''}</small></div>
                <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">
                    <span class="${status === 'active' ? 'ok' : 'cancel'}">${label}</span>
                    <button type="button" data-team-edit="${x.id}">Editar</button>
                    <button type="button" data-team-status="${x.id}" data-team-new-status="active">Ativo</button>
                    <button type="button" data-team-status="${x.id}" data-team-new-status="vacation">Férias</button>
                    <button type="button" data-team-status="${x.id}" data-team-new-status="inactive">Inativo</button>
                    <button type="button" class="danger" data-team-delete="${x.id}">Excluir</button>
                </div>
            </div>`;
    }).join('') : '<p class="muted">Nenhum profissional.</p>';
}

async function editarProfissional(id) {
    if (!isAdmin()) return;
    const { data: item, error } = await sb.from('professionals').select('*').eq('id', id).maybeSingle();
    if (error || !item) { toast('Profissional não encontrado.'); return; }
    const name = prompt('Nome do profissional:', item.name || '');
    if (name === null) return;
    const phone = prompt('Telefone/WhatsApp:', item.phone || '');
    if (phone === null) return;
    if (!name.trim()) { toast('Informe o nome.'); return; }
    const { error: saveError } = await sb.from('professionals').update({ name: name.trim(), phone: phone.trim() }).eq('id', id);
    if (saveError) { toast(saveError.message || 'Não foi possível editar o profissional.'); return; }
    toast('Profissional atualizado.');
    await loadProfessionals();
    await loadTeam();
}

async function alterarStatusProfissional(id, status) {
    if (!isAdmin()) return;
    let localStatus = {};
    try { localStatus = JSON.parse(localStorage.getItem('dnh_professional_status_v1') || '{}'); } catch {}
    const active = status === 'active';
    const patch = { active };
    if (status === 'vacation') patch.status = 'vacation';
    else if (status === 'inactive') patch.status = 'inactive';
    else patch.status = 'active';

    const { error } = await sb.from('professionals').update(patch).eq('id', id);
    if (error) {
        // Compatibilidade com tabelas antigas que ainda não possuem a coluna status.
        if (status === 'vacation') {
            const fallback = await sb.from('professionals').update({ active: false }).eq('id', id);
            if (fallback.error) { toast(fallback.error.message || 'Não foi possível alterar o status.'); return; }
            localStatus[id] = 'vacation';
        } else {
            const fallback = await sb.from('professionals').update({ active }).eq('id', id);
            if (fallback.error) { toast(fallback.error.message || 'Não foi possível alterar o status.'); return; }
            localStatus[id] = status;
        }
    } else {
        localStatus[id] = status;
    }
    localStorage.setItem('dnh_professional_status_v1', JSON.stringify(localStatus));
    toast(status === 'vacation' ? 'Profissional colocado em férias.' : status === 'active' ? 'Profissional ativo.' : 'Profissional inativo.');
    await loadProfessionals();
    await loadTeam();
}

async function excluirProfissional(id) {
    if (!isAdmin()) return;
    if (!confirm('Excluir este profissional? Agendamentos existentes não serão excluídos automaticamente.')) return;
    const { error } = await sb.from('professionals').delete().eq('id', id);
    if (error) { toast(error.message || 'Não foi possível excluir o profissional.'); return; }
    toast('Profissional excluído.');
    await loadProfessionals();
    await loadTeam();
}


/* =========================================================
   NAVEGAÇÃO DOS BOTÕES
   ========================================================= */

$$('[data-page]').forEach(button => {

    button.onclick = () => {

        go(
            button.dataset.page
        );

    };

});


/* =========================================================
   TABS LOGIN / CADASTRO
   ========================================================= */

$$('.auth-tabs button').forEach(button => {

    button.onclick = () => {

        $$('.auth-tabs button')
            .forEach(
                x =>
                    x.classList.remove(
                        'active'
                    )
            );


        button.classList.add(
            'active'
        );


        const signup =
            button.dataset.auth ===
            'signup';


        if ($('#loginForm')) {

            $('#loginForm')
                .classList
                .toggle(
                    'hidden',
                    signup
                );

        }


        if ($('#signupForm')) {

            $('#signupForm')
                .classList
                .toggle(
                    'hidden',
                    !signup
                );

        }

    };

});


/* =========================================================
   LOGIN
   ========================================================= */

if ($('#loginForm')) {

    $('#loginForm').onsubmit =
        async e => {

            e.preventDefault();


            const {
                error
            } =
                await sb.auth
                    .signInWithPassword({

                        email:
                            $('#loginEmail')
                                .value
                                .trim(),

                        password:
                            $('#loginPassword')
                                .value

                    });


            if (error) {

                console.error(
                    'ERRO DE LOGIN:',
                    error
                );

                alert(
                    'E-mail ou senha incorretos.'
                );

                return;
            }

        };
}


/* =========================================================
   CADASTRO CLIENTE
   ========================================================= */

if ($('#signupForm')) {

    $('#signupForm').onsubmit =
        async e => {

            e.preventDefault();


            const name =
                $('#signupName')
                    .value
                    .trim();


            const phone =
                $('#signupPhone')
                    .value
                    .trim();


            const email =
                $('#signupEmail')
                    .value
                    .trim();


            const password =
                $('#signupPassword')
                    .value;


            const birth =
                $('#signupBirth')
                    .value ||
                null;


            if (
                !name ||
                !phone ||
                !email ||
                !password
            ) {

                toast(
                    'Preencha todos os campos obrigatórios.'
                );

                return;
            }


            const {
                data,
                error
            } =
                await sb.auth.signUp({

                    email,

                    password,

                    options: {

                        data: {
                            name,
                            phone,
                            birth
                        }

                    }

                });


            if (error) {

                const msg =
                    (
                        error.message ||
                        ''
                    ).toLowerCase();


                if (
                    msg.includes(
                        'user already registered'
                    )
                ) {

                    toast(
                        'Este e-mail já está cadastrado.'
                    );

                } else if (

                    msg.includes(
                        'database error'
                    ) ||

                    msg.includes(
                        'phone'
                    ) ||

                    msg.includes(
                        'duplicate'
                    ) ||

                    msg.includes(
                        'unique'
                    )

                ) {

                    toast(
                        'Este WhatsApp já está cadastrado ou os dados já existem.'
                    );

                } else {

                    toast(
                        error.message ||
                        'Não foi possível criar a conta.'
                    );

                }


                return;
            }


            if (!data.user) {

                toast(
                    'Não foi possível criar o usuário.'
                );

                return;
            }


            if (data.session) {

                const {
                    error: profileError
                } =
                    await sb
                        .from('profiles')
                        .upsert({

                            id:
                                data.user.id,

                            name,

                            phone,

                            email,

                            birth,

                            role:
                                'client',

                            active:
                                true

                        });


                if (profileError) {

                    console.error(
                        profileError
                    );


                    toast(
                        'Conta criada, mas houve erro ao criar o perfil.'
                    );

                    return;
                }


                toast(
                    'Cliente cadastrado com sucesso!'
                );

            } else {

                toast(
                    'Conta criada. Confirme o e-mail para continuar.'
                );

            }

        };
}


/* =========================================================
   LOGOUT
   ========================================================= */

if ($('#logoutBtn')) {

    $('#logoutBtn').onclick =
        () =>
            sb.auth.signOut();

}


/* =========================================================
   AGENDA
   ========================================================= */

if ($('#refreshAgenda')) {

    $('#refreshAgenda').onclick =
        agenda;

}


if ($('#agendaDate')) {

    $('#agendaDate').onchange =
        agenda;

}


if ($('#agendaProfessional')) {

    $('#agendaProfessional').onchange =
        agenda;

}


/* =========================================================
   FORMULÁRIO SERVIÇOS
   ========================================================= */

if ($('#serviceForm')) {

    $('#serviceForm').onsubmit =
        async e => {

            e.preventDefault();


            if (!isAdmin()) {

                toast(
                    'Acesso restrito ao administrador.'
                );

                return;
            }


            const name =
                $('#serviceName')
                    .value
                    .trim();


            const price =
                Number(
                    $('#servicePrice')
                        .value
                );


            const duration =
                Number(
                    $('#serviceDuration')
                        .value
                );


            if (
                !name ||
                !Number.isFinite(price) ||
                price < 0 ||
                !Number.isFinite(duration) ||
                duration <= 0
            ) {

                toast(
                    'Preencha os dados do serviço corretamente.'
                );

                return;
            }


            const {
                error
            } =
                await sb
                    .from('services')
                    .insert({

                        name,

                        price,

                        duration,

                        active:
                            true

                    });


            if (error) {

                console.error(
                    error
                );


                toast(
                    error.message
                );

            } else {

                e.target.reset();


                await loadServices();


                toast(
                    'Serviço cadastrado.'
                );

            }

        };
}


/* =========================================================
   FORMULÁRIO ESTOQUE
   ========================================================= */

if ($('#stockForm')) {

    $('#stockForm').onsubmit =
        async e => {

            e.preventDefault();


            if (!isAdmin()) {

                toast(
                    'Acesso restrito ao administrador.'
                );

                return;
            }


            const {
                error
            } =
                await sb
                    .from('inventory')
                    .insert({

                        name:
                            $('#stockName')
                                .value
                                .trim(),

                        quantity:
                            Number(
                                $('#stockQty')
                                    .value
                            ),

                        min_quantity:
                            Number(
                                $('#stockMin')
                                    .value
                            )

                    });


            if (error) {

                toast(
                    error.message
                );

            } else {

                e.target.reset();


                await loadStock();


                toast(
                    'Produto cadastrado.'
                );

            }

        };
}


/* =========================================================
   FORMULÁRIO FINANCEIRO
   ========================================================= */

if ($('#financeForm')) {

    $('#financeForm').onsubmit =
        async e => {

            e.preventDefault();


            if (!isAdmin()) {

                toast(
                    'Acesso restrito ao administrador.'
                );

                return;
            }


            const {
                error
            } =
                await sb
                    .from('cash_entries')
                    .insert({

                        type:
                            $('#financeType')
                                .value,

                        description:
                            $('#financeDesc')
                                .value
                                .trim(),

                        amount:
                            Number(
                                $('#financeAmount')
                                    .value
                            ),

                        entry_date:
                            $('#financeDate')
                                .value

                    });


            if (error) {

                toast(
                    error.message
                );

            } else {

                e.target.reset();


                if ($('#financeDate')) {

                    $('#financeDate').value =
                        today();

                }


                await loadFinance();


                toast(
                    'Lançamento registrado.'
                );

            }

        };
}


/* =========================================================
   FORMULÁRIO EQUIPE
   ========================================================= */

if ($('#teamForm')) {

    $('#teamForm').onsubmit =
        async e => {

            e.preventDefault();


            if (!isAdmin()) {

                toast(
                    'Acesso restrito ao administrador.'
                );

                return;
            }


            const {
                error
            } =
                await sb
                    .from('professionals')
                    .insert({

                        name:
                            $('#teamName')
                                .value
                                .trim(),

                        phone:
                            $('#teamPhone')
                                .value
                                .trim(),

                        active:
                            true

                    });


            if (error) {

                toast(
                    error.message
                );

            } else {

                e.target.reset();


                await loadTeam();


                toast(
                    'Profissional cadastrado.'
                );

            }

        };
}


/* =========================================================
   CONFIGURAÇÕES
   ========================================================= */

if ($('#saveSettings')) {
    $('#saveSettings').onclick = async () => {
        if (!isAdmin()) { toast('Acesso restrito ao administrador.'); return; }

        const patch = {
            name: $('#setName')?.value.trim() || 'DNH BARBEARIA',
            whatsapp: digits($('#setWhatsapp')?.value || ''),
            start_time: $('#setStart')?.value || '08:00',
            end_time: $('#setEnd')?.value || '18:00',
            slot_interval: Number($('#setInterval')?.value || 30),
            logo_url: $('#setLogoUrl')?.value.trim() || 'dnh-logo.png'
        };

        const schedule = collectWeeklySchedule();
        for (const day of WEEK_DAYS) {
            const row = schedule[day.key];
            if (row.enabled && timeToMinutes(row.end_time) <= timeToMinutes(row.start_time)) {
                toast(`Horário inválido em ${day.label}: o fim deve ser depois do início.`);
                return;
            }
        }

        if (Object.prototype.hasOwnProperty.call(settings, 'weekly_schedule')) {
            patch.weekly_schedule = schedule;
        }
        const { error } = await sb.from('settings').update(patch).eq('id', 1);
        if (error) {
            console.error('Erro ao salvar configurações:', error);
            toast(error.message || 'Não foi possível salvar as configurações.');
            return;
        }

        saveWeeklySchedule(schedule);
        settings = { ...settings, ...patch };
        await loadSettings();
        toast('Configurações e horários semanais salvos.');
    };
}


/* =========================================================
   COPIAR LINK
   ========================================================= */

if ($('#copyShare')) {

    $('#copyShare').onclick =
        async () => {

            try {

                await navigator.clipboard.writeText(
                    location.href.split('?')[0]
                );


                toast(
                    'Link copiado.'
                );

            } catch (error) {

                console.error(
                    error
                );


                toast(
                    'Não foi possível copiar o link.'
                );

            }

        };
}


/* =========================================================
   COMPARTILHAR
   ========================================================= */

if ($('#shareBtn')) {

    $('#shareBtn').onclick =
        async () => {

            try {

                if (navigator.share) {

                    await navigator.share({

                        title:
                            settings.name,

                        url:
                            location.href.split('?')[0]

                    });

                } else {

                    await navigator.clipboard.writeText(
                        location.href.split('?')[0]
                    );


                    toast(
                        'Link copiado.'
                    );

                }

            } catch (error) {

                console.error(
                    error
                );

            }

        };
}


/* =========================================================
   PESQUISA DE CLIENTES
   ========================================================= */

if ($('#clientSearch')) {

    $('#clientSearch').oninput =
        e => {

            if (!isAdmin()) {
                return;
            }


            const q =
                e.target.value
                    .toLowerCase();


            renderClients(

                (
                    window.allClients ||
                    []
                ).filter(c => {

                    const text =
                        (
                            c.name ||
                            ''
                        )
                        +
                        ' '
                        +
                        (
                            c.phone ||
                            ''
                        )
                        +
                        ' '
                        +
                        (
                            c.email ||
                            ''
                        );


                    return text
                        .toLowerCase()
                        .includes(q);

                })

            );

        };
}


/* =========================================================
   FILTRO ANIVERSARIANTES
   ========================================================= */

if ($('#birthdayOnly')) {

    $('#birthdayOnly').onclick =
        () => {

            if (!isAdmin()) {
                return;
            }


            const month =
                today().slice(
                    5,
                    7
                );


            renderClients(

                (
                    window.allClients ||
                    []
                ).filter(

                    c =>
                        c.birth &&
                        c.birth.slice(
                            5,
                            7
                        ) === month

                )

            );

        };
}



/* =========================================================
   ADMINISTRADOR - NOVO AGENDAMENTO PARA CLIENTE
   ========================================================= */

async function novoAgendamentoAdmin() {

    if (!isAdmin()) {
        toast('Acesso restrito ao administrador.');
        return;
    }

    await loadSettings();
    await loadServices();
    await loadProfessionals();

    const {
        data: clients = [],
        error: clientsError
    } = await sb
        .from('profiles')
        .select('id,name,phone,email,birth')
        .eq('role', 'client')
        .order('name', { ascending: true });

    if (clientsError) {
        console.error('Erro ao carregar clientes para novo agendamento:', clientsError);
        toast('Não foi possível carregar os clientes.');
        return;
    }

    const activeServices = (services || []).filter(s => s.active !== false);
    const activeProfessionals = (professionals || []).filter(p => p.active !== false);

    if (!clients.length) {
        toast('Não há clientes cadastrados.');
        return;
    }

    if (!activeServices.length) {
        toast('Cadastre pelo menos um serviço ativo.');
        return;
    }

    if (!activeProfessionals.length) {
        toast('Cadastre pelo menos um profissional.');
        return;
    }

    const oldModal = document.querySelector('#adminBookingModal');
    if (oldModal) oldModal.remove();

    const modal = document.createElement('div');
    modal.id = 'adminBookingModal';
    modal.style.cssText = `
        position:fixed;
        inset:0;
        z-index:9999;
        background:rgba(0,0,0,.72);
        display:flex;
        align-items:center;
        justify-content:center;
        padding:20px;
        box-sizing:border-box;
    `;

    modal.innerHTML = `
        <div style="width:min(620px,100%);max-height:90vh;overflow:auto;background:var(--card,#151515);border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:22px;box-sizing:border-box;box-shadow:0 20px 60px rgba(0,0,0,.45);">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:18px;">
                <div>
                    <span class="eyebrow">ADMINISTRADOR</span>
                    <h2 style="margin:4px 0 0;">Novo agendamento</h2>
                    <p class="muted" style="margin:4px 0 0;">Agende um serviço para um cliente cadastrado.</p>
                </div>
                <button type="button" id="closeAdminBooking" class="ghost">✕</button>
            </div>

            <div style="display:grid;gap:14px;">
                <label>Cliente
                    <select id="adminBookingClient" style="width:100%;box-sizing:border-box;">
                        <option value="">Selecione o cliente</option>
                        ${clients.map(c => `<option value="${c.id}">${(c.name || c.email || 'Cliente').replace(/&/g,'&amp;').replace(/</g,'&lt;')} ${c.phone ? '• ' + c.phone : ''}</option>`).join('')}
                    </select>
                </label>

                <label>Serviço
                    <select id="adminBookingService" style="width:100%;box-sizing:border-box;">
                        <option value="">Selecione o serviço</option>
                        ${activeServices.map(s => `<option value="${s.id}">${(s.name || 'Serviço').replace(/&/g,'&amp;').replace(/</g,'&lt;')} — ${money(s.price)} — ${Number(s.duration) || 30} min</option>`).join('')}
                    </select>
                </label>

                <label>Profissional
                    <select id="adminBookingProfessional" style="width:100%;box-sizing:border-box;">
                        <option value="">Selecione o profissional</option>
                        ${activeProfessionals.map(p => `<option value="${p.id}">${(p.name || 'Profissional').replace(/&/g,'&amp;').replace(/</g,'&lt;')}</option>`).join('')}
                    </select>
                </label>

                <label>Data
                    <input id="adminBookingDate" type="date" value="${today()}" min="${today()}" style="width:100%;box-sizing:border-box;">
                </label>

                <label>Horário
                    <select id="adminBookingTime" style="width:100%;box-sizing:border-box;">
                        <option value="">Selecione serviço, profissional e data</option>
                    </select>
                </label>

                 <label>Observação (opcional)
                    <textarea id="adminBookingNotes" rows="3" placeholder="Observação do atendimento" style="width:100%;box-sizing:border-box;resize:vertical;"></textarea>
                </label>

                <div id="adminBookingInfo" class="muted" style="font-size:13px;"></div>

                <div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:4px;">
                    <button type="button" id="cancelAdminBooking" class="secondary">Cancelar</button>
                    <button type="button" id="saveAdminBooking" class="btn gold">Confirmar agendamento</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    $('#closeAdminBooking')?.addEventListener('click', close);
    $('#cancelAdminBooking')?.addEventListener('click', close);
    modal.addEventListener('click', e => {
        if (e.target === modal) close();
    });

    const clientSelect = $('#adminBookingClient');
    const serviceSelect = $('#adminBookingService');
    const professionalSelect = $('#adminBookingProfessional');
    const dateInput = $('#adminBookingDate');
    const timeSelect = $('#adminBookingTime');
    const info = $('#adminBookingInfo');

    async function carregarHorariosAdmin() {
        if (!timeSelect) return;

        const serviceId = serviceSelect?.value;
        const professionalId = professionalSelect?.value;
        const date = dateInput?.value;

        timeSelect.innerHTML = '<option value="">Carregando horários...</option>';
        if (info) info.textContent = '';

        if (!serviceId || !professionalId || !date) {
            timeSelect.innerHTML = '<option value="">Selecione serviço, profissional e data</option>';
            return;
        }

        const service = activeServices.find(s => s.id === serviceId);
        const duration = Number(service?.duration) || 30;
        const daySchedule = getScheduleForDate(date);
        if (daySchedule.enabled === false) {
            timeSelect.innerHTML = '<option value="">Sem expediente nesta data</option>';
            if (info) info.textContent = 'Este dia está marcado como folga.';
            return;
        }

        const { data: bookings = [], error } = await sb
            .from('bookings')
            .select('id,booking_time,status,service_id')
            .eq('professional_id', professionalId)
            .eq('booking_date', date)
            .neq('status', 'cancelled');

        if (error) {
            console.error('Erro ao verificar horários do administrador:', error);
            timeSelect.innerHTML = '<option value="">Erro ao carregar horários</option>';
            if (info) info.textContent = error.message || '';
            return;
        }

        const bookingRows = Array.isArray(bookings) ? bookings : [];
        const serviceIds = [...new Set(bookingRows.map(b => b.service_id).filter(Boolean))];
        const durationMap = new Map(activeServices.map(s => [s.id, Number(s.duration) || 30]));

        if (serviceIds.length) {
            const missingIds = serviceIds.filter(id => !durationMap.has(id));
            if (missingIds.length) {
                const { data: otherServices = [] } = await sb
                    .from('services')
                    .select('id,duration')
                    .in('id', missingIds);
                otherServices.forEach(s => durationMap.set(s.id, Number(s.duration) || 30));
            }
        }

        const busy = bookingRows.map(b => {
            const start = timeToMinutes(String(b.booking_time || '').slice(0, 5));
            const end = start + (durationMap.get(b.service_id) || 30);
            return { start, end };
        }).filter(x => Number.isFinite(x.start));

        const startMinutes = timeToMinutes(daySchedule.start_time.slice(0, 5));
        const endMinutes = timeToMinutes(daySchedule.end_time.slice(0, 5));
        const interval = Number(settings.slot_interval) || 30;
        const options = [];
        const now = new Date();
        const currentNow = now.getHours() * 60 + now.getMinutes();

        for (let current = startMinutes; current + duration <= endMinutes; current += interval) {
            const hour = String(Math.floor(current / 60)).padStart(2, '0');
            const minute = String(current % 60).padStart(2, '0');
            const time = `${hour}:${minute}`;
            if (date === today() && current <= currentNow) continue;
            const conflict = busy.some(b => current < b.end && current + duration > b.start);
            if (!conflict) options.push(`<option value="${time}">${time}</option>`);
        }

        timeSelect.innerHTML = options.length
            ? '<option value="">Selecione o horário</option>' + options.join('')
            : '<option value="">Nenhum horário disponível</option>';

        if (info) {
            info.textContent = options.length
                ? `${options.length} horário(s) disponível(is) para este serviço.`
                : 'Não há horários disponíveis para esta data, profissional e serviço.';
        }
    }

    serviceSelect?.addEventListener('change', carregarHorariosAdmin);
    professionalSelect?.addEventListener('change', carregarHorariosAdmin);
    dateInput?.addEventListener('change', carregarHorariosAdmin);

    $('#saveAdminBooking')?.addEventListener('click', async () => {
        const clientId = clientSelect?.value;
        const serviceId = serviceSelect?.value;
        const professionalId = professionalSelect?.value;
        const date = dateInput?.value;
        const time = timeSelect?.value;
        const notes = $('#adminBookingNotes')?.value.trim() || null;
        const button = $('#saveAdminBooking');

        if (!clientId || !serviceId || !professionalId || !date || !time) {
            toast('Selecione cliente, serviço, profissional, data e horário.');
            return;
        }

        if (button) {
            button.disabled = true;
            button.textContent = 'Agendando...';
        }

        const service = activeServices.find(s => s.id === serviceId);
        const requestedStart = timeToMinutes(time);
        const requestedDuration = Number(service?.duration) || 30;
        const requestedEnd = requestedStart + requestedDuration;

        const { data: existingBookings = [], error: checkError } = await sb
            .from('bookings')
            .select('id,booking_time,service_id,status')
            .eq('professional_id', professionalId)
            .eq('booking_date', date)
            .neq('status', 'cancelled');

        if (checkError) {
            console.error('Erro ao verificar horário:', checkError);
            toast('Não foi possível verificar o horário.');
            if (button) { button.disabled = false; button.textContent = 'Confirmar agendamento'; }
            return;
        }

        const durationMap = new Map(activeServices.map(s => [s.id, Number(s.duration) || 30]));
        const conflict = (Array.isArray(existingBookings) ? existingBookings : []).some(b => {
            const start = timeToMinutes(String(b.booking_time || '').slice(0, 5));
            const bookedEnd = start + (durationMap.get(b.service_id) || 30);
            return requestedStart < bookedEnd && requestedEnd > start;
        });
        if (conflict) {
            toast('Esse horário conflita com outro agendamento. Escolha outro.');
            await carregarHorariosAdmin();
            if (button) { button.disabled = false; button.textContent = 'Confirmar agendamento'; }
            return;
        }

        const { error } = await sb.from('bookings').insert({
            user_id: clientId,
            service_id: serviceId,
            professional_id: professionalId,
            booking_date: date,
            booking_time: time + ':00',
            status: 'confirmed',
            notes
        });

        if (error) {
            console.error('Erro ao criar agendamento pelo administrador:', error);
            if (error.code === '23505') {
                toast('Este horário acabou de ser reservado por outro agendamento. Escolha outro.');
                await carregarHorariosAdmin();
            } else {
                toast(error.message || 'Não foi possível realizar o agendamento.');
            }
            if (button) { button.disabled = false; button.textContent = 'Confirmar agendamento'; }
            return;
        }

        toast('Agendamento criado com sucesso!');
        close();
        await agenda();
    });

    await carregarHorariosAdmin();
}

/* =========================================================
   EVENTOS GERAIS
   ========================================================= */

document.addEventListener(
    'click',
    async e => {

        /* -------------------------
           NOVO AGENDAMENTO ADMIN
           ------------------------- */

        const newAdminBooking =
            e.target.closest(
                '[data-admin-new-booking]'
            );

        if (newAdminBooking) {

            if (!isAdmin()) {
                toast('Acesso restrito ao administrador.');
                return;
            }

            await novoAgendamentoAdmin();
            return;
        }


        /* -------------------------
           EDITAR SERVIÇO
           ------------------------- */

        const editService =
            e.target.closest(
                '[data-service-edit]'
            );


        if (editService) {

            if (!isAdmin()) {

                toast(
                    'Acesso restrito ao administrador.'
                );

                return;
            }


            await editarServico(
                editService.dataset
                    .serviceEdit
            );


            return;
        }


        /* -------------------------
           ATIVAR / DESATIVAR SERVIÇO
           ------------------------- */

        const serviceToggle =
            e.target.closest(
                '[data-service-toggle]'
            );


        if (serviceToggle) {

            if (!isAdmin()) {

                toast(
                    'Acesso restrito ao administrador.'
                );

                return;
            }


            const service =
                services.find(
                    s =>
                        s.id ===
                        serviceToggle
                            .dataset
                            .serviceToggle
                );


            if (!service) {
                return;
            }


            const {
                error
            } =
                await sb
                    .from('services')
                    .update({

                        active:
                            !service.active

                    })
                    .eq(
                        'id',
                        service.id
                    );


            if (error) {

                console.error(
                    'Erro ao alterar serviço:',
                    error
                );


                toast(
                    'Não foi possível alterar o serviço.'
                );

                return;
            }


            toast(
                service.active
                    ? 'Serviço desativado.'
                    : 'Serviço ativado.'
            );


            await loadServices();

            return;
        }


        /* -------------------------
           EXCLUIR SERVIÇO
           ------------------------- */

        const serviceDelete = e.target.closest('[data-service-delete]');
        if (serviceDelete) {
            if (!isAdmin()) { toast('Acesso restrito ao administrador.'); return; }
            const id = serviceDelete.dataset.serviceDelete;
            const service = services.find(s => s.id === id);
            if (!service) return;
            if (!confirm(`Excluir o serviço "${service.name || 'Serviço'}"?`)) return;
            const { error } = await sb.from('services').delete().eq('id', id);
            if (error) { toast(error.message || 'Não foi possível excluir o serviço. Se houver agendamentos vinculados, desative-o.'); return; }
            toast('Serviço excluído.');
            await loadServices();
            return;
        }

        /* -------------------------
           HORÁRIO DO CLIENTE
           ------------------------- */

        const timeButton =
            e.target.closest(
                '[data-booking-time]'
            );


        if (timeButton) {

            if (!isClient()) {
                return;
            }


            $$('.time-option')
                .forEach(
                    button =>
                        button.classList.remove(
                            'selected'
                        )
                );


            timeButton.classList.add(
                'selected'
            );


            atualizarResumoAgendamento(
                timeButton.dataset
                    .bookingTime
            );


            return;
        }


        /* -------------------------
           STATUS DO AGENDAMENTO
           ------------------------- */

        const statusButton =
            e.target.closest(
                '[data-status-booking]'
            );


        if (statusButton) {

            if (!isAdmin()) {

                toast(
                    'Acesso restrito ao administrador.'
                );

                return;
            }


            const bookingId =
                statusButton.dataset
                    .statusBooking;


            const newStatus =
                statusButton.dataset
                    .status;


            if (
                !bookingId ||
                !newStatus
            ) {
                return;
            }


            let statusText =
                'Confirmado';


            if (
                newStatus ===
                'in_progress'
            ) {

                statusText =
                    'Em atendimento';

            }


            if (
                newStatus ===
                'completed'
            ) {

                statusText =
                    'Concluído';

            }


            /*
               Conclusão de atendimento: o Supabase executa a alteração
               do status e o lançamento financeiro na mesma transação.
               O serviço fornece descrição e preço; o tipo será sempre
               entrada. O booking_id impede duplicidade.
            */
            if (newStatus === 'completed') {

                const {
                    data: completionData,
                    error: completionError
                } = await sb.rpc(
                    'complete_booking_and_register_finance',
                    {
                        p_booking_id: bookingId
                    }
                );

                if (completionError) {

                    console.error(
                        'Erro ao concluir atendimento e registrar financeiro:',
                        completionError
                    );

                    toast(
                        completionError.message?.includes('function')
                            ? 'Execute o SQL da V15 no Supabase para ativar o lançamento automático.'
                            : (completionError.message || 'Não foi possível concluir o atendimento.')
                    );

                    return;
                }

                const alreadyCompleted =
                    completionData?.already_completed === true;

                toast(
                    alreadyCompleted
                        ? 'Atendimento já estava concluído e o financeiro já foi registrado.'
                        : 'Atendimento concluído e lançado no financeiro como entrada.'
                );

                await agenda();

                return;
            }


            const {
                error
            } =
                await sb
                    .from('bookings')
                    .update({

                        status:
                            newStatus

                    })
                    .eq(
                        'id',
                        bookingId
                    );


            if (error) {

                console.error(
                    'Erro ao alterar status:',
                    error
                );


                toast(
                    'Não foi possível alterar o status.'
                );

                return;
            }


            toast(
                'Agendamento: ' +
                statusText
            );


            await agenda();

            return;
        }


        /* -------------------------
           CANCELAMENTO ADMIN
           ------------------------- */

        const cancelButton =
            e.target.closest(
                '[data-cancel]'
            );


        if (cancelButton) {

            if (!isAdmin()) {

                toast(
                    'Acesso restrito ao administrador.'
                );

                return;
            }


            const confirmar =
                confirm(
                    'Deseja cancelar este agendamento?'
                );


            if (!confirmar) {
                return;
            }


            const {
                error
            } =
                await sb
                    .from('bookings')
                    .update({

                        status:
                            'cancelled'

                    })
                    .eq(
                        'id',
                        cancelButton.dataset
                            .cancel
                    );


            if (error) {

                console.error(
                    'Erro ao cancelar:',
                    error
                );


                toast(
                    'Não foi possível cancelar o agendamento.'
                );

                return;
            }


            await agenda();


            toast(
                'Agendamento cancelado.'
            );


            return;
        }


        /* -------------------------
           CANCELAMENTO CLIENTE
           ------------------------- */

        const clientCancel =
            e.target.closest(
                '[data-client-cancel]'
            );


        if (clientCancel) {

            if (!isClient()) {

                toast(
                    'Acesso não permitido.'
                );

                return;
            }


            await cancelarMeuAgendamento(
                clientCancel.dataset
                    .clientCancel
            );


            return;
        }


        const clientDelete = e.target.closest('[data-client-delete]');
        if (clientDelete) {
            if (!isAdmin()) { toast('Acesso restrito ao administrador.'); return; }
            await excluirCliente(clientDelete.dataset.clientDelete);
            return;
        }

        const stockEdit = e.target.closest('[data-stock-edit]');
        if (stockEdit) { await editarEstoque(stockEdit.dataset.stockEdit); return; }

        const stockDelete = e.target.closest('[data-stock-delete]');
        if (stockDelete) { await excluirEstoque(stockDelete.dataset.stockDelete); return; }

        const stockAdjust = e.target.closest('[data-stock-adjust]');
        if (stockAdjust) { await ajustarEstoque(stockAdjust.dataset.stockAdjust, Number(stockAdjust.dataset.stockDelta || 0)); return; }

        const teamEdit = e.target.closest('[data-team-edit]');
        if (teamEdit) { await editarProfissional(teamEdit.dataset.teamEdit); return; }

        const teamStatus = e.target.closest('[data-team-status]');
        if (teamStatus) { await alterarStatusProfissional(teamStatus.dataset.teamStatus, teamStatus.dataset.teamNewStatus); return; }

        const teamDelete = e.target.closest('[data-team-delete]');
        if (teamDelete) { await excluirProfissional(teamDelete.dataset.teamDelete); return; }

        /* -------------------------
           WHATSAPP
           ------------------------- */

        const whatsapp =
            e.target.closest(
                '[data-wa]'
            );


        if (whatsapp) {

            if (!isAdmin()) {

                toast(
                    'Acesso restrito ao administrador.'
                );

                return;
            }


            window.open(
                'https://wa.me/' +
                whatsapp.dataset.wa +
                '?text=' +
                whatsapp.dataset.msg,
                '_blank'
            );


            return;
        }

    }
);


/* =========================================================
   EVENTOS DO CLIENTE
   ========================================================= */

if ($('#clientService')) {

    $('#clientService').onchange =
        async () => {

            if (!isClient()) {
                return;
            }


            atualizarResumoAgendamento(
                ''
            );


            await loadClientTimes();

        };
}


if ($('#clientProfessional')) {

    $('#clientProfessional').onchange =
        async () => {

            if (!isClient()) {
                return;
            }


            atualizarResumoAgendamento(
                ''
            );


            await loadClientTimes();

        };
}


if ($('#clientDate')) {

    $('#clientDate').onchange =
        async () => {
            if (!isClient()) return;
            const selected = $('#clientDate').value;
            if (selected < today()) {
                $('#clientDate').value = getInitialBookingDate();
                toast('Não é permitido selecionar uma data passada.');
            }
            const schedule = getScheduleForDate($('#clientDate').value);
            if (schedule.enabled === false) {
                toast('Este dia está sem expediente.');
            }
            atualizarResumoAgendamento('');
            await loadClientTimes();
        };
}


if ($('#confirmBooking')) {

    $('#confirmBooking').onclick =
        async () => {

            const button = $('#confirmBooking');

            if (button?.disabled) {
                return;
            }

            if (button) {
                button.disabled = true;
                button.textContent = 'Agendando...';
            }

            try {
                await createBooking();
            } finally {
                if (button) {
                    button.disabled = false;
                    button.textContent = 'Confirmar agendamento';
                }
            }
        };

}


if ($('#refreshClientBookings')) {

    $('#refreshClientBookings').onclick =
        consultarAgenda;

}


/* =========================================================
   MOBILE
   ========================================================= */

function configurarMobileNav() {

    const mobileButtons =
        $$('.mobile-nav [data-page]');


    if (!mobileButtons.length) {
        return;
    }


    /* =====================================================
       ADMINISTRADOR
       ===================================================== */

    if (isAdmin()) {

        mobileButtons.forEach(button => {

            button.style.display = '';

        });


        /* Restaurar botão inicial */

        const firstButton =
            mobileButtons[0];


        if (firstButton) {

            firstButton.dataset.page =
                'dashboard';


            firstButton.innerHTML = `
                ⌂
                <span>
                    Início
                </span>
            `;

        }


        return;
    }


    /* =====================================================
       CLIENTE
       ===================================================== */

    mobileButtons.forEach(button => {

        button.style.display =
            'none';

    });


    /* -------------------------
       BOTÃO 1 = CONSULTAR
       ------------------------- */

    const firstButton =
        mobileButtons[0];


    if (firstButton) {

        firstButton.style.display =
            '';


        firstButton.dataset.page =
            'consultar';


        firstButton.innerHTML = `
            🔎
            <span>
                Meus agendamentos
            </span>
        `;

    }


    /* -------------------------
       BOTÃO 2 = AGENDA
       ------------------------- */

    const agendaButton =
        mobileButtons.find(
            button =>
                button.dataset.page ===
                'agenda'
        );


    if (agendaButton) {

        agendaButton.style.display =
            '';


        agendaButton.innerHTML = `
            ▣
            <span>
                Agendar
            </span>
        `;

    }
}


/* =========================================================
   BOOT
   ========================================================= */

async function boot() {

    if (!configured()) {

        if ($('#configNotice')) {

            $('#configNotice')
                .classList
                .remove('hidden');

        }


        if ($('#loginForm')) {

            $('#loginForm').style.display =
                'none';

        }


        return;
    }


    const {
        data: {
            session
        }
    } =
        await sb.auth.getSession();


    if (
        session &&
        await user()
    ) {

        $('#appView')
            ?.classList
            .remove('hidden');


        $('#authView')
            ?.classList
            .add('hidden');


        if ($('#roleLabel')) {

            $('#roleLabel').textContent =
                profile.role === 'admin'
                    ? 'Administrador'
                    : 'Cliente';

        }


        aplicarPermissoesUI();


        configurarMobileNav();


        await loadSettings();
        ensureServiceDurationOptions();
        ensureAdminBookingButtons();


        if (
            profile.role ===
            'admin'
        ) {

            await loadProfessionals();

            go(
                'dashboard'
            );

        } else {

            await loadServices();

            await loadProfessionals();

            initClientBooking();

            go(
                'agenda'
            );

        }

    }


    /* =====================================================
       ALTERAÇÃO DE AUTENTICAÇÃO
       ===================================================== */

    sb.auth.onAuthStateChange(
        async (_event, session) => {

            if (session) {

                if (await user()) {

                    $('#appView')
                        ?.classList
                        .remove('hidden');


                    $('#authView')
                        ?.classList
                        .add('hidden');


                    if ($('#roleLabel')) {

                        $('#roleLabel')
                            .textContent =
                            profile.role === 'admin'
                                ? 'Administrador'
                                : 'Cliente';

                    }


                    aplicarPermissoesUI();


                    configurarMobileNav();


                    await loadSettings();


                    if (
                        profile.role ===
                        'admin'
                    ) {

                        await loadProfessionals();

                        go(
                            'dashboard'
                        );

                    } else {

                        await loadServices();

                        await loadProfessionals();

                        initClientBooking();

                        go(
                            'agenda'
                        );

                    }

                }

            } else {

                profile = null;


                $('#appView')
                    ?.classList
                    .add('hidden');


                $('#authView')
                    ?.classList
                    .remove('hidden');

            }

        }
    );


    if ($('#agendaDate')) {

        $('#agendaDate').value =
            today();

    }


    if ($('#financeDate')) {

        $('#financeDate').value =
            today();

    }

}


boot();